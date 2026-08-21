const express = require('express');
const { previewMiniSite, getAvatar, getShareCard } = require('../controllers/miniSiteController');

const router = express.Router();

// Prévisualisation du mini site par chemin, sans dépendre d'un sous-domaine.
// Le routage par header Host (middleware/miniSiteMiddleware.js) rend le même template.
router.get('/:slug/avatar.svg', getAvatar); // avant /:slug
router.get('/:slug/share.png', getShareCard);
router.get('/:slug', previewMiniSite);

module.exports = router;
