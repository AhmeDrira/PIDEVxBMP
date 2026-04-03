const express = require('express');
const router = express.Router();
const {
	createProject,
	getProjects,
	updateProject,
	uploadPersonalMaterialImage,
} = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware'); // On utilise ton middleware existant
const upload = require('../middleware/uploadMiddleware');

// Protège la route (seuls les utilisateurs connectés peuvent créer un projet)
router.post('/', protect, createProject);
router.get('/', protect, getProjects);
router.put('/:id', protect, updateProject);
router.post('/:id/personal-materials/:materialId/image', protect, upload.single('document'), uploadPersonalMaterialImage);

module.exports = router;