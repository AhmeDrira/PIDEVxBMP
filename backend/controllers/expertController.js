const { Expert } = require('../models/User');

const pickAllowedFields = (body, allowedFields) => {
  const updates = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates[field] = body[field];
    }
  }
  return updates;
};

exports.getCurrentExpert = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const expert = await Expert.findById(req.user._id).select('-password');
    console.log('GET /api/experts/me - Expert ID:', req.user._id);
    console.log('GET /api/experts/me - Expert document:', expert);

    if (!expert) {
      return res.status(404).json({ message: 'Expert not found' });
    }

    res.status(200).json(expert);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateExpertProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const expertId = req.user._id;

    const allowedFields = ['firstName', 'lastName', 'phone', 'domain'];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    console.log("PUT /api/experts/me - Expert ID:", expertId);
    console.log("Updates received:", updates);

    const updatedExpert = await Expert.findByIdAndUpdate(
      expertId,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedExpert) {
      return res.status(404).json({ message: 'Expert not found' });
    }

    console.log("Updated expert:", updatedExpert);

    res.status(200).json(updatedExpert);

  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: 'Server error' });
  }
};
