const express = require('express');
const router = express.Router();
const { 
  createProject, 
  getProjects, 
  updateProject,
  getProjectsByArtisan 
} = require('../controllers/projectController');

const { protect } = require('../middleware/authMiddleware');

// =========================
// Public Route (Expert view)
// =========================
router.get('/artisan/:artisanId', getProjectsByArtisan);

// =========================
// Private Routes (Artisan)
// =========================
router.post('/', protect, createProject);
router.get('/', protect, getProjects);
router.put('/:id', protect, updateProject);

module.exports = router;