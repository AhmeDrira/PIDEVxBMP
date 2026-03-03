const { Artisan } = require('../models/User');

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
