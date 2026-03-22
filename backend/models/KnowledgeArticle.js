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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  attachments: {
    type: [String],
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('KnowledgeArticle', knowledgeArticleSchema);
