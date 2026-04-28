const ProjectProposal  = require('../models/ProjectProposal');
const { User }         = require('../models/User');
const mongoose         = require('mongoose');
const Contract         = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');
const Notification     = require('../models/Notification');
const { createProposalMessage } = require('./messageController');

// ─── Helpers partagés ─────────────────────────────────────────────────────────

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

async function getActiveTemplate() {
  let tpl = await ContractTemplate.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (!tpl) tpl = await ContractTemplate.create({});
  return tpl;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_STATUSES = ['pending', 'negotiating', 'accepted', 'rejected', 'signed'];

// ─── @desc    Créer une nouvelle demande de projet (expert → artisan)
// ─── @route   POST /api/proposals
// ─── @access  Private (expert uniquement)
const createProposal = async (req, res) => {
  try {
    // Vérification du rôle
    if (req.user.role !== 'expert') {
      return res.status(403).json({ message: 'Only experts can submit project proposals' });
    }

    const { artisanId, description, localisation, proposedPrice, startDate } = req.body;

    // Validation des champs obligatoires
    const missingFields = [];
    if (!artisanId)      missingFields.push('artisanId');
    if (!description)    missingFields.push('description');
    if (!localisation)   missingFields.push('localisation');
    if (proposedPrice === undefined || proposedPrice === null || proposedPrice === '') missingFields.push('proposedPrice');
    if (!startDate)      missingFields.push('startDate');

    if (missingFields.length) {
      return res.status(400).json({ message: 'Missing required fields', missingFields });
    }

    // Validation de l'ID artisan
    if (!mongoose.Types.ObjectId.isValid(artisanId)) {
      return res.status(400).json({ message: 'Invalid artisan ID' });
    }

    // Vérification que l'artisan existe bien en base
    const artisan = await User.findById(artisanId);
    if (!artisan || artisan.role !== 'artisan') {
      return res.status(404).json({ message: 'Artisan not found' });
    }

    // Validation du prix
    const price = Number(proposedPrice);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: 'proposedPrice must be a valid non-negative number' });
    }

    // Validation de la date
    const parsedDate = new Date(startDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid startDate' });
    }

    // Création de la demande
    const proposal = await ProjectProposal.create({
      artisanId,
      expertId: req.user._id,
      description,
      localisation,
      proposedPrice: price,
      startDate: parsedDate,
      status: 'pending',
    });

    // Retourner la demande peuplée
    const populated = await ProjectProposal.findById(proposal._id)
      .populate('artisanId', 'firstName lastName email profilePhoto domain')
      .populate('expertId',  'firstName lastName email profilePhoto');

    // ── Auto-send message in conversation ────────────────────────────────────
    setImmediate(async () => {
      try {
        const artisan = populated.artisanId;
        const expert  = populated.expertId;
        await createProposalMessage({
          senderId:      expert._id,
          recipientId:   artisan._id,
          proposalId:    populated._id,
          messageType:   'price_proposal',
          proposedPrice: populated.proposedPrice,
          content:       `💰 ${expert.firstName} ${expert.lastName} vous propose un projet : « ${populated.description.slice(0, 80)}${populated.description.length > 80 ? '…' : ''} » — Budget : ${populated.proposedPrice.toLocaleString('fr-TN')} TND`,
        });
      } catch (msgErr) {
        console.error('Auto-message for new proposal error:', msgErr);
      }
    });
    // ─────────────────────────────────────────────────────────────────────────

    return res.status(201).json(populated);
  } catch (error) {
    console.error('createProposal error:', error);
    return res.status(500).json({ message: 'Server error while creating proposal' });
  }
};

// ─── @desc    Récupérer toutes les demandes reçues par un artisan
// ─── @route   GET /api/proposals/artisan/:artisanId
// ─── @access  Private
const getArtisanProposals = async (req, res) => {
  try {
    const { artisanId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(artisanId)) {
      return res.status(400).json({ message: 'Invalid artisan ID' });
    }

    // Un artisan ne peut voir que ses propres demandes
    if (
      req.user.role === 'artisan' &&
      req.user._id.toString() !== artisanId
    ) {
      return res.status(403).json({ message: 'Not authorized to view these proposals' });
    }

    const proposals = await ProjectProposal.find({ artisanId, artisanHidden: { $ne: true } })
      .populate('expertId', 'firstName lastName email profilePhoto domain')
      .sort({ createdAt: -1 });

    return res.status(200).json(proposals);
  } catch (error) {
    console.error('getArtisanProposals error:', error);
    return res.status(500).json({ message: 'Server error while fetching artisan proposals' });
  }
};

// ─── @desc    Récupérer toutes les demandes envoyées par un expert
// ─── @route   GET /api/proposals/expert/:expertId
// ─── @access  Private
const getExpertProposals = async (req, res) => {
  try {
    const { expertId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(expertId)) {
      return res.status(400).json({ message: 'Invalid expert ID' });
    }

    // Un expert ne peut voir que ses propres demandes
    if (
      req.user.role === 'expert' &&
      req.user._id.toString() !== expertId
    ) {
      return res.status(403).json({ message: 'Not authorized to view these proposals' });
    }

    const proposals = await ProjectProposal.find({ expertId, expertHidden: { $ne: true } })
      .populate('artisanId', 'firstName lastName email profilePhoto domain location')
      .sort({ createdAt: -1 });

    return res.status(200).json(proposals);
  } catch (error) {
    console.error('getExpertProposals error:', error);
    return res.status(500).json({ message: 'Server error while fetching expert proposals' });
  }
};

// ─── @desc    Mettre à jour le statut d'une demande
// ─── @route   PUT /api/proposals/:id/status
// ─── @access  Private
const updateProposalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid proposal ID' });
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const proposal = await ProjectProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    // Seul l'artisan concerné ou l'expert concerné peut modifier le statut
    const userId = req.user._id.toString();
    const isParty =
      proposal.artisanId.toString() === userId ||
      proposal.expertId.toString() === userId;

    if (!isParty) {
      return res.status(403).json({ message: 'Not authorized to update this proposal' });
    }

    proposal.status = status;
    await proposal.save();

    const updated = await ProjectProposal.findById(id)
      .populate('artisanId', 'firstName lastName email profilePhoto domain')
      .populate('expertId',  'firstName lastName email profilePhoto');

    return res.status(200).json(updated);
  } catch (error) {
    console.error('updateProposalStatus error:', error);
    return res.status(500).json({ message: 'Server error while updating proposal status' });
  }
};

// ─── @desc    Mettre à jour le prix négocié
// ─── @route   PUT /api/proposals/:id/price
// ─── @access  Private
const updateNegotiatedPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { negotiatedPrice } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid proposal ID' });
    }

    const price = Number(negotiatedPrice);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: 'negotiatedPrice must be a valid non-negative number' });
    }

    const proposal = await ProjectProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    const userId = req.user._id.toString();
    const isParty =
      proposal.artisanId.toString() === userId ||
      proposal.expertId.toString() === userId;

    if (!isParty) {
      return res.status(403).json({ message: 'Not authorized to update this proposal' });
    }

    proposal.negotiatedPrice = price;
    // Passer automatiquement en statut "negotiating" si encore "pending"
    if (proposal.status === 'pending') {
      proposal.status = 'negotiating';
    }
    await proposal.save();

    const updated = await ProjectProposal.findById(id)
      .populate('artisanId', 'firstName lastName email profilePhoto domain')
      .populate('expertId',  'firstName lastName email profilePhoto');

    return res.status(200).json(updated);
  } catch (error) {
    console.error('updateNegotiatedPrice error:', error);
    return res.status(500).json({ message: 'Server error while updating negotiated price' });
  }
};

// ─── @desc    Accepter définitivement une demande (artisan uniquement)
// ─── @route   PUT /api/proposals/:id/accept
// ─── @access  Private (artisan)
const acceptProposal = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid proposal ID' });
    }

    const proposal = await ProjectProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    // Seul l'artisan concerné peut accepter
    if (proposal.artisanId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the artisan can accept this proposal' });
    }

    // On ne peut accepter que si pending ou negotiating
    if (!['pending', 'negotiating'].includes(proposal.status)) {
      return res.status(400).json({
        message: `Cannot accept a proposal with status "${proposal.status}"`,
      });
    }

    proposal.status = 'accepted';
    await proposal.save();

    const updated = await ProjectProposal.findById(id)
      .populate('artisanId', 'firstName lastName email profilePhoto domain')
      .populate('expertId',  'firstName lastName email profilePhoto');

    // ── Auto-message "accepted" ───────────────────────────────────────────────
    setImmediate(async () => {
      try {
        const artisan    = updated.artisanId;
        const expert     = updated.expertId;
        const finalPrice = updated.negotiatedPrice ?? updated.proposedPrice;
        await createProposalMessage({
          senderId:      artisan._id,
          recipientId:   expert._id,
          proposalId:    updated._id,
          messageType:   'proposal_accepted',
          proposedPrice: finalPrice,
          content:       `✅ ${artisan.firstName} ${artisan.lastName} a accepté la proposition au prix de ${finalPrice.toLocaleString('fr-TN')} TND.`,
        });
      } catch (msgErr) {
        console.error('Auto-message for accepted proposal error:', msgErr);
      }
    });
    // ─────────────────────────────────────────────────────────────────────────

    // ── Auto-génération du contrat ────────────────────────────────────────────
    // Opération non-bloquante : si elle échoue, la réponse est déjà envoyée.
    setImmediate(async () => {
      try {
        const existing = await Contract.findOne({ proposalId: id });
        if (existing) return;   // déjà généré

        const artisan    = updated.artisanId;
        const expert     = updated.expertId;
        const finalPrice = updated.negotiatedPrice ?? updated.proposedPrice;
        const template   = await getActiveTemplate();

        const vars = {
          artisanName:  `${artisan.firstName} ${artisan.lastName}`,
          expertName:   `${expert.firstName} ${expert.lastName}`,
          description:  updated.description,
          localisation: updated.localisation,
          finalPrice:   finalPrice.toLocaleString('fr-TN'),
          startDate:    new Date(updated.startDate).toLocaleDateString('fr-TN', {
            day: '2-digit', month: 'long', year: 'numeric',
          }),
          createdAt:    new Date().toLocaleDateString('fr-TN', {
            day: '2-digit', month: 'long', year: 'numeric',
          }),
        };

        await Contract.create({
          proposalId: updated._id,
          artisanId:  artisan._id,
          expertId:   expert._id,
          content:    fillTemplate(template.content, vars),
          status:     'pending_expert_signature',   // expert signs first
        });
      } catch (contractErr) {
        console.error('Auto-contract generation error:', contractErr);
      }
    });
    // ─────────────────────────────────────────────────────────────────────────

    return res.status(200).json(updated);
  } catch (error) {
    console.error('acceptProposal error:', error);
    return res.status(500).json({ message: 'Server error while accepting proposal' });
  }
};

// ─── @desc    Refuser définitivement une demande (artisan ou expert)
// ─── @route   PUT /api/proposals/:id/reject
// ─── @access  Private (artisan ou expert concerné)
const rejectProposal = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid proposal ID' });
    }

    const proposal = await ProjectProposal.findById(id)
      .populate('artisanId', 'firstName lastName')
      .populate('expertId',  'firstName lastName');
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    const userId     = req.user._id.toString();
    const artisanStr = proposal.artisanId._id.toString();
    const expertStr  = proposal.expertId._id.toString();

    if (userId !== artisanStr && userId !== expertStr) {
      return res.status(403).json({ message: 'Not authorized to reject this proposal' });
    }

    if (!['pending', 'negotiating'].includes(proposal.status)) {
      return res.status(400).json({
        message: `Cannot reject a proposal with status "${proposal.status}"`,
      });
    }

    proposal.status = 'rejected';
    await proposal.save();

    const updated = await ProjectProposal.findById(id)
      .populate('artisanId', 'firstName lastName email profilePhoto domain')
      .populate('expertId',  'firstName lastName email profilePhoto');

    // ── Notification + message dans la conversation ───────────────────────────
    setImmediate(async () => {
      try {
        const senderRole   = userId === expertStr ? 'expert' : 'artisan';
        const recipientId  = senderRole === 'expert' ? updated.artisanId._id : updated.expertId._id;
        const senderUser   = senderRole === 'expert' ? updated.expertId : updated.artisanId;
        const senderName   = `${senderUser.firstName} ${senderUser.lastName}`;
        const finalPrice   = updated.negotiatedPrice ?? updated.proposedPrice;

        // Notification DB
        await Notification.create({
          type:      'proposal_rejected',
          title:     'Proposition refusée',
          message:   `${senderName} a refusé la proposition.`,
          recipient: recipientId,
          read:      false,
        });

        // Message spécial dans la conversation
        await createProposalMessage({
          senderId:      req.user._id,
          recipientId,
          proposalId:    proposal._id,
          messageType:   'proposal_rejected',
          proposedPrice: finalPrice,
          content:       `❌ ${senderName} a refusé la proposition.`,
        });
      } catch (notifErr) {
        console.error('rejectProposal notification/message error:', notifErr);
      }
    });
    // ─────────────────────────────────────────────────────────────────────────

    return res.status(200).json(updated);
  } catch (error) {
    console.error('rejectProposal error:', error);
    return res.status(500).json({ message: 'Server error while rejecting proposal' });
  }
};

// ─── @desc    Envoyer une contre-proposition (expert ou artisan)
// ─── @route   POST /api/proposals/:id/counter
// ─── @access  Private (expert ou artisan partie prenante)
const sendCounterProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { proposedPrice, message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid proposal ID' });
    }

    const price = Number(proposedPrice);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ message: 'proposedPrice must be a valid positive number' });
    }

    const proposal = await ProjectProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    // Vérifier que l'appelant est l'une des parties
    const userId     = req.user._id.toString();
    const artisanStr = proposal.artisanId.toString();
    const expertStr  = proposal.expertId.toString();

    if (userId !== artisanStr && userId !== expertStr) {
      return res.status(403).json({ message: 'Not authorized to counter this proposal' });
    }

    // On ne peut contre-proposer que si la demande est encore active
    if (!['pending', 'negotiating'].includes(proposal.status)) {
      return res.status(400).json({
        message: `Cannot counter a proposal with status "${proposal.status}"`,
      });
    }

    const senderRole = userId === expertStr ? 'expert' : 'artisan';

    // Ajouter à l'historique
    proposal.negotiationHistory.push({
      senderId:      req.user._id,
      senderRole,
      proposedPrice: price,
      message:       message || '',
      createdAt:     new Date(),
    });

    // Mettre à jour le prix courant et le dernier proposant
    proposal.currentPrice    = price;
    proposal.lastProposedBy  = senderRole;
    proposal.negotiatedPrice = price;          // aussi mis à jour pour compatibilité
    proposal.status          = 'negotiating';

    await proposal.save();

    const updated = await ProjectProposal.findById(id)
      .populate('artisanId', 'firstName lastName email profilePhoto domain')
      .populate('expertId',  'firstName lastName email profilePhoto');

    // ── Notification DB + message dans la conversation ───────────────────────
    setImmediate(async () => {
      try {
        const recipientId  = senderRole === 'expert' ? proposal.artisanId : proposal.expertId;
        const senderName   = senderRole === 'expert'
          ? `${updated.expertId.firstName} ${updated.expertId.lastName}`
          : `${updated.artisanId.firstName} ${updated.artisanId.lastName}`;

        // Notification
        await Notification.create({
          type:      'counter_proposal',
          title:     senderRole === 'expert' ? 'Nouvelle contre-offre' : 'Nouvelle contre-offre artisan',
          message:   `${senderName} a proposé un nouveau prix de ${price.toLocaleString('fr-TN')} TND${message ? ` : "${message.slice(0, 100)}"` : '.'}`,
          recipient: recipientId,
          read:      false,
        });

        // Message dans la conversation
        await createProposalMessage({
          senderId:      req.user._id,
          recipientId,
          proposalId:    proposal._id,
          messageType:   'counter_proposal',
          proposedPrice: price,
          content:       message ? `${message}` : '',
        });
      } catch (notifErr) {
        console.error('Counter-proposal notification/message error:', notifErr);
      }
    });
    // ─────────────────────────────────────────────────────────────────────────

    return res.status(200).json(updated);
  } catch (error) {
    console.error('sendCounterProposal error:', error);
    return res.status(500).json({ message: 'Server error while sending counter-proposal' });
  }
};

// ─── @desc    Hide a proposal from one side without deleting it for the other
// ─── @route   PUT /api/proposals/:id/hide
// ─── @access  Private (expert or artisan)
const hideProposal = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid proposal ID' });
    }

    const proposal = await ProjectProposal.findById(id);
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });

    const userId = req.user._id.toString();
    const role   = req.user.role;

    if (role === 'expert' && proposal.expertId.toString() === userId) {
      proposal.expertHidden = true;
    } else if (role === 'artisan' && proposal.artisanId.toString() === userId) {
      proposal.artisanHidden = true;
    } else {
      return res.status(403).json({ message: 'Not authorized to hide this proposal' });
    }

    await proposal.save();
    return res.status(200).json({ message: 'Proposal hidden successfully' });
  } catch (error) {
    console.error('hideProposal error:', error);
    return res.status(500).json({ message: 'Server error while hiding proposal' });
  }
};

module.exports = {
  createProposal,
  getArtisanProposals,
  getExpertProposals,
  updateProposalStatus,
  updateNegotiatedPrice,
  acceptProposal,
  rejectProposal,
  sendCounterProposal,
  hideProposal,
};
