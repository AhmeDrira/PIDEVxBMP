const express = require('express');
const router  = express.Router();
const {
  generateContract,
  getContractById,
  getContractByProposal,
  getMyContracts,
  getContractTemplate,
  updateContractTemplate,
  signContract,
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

// PUT    /api/contracts/:id/sign                  → Signer électroniquement (artisan)
router.put('/:id/sign', protect, signContract);

// GET    /api/contracts/:id                       → Contrat par ID
router.get('/:id', protect, getContractById);

module.exports = router;
