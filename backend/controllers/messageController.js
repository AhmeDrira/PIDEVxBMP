const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const ProjectProposal = require('../models/ProjectProposal');
const Contract = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');
const Notification = require('../models/Notification');
const { getIo } = require('../socket');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// ─── Contract helpers (shared with proposalController) ────────────────────────

function _fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

async function _getActiveTemplate() {
  let tpl = await ContractTemplate.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (!tpl) tpl = await ContractTemplate.create({});
  return tpl;
}

function extractGeminiText(responseData) {
  const candidates = Array.isArray(responseData?.candidates) ? responseData.candidates : [];
  if (!candidates.length) return '';

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const text = parts
      .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join(' ')
      .trim();
    if (text) return text;
  }

  return '';
}

function sanitizeGeneratedMessage(text) {
  return String(text || '')
    .replace(/```(?:[a-zA-Z0-9_-]+)?/g, ' ')
    .replace(/```/g, ' ')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text) {
  const cleaned = sanitizeGeneratedMessage(text);
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

function countSentences(text) {
  const cleaned = sanitizeGeneratedMessage(text);
  if (!cleaned) return 0;
  return cleaned
    .split(/[.!?\u061f]+/u)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

function isDraftMessageTooShort(text) {
  const cleaned = sanitizeGeneratedMessage(text);
  return !cleaned || countWords(cleaned) < 20 || countSentences(cleaned) < 2;
}

function isDraftMessageLikelyTruncated(text) {
  const cleaned = sanitizeGeneratedMessage(text);
  if (!cleaned) return true;
  if (/[.!?]$/.test(cleaned)) return false;

  const connectorEndings = [
    'et', 'ou', 'donc', 'car', 'mais', 'avec', 'sans', 'pour', 'que', 'qui', 'dont', 'si',
    'au', 'aux', 'en', 'dans', 'sur', 'vers', 'parce', 'parce que', 'afin', 'de', 'du', 'des',
  ];

  const lower = cleaned.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1] || '';
  const lastThree = words.slice(-3).join(' ');

  return connectorEndings.some((entry) => entry === lastWord || lastThree.endsWith(entry));
}

function finalizeGeneratedMessage(text) {
  const cleaned = sanitizeGeneratedMessage(text);
  if (!cleaned) return '';
  if (/[.!?]$/.test(cleaned)) return cleaned;
  return `${cleaned}.`;
}

function normalizeInstructionForFallback(aiInstruction) {
  let instruction = sanitizeGeneratedMessage(aiInstruction)
    .replace(/^['"«»\s]+|['"«»\s]+$/g, '')
    .trim();

  const wrappers = [
    /^je\s+veux\s+envoyer\s+un\s+message\s+qui\s+lui\s+dit\s+que\s*/i,
    /^je\s+veux\s+envoyer\s+un\s+message\s+pour\s+dire\s+que\s*/i,
    /^je\s+veux\s+envoyer\s+un\s+message\s*/i,
    /^redige\s+un\s+message\s*/i,
    /^r[ée]dige\s+un\s+message\s*/i,
    /^ecris\s+un\s+message\s*/i,
    /^[ée]cris\s+un\s+message\s*/i,
    /^message\s*:\s*/i,
  ];

  for (const pattern of wrappers) {
    instruction = instruction.replace(pattern, '').trim();
  }

  if (!instruction) {
    return 'vous transmettre une information importante concernant le suivi de notre echange';
  }

  instruction = instruction
    .replace(/^que\s+/i, '')
    .replace(/[.!?]+$/g, '')
    .trim();

  return instruction || 'vous transmettre une information importante concernant le suivi de notre echange';
}

function buildLocalDraftFallback({ aiInstruction, userRole }) {
  const opening = userRole === 'expert'
    ? 'Bonjour, en tant qu\'expert, je vous contacte pour le suivi technique de notre dossier.'
    : 'Bonjour, en tant qu\'artisan, je vous contacte au sujet de l\'avancement de notre chantier.';
  const normalized = normalizeInstructionForFallback(aiInstruction);

  return `${opening} Je souhaite vous informer que ${normalized}. Je vous prie de m\'excuser pour le desagrement occasionne et je vous remercie pour votre comprehension. Merci de me confirmer la bonne reception de ce message.`;
}

function getGeminiErrorMessage(error) {
  if (axios.isAxiosError(error)) {
    return String(
      error.response?.data?.error?.message
      || error.response?.data?.message
      || error.message
      || 'Gemini request failed'
    ).trim();
  }

  return String(error?.message || 'Gemini request failed').trim();
}

function isGeminiCapacityError(error) {
  const status = Number(error?.response?.status || error?.status || 0);
  const message = getGeminiErrorMessage(error).toLowerCase();

  if ([429, 500, 503].includes(status)) return true;

  return /quota exceeded|rate limit|resource_exhausted|temporarily unavailable|please retry/.test(message);
}

async function requestGeminiDraft({ endpoint, prompt, maxOutputTokens }) {
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens,
    },
  };

  const response = await axios.post(endpoint, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
  });

  return sanitizeGeneratedMessage(extractGeminiText(response.data));
}

const uploadsDir = path.join(__dirname, '..', 'uploads', 'messages');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const voiceUploadsDir = path.join(__dirname, '..', 'uploads', 'voice');
if (!fs.existsSync(voiceUploadsDir)) {
  fs.mkdirSync(voiceUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeBase = path.basename(file.originalname || 'file', ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const fileFilter = (_req, file, cb) => {
  if (allowedMimeTypes.has(file.mimetype)) return cb(null, true);
  return cb(new Error('Unsupported file type'));
};

exports.uploadAttachments = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
}).array('attachments', 5);

const voiceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, voiceUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeBase = `voice_${Date.now()}_${req.user ? req.user._id : 'unknown'}`;
    cb(null, `${safeBase}${ext}`);
  },
});

const voiceFileFilter = (_req, file, cb) => {
  const allowedVoiceMimeTypes = new Set(['audio/webm', 'audio/mpeg', 'audio/wav', 'audio/mp4']);
  if (allowedVoiceMimeTypes.has(file.mimetype)) return cb(null, true);
  return cb(new Error('Unsupported audio file type'));
};

exports.uploadVoice = multer({
  storage: voiceStorage,
  fileFilter: voiceFileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
}).single('voice');

exports.getMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { conversationId } = req.query;
    if (!conversationId) return res.status(400).json({ message: 'conversationId is required' });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversation introuvable' });
    if (!conversation.participants.some((p) => String(p) === String(userId))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const messages = await Message.find({ conversation: conversationId, deleted: { $ne: true } })
      .populate('sender', 'firstName lastName')
      .populate({ path: 'replyTo', select: 'content sender', populate: { path: 'sender', select: 'firstName lastName' } })
      .populate('reactions.user', 'firstName lastName')
      .sort({ createdAt: 1 });

    // Mark loaded messages as read for current user
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        deleted: { $ne: true },
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } }
    );

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors du chargement des messages' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { conversationId, content, replyTo } = req.body;
    if (!conversationId) return res.status(400).json({ message: 'conversationId required' });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversation introuvable' });
    if (!conversation.participants.some((p) => String(p) === String(userId))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    const blockedByMe = (conversation.blockedBy || []).some((id) => String(id) === String(userId));
    const otherParticipant = (conversation.participants || []).find((id) => String(id) !== String(userId));
    const blockedByOther = otherParticipant
      ? (conversation.blockedBy || []).some((id) => String(id) === String(otherParticipant))
      : false;
    if (blockedByMe) {
      return res.status(403).json({ message: 'You have blocked this user.' });
    }
    if (blockedByOther) {
      return res.status(403).json({ message: 'You cannot send messages because you are blocked by this user.' });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const trimmedContent = (content || '').trim();
    if (!trimmedContent && files.length === 0) {
      return res.status(400).json({ message: 'Message text or attachment required' });
    }

    const attachments = files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/messages/${file.filename}`,
    }));

    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      content: trimmedContent,
      attachments,
      replyTo: replyTo || null,
      readBy: [userId],
    });

    conversation.lastMessage = trimmedContent || (attachments.length ? `Attachment (${attachments.length})` : '');
    conversation.deletedBy = [];
    await conversation.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'firstName lastName')
      .populate({ path: 'replyTo', select: 'content sender', populate: { path: 'sender', select: 'firstName lastName' } })
      .populate('reactions.user', 'firstName lastName');

    // Notify recipient in real-time
    const recipientId = conversation.participants.find((p) => String(p) !== String(userId));
    if (recipientId) {
      try {
        getIo().to(`user:${recipientId}`).emit('message:new', {
          conversationId,
          senderId: String(userId),
          message: populated,
        });
      } catch (_) {}
    }

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du message' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ message: 'Message introuvable' });
    if (String(message.sender) !== String(userId)) {
      return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres messages.' });
    }

    message.deleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    await message.save();

    res.json({ message: 'Message supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la suppression du message' });
  }
};

exports.toggleReaction = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { emoji } = req.body;
    const allowed = new Set(['👍', '❤️', '😂', '😮', '😢', '😡']);
    if (!allowed.has(emoji)) return res.status(400).json({ message: 'Emoji not allowed' });

    const message = await Message.findById(id);
    if (!message || message.deleted) return res.status(404).json({ message: 'Message introuvable' });
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !conversation.participants.some((p) => String(p) === String(userId))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const existingIndex = (message.reactions || []).findIndex((r) => String(r.user) === String(userId));
    if (existingIndex >= 0) {
      if (message.reactions[existingIndex].emoji === emoji) {
        message.reactions.splice(existingIndex, 1);
      } else {
        message.reactions[existingIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();
    const populated = await Message.findById(id)
      .populate('sender', 'firstName lastName')
      .populate({ path: 'replyTo', select: 'content sender', populate: { path: 'sender', select: 'firstName lastName' } })
      .populate('reactions.user', 'firstName lastName');

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la réaction au message' });
  }
};

exports.sendVoiceMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { conversationId, duration } = req.body;
    
    if (!conversationId) return res.status(400).json({ message: 'conversationId required' });
    if (!req.file) return res.status(400).json({ message: 'Voice file required' });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversation introuvable' });
    if (!conversation.participants.some((p) => String(p) === String(userId))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    
    const blockedByMe = (conversation.blockedBy || []).some((id) => String(id) === String(userId));
    const otherParticipant = (conversation.participants || []).find((id) => String(id) !== String(userId));
    const blockedByOther = otherParticipant
      ? (conversation.blockedBy || []).some((id) => String(id) === String(otherParticipant))
      : false;
      
    if (blockedByMe) {
      return res.status(403).json({ message: 'You have blocked this user.' });
    }
    if (blockedByOther) {
      return res.status(403).json({ message: 'You cannot send messages because you are blocked by this user.' });
    }

    const voiceMessageData = {
      url: `/uploads/voice/${req.file.filename}`,
      duration: duration ? parseFloat(duration) : 0,
      size: req.file.size,
      mimeType: req.file.mimetype
    };

    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      content: '', // Explicit empty content for voice messages
      voiceMessage: voiceMessageData,
      readBy: [userId],
    });

    conversation.lastMessage = '🎤 Message vocal';
    conversation.deletedBy = [];
    await conversation.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'firstName lastName')
      .populate({ path: 'replyTo', select: 'content sender', populate: { path: 'sender', select: 'firstName lastName' } })
      .populate('reactions.user', 'firstName lastName');

    // Notify recipient in real-time
    const recipientId = conversation.participants.find((p) => String(p) !== String(userId));
    if (recipientId) {
      try {
        getIo().to(`user:${recipientId}`).emit('message:new', {
          conversationId,
          senderId: String(userId),
          message: populated,
        });
      } catch (_) {}
    }

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de l'envoi du message vocal" });
  }
};

// ─── Shared helper: find-or-create conversation + create proposal message ────
// Used both by this controller and by proposalController (via import).
// Returns { message: populated, conversationId }
async function createProposalMessage({ senderId, recipientId, proposalId, messageType, proposedPrice, content }) {
  // Find existing conversation between the two participants
  let conversation = await Conversation.findOne({
    participants: { $all: [senderId, recipientId] },
    $expr: { $eq: [{ $size: '$participants' }, 2] },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [senderId, recipientId],
      lastMessage: content || '',
    });
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: senderId,
    content: content || '',
    messageType,
    proposedPrice: proposedPrice ?? null,
    proposalId: proposalId ?? null,
    readBy: [senderId],
  });

  // Update lastMessage preview
  conversation.lastMessage = content || '💰 Proposition';
  conversation.deletedBy = [];
  await conversation.save();

  const populated = await Message.findById(message._id)
    .populate('sender', 'firstName lastName');

  // Real-time notify the other party
  try {
    getIo().to(`user:${String(recipientId)}`).emit('message:new', {
      conversationId: String(conversation._id),
      senderId: String(senderId),
      message: populated,
    });
  } catch (_) { /* socket may not be running in tests */ }

  return { message: populated, conversationId: conversation._id };
}
exports.createProposalMessage = createProposalMessage;

// ─── @desc    Artisan envoie une proposition de prix depuis la messagerie
// ─── @route   POST /api/messages/price-proposal
// ─── @access  Private (artisan)
exports.sendPriceProposalFromChat = async (req, res) => {
  try {
    const { conversationId, proposalId, proposedPrice, content } = req.body;
    const senderId = req.user._id;

    if (!proposalId) return res.status(400).json({ message: 'proposalId is required' });
    const price = Number(proposedPrice);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ message: 'proposedPrice must be a valid positive number' });
    }

    // Verify proposal exists and caller is the artisan
    const proposal = await ProjectProposal.findById(proposalId);
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
    if (proposal.artisanId.toString() !== senderId.toString()) {
      return res.status(403).json({ message: 'Only the artisan can send a price proposal' });
    }
    if (!['pending', 'negotiating'].includes(proposal.status)) {
      return res.status(400).json({ message: `Cannot propose on a proposal with status "${proposal.status}"` });
    }

    // If conversationId provided, use it; otherwise resolve from participants
    let convId = conversationId;
    if (!convId) {
      const conv = await Conversation.findOne({
        participants: { $all: [proposal.artisanId, proposal.expertId] },
        $expr: { $eq: [{ $size: '$participants' }, 2] },
      });
      convId = conv?._id || null;
    }

    // If still no conversation, create one
    if (!convId) {
      const newConv = await Conversation.create({
        participants: [proposal.artisanId, proposal.expertId],
        lastMessage: '',
      });
      convId = newConv._id;
    }

    // Update the proposal (via counter endpoint logic)
    proposal.negotiationHistory.push({
      senderId,
      senderRole: 'artisan',
      proposedPrice: price,
      message: content || '',
      createdAt: new Date(),
    });
    proposal.currentPrice    = price;
    proposal.lastProposedBy  = 'artisan';
    proposal.negotiatedPrice = price;
    proposal.status          = 'negotiating';
    await proposal.save();

    // Create the message
    const message = await Message.create({
      conversation: convId,
      sender: senderId,
      content: content || '',
      messageType: 'price_proposal',
      proposedPrice: price,
      proposalId,
      readBy: [senderId],
    });

    await Conversation.findByIdAndUpdate(convId, {
      lastMessage: `💰 ${price.toLocaleString('fr-TN')} TND`,
      deletedBy: [],
    });

    const populated = await Message.findById(message._id)
      .populate('sender', 'firstName lastName');

    try {
      getIo().to(`user:${String(proposal.expertId)}`).emit('message:new', {
        conversationId: String(convId),
        senderId: String(senderId),
        message: populated,
      });
    } catch (_) {}

    return res.status(201).json(populated);
  } catch (err) {
    console.error('sendPriceProposalFromChat error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── @desc    Accept a proposal directly from a chat message
// ─── @route   PUT /api/messages/proposal/:proposalId/accept
// ─── @access  Private (artisan)
exports.acceptProposalFromChat = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = req.user._id;

    const proposal = await ProjectProposal.findById(proposalId)
      .populate('artisanId', 'firstName lastName email')
      .populate('expertId',  'firstName lastName email');
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });

    const isArtisan = proposal.artisanId._id.toString() === userId.toString();
    const isExpert  = proposal.expertId._id.toString() === userId.toString();

    if (!isArtisan && !isExpert) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (!['pending', 'negotiating'].includes(proposal.status)) {
      return res.status(400).json({ message: `Cannot accept a proposal with status "${proposal.status}"` });
    }

    proposal.status = 'accepted';
    await proposal.save();

    const finalPrice = proposal.currentPrice ?? proposal.negotiatedPrice ?? proposal.proposedPrice;
    const acceptorName = isArtisan
      ? `${proposal.artisanId.firstName} ${proposal.artisanId.lastName}`
      : `${proposal.expertId.firstName} ${proposal.expertId.lastName}`;
    const recipientId = isArtisan ? proposal.expertId._id : proposal.artisanId._id;

    // ── Non-blocking: accepted message + contract generation ─────────────────
    setImmediate(async () => {
      // 1. Accepted message
      try {
        await createProposalMessage({
          senderId:      userId,
          recipientId,
          proposalId:    proposal._id,
          messageType:   'proposal_accepted',
          proposedPrice: finalPrice,
          content:       `✅ ${acceptorName} a accepté la proposition au prix de ${finalPrice.toLocaleString('fr-TN')} TND.`,
        });
      } catch (e) { console.error('accepted message error:', e); }

      // 2. Auto-generate contract (expert signs first)
      try {
        const existing = await Contract.findOne({ proposalId: proposal._id });
        if (!existing) {
          const artisan  = proposal.artisanId;
          const expert   = proposal.expertId;
          const template = await _getActiveTemplate();
          const vars = {
            artisanName:  `${artisan.firstName} ${artisan.lastName}`,
            expertName:   `${expert.firstName} ${expert.lastName}`,
            description:  proposal.description  || '',
            localisation: proposal.localisation || '',
            finalPrice:   (finalPrice ?? 0).toLocaleString('fr-TN'),
            startDate:    proposal.startDate
              ? new Date(proposal.startDate).toLocaleDateString('fr-TN', { day: '2-digit', month: 'long', year: 'numeric' })
              : '',
            createdAt:    new Date().toLocaleDateString('fr-TN', { day: '2-digit', month: 'long', year: 'numeric' }),
          };
          await Contract.create({
            proposalId: proposal._id,
            artisanId:  artisan._id,
            expertId:   expert._id,
            content:    _fillTemplate(template.content, vars),
            status:     'pending_expert_signature',   // expert signs first
          });

          // Notify expert
          await Notification.create({
            userId:       expert._id,
            type:         'contract_generated',
            message:      `Un contrat a été généré suite à l'acceptation de la proposition. Veuillez le signer.`,
            relatedModel: 'Contract',
          });
        }
      } catch (contractErr) {
        console.error('Auto-contract generation error (chat):', contractErr);
      }
    });
    // ─────────────────────────────────────────────────────────────────────────

    return res.status(200).json({ message: 'Proposal accepted', proposal });
  } catch (err) {
    console.error('acceptProposalFromChat error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── @desc    Reject a proposal directly from a chat message
// ─── @route   PUT /api/messages/proposal/:proposalId/reject
// ─── @access  Private
exports.rejectProposalFromChat = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = req.user._id;

    const proposal = await ProjectProposal.findById(proposalId)
      .populate('artisanId', 'firstName lastName')
      .populate('expertId', 'firstName lastName');
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });

    const isParty =
      proposal.artisanId._id.toString() === userId.toString() ||
      proposal.expertId._id.toString() === userId.toString();
    if (!isParty) return res.status(403).json({ message: 'Not authorized' });

    if (!['pending', 'negotiating'].includes(proposal.status)) {
      return res.status(400).json({ message: `Cannot reject a proposal with status "${proposal.status}"` });
    }

    proposal.status = 'rejected';
    await proposal.save();

    const isArtisan   = proposal.artisanId._id.toString() === userId.toString();
    const rejectorName = isArtisan
      ? `${proposal.artisanId.firstName} ${proposal.artisanId.lastName}`
      : `${proposal.expertId.firstName} ${proposal.expertId.lastName}`;
    const recipientId  = isArtisan ? proposal.expertId._id : proposal.artisanId._id;

    setImmediate(async () => {
      try {
        await createProposalMessage({
          senderId:    userId,
          recipientId,
          proposalId:  proposal._id,
          messageType: 'proposal_rejected',
          content:     `❌ ${rejectorName} a refusé la proposition.`,
        });
      } catch (e) { console.error('rejected message error:', e); }
    });

    return res.status(200).json({ message: 'Proposal rejected', proposal });
  } catch (err) {
    console.error('rejectProposalFromChat error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.generateAIDraftMessage = async (req, res) => {
  const aiInstruction = sanitizeGeneratedMessage(req.body?.aiInstruction || '');

  if (!aiInstruction) {
    return res.status(400).json({ message: 'aiInstruction is required' });
  }

  if (!req.user || !['artisan', 'expert'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only artisan and expert roles can use AI draft generation' });
  }

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  const model = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  const apiVersion = String(process.env.GEMINI_API_VERSION || 'v1').trim();

  if (!apiKey) {
    console.error('generateAIDraftMessage unrecoverable: GEMINI_API_KEY missing');
    return res.status(500).json({ message: 'Failed to generate AI message draft', detail: 'GEMINI_API_KEY missing' });
  }

  const endpoint = `https://generativelanguage.googleapis.com/${encodeURIComponent(apiVersion)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const strictPrompt = [
    'You are a communication assistant in a B2B construction SaaS.',
    `Current user role: ${req.user.role}.`,
    `Exact user instruction: ${aiInstruction}`,
    'Mandatory rules:',
    '- produce a complete message ready to send',
    '- clear, natural, professional tone',
    '- 2 to 4 sentences',
    '- minimum 35 words',
    '- never leave incomplete sentence',
    '- finish with a professional closing sentence',
    '- return only final message text, no list, no markdown, no quotes',
  ].join('\n');

  try {
    let generatedMessage = await requestGeminiDraft({
      endpoint,
      prompt: strictPrompt,
      maxOutputTokens: 360,
    });

    if (isDraftMessageTooShort(generatedMessage) || isDraftMessageLikelyTruncated(generatedMessage)) {
      const refinementPrompt = [
        strictPrompt,
        '',
        `Previous response: ${generatedMessage || '[empty]'}`,
        'Correction instructions:',
        '- previous response too short or incomplete',
        '- rewrite fully and in more detail',
        '- keep mandatory constraints',
      ].join('\n');

      generatedMessage = await requestGeminiDraft({
        endpoint,
        prompt: refinementPrompt,
        maxOutputTokens: 460,
      });
    }

    generatedMessage = finalizeGeneratedMessage(generatedMessage);

    if (isDraftMessageTooShort(generatedMessage) || isDraftMessageLikelyTruncated(generatedMessage)) {
      return res.status(200).json({
        generatedMessage: buildLocalDraftFallback({ aiInstruction, userRole: req.user.role }),
        fallbackUsed: true,
        warning: 'AI draft was incomplete; local fallback draft was returned.',
      });
    }

    return res.status(200).json({ generatedMessage });
  } catch (error) {
    if (isGeminiCapacityError(error)) {
      return res.status(200).json({
        generatedMessage: buildLocalDraftFallback({ aiInstruction, userRole: req.user.role }),
        fallbackUsed: true,
        warning: 'AI service is temporarily limited; local fallback draft was returned.',
      });
    }

    const providerMessage = getGeminiErrorMessage(error);
    console.error('generateAIDraftMessage unrecoverable:', providerMessage);
    return res.status(500).json({ message: 'Failed to generate AI message draft', detail: providerMessage });
  }
};