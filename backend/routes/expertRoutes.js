const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getCurrentExpert,
  updateExpertProfile,
} = require('../controllers/expertController');

const router = express.Router();

router.get('/test', (req, res) => {
  return res.json({ message: 'ok' });
});

router.get('/me', protect, getCurrentExpert);
router.put('/me', protect, updateExpertProfile);

module.exports = router;
