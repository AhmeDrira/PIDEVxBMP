const mongoose = require('mongoose');
const Contract         = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');
const ProjectProposal  = require('../models/ProjectProposal');
const Project          = require('../models/Project');
const CalendarEvent    = require('../models/CalendarEvent');
const Notification     = require('../models/Notification');
const { User }         = require('../models/User');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Remplace les variables {{key}} dans le template par les valeurs réelles.
 */
function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

/**
 * Récupère ou crée le template actif.
 */
async function getActiveTemplate() {
  let tpl = await ContractTemplate.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (!tpl) {
    tpl = await ContractTemplate.create({});
  }
  return tpl;
}

/**
 * Crée une notification pour un utilisateur.
 */
async function createContractNotification({ recipient, type, title, message, contractId }) {
  try {
    await Notification.create({
      type,
      title,
      message,
      relatedId: contractId,
      relatedModel: 'Contract',
      recipient,
      read: false,
    });
  } catch (err) {
    console.error('createContractNotification error:', err);
  }
}

// ─── @desc    Générer un contrat à partir d'une proposition acceptée
// ─── @route   POST /api/contracts/generate/:proposalId
// ─── @access  Private (artisan ou expert de la proposition)
const generateContract = async (req, res) => {
  try {
    const { proposalId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(proposalId)) {
      return res.status(400).json({ message: 'Invalid proposal ID' });
    }

    const proposal = await ProjectProposal.findById(proposalId)
      .populate('artisanId', 'firstName lastName email')
      .populate('expertId',  'firstName lastName email');

    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    const userId = req.user._id.toString();
    const isParty =
      proposal.artisanId._id.toString() === userId ||
      proposal.expertId._id.toString()  === userId;

    if (!isParty) {
      return res.status(403).json({ message: 'Not authorized to generate this contract' });
    }

    if (!['accepted', 'signed'].includes(proposal.status)) {
      return res.status(400).json({
        message: `Cannot generate a contract for a proposal with status "${proposal.status}". It must be "accepted" first.`,
      });
    }

    // Vérifier si un contrat existe déjà
    const existing = await Contract.findOne({ proposalId });

    if (existing) {
      // ── Correction des anciens contrats ──────────────────────────────────────
      // Si le contrat existe mais n'a pas de signature expert ET est dans un
      // statut incorrect (ancien code générait pending_artisan_signature directement),
      // on le remet dans le bon état : pending_expert_signature
      if (
        !existing.signedByExpertAt &&
        !existing.signatureDataExpert &&
        existing.status === 'pending_artisan_signature'
      ) {
        existing.status = 'pending_expert_signature';
        await existing.save();
      }

      const populated = await Contract.findById(existing._id)
        .populate('artisanId', 'firstName lastName email profilePhoto')
        .populate('expertId',  'firstName lastName email profilePhoto')
        .populate('proposalId');
      return res.status(200).json(populated);
    }

    // Construire le contenu à partir du template
    const template    = await getActiveTemplate();
    const artisan     = proposal.artisanId;
    const expert      = proposal.expertId;
    const finalPrice  = proposal.negotiatedPrice ?? proposal.proposedPrice;

    const vars = {
      artisanName:  `${artisan.firstName} ${artisan.lastName}`,
      expertName:   `${expert.firstName} ${expert.lastName}`,
      description:  proposal.description,
      localisation: proposal.localisation,
      finalPrice:   finalPrice.toLocaleString('fr-TN'),
      startDate:    new Date(proposal.startDate).toLocaleDateString('fr-TN', {
        day: '2-digit', month: 'long', year: 'numeric',
      }),
      createdAt:    new Date().toLocaleDateString('fr-TN', {
        day: '2-digit', month: 'long', year: 'numeric',
      }),
    };

    const filledContent = fillTemplate(template.content, vars);

    // Créer le contrat — l'expert signe EN PREMIER
    const contract = await Contract.create({
      proposalId: proposal._id,
      artisanId:  artisan._id,
      expertId:   expert._id,
      content:    filledContent,
      status:     'pending_expert_signature',
    });

    // Notifier l'expert qu'il doit signer en premier
    await createContractNotification({
      recipient:  expert._id,
      type:       'contract_pending_expert_signature',
      title:      'Contrat à signer',
      message:    `Un contrat a été généré pour votre proposition avec ${artisan.firstName} ${artisan.lastName}. Veuillez le signer en premier.`,
      contractId: contract._id,
    });

    const populated = await Contract.findById(contract._id)
      .populate('artisanId', 'firstName lastName email profilePhoto')
      .populate('expertId',  'firstName lastName email profilePhoto')
      .populate('proposalId');

    return res.status(201).json(populated);
  } catch (error) {
    console.error('generateContract error:', error);
    return res.status(500).json({ message: 'Server error while generating contract' });
  }
};

// ─── @desc    Signer électroniquement le contrat (expert — 1er signataire)
// ─── @route   POST /api/contracts/:id/sign-expert
// ─── @access  Private (expert)
const signExpertContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { signatureData } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid contract ID' });
    }

    if (
      !signatureData ||
      typeof signatureData !== 'string' ||
      !signatureData.startsWith('data:image/')
    ) {
      return res.status(400).json({ message: 'signatureData must be a valid base64 image data URL' });
    }

    if (signatureData.length > 700000) {
      return res.status(400).json({ message: 'Signature image is too large (max 500 KB)' });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    // Seul l'expert du contrat peut utiliser cette route
    if (contract.expertId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the expert can sign via this endpoint' });
    }

    // Le contrat doit être en attente de la signature de l'expert.
    // On accepte aussi 'pending_artisan_signature' pour les anciens contrats
    // créés avant la mise en place du workflow double signature (sans signedByExpertAt).
    const expertCanSign =
      contract.status === 'pending_expert_signature' ||
      (contract.status === 'pending_artisan_signature' && !contract.signedByExpertAt);

    if (!expertCanSign) {
      if (contract.signedByExpertAt) {
        return res.status(400).json({ message: 'You have already signed this contract.' });
      }
      return res.status(400).json({
        message: `Cannot sign: contract status is "${contract.status}"`,
      });
    }

    contract.signatureDataExpert = signatureData;
    contract.signedByExpertAt    = new Date();
    contract.status              = 'pending_artisan_signature';
    await contract.save();

    // Notifier l'artisan qu'il doit signer à son tour
    await createContractNotification({
      recipient:  contract.artisanId,
      type:       'contract_expert_signed',
      title:      'L\'expert a signé le contrat',
      message:    `L'expert a signé le contrat. Veuillez signer à votre tour pour valider l'accord.`,
      contractId: contract._id,
    });

    const updated = await Contract.findById(id)
      .populate('artisanId', 'firstName lastName email profilePhoto')
      .populate('expertId',  'firstName lastName email profilePhoto')
      .populate('proposalId');

    return res.status(200).json(updated);
  } catch (error) {
    console.error('signExpertContract error:', error);
    return res.status(500).json({ message: 'Server error while signing contract (expert)' });
  }
};

// ─── @desc    Signer électroniquement le contrat (artisan — 2ème signataire)
// ─── @route   PUT /api/contracts/:id/sign
// ─── @access  Private (artisan)
const signContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { signatureData } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid contract ID' });
    }

    if (
      !signatureData ||
      typeof signatureData !== 'string' ||
      !signatureData.startsWith('data:image/')
    ) {
      return res.status(400).json({ message: 'signatureData must be a valid base64 image data URL' });
    }

    if (signatureData.length > 700000) {
      return res.status(400).json({ message: 'Signature image is too large (max 500 KB)' });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    // Seul l'artisan du contrat peut signer
    if (contract.artisanId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the artisan can sign this contract' });
    }

    // Le contrat doit être en attente de la signature de l'artisan (l'expert a déjà signé)
    if (contract.status !== 'pending_artisan_signature') {
      return res.status(400).json({
        message: `Cannot sign: contract status is "${contract.status}" (expected "pending_artisan_signature")`,
      });
    }

    // Double sécurité : vérifier que l'expert a bien signé avant l'artisan
    if (!contract.signedByExpertAt || !contract.signatureDataExpert) {
      return res.status(400).json({
        message: 'The expert must sign the contract before the artisan can sign.',
      });
    }

    contract.signatureData     = signatureData;
    contract.signedByArtisanAt = new Date();
    contract.status            = 'signed';
    await contract.save();

    // Passer la proposition en statut "signed"
    await ProjectProposal.findByIdAndUpdate(contract.proposalId, { status: 'signed' });

    // Notifier l'expert que l'artisan a signé → contrat pleinement validé
    await createContractNotification({
      recipient:  contract.expertId,
      type:       'contract_fully_signed',
      title:      'Contrat signé par les deux parties',
      message:    `L'artisan a signé le contrat. Le contrat est maintenant pleinement validé et le projet sera créé automatiquement.`,
      contractId: contract._id,
    });

    // Notifier aussi l'artisan (confirmation)
    await createContractNotification({
      recipient:  contract.artisanId,
      type:       'contract_fully_signed',
      title:      'Contrat signé — projet en création',
      message:    `Les deux parties ont signé le contrat. Votre projet collaboratif sera créé automatiquement.`,
      contractId: contract._id,
    });

    const updated = await Contract.findById(id)
      .populate('artisanId', 'firstName lastName email profilePhoto')
      .populate('expertId',  'firstName lastName email profilePhoto')
      .populate('proposalId');

    // ── Auto-création du projet collaboratif ──────────────────────────────────
    setImmediate(async () => {
      try {
        const existingProject = await Project.findOne({ contractId: id });
        if (existingProject) return;

        const proposal = await ProjectProposal.findById(contract.proposalId)
          .populate('artisanId', 'firstName lastName')
          .populate('expertId',  'firstName lastName');

        if (!proposal) return;

        const finalPrice = proposal.negotiatedPrice ?? proposal.proposedPrice;
        const startDate  = new Date(proposal.startDate);
        const endDate    = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);

        const expertName = `${proposal.expertId.firstName} ${proposal.expertId.lastName}`;
        const shortDesc  = proposal.description.length > 60
          ? proposal.description.slice(0, 60) + '…'
          : proposal.description;

        const project = await Project.create({
          title:           `Projet avec ${expertName} - ${shortDesc}`,
          description:     proposal.description,
          location:        proposal.localisation,
          budget:          finalPrice,
          startDate,
          endDate,
          status:          'active',
          artisan:         proposal.artisanId._id,
          expertId:        proposal.expertId._id,
          contractId:      contract._id,
          proposalId:      proposal._id,
          isCollaborative: true,
        });

        await Contract.findByIdAndUpdate(id, { projectId: project._id });

        try {
          await CalendarEvent.create({
            artisanId:   proposal.artisanId._id,
            title:       project.title,
            type:        'projet',
            startDate:   project.startDate,
            endDate:     project.endDate,
            description: project.description,
            location:    project.location,
            projectId:   project._id,
            isPublic:    true,
          });
        } catch (calErr) {
          console.error('Calendar sync error on collaborative project:', calErr);
        }
      } catch (projErr) {
        console.error('Auto collaborative project creation error:', projErr);
      }
    });
    // ─────────────────────────────────────────────────────────────────────────

    return res.status(200).json(updated);
  } catch (error) {
    console.error('signContract error:', error);
    return res.status(500).json({ message: 'Server error while signing contract' });
  }
};

// ─── @desc    Récupérer un contrat par son ID
// ─── @route   GET /api/contracts/:id
// ─── @access  Private (artisan ou expert du contrat)
const getContractById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid contract ID' });
    }

    const contract = await Contract.findById(id)
      .populate('artisanId', 'firstName lastName email profilePhoto')
      .populate('expertId',  'firstName lastName email profilePhoto')
      .populate('proposalId');

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    const userId = req.user._id.toString();
    const isParty =
      contract.artisanId._id.toString() === userId ||
      contract.expertId._id.toString()  === userId;

    if (!isParty) {
      return res.status(403).json({ message: 'Not authorized to view this contract' });
    }

    return res.status(200).json(contract);
  } catch (error) {
    console.error('getContractById error:', error);
    return res.status(500).json({ message: 'Server error while fetching contract' });
  }
};

// ─── @desc    Récupérer le contrat lié à une proposition
// ─── @route   GET /api/contracts/by-proposal/:proposalId
// ─── @access  Private (artisan ou expert de la proposition)
const getContractByProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(proposalId)) {
      return res.status(400).json({ message: 'Invalid proposal ID' });
    }

    const contract = await Contract.findOne({ proposalId })
      .populate('artisanId', 'firstName lastName email profilePhoto')
      .populate('expertId',  'firstName lastName email profilePhoto')
      .populate('proposalId');

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found for this proposal' });
    }

    const userId = req.user._id.toString();
    const isParty =
      contract.artisanId._id.toString() === userId ||
      contract.expertId._id.toString()  === userId;

    if (!isParty) {
      return res.status(403).json({ message: 'Not authorized to view this contract' });
    }

    return res.status(200).json(contract);
  } catch (error) {
    console.error('getContractByProposal error:', error);
    return res.status(500).json({ message: 'Server error while fetching contract' });
  }
};

// ─── @desc    Récupérer tous les contrats de l'utilisateur connecté
// ─── @route   GET /api/contracts
// ─── @access  Private
const getMyContracts = async (req, res) => {
  try {
    const userId = req.user._id;
    const filter = req.user.role === 'artisan'
      ? { artisanId: userId }
      : { expertId: userId };

    const contracts = await Contract.find(filter)
      .populate('artisanId', 'firstName lastName email profilePhoto')
      .populate('expertId',  'firstName lastName email profilePhoto')
      .populate('proposalId', 'description localisation proposedPrice negotiatedPrice startDate status')
      .sort({ createdAt: -1 });

    return res.status(200).json(contracts);
  } catch (error) {
    console.error('getMyContracts error:', error);
    return res.status(500).json({ message: 'Server error while fetching contracts' });
  }
};

// ─── @desc    Récupérer le template actif
// ─── @route   GET /api/contracts/template
// ─── @access  Private
const getContractTemplate = async (req, res) => {
  try {
    const tpl = await getActiveTemplate();
    return res.status(200).json(tpl);
  } catch (error) {
    console.error('getContractTemplate error:', error);
    return res.status(500).json({ message: 'Server error while fetching template' });
  }
};

// ─── @desc    Mettre à jour le template (admin uniquement)
// ─── @route   PUT /api/contracts/template
// ─── @access  Private (admin)
const updateContractTemplate = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update the contract template' });
    }

    const { content, name } = req.body;
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ message: 'Template content is required' });
    }

    let tpl = await ContractTemplate.findOne({ isActive: true }).sort({ updatedAt: -1 });
    if (!tpl) {
      tpl = new ContractTemplate({});
    }

    tpl.content = content.trim();
    if (name) tpl.name = name.trim();
    await tpl.save();

    return res.status(200).json(tpl);
  } catch (error) {
    console.error('updateContractTemplate error:', error);
    return res.status(500).json({ message: 'Server error while updating template' });
  }
};

module.exports = {
  generateContract,
  signExpertContract,
  signContract,
  getContractById,
  getContractByProposal,
  getMyContracts,
  getContractTemplate,
  updateContractTemplate,
};
