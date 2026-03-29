const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const {
  getAllArtisans,
  getArtisanById,
  searchArtisans,
  getMyPortfolio,
  addPortfolioItem,
  addPortfolioItemFromProject,
  updatePortfolioItem,
  deletePortfolioItem,
  addMediaToPortfolioItem,
  getPortfolioItemById,
  getArtisanPortfolio,
  getArtisanReviews,
  addArtisanReview,
  getPublicPortfolioItem,
} = require('../controllers/artisanController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const portfolioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/portfolio');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `portfolio-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const portfolioUpload = multer({
  storage: portfolioStorage,
  limits: { fileSize: 120 * 1024 * 1024 },
});

router.get('/me/portfolio', protect, getMyPortfolio);
router.post('/me/portfolio', protect, portfolioUpload.array('mediaFiles', 12), addPortfolioItem);
router.post('/me/portfolio/from-project/:projectId', protect, addPortfolioItemFromProject);
router.put('/me/portfolio/:itemId', protect, updatePortfolioItem);
router.post('/me/portfolio/:itemId/media', protect, portfolioUpload.array('mediaFiles', 12), addMediaToPortfolioItem);
router.delete('/me/portfolio/:itemId', protect, deletePortfolioItem);
router.get('/me/portfolio/:itemId', protect, getPortfolioItemById);

router.get('/', getAllArtisans);
router.get('/search', searchArtisans); // MUST be before /:id
router.get('/:id', getArtisanById);
router.get('/:id/portfolio', getArtisanPortfolio);
router.get('/:id/portfolio/:itemId', getPublicPortfolioItem);
router.get('/:id/reviews', getArtisanReviews);
router.post('/:id/reviews', protect, addArtisanReview);

module.exports = router;
