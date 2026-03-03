const Conversation = require('../models/Conversation');
const User = require('../models/User');

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

    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'firstName lastName role avatar')
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération des conversations' });
  }
};