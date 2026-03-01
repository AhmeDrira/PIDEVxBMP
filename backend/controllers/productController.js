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
exports.getProducts = async (req, res) => {
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
exports.createProduct = async (req, res) => {
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
exports.updateProduct = async (req, res) => {
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
exports.deleteProduct = async (req, res) => {
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