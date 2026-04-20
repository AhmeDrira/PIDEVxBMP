const { buildReq, buildRes, chainableQuery } = require('../../http.mock');

jest.mock('../../../models/Notification', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  updateMany: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  deleteMany: jest.fn(),
}));

const Notification = require('../../../models/Notification');
const controller = require('../../../controllers/notificationController');

describe('notificationController', () => {
  test('getNotifications -> 200 for regular user', async () => {
    Notification.find.mockReturnValue(chainableQuery([{ _id: 'n1', read: false }]));

    const req = buildReq({ user: { _id: 'u1', role: 'artisan' } });
    const res = buildRes();

    await controller.getNotifications(req, res);

    expect(res.json).toHaveBeenCalledWith([{ _id: 'n1', read: false }]);
    expect(Notification.find).toHaveBeenCalledWith({ recipient: 'u1' });
  });

  test('getUnreadCount -> 200 with count', async () => {
    Notification.countDocuments.mockResolvedValue(3);

    const req = buildReq({ user: { _id: 'u1', role: 'expert' } });
    const res = buildRes();

    await controller.getUnreadCount(req, res);

    expect(res.json).toHaveBeenCalledWith({ count: 3 });
  });

  test('markRead -> 404 when notification is missing', async () => {
    Notification.findByIdAndUpdate.mockResolvedValue(null);

    const req = buildReq({ params: { id: 'x' } });
    const res = buildRes();

    await controller.markRead(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('markAllRead -> 200 updates unread notifications', async () => {
    Notification.updateMany.mockResolvedValue({ modifiedCount: 2 });

    const req = buildReq({ user: { _id: 'u1', role: 'artisan' } });
    const res = buildRes();

    await controller.markAllRead(req, res);

    expect(Notification.updateMany).toHaveBeenCalledWith(
      { recipient: 'u1', read: false },
      { read: true }
    );
    expect(res.json).toHaveBeenCalledWith({ message: 'All notifications marked as read' });
  });

  test('deleteAll -> 500 on internal error', async () => {
    Notification.deleteMany.mockRejectedValue(new Error('db fail'));

    const req = buildReq({ user: { _id: 'u1', role: 'artisan' } });
    const res = buildRes();

    await controller.deleteAll(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.message).toBe('Server error');
  });
});
