jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

jest.mock('../../../models/User', () => ({
  User: {
    find: jest.fn(),
  },
}));

jest.mock('../../../models/Notification', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

const cron = require('node-cron');
const { User } = require('../../../models/User');
const Notification = require('../../../models/Notification');
const { initSubscriptionExpirationJob } = require('../../../jobs/subscriptionExpirationJob');

describe('subscriptionExpirationJob', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('initSubscriptionExpirationJob -> schedules cron and sends J-7 reminder', async () => {
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    endDate.setDate(endDate.getDate() + 7);

    const artisans = [
      {
        _id: 'artisan1',
        firstName: 'Ali',
        lastName: 'Ben',
        subscription: { status: 'active', endDate },
        save: jest.fn().mockResolvedValue(),
      },
    ];

    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue(artisans),
    });
    Notification.findOne.mockResolvedValue(null);
    Notification.create.mockResolvedValue({ _id: 'n1' });

    initSubscriptionExpirationJob();

    await new Promise((resolve) => setImmediate(resolve));

    expect(cron.schedule).toHaveBeenCalledWith(
      '0 8 * * *',
      expect.any(Function),
      expect.objectContaining({ timezone: 'Africa/Tunis' })
    );
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'subscription_expiring_7d', recipient: 'artisan1' })
    );
  });
});
