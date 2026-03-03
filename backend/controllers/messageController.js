const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.query;
    if (!conversationId) return res.status(400).json({ message: 'conversationId is required' });

    const messages = await Message.find({ conversation: conversationId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors du chargement des messages' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    if (!conversationId || !content) return res.status(400).json({ message: 'conversationId and content required' });

    const message = await Message.create({ conversation: conversationId, sender: req.user._id, content });
    res.json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du message' });
  }
};