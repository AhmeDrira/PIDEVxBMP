const { Artisan } = require('../models/User');
const Project = require('../models/Project');
const Review = require('../models/Review');
const fs = require('fs');
const path = require('path');

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

exports.getAllArtisans = async (req, res) => {
  try {
    const artisans = await Artisan.find({ status: 'active' }).select('-password');
    return res.status(200).json(artisans);
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

    return res.status(200).json(artisan);
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
      ],
    }).select('-password');

    return res.status(200).json(artisans);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
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

// Public: get a specific portfolio item by artisan ID and item ID
exports.getPublicPortfolioItemById = async (req, res) => {
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

// Public: get all reviews for an artisan
exports.getArtisanReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ artisanId: req.params.id }).sort({ createdAt: -1 });
    const averageRating =
      reviews.length > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
        : 0;
    return res.status(200).json({ reviews, averageRating, total: reviews.length });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Protected (expert): add a review for an artisan
exports.addArtisanReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || !comment) {
      return res.status(400).json({ message: 'Rating and comment are required' });
    }
    const existing = await Review.findOne({ artisanId: req.params.id, expertId: req.user._id });
    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this artisan' });
    }
    const review = await Review.create({
      artisanId: req.params.id,
      expertId: req.user._id,
      expertName: `${req.user.firstName} ${req.user.lastName}`,
      rating: Number(rating),
      comment,
    });
    return res.status(201).json(review);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
