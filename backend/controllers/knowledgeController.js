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

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // fallback: comma-separated
      return value.split(',').map((v) => v.trim()).filter(Boolean);
    }
  }
  return [];
};

const formatArticleResponse = (article, userId) => ({
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
  tags: article.tags || [],
  liked: userId ? Boolean((article.likedBy || []).some((id) => String(id) === String(userId))) : false,
  likedByUser: userId ? Boolean((article.likedBy || []).some((id) => String(id) === String(userId))) : false,
  attachments: (article.attachments || []).map((a) => {
    // Backward-compat: old documents could have string arrays
    if (typeof a === 'string') {
      return { name: a, size: '', type: '', url: a };
    }
    return a;
  }),
});

exports.listArticles = async (req, res) => {
  try {
    const articles = await KnowledgeArticle.find({ status: 'published' }).sort({ createdAt: -1 });
    return res.status(200).json(articles.map((a) => formatArticleResponse(a)));
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
    return res.status(200).json(formatArticleResponse(article, req.user?._id));
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
    const { title, category, summary, content, authorName, tags } = req.body || {};
    if (!title || !category || !summary || !content) {
      return res.status(400).json({ message: 'Title, category, summary, and content are required' });
    }

    const authorLabel = authorName || (req.user?.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() || 'BMP Admin'
      : 'BMP Admin');

    const files = Array.isArray(req.files) ? req.files : [];
    const attachments = files.map((file) => ({
      name: file.originalname,
      size: String(file.size ?? ''),
      type: file.mimetype ?? 'application/octet-stream',
      url: `/uploads/knowledge-attachments/${file.filename}`,
    }));

    const parsedTags = parseJsonArray(tags);

    const article = await KnowledgeArticle.create({
      title,
      category,
      summary,
      content,
      authorName: authorLabel,
      tags: parsedTags,
      attachments,
      createdBy: req.user?._id,
      status: 'published',
    });

    return res.status(201).json(formatArticleResponse(article, req.user?._id));
  } catch (error) {
    console.error('createArticle error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.updateArticle = async (req, res) => {
  try {
    if (!guardKnowledgePermission(req, res)) {
      return;
    }

    const { id } = req.params;
    const article = await KnowledgeArticle.findById(id);
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    const { title, category, summary, content, authorName, tags, removeAttachmentUrls } = req.body || {};

    if (!title || !category || !summary || !content) {
      return res.status(400).json({ message: 'Title, category, summary, and content are required' });
    }

    const authorLabel = authorName || article.authorName;

    const parsedTags = parseJsonArray(tags);
    article.title = title;
    article.category = category;
    article.summary = summary;
    article.content = content;
    article.authorName = authorLabel;
    article.tags = parsedTags;

    // Preserve existing attachments unless user explicitly removes them or adds new files
    const parsedRemoveUrls = parseJsonArray(removeAttachmentUrls);
    if (parsedRemoveUrls.length) {
      article.attachments = (article.attachments || []).filter((a) => {
        const url = typeof a === 'string' ? a : a?.url;
        return url ? !parsedRemoveUrls.includes(url) : true;
      });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length) {
      const newAttachments = files.map((file) => ({
        name: file.originalname,
        size: String(file.size ?? ''),
        type: file.mimetype ?? 'application/octet-stream',
        url: `/uploads/knowledge-attachments/${file.filename}`,
      }));
      article.attachments = [...(article.attachments || []), ...newAttachments];
    }

    await article.save();
    return res.status(200).json(formatArticleResponse(article, req.user?._id));
  } catch (error) {
    console.error('updateArticle error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.likeArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const article = await KnowledgeArticle.findById(id);
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    const hasLiked = (article.likedBy || []).some((uid) => String(uid) === String(userId));

    if (hasLiked) {
      // Unlike: remove user id and decrement likes
      article.likedBy = (article.likedBy || []).filter((uid) => String(uid) !== String(userId));
      article.likes = Math.max(0, (article.likes || 0) - 1);
    } else {
      // Like: add user id and increment likes
      article.likedBy = [...(article.likedBy || []), userId];
      article.likes = (article.likes || 0) + 1;
    }

    await article.save();

    const updated = formatArticleResponse(article, userId);
    return res.status(200).json({ likes: updated.likes, liked: updated.liked, ...updated });
  } catch (error) {
    console.error('likeArticle error:', error);
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
