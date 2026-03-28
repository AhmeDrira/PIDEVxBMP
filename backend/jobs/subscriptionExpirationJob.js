const cron = require('node-cron');
const { User } = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Runs daily at 08:00 — sends expiration reminder notifications to artisans.
 * Scenarios:
 *   J-7  → subscription expires in exactly 7 days
 *   J-1  → subscription expires in exactly 1 day
 *   J+0  → subscription has just expired (status still 'active' but endDate passed)
 */
const runSubscriptionExpirationJob = async () => {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // normalize to start of day

    const artisans = await User.find({
      role: 'artisan',
      'subscription.status': 'active',
    }).select('_id firstName lastName subscription');

    for (const artisan of artisans) {
      const endDate = artisan.subscription?.endDate
        ? new Date(artisan.subscription.endDate)
        : null;
      if (!endDate) continue;

      endDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check if notification already exists for today
      const todayStart = new Date(now);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const alreadySent = await Notification.findOne({
        recipient: artisan._id,
        type: { $in: ['subscription_expiring_7d', 'subscription_expiring_1d', 'subscription_expired'] },
        createdAt: { $gte: todayStart, $lte: todayEnd },
      });

      if (alreadySent) continue;

      if (diffDays === 7) {
        await Notification.create({
          type: 'subscription_expiring_7d',
          title: 'Subscription Expiring Soon',
          message: 'Your subscription expires in 7 days. Renew now to avoid any interruption to your services.',
          recipient: artisan._id,
          recipientRole: 'artisan',
        });
      } else if (diffDays === 1) {
        await Notification.create({
          type: 'subscription_expiring_1d',
          title: 'Last Day of Subscription',
          message: 'Today is the last day of your active subscription. Remember to renew to stay fully operational.',
          recipient: artisan._id,
          recipientRole: 'artisan',
        });
      } else if (diffDays <= 0) {
        // Mark as expired and notify
        artisan.subscription.status = 'expired';
        await artisan.save();

        await Notification.create({
          type: 'subscription_expired',
          title: 'Subscription Expired',
          message: 'Your subscription has expired. Your projects are now in read-only mode. Reactivate your plan to regain full access.',
          recipient: artisan._id,
          recipientRole: 'artisan',
        });
      }
    }

    console.log(`[SubscriptionJob] Ran at ${new Date().toISOString()} — checked ${artisans.length} artisan(s).`);
  } catch (err) {
    console.error('[SubscriptionJob] Error:', err.message);
  }
};

/**
 * Schedule: every day at 08:00 server time.
 * Also runs once immediately on startup so dev/test can verify it works.
 */
const initSubscriptionExpirationJob = () => {
  // Run once at startup
  runSubscriptionExpirationJob();

  // Then every day at 08:00
  cron.schedule('0 8 * * *', runSubscriptionExpirationJob, {
    timezone: 'Africa/Tunis',
  });

  console.log('[SubscriptionJob] Scheduled daily at 08:00 Africa/Tunis.');
};

module.exports = { initSubscriptionExpirationJob };
