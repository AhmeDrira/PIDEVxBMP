const ActionLog = require('../models/ActionLog');

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), 100);
};

const buildDateRange = (from, to) => {
  const createdAt = {};

  const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;

  const start = hasValue(from) ? new Date(from) : null;
  const end = hasValue(to) ? new Date(to) : null;

  if (start && !Number.isNaN(start.getTime())) {
    // When frontend sends a date-only string (YYYY-MM-DD), normalize to start of that day.
    start.setHours(0, 0, 0, 0);
    createdAt.$gte = start;
  }

  if (end && !Number.isNaN(end.getTime())) {
    // Normalize to end-of-day to make the range inclusive for date-only inputs.
    end.setHours(23, 59, 59, 999);
    createdAt.$lte = end;
  }

  if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) {
    const tmp = createdAt.$gte;
    createdAt.$gte = createdAt.$lte;
    createdAt.$lte = tmp;
  }

  return Object.keys(createdAt).length ? createdAt : null;
};

const listActionLogs = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = normalizeLimit(req.query.limit);
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.actorRole) {
      query.actorRole = String(req.query.actorRole).toLowerCase();
    }

    if (req.query.actionKey) {
      query.actionKey = String(req.query.actionKey);
    }

    const dateRange = buildDateRange(req.query.from, req.query.to);
    if (dateRange) {
      query.createdAt = dateRange;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(String(req.query.search), 'i');
      query.$or = [
        { actorName: searchRegex },
        { actionLabel: searchRegex },
        { actionKey: searchRegex },
        { entityType: searchRegex },
        { description: searchRegex },
        { targetName: searchRegex },
        { 'metadata.invoiceNumber': searchRegex },
        { 'metadata.quoteNumber': searchRegex },
        { 'metadata.stripeSessionId': searchRegex },
        { 'metadata.items.name': searchRegex },
      ];
    }

    const [
      logs,
      total,
      paymentEvents,
      marketplaceEvents,
      invoiceInstallmentEvents,
      manufacturerProductEvents,
      adminSecurityEvents,
      roleBuckets,
      topActions,
    ] = await Promise.all([
      ActionLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ActionLog.countDocuments(query),
      ActionLog.countDocuments({ ...query, actionKey: /payment|checkout|subscription/i }),
      ActionLog.countDocuments({ ...query, actionKey: /^marketplace\./i }),
      ActionLog.countDocuments({ ...query, actionKey: /^artisan\.invoice\.payment\./i }),
      ActionLog.countDocuments({ ...query, actionKey: /^manufacturer\.product\./i }),
      ActionLog.countDocuments({ ...query, actionKey: /^admin\./i }),
      ActionLog.aggregate([
        { $match: query },
        { $group: { _id: '$actorRole', count: { $sum: 1 } } },
      ]),
      ActionLog.aggregate([
        { $match: query },
        { $group: { _id: '$actionKey', count: { $sum: 1 }, actionLabel: { $first: '$actionLabel' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const byRole = roleBuckets.reduce((acc, item) => {
      acc[String(item._id || 'system')] = Number(item.count || 0);
      return acc;
    }, {});

    return res.status(200).json({
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
      summary: {
        total,
        paymentEvents,
        marketplaceEvents,
        invoiceInstallmentEvents,
        manufacturerProductEvents,
        adminSecurityEvents,
        byRole,
        topActions: topActions.map((item) => ({
          actionKey: item._id,
          actionLabel: item.actionLabel || item._id,
          count: item.count,
        })),
      },
    });
  } catch (error) {
    console.error('listActionLogs error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const deleteActionLog = async (req, res) => {
  try {
    const deleted = await ActionLog.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Log not found' });
    }
    return res.status(200).json({ message: 'Log deleted' });
  } catch (error) {
    console.error('deleteActionLog error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const deleteManyActionLogs = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) {
      return res.status(400).json({ message: 'Please provide at least one log id' });
    }

    const result = await ActionLog.deleteMany({ _id: { $in: ids } });
    return res.status(200).json({
      message: 'Logs deleted',
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    console.error('deleteManyActionLogs error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  listActionLogs,
  deleteActionLog,
  deleteManyActionLogs,
};
