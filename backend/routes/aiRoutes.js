/**
 * aiRoutes.js — BMP.tn
 * ──────────────────────────────────────────────────────────────────────────────
 * Routes pour les fonctionnalités d'IA locale.
 *
 * Préfixe monté dans app.js : /api/ai
 */

const express              = require('express');
const router               = express.Router();
const { projectAutofill }  = require('../controllers/aiController');
const { protect }          = require('../middleware/authMiddleware');

// POST /api/ai/project-autofill
// Body : { text: string }
// Auth : artisan connecté requis
router.post('/project-autofill', protect, projectAutofill);

module.exports = router;
