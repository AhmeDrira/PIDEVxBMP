const MissingProductSearch = require('../models/MissingProductSearch');

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const trackMissingProduct = async (req, res) => {
  try {
    const genericName = String(req.body?.generic_name || req.body?.name || '').trim();
    const searchKeyword = String(req.body?.search_keyword || genericName || '').trim();
    const suggestedBrand = String(req.body?.suggested_brand || '').trim();
    const projectId = String(req.body?.projectId || '').trim();

    if (!genericName) {
      return res.status(400).json({ message: 'generic_name is required.' });
    }

    const created = await MissingProductSearch.create({
      user: req.user?._id,
      project: projectId || null,
      genericName,
      normalizedName: normalizeText(genericName),
      suggestedBrand,
      searchKeyword,
      source: 'ai-shopper',
    });

    return res.status(201).json({
      success: true,
      id: created._id,
    });
  } catch (error) {
    console.error('[analytics.trackMissingProduct] error:', error);
    return res.status(500).json({ message: 'Unable to track missing product search.' });
  }
};

module.exports = {
  trackMissingProduct,
};
