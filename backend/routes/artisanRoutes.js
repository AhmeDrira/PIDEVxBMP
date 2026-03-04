const express = require('express');
const {
  getAllArtisans,
  getArtisanById,
  searchArtisans,
} = require('../controllers/artisanController');

const router = express.Router();

router.get('/', getAllArtisans);
router.get('/search', searchArtisans); // MUST be before /:id
router.get('/:id', getArtisanById);

module.exports = router;
