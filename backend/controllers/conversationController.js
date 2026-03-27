const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Message = require('../models/Message');

// Créer une conversation ou récupérer si elle existe déjà
exports.createConversation = async (req, res) => {
  try {
    const userId = req.user._id; // Expert connecté
    const { participantId } = req.body;

    if (!participantId) return res.status(400).json({ message: 'participantId is required' });

    // Vérifie si la conversation existe déjà entre ces deux participants
    let conv = await Conversation.findOne({ participants: { $all: [userId, participantId] } });

    if (!conv) {
      conv = new Conversation({ participants: [userId, participantId] });
      await conv.save();
    } else {
      // Restore conversation visibility if one user had deleted it.
      conv.deletedBy = (conv.deletedBy || []).filter((id) => String(id) !== String(userId));
      await conv.save();
    }

    // Toujours peupler les participants avec les champs nécessaires
    conv = await conv.populate('participants', 'firstName lastName role avatar');

    res.json(conv);
  } catch (err) {
    console.error('Error creating conversation:', err);
    res.status(500).json({ message: 'Erreur lors de la création de la conversation' });
  }
};

// Récupérer toutes les conversations de l'utilisateur connecté
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId,
      deletedBy: { $ne: userId },
    })
      .populate('participants', 'firstName lastName role avatar')
      .sort({ updatedAt: -1 });

    const withUnread = await Promise.all(
      conversations.map(async (conv) => {
        const otherParticipant = (conv.participants || []).find((p) => String(p._id || p) !== String(userId));
        const blockedByMe = (conv.blockedBy || []).some((id) => String(id) === String(userId));
        const blockedByOther = otherParticipant
          ? (conv.blockedBy || []).some((id) => String(id) === String(otherParticipant._id || otherParticipant))
          : false;
        const unread = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: userId },
          deleted: { $ne: true },
          readBy: { $ne: userId },
        });
        return { ...conv.toObject(), unread, blockedByMe, blockedByOther };
      })
    );

    res.json(withUnread);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération des conversations' });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const conversation = await Conversation.findById(id);
    if (!conversation) return res.status(404).json({ message: 'Conversation introuvable' });
    if (!conversation.participants.some((p) => String(p) === String(userId))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    if (!conversation.deletedBy.some((u) => String(u) === String(userId))) {
      conversation.deletedBy.push(userId);
      await conversation.save();
    }

    res.json({ message: 'Conversation supprimée' });
  } catch (err) {
    console.error('Error deleting conversation:', err);
    res.status(500).json({ message: 'Erreur lors de la suppression de la conversation' });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const conversation = await Conversation.findById(id);
    if (!conversation) return res.status(404).json({ message: 'Conversation introuvable' });
    if (!conversation.participants.some((p) => String(p) === String(userId))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    if (!conversation.blockedBy.some((u) => String(u) === String(userId))) {
      conversation.blockedBy.push(userId);
      await conversation.save();
    }

    res.json({ message: 'Utilisateur bloqué' });
  } catch (err) {
    console.error('Error blocking user:', err);
    res.status(500).json({ message: 'Erreur lors du blocage' });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const conversation = await Conversation.findById(id);
    if (!conversation) return res.status(404).json({ message: 'Conversation introuvable' });
    if (!conversation.participants.some((p) => String(p) === String(userId))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    conversation.blockedBy = (conversation.blockedBy || []).filter((u) => String(u) !== String(userId));
    await conversation.save();

    res.json({ message: 'Utilisateur débloqué' });
  } catch (err) {
    console.error('Error unblocking user:', err);
    res.status(500).json({ message: 'Erreur lors du déblocage' });
  }
};

exports.getConversationStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const conversation = await Conversation.findById(id).populate('participants', 'firstName lastName role');
    if (!conversation) return res.status(404).json({ message: 'Conversation introuvable' });
    if (!conversation.participants.some((p) => String(p._id || p) === String(userId))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const otherParticipant = (conversation.participants || []).find((p) => String(p._id || p) !== String(userId));
    const blockedByMe = (conversation.blockedBy || []).some((id) => String(id) === String(userId));
    const blockedByOther = otherParticipant
      ? (conversation.blockedBy || []).some((id) => String(id) === String(otherParticipant._id || otherParticipant))
      : false;

    res.json({
      blocked: blockedByMe || blockedByOther,
      blockedByMe,
      blockedByOther,
      otherParticipant: otherParticipant
        ? {
            _id: otherParticipant._id,
            firstName: otherParticipant.firstName,
            lastName: otherParticipant.lastName,
            role: otherParticipant.role,
          }
        : null,
    });
  } catch (err) {
    console.error('Error getting conversation status:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération du statut de conversation' });
  }
};