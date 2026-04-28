const express = require('express');
const router = express.Router();
const {
  createProposal,
  getArtisanProposals,
  getExpertProposals,
  updateProposalStatus,
  updateNegotiatedPrice,
  acceptProposal,
  rejectProposal,
  sendCounterProposal,
  hideProposal,
} = require('../controllers/proposalController');
const { protect } = require('../middleware/authMiddleware');

// POST   /api/proposals            → Créer une demande (expert uniquement)
router.post('/', protect, createProposal);

// GET    /api/proposals/artisan/:artisanId → Demandes reçues par un artisan
router.get('/artisan/:artisanId', protect, getArtisanProposals);

// GET    /api/proposals/expert/:expertId   → Demandes envoyées par un expert
router.get('/expert/:expertId', protect, getExpertProposals);

// PUT    /api/proposals/:id/status  → Mettre à jour le statut
router.put('/:id/status', protect, updateProposalStatus);

// PUT    /api/proposals/:id/price   → Mettre à jour le prix négocié
router.put('/:id/price', protect, updateNegotiatedPrice);

// PUT    /api/proposals/:id/accept   → Accepter définitivement (artisan uniquement)
router.put('/:id/accept', protect, acceptProposal);

// PUT    /api/proposals/:id/reject   → Refuser définitivement (artisan ou expert)
router.put('/:id/reject', protect, rejectProposal);

// POST   /api/proposals/:id/counter  → Envoyer une contre-proposition (expert ou artisan)
router.post('/:id/counter', protect, sendCounterProposal);

// PUT    /api/proposals/:id/hide     → Hide from one side without deleting for the other
router.put('/:id/hide', protect, hideProposal);

module.exports = router;
