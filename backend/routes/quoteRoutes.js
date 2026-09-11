const express = require('express');
const multer = require('multer');
const router = express.Router();

/**
 * Le plan importe ne sert qu'a un appel au modele : il reste en memoire et
 * disparait avec la requete. Le persister sur disque creerait une dette de
 * nettoyage et de volume pour un fichier jetable.
 */
const PLAN_MAX_SIZE = 20 * 1024 * 1024;
const PLAN_MIMETYPES = /^(image\/jpeg|image\/png|application\/pdf)$/;

const planUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PLAN_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (PLAN_MIMETYPES.test(file.mimetype)) return cb(null, true);
    // Le DWG est volontairement absent : aucune conversion libre fiable.
    return cb(new Error('Seuls les formats JPEG, PNG et PDF sont acceptés.'));
  },
});
const {
  getQuoteTemplates,
	computeQuoteTemplateLines,
	readPlanFile,
	detectTradeFromDescription,
	mapPlanReadingToTemplate,
	generateQuoteDraft,
	createQuote,
	getQuotes,
	updateQuoteStatus,
	downloadQuotePdf,
	deleteQuote,
} = require('../controllers/quoteController');
const { protect } = require('../middleware/authMiddleware');

// Modeles metier — avant les routes parametrees pour ne pas etre capture par /:id
router.get('/templates', protect, getQuoteTemplates);
router.post('/templates/:id/compute', protect, computeQuoteTemplateLines);
// Lecture du plan : un seul appel au modele, sans connaitre le metier.
router.post('/plan-reading', protect, planUpload.single('plan'), readPlanFile);
// Detection du metier depuis le texte libre : mots-cles, sans IA.
router.post('/detect-trade', protect, detectTradeFromDescription);
// Projection sur un metier : deterministe, sans IA, rejouable a volonte.
router.post('/templates/:id/map-reading', protect, mapPlanReadingToTemplate);

router.post('/ai-draft', protect, generateQuoteDraft);
router.post('/', protect, createQuote);
router.get('/', protect, getQuotes);
router.get('/:id/pdf', protect, downloadQuotePdf);
router.put('/:id/status', protect, updateQuoteStatus);
router.delete('/:id', protect, deleteQuote);

module.exports = router;