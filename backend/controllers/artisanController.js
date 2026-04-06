const { Artisan } = require('../models/User');
const Project = require('../models/Project');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const ActionLog = require('../models/ActionLog');
const { analyzeIntent, buildMongoFilter, searchArtisansWithAI } = require('../services/artisanAiSearchService');
const fs = require('fs');
const path = require('path');

const COMPLETED_PROJECT_STATUSES = ['completed', 'done'];

const parseMediaPayload = (media) => {
  if (!media) return [];
  let parsed = media;
  if (typeof media === 'string') {
    try {
      parsed = JSON.parse(media);
    } catch (error) {
      parsed = [];
    }
  }

  return Array.isArray(parsed)
    ? parsed
        .map((entry) => ({
          type: entry?.type === 'video' ? 'video' : 'image',
          url: String(entry?.url || '').trim(),
        }))
        .filter((entry) => entry.url)
    : [];
};

const filesToMedia = (files = []) => {
  return files.map((file) => ({
    type: file.mimetype && file.mimetype.startsWith('video/') ? 'video' : 'image',
    url: `/uploads/portfolio/${file.filename}`,
  }));
};

const removePortfolioMediaFiles = (media = []) => {
  for (const item of media) {
    const url = String(item?.url || '');
    if (!url.startsWith('/uploads/portfolio/')) continue;
    const filePath = path.join(process.cwd(), url.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

const enrichArtisansWithStats = async (artisans, options = {}) => {
  const {
    includeSemanticProjects = false,
    includeActivitySignals = false,
  } = options;

  if (!Array.isArray(artisans) || artisans.length === 0) {
    return [];
  }

  const artisanIds = artisans.map((artisan) => artisan._id);

  const projectAggregation = includeSemanticProjects
    ? [
        {
          $match: {
            artisan: { $in: artisanIds },
            status: { $in: COMPLETED_PROJECT_STATUSES },
          },
        },
        { $sort: { updatedAt: -1 } },
        {
          $group: {
            _id: '$artisan',
            count: { $sum: 1 },
            recentProjectAt: { $max: '$updatedAt' },
            projects: {
              $push: {
                title: '$title',
                description: '$description',
                location: '$location',
                updatedAt: '$updatedAt',
                endDate: '$endDate',
              },
            },
          },
        },
      ]
    : [
        {
          $match: {
            artisan: { $in: artisanIds },
            status: { $in: COMPLETED_PROJECT_STATUSES },
          },
        },
        { $group: { _id: '$artisan', count: { $sum: 1 }, recentProjectAt: { $max: '$updatedAt' } } },
      ];

  const [reviewStats, projectStats, actionStats] = await Promise.all([
    Review.aggregate([
      { $match: { artisan: { $in: artisanIds } } },
      {
        $group: {
          _id: '$artisan',
          reviewCount: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          recentReviewAt: { $max: '$createdAt' },
        },
      },
    ]),
    Project.aggregate(projectAggregation),
    includeActivitySignals
      ? ActionLog.aggregate([
          { $match: { actorId: { $in: artisanIds } } },
          {
            $group: {
              _id: '$actorId',
              lastActionAt: { $max: '$createdAt' },
            },
          },
        ])
      : Promise.resolve([]),
  ]);

  const reviewMap = {};
  reviewStats.forEach((review) => {
    reviewMap[String(review._id)] = {
      reviewCount: review.reviewCount,
      rating: Math.round(review.avgRating * 10) / 10,
      recentReviewAt: review.recentReviewAt || null,
    };
  });

  const projectMap = {};
  projectStats.forEach((project) => {
    projectMap[String(project._id)] = {
      count: project.count,
      recentProjectAt: project.recentProjectAt || null,
      projects: project.projects || [],
    };
  });

  const actionMap = {};
  actionStats.forEach((entry) => {
    actionMap[String(entry._id)] = entry.lastActionAt || null;
  });

  return artisans.map((artisan) => ({
    ...artisan.toObject(),
    rating: reviewMap[String(artisan._id)]?.rating ?? 0,
    reviewCount: reviewMap[String(artisan._id)]?.reviewCount ?? 0,
    completedProjects: projectMap[String(artisan._id)]?.count ?? 0,
    portfolioCount: (artisan.portfolio || []).length,
    ...(includeSemanticProjects ? { completedProjectDetails: projectMap[String(artisan._id)]?.projects ?? [] } : {}),
    ...(includeActivitySignals ? {
      lastReviewAt: reviewMap[String(artisan._id)]?.recentReviewAt ?? null,
      lastProjectActivityAt: projectMap[String(artisan._id)]?.recentProjectAt ?? null,
      lastActionAt: actionMap[String(artisan._id)] ?? null,
      lastLoginAt: artisan.lastLoginAt ?? null,
    } : {}),
  }));
};

exports.getAllArtisans = async (req, res) => {
  try {
    const artisans = await Artisan.find({ status: 'active' }).select('-password');
    const enriched = await enrichArtisansWithStats(artisans);

    return res.status(200).json(enriched);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getArtisanById = async (req, res) => {
  try {
    const artisan = await Artisan.findById(req.params.id).select('-password');

    if (!artisan) {
      return res.status(404).json({ message: 'Artisan not found' });
    }

    const [completedProjects, reviews] = await Promise.all([
      Project.countDocuments({ artisan: artisan._id, status: { $in: COMPLETED_PROJECT_STATUSES } }),
      Review.find({ artisan: artisan._id }),
    ]);

    const reviewCount = reviews.length;
    const rating = reviewCount > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
      : 0;
    const portfolioCount = (artisan.portfolio || []).length;

    return res.status(200).json({
      ...artisan.toObject(),
      completedProjects,
      reviewCount,
      rating,
      portfolioCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getArtisanReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ artisan: req.params.id })
      .populate('expert', 'firstName lastName profilePhoto')
      .sort({ createdAt: -1 });
    return res.status(200).json(reviews);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.addArtisanReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const artisan = await Artisan.findById(req.params.id);
    if (!artisan) {
      return res.status(404).json({ message: 'Artisan not found' });
    }

    if (String(req.user._id) === String(artisan._id)) {
      return res.status(400).json({ message: 'You cannot review yourself' });
    }

    const isNew = !(await Review.findOne({ artisan: req.params.id, expert: req.user._id }));

    const review = await Review.findOneAndUpdate(
      { artisan: req.params.id, expert: req.user._id },
      { rating, comment: comment || '' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const populated = await review.populate('expert', 'firstName lastName profilePhoto');

    // Create notification for the artisan
    const expertName = `${populated.expert.firstName} ${populated.expert.lastName}`;
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    await Notification.create({
      type: 'new_review',
      title: isNew ? 'New Review Received' : 'Review Updated',
      message: `${expertName} ${isNew ? 'left' : 'updated'} a ${rating}-star review on your profile. ${stars}${comment ? ` — "${comment}"` : ''}`,
      recipient: artisan._id,
      relatedId: req.user._id,
      relatedModel: 'User',
    });

    return res.status(201).json(populated);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getPublicPortfolioItem = async (req, res) => {
  try {
    const artisan = await Artisan.findById(req.params.id).select('portfolio');
    if (!artisan) {
      return res.status(404).json({ message: 'Artisan not found' });
    }
    const item = artisan.portfolio.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Portfolio item not found' });
    }
    return res.status(200).json(item);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.searchArtisans = async (req, res) => {
  try {
    const query = (req.query.query || '').toString().trim();

    if (!query) {
      return res.status(200).json([]);
    }

    const regex = new RegExp(query, 'i');

    const artisans = await Artisan.find({
      status: 'active',
      $or: [
        { firstName: regex },
        { lastName: regex },
        { domain: regex },
        { location: regex },
        { bio: regex },
        { skills: regex },
        { certifications: regex },
      ],
    }).select('-password');

    const enriched = await enrichArtisansWithStats(artisans);

    return res.status(200).json(enriched);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.aiSearchArtisans = async (req, res) => {
  try {
    const query = (req.body?.query || req.body?.text || '').toString().trim();

    if (!query) {
      return res.status(400).json({ message: 'Please provide a natural-language search query.' });
    }

    const analysis = analyzeIntent(query);
    const mongoFilter = buildMongoFilter(analysis);

    const candidateArtisans = await Artisan.find(mongoFilter).select('-password');
    const enrichedArtisans = await enrichArtisansWithStats(candidateArtisans, {
      includeSemanticProjects: true,
      includeActivitySignals: true,
    });
    const result = await searchArtisansWithAI(enrichedArtisans, query, { limit: 24 });

    return res.status(200).json({
      query,
      analysis: result.analysis,
      total: result.artisans.length,
      artisans: result.artisans,
    });
  } catch (error) {
    return res.status(500).json({ message: 'AI artisan search failed', error: error.message });
  }
};

exports.getMyPortfolio = async (req, res) => {
  try {
    const artisan = await Artisan.findById(req.user._id).select('portfolio');
    if (!artisan) {
      return res.status(404).json({ message: 'Artisan not found' });
    }
    return res.status(200).json(artisan.portfolio || []);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Public: get any artisan's portfolio by artisan ID
exports.getArtisanPortfolio = async (req, res) => {
  try {
    const artisan = await Artisan.findById(req.params.id).select('portfolio');
    if (!artisan) {
      return res.status(404).json({ message: 'Artisan not found' });
    }
    return res.status(200).json(artisan.portfolio || []);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getPortfolioItemById = async (req, res) => {
  try {
    const artisan = await Artisan.findById(req.user._id).select('portfolio');
    if (!artisan) {
      return res.status(404).json({ message: 'Artisan not found' });
    }
    const item = artisan.portfolio.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Portfolio item not found' });
    }
    return res.status(200).json(item);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.addPortfolioItem = async (req, res) => {
  try {
    const artisan = await Artisan.findById(req.user._id);
    if (!artisan) {
      return res.status(404).json({ message: 'Artisan not found' });
    }

    const { title, description, location, completedDate, media } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    const normalizedMedia = [
      ...parseMediaPayload(media),
      ...filesToMedia(req.files || []),
    ];

    artisan.portfolio.push({
      title,
      description,
      location: location || '',
      completedDate: completedDate || undefined,
      source: 'manual',
      media: normalizedMedia,
    });

    await artisan.save({ validateBeforeSave: false });
    return res.status(201).json(artisan.portfolio[artisan.portfolio.length - 1]);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.addPortfolioItemFromProject = async (req, res) => {
  try {
    const artisan = await Artisan.findById(req.user._id);
    if (!artisan) {
      return res.status(404).json({ message: 'Artisan not found' });
    }

    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (String(project.artisan) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized for this project' });
    }

    const isCompleted = project.status === 'completed' || Number(project.progress || 0) >= 100;
    if (!isCompleted) {
      return res.status(400).json({ message: 'Project must be completed before adding to portfolio' });
    }

    const alreadyAdded = (artisan.portfolio || []).some(
      (item) => item.sourceProject && String(item.sourceProject) === String(project._id)
    );
    if (alreadyAdded) {
      return res.status(400).json({ message: 'This project is already in your portfolio' });
    }

    artisan.portfolio.push({
      title: project.title,
      description: project.description || 'Completed project',
      location: project.location || '',
      completedDate: project.endDate || new Date(),
      source: 'project',
      sourceProject: project._id,
      media: [],
    });

    await artisan.save({ validateBeforeSave: false });
    return res.status(201).json(artisan.portfolio[artisan.portfolio.length - 1]);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updatePortfolioItem = async (req, res) => {
  try {
    const artisan = await Artisan.findById(req.user._id);
    if (!artisan) {
      return res.status(404).json({ message: 'Artisan not found' });
    }

    const item = artisan.portfolio.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Portfolio item not found' });
    }

    const { title, description, location, completedDate, media } = req.body;

    if (title !== undefined) item.title = title;
    if (description !== undefined) item.description = description;
    if (location !== undefined) item.location = location;
    if (completedDate !== undefined) item.completedDate = completedDate;

    if (media !== undefined) {
      item.media = parseMediaPayload(media);
    }

    await artisan.save({ validateBeforeSave: false });
    return res.status(200).json(item);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deletePortfolioItem = async (req, res) => {
  try {
    const artisan = await Artisan.findById(req.user._id);
    if (!artisan) {
      return res.status(404).json({ message: 'Artisan not found' });
    }

    const item = artisan.portfolio.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Portfolio item not found' });
    }

    removePortfolioMediaFiles(item.media || []);
    item.deleteOne();
    await artisan.save({ validateBeforeSave: false });
    return res.status(200).json({ message: 'Portfolio item deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.addMediaToPortfolioItem = async (req, res) => {
  try {
    const artisan = await Artisan.findById(req.user._id);
    if (!artisan) {
      return res.status(404).json({ message: 'Artisan not found' });
    }

    const item = artisan.portfolio.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Portfolio item not found' });
    }

    const uploadedMedia = filesToMedia(req.files || []);
    const manualMedia = parseMediaPayload(req.body.media);
    const combined = [...uploadedMedia, ...manualMedia];

    if (!combined.length) {
      return res.status(400).json({ message: 'Please provide at least one media file (image/video)' });
    }

    item.media = [...(item.media || []), ...combined];
    await artisan.save({ validateBeforeSave: false });

    return res.status(200).json(item);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
