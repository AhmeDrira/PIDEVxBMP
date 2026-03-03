// backend/controllers/productController.js
const Product = require('../models/Product');

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
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create product', error: error.message });
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
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      // Vérifier si l'utilisateur a déjà voté
      const alreadyReviewed = product.reviews.find(r => r.user.toString() === req.user._id.toString());
      if (alreadyReviewed) return res.status(400).json({ message: 'Vous avez déjà noté ce produit' });

      const review = {
        user: req.user._id,
        rating: Number(rating),
        comment: comment || ''
      };

      product.reviews.push(review);
      product.numReviews = product.reviews.length;
      // Calcul de la nouvelle moyenne
      product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

      await product.save();
      res.status(201).json({ message: 'Review added' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  getMarketplaceProducts,
  createProductReview
};