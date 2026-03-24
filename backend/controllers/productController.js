const Product = require('../models/Product');

const calculateStatus = (stock) => {
  if (stock <= 0) return 'out-of-stock';
  if (stock <= 10) return 'low-stock';
  return 'active';
};

// @desc    Get all products
const getProducts = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const products = await Product.find({ manufacturer: userId }).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
};

// @desc    Create a new product
const createProduct = async (req, res) => {
  try {
    console.log("📥 --- NOUVELLE REQUÊTE DE CRÉATION DE PRODUIT ---");
    console.log("Données texte (req.body):", req.body);
    console.log("Fichiers reçus (req.files):", req.files);

    const { name, category, price, stock, description } = req.body;

    let documentUrl = '';
    let techSheetUrl = '';

    // Extraction des fichiers s'ils existent
    if (req.files) {
      if (req.files['document'] && req.files['document'][0]) {
        documentUrl = req.files['document'][0].path.replace(/\\/g, '/');
      }
      if (req.files['techSheet'] && req.files['techSheet'][0]) {
        techSheetUrl = req.files['techSheet'][0].path.replace(/\\/g, '/');
      }
    }

    const userId = req.user._id || req.user.id;
    console.log("ID du Fabricant:", userId);

    const newProduct = new Product({
      name,
      category,
      price: Number(price),
      stock: Number(stock),
      description,
      documentUrl,
      techSheetUrl,
      status: calculateStatus(Number(stock)),
      manufacturer: userId
    });

    const savedProduct = await newProduct.save();
    console.log("✅ Produit sauvegardé avec succès dans MongoDB:", savedProduct._id);
    
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error("❌ Erreur création produit:", error);
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
};

// @desc    Update a product
const updateProduct = async (req, res) => {
  try {
    const { name, category, price, stock, description } = req.body;
    
    let product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const userId = req.user._id || req.user.id;
    if (product.manufacturer.toString() !== userId.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    product.name = name || product.name;
    product.category = category || product.category;
    if (price !== undefined) product.price = Number(price);
    if (stock !== undefined) product.stock = Number(stock);
    product.description = description || product.description;
    
    if (req.files) {
      if (req.files['document'] && req.files['document'][0]) {
        product.documentUrl = req.files['document'][0].path.replace(/\\/g, '/');
      }
      if (req.files['techSheet'] && req.files['techSheet'][0]) {
        product.techSheetUrl = req.files['techSheet'][0].path.replace(/\\/g, '/');
      }
    }

    product.status = calculateStatus(product.stock);

    const updatedProduct = await product.save();
    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    
    const userId = req.user._id || req.user.id;
    if (product.manufacturer.toString() !== userId.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    await product.deleteOne();
    res.status(200).json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
};

const getMarketplaceProducts = async (req, res) => {
  try {
    const products = await Product.find({}).populate('manufacturer', 'companyName firstName lastName').sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const checkoutProducts = async (req, res) => {
  try {
    if (!req.user || !['expert', 'artisan'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only expert or artisan accounts can checkout materials' });
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ message: 'Cart is empty' });

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (product && product.stock >= item.quantity) {
        product.stock -= item.quantity;
        product.status = calculateStatus(product.stock);
        await product.save();
      }
    }
    return res.status(200).json({ message: 'Checkout completed successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to complete checkout', error: error.message });
  }
};

const createProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const userId = req.user._id || req.user.id;
    const alreadyReviewed = product.reviews.find(r => r.user.toString() === userId.toString());
    
    if (alreadyReviewed) return res.status(400).json({ message: 'Déjà noté' });
    
    const review = { user: userId, rating: Number(rating), comment: comment || '' };
    product.reviews.push(review);
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;
    
    await product.save();
    res.status(201).json({ message: 'Review added' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
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