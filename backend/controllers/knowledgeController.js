const KnowledgeArticle = require('../models/KnowledgeArticle');
const axios = require('axios');

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

const safeStr = (value, fallback = '') => {
  if (value === undefined || value === null) return fallback;
  const str = String(value).trim();
  return str || fallback;
};

const normalizeText = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'au', 'aux', 'avec', 'ce', 'cet', 'cette', 'de', 'des', 'du', 'en', 'et',
  'for', 'i', 'il', 'je', 'la', 'le', 'les', 'mon', 'my', 'of', 'ou', 'par', 'pour', 'que',
  'qui', 'sur', 'the', 'to', 'un', 'une', 'veux', 'want', 'article', 'articles', 'knowledge',
  'library', 'problem', 'projet', 'project', 'chantier',
]);

const tokenizeText = (value = '') =>
  normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

const extractGeminiText = (responseData) => {
  const candidates = Array.isArray(responseData?.candidates) ? responseData.candidates : [];
  if (!candidates.length) return '';

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const text = parts
      .map((part) => safeStr(part?.text))
      .filter(Boolean)
      .join(' ')
      .trim();
    if (text) return text;
  }

  return '';
};

const sanitizeGeminiJsonText = (text = '') =>
  safeStr(text)
    .replace(/```(?:json)?/gi, ' ')
    .replace(/```/g, ' ')
    .trim();

const parseJsonObject = (text = '') => {
  const cleaned = sanitizeGeminiJsonText(text);
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const normalizeIntentPayload = (payload, fallbackQuery = '') => {
  const keywords = Array.isArray(payload?.keywords)
    ? payload.keywords.map((entry) => safeStr(entry)).filter(Boolean)
    : [];
  const categories = Array.isArray(payload?.categories)
    ? payload.categories.map((entry) => safeStr(entry)).filter(Boolean)
    : [];
  const mustIncludePhrases = Array.isArray(payload?.mustIncludePhrases)
    ? payload.mustIncludePhrases.map((entry) => safeStr(entry)).filter(Boolean)
    : [];

  const mergedKeywords = Array.from(new Set([
    ...keywords,
    ...tokenizeText(fallbackQuery),
  ])).slice(0, 16);

  return {
    keywords: mergedKeywords,
    categories: categories.slice(0, 8),
    mustIncludePhrases: mustIncludePhrases.slice(0, 8),
  };
};

const buildKnowledgeSearchPrompt = (query) => `You are an AI search analyst for a B2B construction knowledge library.
User natural language request:
${query}

Return only a valid JSON object with this exact structure:
{
  "keywords": ["..."],
  "categories": ["..."],
  "mustIncludePhrases": ["..."]
}

Rules:
- keywords: 4 to 12 concise domain terms extracted from the request
- categories: optional high-level construction categories inferred from the request
- mustIncludePhrases: optional 0 to 5 phrases that represent strict needs
- no markdown
- no extra text outside JSON`;

const requestGeminiKnowledgeIntent = async (query) => {
  const apiKey = safeStr(process.env.GEMINI_API_KEY);
  if (!apiKey) return { intent: normalizeIntentPayload({}, query), warning: 'GEMINI_API_KEY missing', modelUsed: null };

  const model = safeStr(process.env.GEMINI_MODEL, 'gemini-2.5-flash');
  const apiVersion = safeStr(process.env.GEMINI_API_VERSION, 'v1');
  const endpoint = `https://generativelanguage.googleapis.com/${encodeURIComponent(apiVersion)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await axios.post(
      endpoint,
      {
        contents: [{ role: 'user', parts: [{ text: buildKnowledgeSearchPrompt(query) }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: 220,
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000,
      }
    );

    const raw = extractGeminiText(response.data);
    const parsed = parseJsonObject(raw);
    return {
      intent: normalizeIntentPayload(parsed || {}, query),
      warning: null,
      modelUsed: model,
    };
  } catch (error) {
    const warning = safeStr(
      error?.response?.data?.error?.message
      || error?.response?.data?.message
      || error?.message,
      'AI intent parsing failed; local semantic matching used.'
    );

    return {
      intent: normalizeIntentPayload({}, query),
      warning,
      modelUsed: null,
    };
  }
};

const scoreArticleByIntent = (article, intent, query) => {
  const title = normalizeText(article.title);
  const category = normalizeText(article.category);
  const summary = normalizeText(article.summary);
  const content = normalizeText(article.content);
  const tags = Array.isArray(article.tags) ? normalizeText(article.tags.join(' ')) : '';
  const queryTokens = tokenizeText(query);

  let score = 0;
  const matchedTerms = [];

  const registerTermMatch = (term, weight, inText) => {
    if (!term || !inText.includes(term)) return;
    score += weight;
    matchedTerms.push(term);
  };

  intent.keywords.forEach((keyword) => {
    const term = normalizeText(keyword);
    if (!term) return;
    registerTermMatch(term, 12, title);
    registerTermMatch(term, 9, summary);
    registerTermMatch(term, 6, category);
    registerTermMatch(term, 7, tags);
    registerTermMatch(term, 3, content);
  });

  intent.categories.forEach((cat) => {
    const term = normalizeText(cat);
    if (!term) return;
    registerTermMatch(term, 14, category);
    registerTermMatch(term, 6, title);
    registerTermMatch(term, 5, summary);
  });

  intent.mustIncludePhrases.forEach((phrase) => {
    const term = normalizeText(phrase);
    if (!term) return;
    if (title.includes(term) || summary.includes(term) || content.includes(term) || tags.includes(term)) {
      score += 15;
      matchedTerms.push(term);
    }
  });

  queryTokens.forEach((token) => {
    registerTermMatch(token, 4, title);
    registerTermMatch(token, 3, summary);
    registerTermMatch(token, 1, content);
  });

  const uniqueTerms = Array.from(new Set(matchedTerms));
  const isMatch = score >= 18 || uniqueTerms.length >= 2;

  return {
    score,
    isMatch,
    matchHighlights: uniqueTerms.slice(0, 6),
  };
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

exports.aiSearchArticles = async (req, res) => {
  try {
    const query = safeStr(req.body?.query || req.body?.text || req.body?.aiQuery || '');

    if (!query) {
      return res.status(400).json({ message: 'Please provide a natural-language project/problem description.' });
    }

    if (!req.user || req.user.role !== 'expert') {
      return res.status(403).json({ message: 'Only expert users can run AI knowledge search.' });
    }

    const articles = await KnowledgeArticle.find({ status: 'published' }).lean();
    if (!articles.length) {
      return res.status(200).json({
        query,
        total: 0,
        sorting: { primary: 'views', secondary: 'likes' },
        analysis: { keywords: [], categories: [], mustIncludePhrases: [] },
        articles: [],
      });
    }

    const aiIntentResult = await requestGeminiKnowledgeIntent(query);
    const intent = aiIntentResult.intent;

    const scoredArticles = articles
      .map((article) => {
        const scoreResult = scoreArticleByIntent(article, intent, query);
        return {
          article,
          ...scoreResult,
        };
      })
      .filter((entry) => entry.isMatch)
      .sort((left, right) => {
        if ((right.article.views || 0) !== (left.article.views || 0)) {
          return (right.article.views || 0) - (left.article.views || 0);
        }
        if ((right.article.likes || 0) !== (left.article.likes || 0)) {
          return (right.article.likes || 0) - (left.article.likes || 0);
        }
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return new Date(right.article.createdAt).getTime() - new Date(left.article.createdAt).getTime();
      });

    const responseArticles = scoredArticles.map((entry) => ({
      ...formatArticleResponse(entry.article, req.user?._id),
      aiMatchScore: entry.score,
      matchHighlights: entry.matchHighlights,
    }));

    return res.status(200).json({
      query,
      total: responseArticles.length,
      sorting: { primary: 'views', secondary: 'likes' },
      analysis: intent,
      modelUsed: aiIntentResult.modelUsed,
      ...(aiIntentResult.warning ? { warning: aiIntentResult.warning } : {}),
      articles: responseArticles,
    });
  } catch (error) {
    console.error('aiSearchArticles error:', error?.message || error);
    return res.status(500).json({ message: 'AI knowledge search failed', detail: error?.message || 'Unknown error' });
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
