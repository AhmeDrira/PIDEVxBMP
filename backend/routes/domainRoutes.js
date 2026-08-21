const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  checkSlug,
  getPublicArtisan,
  getMyDomain,
  updateMyDomain,
} = require('../controllers/domainController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Endpoint public : on borne le débit pour éviter l'énumération des slugs existants.
// 60 appels/minute laisse largement la place à une saisie clavier debouncée à 500 ms.
// Même configuration que les limiters de routes/authRoutes.js.
const checkSlugLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: 'Too many slug checks. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/check-slug', checkSlugLimiter, checkSlug);

// Profil public du mini site — aucune authentification
router.get('/public/artisan/:slug', getPublicArtisan);

// Mini site de l'artisan connecté
router.get('/artisan-domain/me', protect, getMyDomain);
router.put('/artisan-domain/me', protect, updateMyDomain);

module.exports = router;
