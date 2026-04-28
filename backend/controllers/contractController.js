const mongoose = require('mongoose');
const Contract         = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');
const ProjectProposal  = require('../models/ProjectProposal');
const Project          = require('../models/Project');
const CalendarEvent    = require('../models/CalendarEvent');
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
 * Si aucun template n'existe en base, en crée un par défaut.
 */
async function getActiveTemplate() {
  let tpl = await ContractTemplate.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (!tpl) {
    tpl = await ContractTemplate.create({});   // utilise les valeurs par défaut du schéma
  }
  return tpl;
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

    // Seuls artisan et expert concernés peuvent générer le contrat
    const userId = req.user._id.toString();
    const isParty =
      proposal.artisanId._id.toString() === userId ||
      proposal.expertId._id.toString()  === userId;

    if (!isParty) {
      return res.status(403).json({ message: 'Not authorized to generate this contract' });
    }

    // La proposition doit être acceptée (ou déjà signée)
    if (!['accepted', 'signed'].includes(proposal.status)) {
      return res.status(400).json({
        message: `Cannot generate a contract for a proposal with status "${proposal.status}". It must be "accepted" first.`,
      });
    }

    // Vérifier si un contrat existe déjà pour cette proposition
    const existing = await Contract.findOne({ proposalId })
      .populate('artisanId', 'firstName lastName email profilePhoto')
      .populate('expertId',  'firstName lastName email profilePhoto');

    if (existing) {
      return res.status(200).json(existing);
    }

    // Construire le contenu à partir du template
    const template = await getActiveTemplate();
    const artisan  = proposal.artisanId;
    const expert   = proposal.expertId;
    const finalPrice = proposal.negotiatedPrice ?? proposal.proposedPrice;

    const vars = {
      artisanName: `${artisan.firstName} ${artisan.lastName}`,
      expertName:  `${expert.firstName} ${expert.lastName}`,
      description: proposal.description,
      localisation: proposal.localisation,
      finalPrice:  finalPrice.toLocaleString('fr-TN'),
      startDate:   new Date(proposal.startDate).toLocaleDateString('fr-TN', {
        day: '2-digit', month: 'long', year: 'numeric',
      }),
      createdAt:   new Date().toLocaleDateString('fr-TN', {
        day: '2-digit', month: 'long', year: 'numeric',
      }),
    };

    const filledContent = fillTemplate(template.content, vars);

    // Créer le contrat
    const contract = await Contract.create({
      proposalId:  proposal._id,
      artisanId:   artisan._id,
      expertId:    expert._id,
      content:     filledContent,
      status:      'pending_artisan_signature',
    });

    // Passer le statut de la proposition à "signed" (en attente de signature)
    // Non — on garde "accepted" ; le statut passera à "signed" lors de la signature ÉTAPE 8.

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

// ─── @desc    Récupérer le template actif (admin ou consultation)
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

// ─── @desc    Signer électroniquement un contrat (artisan uniquement)
// ─── @route   PUT /api/contracts/:id/sign
// ─── @access  Private (artisan)
const signContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { signatureData } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid contract ID' });
    }

    // Validation de la signature (base64 data URL)
    if (
      !signatureData ||
      typeof signatureData !== 'string' ||
      !signatureData.startsWith('data:image/')
    ) {
      return res.status(400).json({ message: 'signatureData must be a valid base64 image data URL' });
    }

    // Vérification de la taille (max ~500 KB encodé)
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

    // Vérifier que le contrat est bien en attente de signature
    if (contract.status !== 'pending_artisan_signature') {
      return res.status(400).json({
        message: `Cannot sign a contract with status "${contract.status}"`,
      });
    }

    contract.signatureData    = signatureData;
    contract.signedByArtisanAt = new Date();
    contract.status           = 'signed';
    await contract.save();

    // Passer la proposition en statut "signed"
    await ProjectProposal.findByIdAndUpdate(contract.proposalId, { status: 'signed' });

    const updated = await Contract.findById(id)
      .populate('artisanId', 'firstName lastName email profilePhoto')
      .populate('expertId',  'firstName lastName email profilePhoto')
      .populate('proposalId');

    // ── Auto-création du projet collaboratif ──────────────────────────────────
    setImmediate(async () => {
      try {
        // Éviter la double-création
        const existingProject = await Project.findOne({ contractId: id });
        if (existingProject) return;

        const proposal = await ProjectProposal.findById(contract.proposalId)
          .populate('artisanId', 'firstName lastName')
          .populate('expertId',  'firstName lastName');

        if (!proposal) return;

        const finalPrice  = proposal.negotiatedPrice ?? proposal.proposedPrice;
        const startDate   = new Date(proposal.startDate);
        const endDate     = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);

        const expertName  = `${proposal.expertId.firstName} ${proposal.expertId.lastName}`;
        const shortDesc   = proposal.description.length > 60
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

        // Lier le projet au contrat
        await Contract.findByIdAndUpdate(id, { projectId: project._id });

        // Sync calendrier artisan
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

module.exports = {
  generateContract,
  getContractById,
  getContractByProposal,
  getMyContracts,
  getContractTemplate,
  updateContractTemplate,
  signContract,
};
