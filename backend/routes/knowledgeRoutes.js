const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { protect, admin } = require('../middleware/authMiddleware');
const knowledgeController = require('../controllers/knowledgeController');

// Store uploaded knowledge attachments on disk (served via backend/app.js -> /uploads)
const attachmentsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/knowledge-attachments');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const base = path.basename(file.originalname || 'attachment', ext);
    const safeBase = base.replace(/[^a-z0-9-_]/gi, '');
    cb(null, `${safeBase}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: attachmentsStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});

router.get('/', knowledgeController.listArticles);
router.get('/:id', protect, knowledgeController.getArticleById);

router.post('/', protect, admin, upload.array('attachments', 10), knowledgeController.createArticle);
router.put('/:id', protect, admin, upload.array('attachments', 10), knowledgeController.updateArticle);

router.post('/:id/like', protect, knowledgeController.likeArticle);

router.delete('/:id', protect, admin, knowledgeController.deleteArticle);

module.exports = router;
