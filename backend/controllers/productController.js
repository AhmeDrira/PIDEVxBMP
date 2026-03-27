// backend/controllers/productController.js
const Product = require('../models/Product');
const Project = require('../models/Project');
const Invoice = require('../models/Invoice');
const ActionLog = require('../models/ActionLog');
const ProductPayment = require('../models/ProductPayment');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const { User } = require('../models/User');
const { logAction } = require('../utils/actionLogger');

let stripeClient = null;

const checkoutDebug = (requestId, step, payload = {}) => {
  console.log(`[checkout:${requestId}] ${step}`, payload);
};

const getStripeClient = () => {
  if (stripeClient) return stripeClient;

  const stripeSecret = process.env.STRIPE_SECRET_KEY || process.env.Stripe_Secret_key;
  if (!stripeSecret) {
    throw new Error('Stripe secret key is missing. Set STRIPE_SECRET_KEY in backend .env');
  }

  // Lazy load Stripe so the app can still boot without it in unrelated flows.
  // eslint-disable-next-line global-require
  const Stripe = require('stripe');
  stripeClient = new Stripe(stripeSecret);
  return stripeClient;
};

const MARKETPLACE_SHIPPING_TND = 15;

const getStripeCurrencyConfig = () => {
  const currency = String(process.env.STRIPE_CURRENCY || 'usd').trim().toLowerCase();
  const minorUnit = currency === 'tnd' ? 1000 : 100;
  return { currency, minorUnit };
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const normalizeUploadedPath = (filePath = '') => {
  const normalized = String(filePath || '').replace(/\\/g, '/').trim();
  if (!normalized) return '';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const toPublicAssetUrl = (value, req) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  return `${req.protocol}://${req.get('host')}${normalized}`;
};

const normalizeCheckoutItems = (rawItems = []) => rawItems
  .map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity),
    name: item.name,
    category: item.category,
    price: item.price,
    stock: item.stock,
    description: item.description,
    image: item.image,
  }))
  .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0);

const resolveManufacturerId = async (user) => {
  const candidateIds = [user?._id, user?.id]
    .map((v) => (v ? String(v) : ''))
    .filter(Boolean);

  for (const candidate of candidateIds) {
    const owner = await User.findById(candidate).select('_id');
    if (owner?._id) return owner._id;
  }

  const existingManufacturer = await User.findOne({ role: 'manufacturer' }).select('_id');
  if (existingManufacturer?._id) return existingManufacturer._id;

  const anyUser = await User.findOne({}).select('_id');
  if (anyUser?._id) return anyUser._id;

  return null;
};

const ensureCheckoutProductId = async (checkoutItem, user) => {
  const rawId = String(checkoutItem?.productId || '').trim();
  if (mongoose.Types.ObjectId.isValid(rawId)) {
    return rawId;
  }

  const name = String(checkoutItem?.name || '').trim();
  const category = String(checkoutItem?.category || '').trim();
  const parsedPrice = Number(checkoutItem?.price);
  const parsedStock = Number(checkoutItem?.stock);

  if (!name || !category || !Number.isFinite(parsedPrice)) {
    throw new Error('Invalid cart item: missing fallback data for static product');
  }

  const manufacturerId = await resolveManufacturerId(user);
  if (!manufacturerId) {
    throw new Error('No user available to attach static product');
  }

  const stock = Number.isFinite(parsedStock) ? parsedStock : 0;

  const ensured = await Product.findOneAndUpdate(
    { name, category },
    {
      $set: {
        price: parsedPrice,
        stock,
        description: checkoutItem?.description || '',
        image: checkoutItem?.image || '',
        status: calculateStatus(stock),
        isStaticProduct: true,
      },
      $setOnInsert: {
        manufacturer: manufacturerId,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
    },
  );

  return String(ensured._id);
};

const resolveCheckoutItemsProductIds = async (normalizedItems, user) => {
  const resolved = [];
  for (const item of normalizedItems) {
    const productId = await ensureCheckoutProductId(item, user);
    resolved.push({ ...item, productId });
  }
  return resolved;
};

const generateInvoiceNumber = () => {
  const currentYear = new Date().getFullYear();
  const randomCode = Math.floor(1000 + Math.random() * 9000);
  return `INV-${currentYear}-${randomCode}`;
};

const processMarketplaceCheckout = async ({ req, user, normalizedItems, stripeSessionId = null }) => {
  const productIds = normalizedItems.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const productsMap = new Map(products.map((product) => [String(product._id), product]));

  let materialsAmount = 0;
  const summaryItems = [];
  const paymentItems = [];
  const buyerId = user?._id || user?.id || null;

  for (const item of normalizedItems) {
    const product = productsMap.get(String(item.productId));
    if (!product) {
      throw new Error('One or more products no longer exist');
    }

    if (product.stock < item.quantity) {
      throw new Error(`Not enough stock for ${product.name}`);
    }

    product.stock -= item.quantity;
    product.status = calculateStatus(product.stock);

    // Remove products automatically from DB/marketplace when stock reaches 0.
    if (product.stock <= 0) {
      await product.deleteOne();
    } else {
      await product.save();
    }

    materialsAmount += product.price * item.quantity;
    summaryItems.push({
      productId: product._id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
    });
    paymentItems.push({
      productId: product._id,
      manufacturerId: product.manufacturer,
      name: product.name,
      quantity: item.quantity,
      price: Number(product.price || 0),
    });
  }

  const shippingAmount = MARKETPLACE_SHIPPING_TND;
  const taxAmount = 0;
  const totalAmount = materialsAmount + shippingAmount + taxAmount;

  let invoice = null;
  const artisanProject = await Project.findOne({ artisan: user._id }).sort({ createdAt: -1 }).select('_id title');
  if (artisanProject?._id) {
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(now.getDate() + 7);

    invoice = await Invoice.create({
      invoiceNumber: generateInvoiceNumber(),
      project: artisanProject._id,
      artisan: user._id,
      clientName: 'Marketplace Purchase',
      amount: totalAmount,
      description: `Marketplace checkout payment${stripeSessionId ? ` (Stripe session ${stripeSessionId})` : ''}`,
      issueDate: now,
      dueDate,
      status: 'paid',
      paidAmount: totalAmount,
      paymentProgress: 100,
      paymentPlan: {
        firstTranchePercent: 50,
        secondTranchePercent: 50,
        firstTrancheAmount: roundMoney(totalAmount / 2),
        secondTrancheAmount: roundMoney(totalAmount - roundMoney(totalAmount / 2)),
        firstTranchePaid: true,
        secondTranchePaid: true,
        firstTranchePaidAt: now,
        secondTranchePaidAt: now,
      },
      delivery: {
        status: 'none',
        timeline: [],
      },
    });
  }

  await logAction(req, {
    actionKey: stripeSessionId ? 'marketplace.checkout.stripe' : 'marketplace.checkout',
    actionLabel: 'Purchased Materials',
    entityType: 'order',
    entityId: invoice?._id ? String(invoice._id) : null,
    description: `${user.role} completed a marketplace checkout (${summaryItems.length} items).`,
    metadata: {
      itemCount: summaryItems.length,
      materialsAmount,
      shippingAmount,
      taxAmount,
      totalAmount,
      stripeSessionId,
      invoiceId: invoice?._id || null,
      items: summaryItems,
    },
  });

  let productPayment = null;
  if (buyerId && paymentItems.length) {
    if (stripeSessionId) {
      productPayment = await ProductPayment.findOne({
        user: buyerId,
        stripeSessionId,
      });
    }

    if (!productPayment) {
      productPayment = await ProductPayment.create({
        user: buyerId,
        items: paymentItems,
        totalAmount,
        currency: String(process.env.STRIPE_CURRENCY || 'usd').toUpperCase(),
        stripeSessionId: stripeSessionId || null,
        status: 'paid',
        paymentDate: new Date(),
      });
    }

    const manufacturerIds = [
      ...new Set(
        paymentItems
          .map((item) => String(item.manufacturerId || ''))
          .filter(Boolean)
      ),
    ];

    for (const recipientId of manufacturerIds) {
      try {
        await Notification.create({
          type: 'new_order',
          title: 'New Order Received',
          message: `You received a new order #${String(productPayment._id).slice(-6)}.`,
          relatedId: productPayment._id,
          relatedModel: 'ProductPayment',
          recipient: recipientId,
        });
      } catch (notifyError) {
        console.error('Failed to notify manufacturer for marketplace checkout:', notifyError);
      }
    }
  }

  return {
    itemCount: summaryItems.length,
    materialsAmount,
    shippingAmount,
    taxAmount,
    totalAmount,
    items: summaryItems,
    invoiceId: invoice?._id || null,
    paymentId: productPayment?._id || null,
  };
};

// Fonction pour déterminer le statut automatiquement selon le stock
const calculateStatus = (stock) => {
  if (stock <= 0) return 'out-of-stock';
  if (stock <= 10) return 'low-stock';
  return 'active';
};

// @desc    Get all products for the logged-in manufacturer
// @route   GET /api/products
const getProducts = async (req, res) => {
  try {
    // req.user est défini par ton middleware d'authentification
    const products = await Product.find({ manufacturer: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
};

// @desc    Create a new product
// @route   POST /api/products
const createProduct = async (req, res) => {
  try {
    const { name, category, price, stock, description } = req.body;
    const uploadedDocumentPath = normalizeUploadedPath(req.files?.document?.[0]?.path || '');
    const uploadedTechSheetPath = normalizeUploadedPath(req.files?.techSheet?.[0]?.path || '');
    const numericPrice = Number(price);
    const numericStock = Number(stock);

    const newProduct = new Product({
      name,
      category,
      price: Number.isFinite(numericPrice) ? numericPrice : 0,
      stock: Number.isFinite(numericStock) ? numericStock : 0,
      description,
      status: calculateStatus(Number.isFinite(numericStock) ? numericStock : 0),
      manufacturer: req.user.id, // L'ID vient du token
      documentUrl: uploadedDocumentPath || '',
      techSheetUrl: uploadedTechSheetPath || '',
      image: uploadedDocumentPath || undefined,
    });

    const savedProduct = await newProduct.save();

    await logAction(req, {
      actionKey: 'manufacturer.product.create',
      actionLabel: 'Added Marketplace Material',
      entityType: 'product',
      entityId: savedProduct._id,
      description: `Manufacturer added product \"${savedProduct.name}\" to marketplace.`,
      metadata: {
        name: savedProduct.name,
        category: savedProduct.category,
        price: savedProduct.price,
        stock: savedProduct.stock,
      },
    });

    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
};

// @desc    Checkout marketplace cart
// @route   POST /api/products/checkout
const checkoutProducts = async (req, res) => {
  try {
    if (!req.user || !['expert', 'artisan'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only expert or artisan accounts can checkout materials' });
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const normalizedItems = normalizeCheckoutItems(items);

    if (!normalizedItems.length) {
      return res.status(400).json({ message: 'Invalid cart items' });
    }

    const resolvedItems = await resolveCheckoutItemsProductIds(normalizedItems, req.user);

    const result = await processMarketplaceCheckout({
      req,
      user: req.user,
      normalizedItems: resolvedItems,
    });

    return res.status(200).json({
      message: 'Checkout completed successfully',
      ...result,
    });
  } catch (error) {
    if (error?.message?.includes('Not enough stock') || error?.message?.includes('no longer exist')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to complete checkout', error: error.message });
  }
};

// @desc    Create Stripe checkout session for marketplace cart
// @route   POST /api/products/checkout/create-session
const createStripeCheckoutSession = async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    checkoutDebug(requestId, 'create-session:start', {
      userId: req.user?._id || req.user?.id || null,
      role: req.user?.role || null,
    });

    if (!req.user || !['expert', 'artisan'].includes(req.user.role)) {
      checkoutDebug(requestId, 'create-session:forbidden-role', { role: req.user?.role || null });
      return res.status(403).json({ message: 'Only expert or artisan accounts can checkout materials' });
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const normalizedItems = normalizeCheckoutItems(items);
    checkoutDebug(requestId, 'create-session:items-normalized', {
      rawCount: items.length,
      normalizedCount: normalizedItems.length,
    });

    if (!normalizedItems.length) {
      checkoutDebug(requestId, 'create-session:invalid-items');
      return res.status(400).json({ message: 'Invalid cart items' });
    }

    const stripe = getStripeClient();
    const { currency, minorUnit } = getStripeCurrencyConfig();
    checkoutDebug(requestId, 'create-session:stripe-config', { currency, minorUnit });

    const resolvedItems = await resolveCheckoutItemsProductIds(normalizedItems, req.user);
    const productIds = resolvedItems.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    checkoutDebug(requestId, 'create-session:products-loaded', {
      requestedProducts: productIds.length,
      loadedProducts: products.length,
    });

    const productsMap = new Map(products.map((product) => [String(product._id), product]));

    const lineItems = [];
    let expectedMaterialsMinor = 0;

    for (const item of resolvedItems) {
      const product = productsMap.get(String(item.productId));
      if (!product) {
        return res.status(404).json({ message: 'One or more products no longer exist' });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Not enough stock for ${product.name}` });
      }

      const unitAmount = Math.round(Number(product.price) * minorUnit);
      expectedMaterialsMinor += unitAmount * item.quantity;

      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: product.name,
          },
          unit_amount: unitAmount,
        },
        quantity: item.quantity,
      });
    }

    lineItems.push({
      price_data: {
        currency,
        product_data: {
          name: 'Shipping',
        },
        unit_amount: Math.round(MARKETPLACE_SHIPPING_TND * minorUnit),
      },
      quantity: 1,
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    checkoutDebug(requestId, 'create-session:stripe-create', {
      appUrl,
      lineItemsCount: lineItems.length,
      expectedMaterialsMinor,
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${appUrl}/?artisanView=marketplace&payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?artisanView=marketplace&payment=cancel`,
      metadata: {
        userId: String(req.user._id || req.user.id),
        expectedMaterialsMinor: String(expectedMaterialsMinor),
      },
    });

    checkoutDebug(requestId, 'create-session:success', {
      sessionId: session.id,
      urlPresent: Boolean(session.url),
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    checkoutDebug(requestId, 'create-session:error', {
      message: error?.message,
      type: error?.type,
      code: error?.code,
      stackTop: error?.stack ? String(error.stack).split('\n').slice(0, 2).join(' | ') : undefined,
    });
    return res.status(500).json({ message: 'Failed to initialize Stripe checkout', requestId, error: error.message });
  }
};

// @desc    Confirm Stripe session and apply stock changes
// @route   POST /api/products/checkout/confirm-session
const confirmStripeCheckoutSession = async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    checkoutDebug(requestId, 'confirm-session:start', {
      userId: req.user?._id || req.user?.id || null,
      role: req.user?.role || null,
    });

    if (!req.user || !['expert', 'artisan'].includes(req.user.role)) {
      checkoutDebug(requestId, 'confirm-session:forbidden-role', { role: req.user?.role || null });
      return res.status(403).json({ message: 'Only expert or artisan accounts can checkout materials' });
    }

    const sessionId = String(req.body?.sessionId || '').trim();
    if (!sessionId) {
      checkoutDebug(requestId, 'confirm-session:missing-session-id');
      return res.status(400).json({ message: 'sessionId is required' });
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const normalizedItems = normalizeCheckoutItems(items);
    checkoutDebug(requestId, 'confirm-session:items-normalized', {
      sessionId,
      rawCount: items.length,
      normalizedCount: normalizedItems.length,
    });

    if (!normalizedItems.length) {
      checkoutDebug(requestId, 'confirm-session:invalid-items');
      return res.status(400).json({ message: 'Invalid cart items' });
    }

    const alreadyProcessed = await ActionLog.findOne({
      actionKey: 'marketplace.checkout.stripe',
      'metadata.stripeSessionId': sessionId,
      actorId: req.user._id,
    }).select('_id');

    if (alreadyProcessed) {
      checkoutDebug(requestId, 'confirm-session:already-processed', { sessionId });
      return res.status(200).json({
        message: 'Payment already processed',
        alreadyProcessed: true,
      });
    }

    const stripe = getStripeClient();
    const { minorUnit } = getStripeCurrencyConfig();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    checkoutDebug(requestId, 'confirm-session:stripe-session-loaded', {
      paymentStatus: session?.payment_status,
      amountTotal: session?.amount_total,
    });

    if (!session || session.payment_status !== 'paid') {
      return res.status(400).json({ message: 'Stripe payment is not completed' });
    }

    const resolvedItems = await resolveCheckoutItemsProductIds(normalizedItems, req.user);
    const productIds = resolvedItems.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const productsMap = new Map(products.map((product) => [String(product._id), product]));

    let expectedMaterialsMinor = 0;
    for (const item of resolvedItems) {
      const product = productsMap.get(String(item.productId));
      if (!product) {
        return res.status(404).json({ message: 'One or more products no longer exist' });
      }
      expectedMaterialsMinor += Math.round(Number(product.price) * minorUnit) * item.quantity;
    }

    const expectedTotalMinor = expectedMaterialsMinor + Math.round(MARKETPLACE_SHIPPING_TND * minorUnit);
    const stripeTotalMinor = Number(session.amount_total || 0);
    checkoutDebug(requestId, 'confirm-session:amount-compare', {
      expectedTotalMinor,
      stripeTotalMinor,
    });

    if (expectedTotalMinor !== stripeTotalMinor) {
      return res.status(400).json({ message: 'Payment amount mismatch. Please retry checkout.' });
    }

    const result = await processMarketplaceCheckout({
      req,
      user: req.user,
      normalizedItems: resolvedItems,
      stripeSessionId: sessionId,
    });

    return res.status(200).json({
      message: 'Payment confirmed and stock updated',
      ...result,
    });
  } catch (error) {
    checkoutDebug(requestId, 'confirm-session:error', {
      message: error?.message,
      type: error?.type,
      code: error?.code,
      stackTop: error?.stack ? String(error.stack).split('\n').slice(0, 2).join(' | ') : undefined,
    });
    return res.status(500).json({ message: 'Failed to confirm Stripe payment', requestId, error: error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const { name, category, price, stock, description } = req.body;
    
    // Vérifier si le produit existe
    let product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Vérifier si le manufacturer est bien le propriétaire du produit
    if (product.manufacturer.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to update this product' });
    }

    const uploadedDocumentPath = normalizeUploadedPath(req.files?.document?.[0]?.path || '');
    const uploadedTechSheetPath = normalizeUploadedPath(req.files?.techSheet?.[0]?.path || '');
    const numericPrice = Number(price);
    const numericStock = Number(stock);

    product.name = name;
    product.category = category;
    product.price = Number.isFinite(numericPrice) ? numericPrice : product.price;
    product.stock = Number.isFinite(numericStock) ? numericStock : product.stock;
    product.description = description;
    product.status = calculateStatus(product.stock); // Mise à jour automatique du statut

    if (uploadedDocumentPath) {
      product.documentUrl = uploadedDocumentPath;
      product.image = uploadedDocumentPath;
    }

    if (uploadedTechSheetPath) {
      product.techSheetUrl = uploadedTechSheetPath;
    }

    const updatedProduct = await product.save();

    await logAction(req, {
      actionKey: 'manufacturer.product.update',
      actionLabel: 'Updated Marketplace Material',
      entityType: 'product',
      entityId: updatedProduct._id,
      description: `Manufacturer updated product "${updatedProduct.name}".`,
      metadata: {
        name: updatedProduct.name,
        category: updatedProduct.category,
        price: updatedProduct.price,
        stock: updatedProduct.stock,
      },
    });

    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Vérifier si le manufacturer est bien le propriétaire
    if (product.manufacturer.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to delete this product' });
    }

    const deletedProductSnapshot = {
      _id: product._id,
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
    };

    await product.deleteOne();

    await logAction(req, {
      actionKey: 'manufacturer.product.delete',
      actionLabel: 'Deleted Marketplace Material',
      entityType: 'product',
      entityId: deletedProductSnapshot._id,
      description: `Manufacturer deleted product "${deletedProductSnapshot.name}".`,
      metadata: {
        name: deletedProductSnapshot.name,
        category: deletedProductSnapshot.category,
        price: deletedProductSnapshot.price,
        stock: deletedProductSnapshot.stock,
      },
    });

    res.status(200).json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
};

// @desc    Get ALL products for the marketplace (with manufacturer name)
// @route   GET /api/products/marketplace
const getMarketplaceProducts = async (req, res) => {
  try {
    // On récupère tous les produits et on "populate" pour avoir le nom de l'entreprise
    const products = await Product.find({})
      .populate('manufacturer', 'companyName firstName lastName')
      .sort({ createdAt: -1 });

    const currentUserId = String(req.user?._id || req.user?.id || '');
    const payload = products.map((product) => {
      const raw = typeof product.toObject === 'function' ? product.toObject() : product;
      const currentUserHasReviewed = currentUserId
        ? Array.isArray(raw?.reviews) && raw.reviews.some((review) => {
          const reviewUserId = review?.user?._id
            ? String(review.user._id)
            : review?.user
              ? String(review.user)
              : '';
          return reviewUserId === currentUserId;
        })
        : false;

      return {
        ...raw,
        image: toPublicAssetUrl(raw.documentUrl || raw.image || '', req) || raw.image,
        documentUrl: toPublicAssetUrl(raw.documentUrl || '', req) || raw.documentUrl,
        currentUserHasReviewed,
      };
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error('Marketplace fetch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Ensure a static marketplace product exists in DB
// @route   POST /api/products/ensure-static
const ensureStaticProduct = async (req, res) => {
  try {
    const { name, category, price, stock, description, image } = req.body || {};

    if (!name || !category || !Number.isFinite(Number(price))) {
      return res.status(400).json({ message: 'name, category and price are required' });
    }

    const resolveManufacturerId = async () => {
      const candidateIds = [req.user?._id, req.user?.id]
        .map((v) => (v ? String(v) : ''))
        .filter(Boolean);

      for (const candidate of candidateIds) {
        const owner = await User.findById(candidate).select('_id');
        if (owner?._id) return owner._id;
      }

      const existingManufacturer = await User.findOne({ role: 'manufacturer' }).select('_id');
      if (existingManufacturer?._id) return existingManufacturer._id;

      const anyUser = await User.findOne({}).select('_id');
      if (anyUser?._id) return anyUser._id;

      return null;
    };

    const manufacturerId = await resolveManufacturerId();
    if (!manufacturerId) {
      return res.status(500).json({ message: 'No user available to attach static product' });
    }

    const normalizedStock = Number.isFinite(Number(stock)) ? Number(stock) : 0;

    const ensured = await Product.findOneAndUpdate(
      { name, category },
      {
        $set: {
          price: Number(price),
          stock: normalizedStock,
          description: description || '',
          image: image || '',
          status: calculateStatus(normalizedStock),
          isStaticProduct: true,
        },
        $setOnInsert: {
          manufacturer: manufacturerId,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
        runValidators: true,
      }
    );

    const populated = await Product.findById(ensured._id)
      .populate('manufacturer', 'companyName firstName lastName');

    return res.status(200).json(populated);
  } catch (error) {
    console.error('ensureStaticProduct error:', error);
    return res.status(500).json({ message: 'Failed to ensure static product', error: error.message });
  }
};

// @desc    Create new review & rating
// @route   POST /api/products/:id/reviews
const createProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const reviewerId = req.user?._id || req.user?.id;
    if (!reviewerId) {
      return res.status(401).json({ message: 'Not authorized to review this product' });
    }

    const normalizedRating = Number(rating);
    if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Robust duplicate check: tolerate old review rows with missing/legacy user shape.
    const alreadyReviewed = Array.isArray(product.reviews) && product.reviews.some((r) => {
      if (!r) return false;
      const reviewUserId = r.user && r.user._id ? String(r.user._id) : r.user ? String(r.user) : '';
      return reviewUserId && reviewUserId === String(reviewerId);
    });
    if (alreadyReviewed) {
      return res.status(400).json({ message: 'You already rated this material' });
    }

    const review = {
      user: reviewerId,
      rating: normalizedRating,
      comment: comment || ''
    };

    product.reviews.push(review);
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((acc, item) => Number(item?.rating || 0) + acc, 0) / product.reviews.length;

    await product.save();
    return res.status(201).json({ message: 'Review added' });
  } catch (error) {
    console.error('createProductReview error:', error);
    return res.status(500).json({ message: 'Server error while adding review' });
  }
};

// @desc    Get all orders for a manufacturer
// @route   GET /api/products/orders
const getManufacturerOrders = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const products = await Product.find({ manufacturer: userId }).select('_id');
    const productIds = products.map((p) => p._id.toString());

    const orders = await ProductPayment.find({
      $or: [
        { 'items.manufacturerId': userId },
        { 'items.productId': { $in: productIds } }
      ]
    })
      .populate('user', 'firstName lastName companyName email')
      .populate('items.productId', 'documentUrl image')
      .sort({ paymentDate: -1 });

    const formattedOrders = orders.map((order) => {
      const manufacturerItems = order.items.filter((item) => {
        const pId = (item.productId && item.productId._id)
          ? item.productId._id.toString()
          : (item.productId ? item.productId.toString() : null);
        const mId = item.manufacturerId ? item.manufacturerId.toString() : null;

        return (mId === userId.toString()) || (pId && productIds.includes(pId));
      });

      const itemsWithImages = manufacturerItems.map((item) => {
        const productData = item.productId;
        return {
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          image: productData?.documentUrl || productData?.image || ''
        };
      });

      const productsList = manufacturerItems.map((item) => `${item.name} (x${item.quantity})`).join(', ');
      const manufacturerAmount = manufacturerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      return {
        id: order._id,
        stripeSessionId: order.stripeSessionId,
        customer: order.user ? (order.user.companyName || `${order.user.firstName} ${order.user.lastName}`) : 'Unknown Customer',
        customerEmail: order.user ? order.user.email : '',
        products: productsList,
        items: itemsWithImages,
        amount: manufacturerAmount,
        status: order.status === 'paid' ? 'processing' : order.status,
        date: new Date(order.paymentDate).toISOString().split('T')[0]
      };
    });

    res.status(200).json(formattedOrders);
  } catch (error) {
    console.error('getManufacturerOrders error:', error);
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
};

// @desc    Update order status
// @route   PUT /api/products/orders/:id/status
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;
    const userId = req.user._id || req.user.id;

    if (!['processing', 'shipped', 'delivered'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await ProductPayment.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const hasProductInOrder = order.items.some((item) =>
      item.manufacturerId && item.manufacturerId.toString() === userId.toString()
    );

    if (!hasProductInOrder && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    order.status = status;
    await order.save();

    try {
      await Notification.create({
        type: 'order_status_update',
        title: 'Order Status Updated',
        message: `Your order #${order._id.toString().slice(-6)} is now ${status}.`,
        relatedId: order._id,
        relatedModel: 'ProductPayment',
        recipient: order.user,
      });
    } catch (err) {
      console.error('Failed to create notification for artisan:', err);
    }

    res.status(200).json({ message: `Order status updated to ${status}`, status });
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ message: 'Failed to update order status', error: error.message });
  }
};

// @desc    Get manufacturer sales analytics
// @route   GET /api/products/analytics
const getManufacturerAnalytics = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const manufacturerId = String(userId);

    const payments = await ProductPayment.find({
      'items.manufacturerId': manufacturerId,
      status: { $in: ['paid', 'shipped', 'delivered'] }
    });

    let totalRevenue = 0;
    const totalOrders = payments.length;
    const productSalesMap = {};

    payments.forEach((payment) => {
      payment.items.forEach((item) => {
        if (String(item.manufacturerId) === manufacturerId) {
          const itemTotal = item.price * item.quantity;
          totalRevenue += itemTotal;

          if (!productSalesMap[item.name]) {
            productSalesMap[item.name] = { name: item.name, sales: 0, units: 0 };
          }
          productSalesMap[item.name].sales += itemTotal;
          productSalesMap[item.name].units += item.quantity;
        }
      });
    });

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const activeProductsCount = await Product.countDocuments({ manufacturer: userId });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyData = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < 6; i += 1) {
      const targetMonth = new Date(sixMonthsAgo);
      targetMonth.setMonth(sixMonthsAgo.getMonth() + i);
      const monthLabel = monthNames[targetMonth.getMonth()];

      const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59);

      const monthPayments = payments.filter((p) => p.paymentDate >= startOfMonth && p.paymentDate <= endOfMonth);

      let monthSales = 0;
      monthPayments.forEach((p) => {
        p.items.forEach((item) => {
          if (String(item.manufacturerId) === manufacturerId) {
            monthSales += (item.price * item.quantity);
          }
        });
      });

      monthlyData.push({
        month: monthLabel,
        sales: monthSales,
        orders: monthPayments.length
      });
    }

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    res.status(200).json({
      stats: {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        activeProducts: activeProductsCount
      },
      monthlyData,
      topProducts
    });
  } catch (error) {
    console.error('getManufacturerAnalytics error:', error);
    res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
  }
};

module.exports = {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  getMarketplaceProducts,
  ensureStaticProduct,
  createProductReview,
  checkoutProducts,
  createStripeCheckoutSession,
  confirmStripeCheckoutSession,
  getManufacturerOrders,
  updateOrderStatus,
  getManufacturerAnalytics,
};