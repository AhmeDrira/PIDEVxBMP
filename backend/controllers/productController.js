// backend/controllers/productController.js
const Product = require('../models/Product');
const { logAction } = require('../utils/actionLogger');

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

    const newProduct = new Product({
      name,
      category,
      price,
      stock,
      description,
      status: calculateStatus(stock),
      manufacturer: req.user.id // L'ID vient du token
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

    const normalizedItems = items
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
      }))
      .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0);

    if (!normalizedItems.length) {
      return res.status(400).json({ message: 'Invalid cart items' });
    }

    const productIds = normalizedItems.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const productsMap = new Map(products.map((product) => [String(product._id), product]));

    let totalAmount = 0;
    const summaryItems = [];

    for (const item of normalizedItems) {
      const product = productsMap.get(String(item.productId));
      if (!product) {
        return res.status(404).json({ message: 'One or more products no longer exist' });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name}`,
        });
      }

      product.stock -= item.quantity;
      product.status = calculateStatus(product.stock);
      await product.save();

      totalAmount += product.price * item.quantity;
      summaryItems.push({
        productId: product._id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
      });
    }

    await logAction(req, {
      actionKey: 'marketplace.checkout',
      actionLabel: 'Purchased Materials',
      entityType: 'order',
      entityId: null,
      description: `${req.user.role} completed a marketplace checkout (${summaryItems.length} items).`,
      metadata: {
        itemCount: summaryItems.length,
        totalAmount,
        items: summaryItems,
      },
    });

    return res.status(200).json({
      message: 'Checkout completed successfully',
      itemCount: summaryItems.length,
      totalAmount,
      items: summaryItems,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to complete checkout', error: error.message });
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

    product.name = name;
    product.category = category;
    product.price = price;
    product.stock = stock;
    product.description = description;
    product.status = calculateStatus(stock); // Mise à jour automatique du statut

    const updatedProduct = await product.save();
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

    await product.deleteOne();
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
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create new review & rating
// @route   POST /api/products/:id/reviews
const createProductReview = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const value = Math.max(1, Math.min(5, Number(req.body?.rating)));
    if (!Number.isFinite(value)) {
      return res.status(400).json({ message: 'Invalid rating value' });
    }
    const product = await Product.findById(req.params.id).select('manufacturer reviews rating numReviews');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (String(product.manufacturer) === String(req.user._id)) {
      return res.status(403).json({ message: 'Not allowed to rate own product' });
    }
    if (req.user.role && !['artisan', 'expert'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not allowed to rate' });
    }
    const userId = String(req.user._id);
    const idx = product.reviews.findIndex((r) => String(r.user) === userId);
    if (idx >= 0) {
      const old = Number(product.reviews[idx].rating || 0);
      const total = Number(product.rating || 0) * Number(product.numReviews || 0);
      const newTotal = total - old + value;
      const newAvg = product.numReviews > 0 ? newTotal / product.numReviews : value;
      await Product.updateOne(
        { _id: product._id, 'reviews.user': req.user._id },
        {
          $set: {
            'reviews.$.rating': value,
            'reviews.$.comment': typeof req.body?.comment === 'string' ? req.body.comment : '',
            rating: newAvg,
          },
        }
      );
      return res.status(200).json({ message: 'Review updated', updated: true, rating: newAvg, numReviews: product.numReviews });
    } else {
      const newNum = (product.numReviews || 0) + 1;
      const newAvg = (((product.rating || 0) * (product.numReviews || 0)) + value) / newNum;
      await Product.updateOne(
        { _id: product._id },
        {
          $push: { reviews: { user: req.user._id, rating: value, comment: typeof req.body?.comment === 'string' ? req.body.comment : '' } },
          $set: { numReviews: newNum, rating: newAvg },
        }
      );
      return res.status(201).json({ message: 'Review added', created: true, rating: newAvg, numReviews: newNum });
    }
  } catch (error) {
    console.error('createProductReview error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  getMarketplaceProducts,
  createProductReview,
  checkoutProducts,
};
