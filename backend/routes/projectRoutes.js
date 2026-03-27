const express = require('express');
const router = express.Router();
const { createProject,getProjects,updateProject } = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware'); // On utilise ton middleware existant

// Protège la route (seuls les utilisateurs connectés peuvent créer un projet)
router.post('/', protect, createProject);
router.get('/', protect, getProjects);
router.put('/:id', protect, updateProject);

module.exports = router;