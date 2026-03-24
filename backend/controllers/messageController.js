const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads', 'messages');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
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
      .populate('replyTo', 'content sender')
      .populate('replyTo.sender', 'firstName lastName')
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
      .populate('replyTo', 'content sender')
      .populate('replyTo.sender', 'firstName lastName')
      .populate('reactions.user', 'firstName lastName');
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
      .populate('replyTo', 'content sender')
      .populate('replyTo.sender', 'firstName lastName')
      .populate('reactions.user', 'firstName lastName');

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la réaction au message' });
  }
};