const KnowledgeArticle = require('../models/KnowledgeArticle');

const hasKnowledgePermission = (user) => {
  if (!user) return false;
  if (user.role !== 'admin') return false;
  if (user.isSuperAdmin || user.adminType === 'super') return true;
  return Boolean(user.permissions?.canManageKnowledge);
};

const guardKnowledgePermission = (req, res) => {
  if (hasKnowledgePermission(req.user)) {
    return true;
  }
  res.status(403).json({ message: 'You do not have permission to manage knowledge articles' });
  return false;
};

const formatArticleResponse = (article) => ({
  _id: article._id,
  title: article.title,
  category: article.category,
  summary: article.summary,
  content: article.content,
  authorName: article.authorName,
  status: article.status,
  views: article.views,
  likes: article.likes,
  createdAt: article.createdAt,
  updatedAt: article.updatedAt,
  attachments: article.attachments || [],
});

exports.listArticles = async (req, res) => {
  try {
    const articles = await KnowledgeArticle.find({ status: 'published' }).sort({ createdAt: -1 });
    return res.status(200).json(articles.map(formatArticleResponse));
  } catch (error) {
    console.error('listArticles error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.getArticleById = async (req, res) => {
  try {
    const { id } = req.params;
    const article = await KnowledgeArticle.findById(id);
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }
    article.views += 1;
    await article.save();
    return res.status(200).json(formatArticleResponse(article));
  } catch (error) {
    console.error('getArticleById error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.createArticle = async (req, res) => {
  try {
    if (!guardKnowledgePermission(req, res)) {
      return;
    }
    const { title, category, summary, content, authorName, attachments } = req.body || {};
    if (!title || !category || !summary || !content) {
      return res.status(400).json({ message: 'Title, category, summary, and content are required' });
    }

    const authorLabel = authorName || (req.user?.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() || 'BMP Admin'
      : 'BMP Admin');

    const article = await KnowledgeArticle.create({
      title,
      category,
      summary,
      content,
      authorName: authorLabel,
      attachments: Array.isArray(attachments) ? attachments : [],
      createdBy: req.user?._id,
      status: 'published',
    });

    return res.status(201).json(formatArticleResponse(article));
  } catch (error) {
    console.error('createArticle error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteArticle = async (req, res) => {
  try {
    if (!guardKnowledgePermission(req, res)) {
      return;
    }
    const { id } = req.params;
    const deleted = await KnowledgeArticle.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Article not found' });
    }
    return res.status(200).json({ message: 'Article removed' });
  } catch (error) {
    console.error('deleteArticle error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
