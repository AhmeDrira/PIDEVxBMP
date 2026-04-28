const express = require('express');
const router  = express.Router();
const {
  generateContract,
  signExpertContract,
  signContract,
  getContractById,
  getContractByProposal,
  getMyContracts,
  getContractTemplate,
  updateContractTemplate,
} = require('../controllers/contractController');
const { protect } = require('../middleware/authMiddleware');

// GET    /api/contracts                           → Mes contrats
router.get('/', protect, getMyContracts);

// GET    /api/contracts/template                  → Template actif
router.get('/template', protect, getContractTemplate);

// PUT    /api/contracts/template                  → Modifier le template (admin)
router.put('/template', protect, updateContractTemplate);

// POST   /api/contracts/generate/:proposalId      → Générer depuis une proposition
router.post('/generate/:proposalId', protect, generateContract);

// GET    /api/contracts/by-proposal/:proposalId   → Contrat d'une proposition
router.get('/by-proposal/:proposalId', protect, getContractByProposal);

// POST   /api/contracts/:id/sign-expert           → Signature de l'expert (1er signataire)
router.post('/:id/sign-expert', protect, signExpertContract);

// PUT    /api/contracts/:id/sign                  → Signature de l'artisan (2ème signataire)
router.put('/:id/sign', protect, signContract);

// GET    /api/contracts/:id                       → Contrat par ID
router.get('/:id', protect, getContractById);

module.exports = router;
