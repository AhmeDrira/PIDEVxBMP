const mongoose = require('mongoose');

const knowledgeArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  summary: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  authorName: {
    type: String,
    default: 'BMP Editorial Team',
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'published',
  },
  views: {
    type: Number,
    default: 0,
  },
  likes: {
    type: Number,
    default: 0,
  },
  likedBy: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: [],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  tags: {
    type: [String],
    default: [],
  },
  attachments: {
    type: [
      {
        name: { type: String, required: false },
        size: { type: String, required: false },
        type: { type: String, required: false },
        url: { type: String, required: false },
      },
    ],
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('KnowledgeArticle', knowledgeArticleSchema);
