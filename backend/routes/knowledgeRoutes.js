const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const knowledgeController = require('../controllers/knowledgeController');

router.get('/', knowledgeController.listArticles);
router.get('/:id', knowledgeController.getArticleById);
router.post('/', protect, admin, knowledgeController.createArticle);
router.delete('/:id', protect, admin, knowledgeController.deleteArticle);

module.exports = router;
