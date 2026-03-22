const express = require('express');
const router = express.Router();
const { User } = require('../models/User');
const Project = require('../models/Project');
const Invoice = require('../models/Invoice');
const Quote = require('../models/Quote');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

/**
 * GET /api/stats
 * Public endpoint returning:
 *   totalUsers    – total user count
 *   activeUsers   – count of users with status 'active'
 *   activeProjects – project count with status 'active'
 *   totalProjects – total project count
 *   totalInvoices – total invoice count
 *   satisfaction  – 0-100 score based on:
 *                    60 % quote approval rate (artisan↔manufacturer/expert interaction)
 *                    25 % completed-project rate
 *                    15 % cross-role conversation activity rate
 *                  (each component is only included when there is data for it)
 */
router.get('/', async (req, res) => {
  try {
    const toMonthKey = (year, month) => `${year}-${month}`;
    const monthFormatter = new Intl.DateTimeFormat('en', { month: 'short' });
    const getLastMonths = (count) => {
      const months = [];
      const now = new Date();
      for (let i = count - 1; i >= 0; i -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          label: monthFormatter.format(date),
        });
      }
      return months;
    };

    // ── Active users ────────────────────────────────────────────────
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });

    // ── User distribution by role ───────────────────────────────────
    const roleDistributionRaw = await User.aggregate([
      { $group: { _id: '$role', value: { $sum: 1 } } },
    ]);
    const roleCounts = roleDistributionRaw.reduce((acc, entry) => {
      acc[entry._id] = entry.value;
      return acc;
    }, {});

    // ── Projects ────────────────────────────────────────────────────
    const totalProjects = await Project.countDocuments();
    const activeProjects = await Project.countDocuments({ status: 'active' });
    const completedProjects = await Project.countDocuments({ status: 'completed' });

    // ── Invoices (Orders) ───────────────────────────────────────────
    const totalInvoices = await Invoice.countDocuments();

    // ── Growth data (last 6 months) ─────────────────────────────────
    const months = getLastMonths(6);

    const userGrowthRaw = await User.aggregate([
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]);
    const userGrowthMap = new Map(userGrowthRaw.map((row) => [toMonthKey(row._id.year, row._id.month), row.count]));
    const userGrowth = months.map((m) => ({
      month: m.label,
      users: userGrowthMap.get(toMonthKey(m.year, m.month)) || 0,
    }));

    const projectActivityRaw = await Project.aggregate([
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]);
    const projectActivityMap = new Map(projectActivityRaw.map((row) => [toMonthKey(row._id.year, row._id.month), row.count]));
    const projectActivity = months.map((m) => ({
      month: m.label,
      projects: projectActivityMap.get(toMonthKey(m.year, m.month)) || 0,
    }));

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

    res.json({
      totalUsers,
      activeUsers,
      activeProjects,
      totalProjects,
      totalInvoices,
      satisfaction,
      roleCounts,
      userGrowth,
      projectActivity,
    });
  } catch (error) {
    console.error('[stats]', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
