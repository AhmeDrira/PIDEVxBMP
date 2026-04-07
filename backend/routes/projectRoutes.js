const express = require('express');
const router = express.Router();
const {
	createProject,
	getProjects,
	updateProject,
	deleteProject,
	uploadPersonalMaterialImage,
} = require('../controllers/projectController');
const { getMaterialRecommendations } = require('../controllers/recommendationController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Project CRUD
router.post('/', protect, createProject);
router.get('/', protect, getProjects);
router.put('/:id', protect, updateProject);
router.delete('/:id', protect, deleteProject);
router.post('/:id/personal-materials/:materialId/image', protect, upload.single('document'), uploadPersonalMaterialImage);

// Smart material recommendations
router.post('/:projectId/material-recommendations', protect, getMaterialRecommendations);

module.exports = router;