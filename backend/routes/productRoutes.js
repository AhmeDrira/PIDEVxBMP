// backend/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const { 
  getProducts, 
  createProduct, 
  updateProduct, 
  deleteProduct 
} = require('../controllers/productController');

// IMPORT IMPORTANT: Ton middleware qui vérifie le Token JWT
// Modifie le chemin ou le nom selon comment tu l'as appelé dans ton dossier middleware
const { protect } = require('../middleware/authMiddleware'); 

// Toutes les routes produits doivent être protégées (il faut être connecté)
router.route('/')
  .get(protect, getProducts)
  .post(protect, createProduct);

router.route('/:id')
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

module.exports = router;