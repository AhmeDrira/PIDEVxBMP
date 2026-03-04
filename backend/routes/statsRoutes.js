const express = require('express');
const router = express.Router();
const { User } = require('../models/User');
const Project = require('../models/Project');
const Quote = require('../models/Quote');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

/**
 * GET /api/stats
 * Public endpoint returning:
 *   activeUsers  – count of users with status 'active'
 *   projects     – total project count
 *   satisfaction – 0-100 score based on:
 *                    60 % quote approval rate (artisan↔manufacturer/expert interaction)
 *                    25 % completed-project rate
 *                    15 % cross-role conversation activity rate
 *                  (each component is only included when there is data for it)
 */
router.get('/', async (req, res) => {
  try {
    // ── Active users ────────────────────────────────────────────────
    const activeUsers = await User.countDocuments({ status: 'active' });

    // ── Projects ────────────────────────────────────────────────────
    const totalProjects = await Project.countDocuments();
    const completedProjects = await Project.countDocuments({ status: 'completed' });

    // ── Quote approval rate ─────────────────────────────────────────
    const totalQuotes = await Quote.countDocuments();
    const approvedQuotes = await Quote.countDocuments({ status: 'approved' });

    // ── Cross-role conversation activity ────────────────────────────
    // Find conversations whose participants span at least two distinct
    // professional roles (manufacturer, expert, artisan).
    const professionalRoles = ['manufacturer', 'expert', 'artisan'];

    const conversations = await Conversation.find().populate('participants', 'role');

    const crossRoleConvIds = conversations
      .filter(conv => {
        const roles = new Set(
          conv.participants.map(p => p.role).filter(r => professionalRoles.includes(r))
        );
        return roles.size >= 2;
      })
      .map(conv => conv._id);

    const crossRoleTotal = crossRoleConvIds.length;

    // Count how many of those have at least a two-message exchange
    let activeInteractions = 0;
    if (crossRoleTotal > 0) {
      const msgGroups = await Message.aggregate([
        { $match: { conversation: { $in: crossRoleConvIds } } },
        { $group: { _id: '$conversation', count: { $sum: 1 } } },
      ]);
      activeInteractions = msgGroups.filter(g => g.count >= 2).length;
    }

    // ── Satisfaction formula ────────────────────────────────────────
    // Collect only components that have data.
    const components = [];

    if (totalQuotes > 0)
      components.push({ score: approvedQuotes / totalQuotes, weight: 0.60 });

    if (totalProjects > 0)
      components.push({ score: completedProjects / totalProjects, weight: 0.25 });

    if (crossRoleTotal > 0)
      components.push({ score: activeInteractions / crossRoleTotal, weight: 0.15 });

    let satisfaction = 0;
    if (components.length > 0) {
      const totalWeight = components.reduce((s, c) => s + c.weight, 0);
      const raw = components.reduce((s, c) => s + c.score * (c.weight / totalWeight), 0);
      satisfaction = Math.round(raw * 100);
    }

    res.json({ activeUsers, projects: totalProjects, satisfaction });
  } catch (error) {
    console.error('[stats]', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
