jest.mock('../../../models/User', () => ({
  User: {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
}));

jest.mock('../../../models/Project', () => ({
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
}));

jest.mock('../../../models/Invoice', () => ({
  countDocuments: jest.fn(),
}));

jest.mock('../../../models/Quote', () => ({
  countDocuments: jest.fn(),
}));

jest.mock('../../../models/Conversation', () => ({
  find: jest.fn(),
}));

jest.mock('../../../models/Message', () => ({
  aggregate: jest.fn(),
}));

const { buildReq, buildRes } = require('../../http.mock');
const { User } = require('../../../models/User');
const Project = require('../../../models/Project');
const Invoice = require('../../../models/Invoice');
const Quote = require('../../../models/Quote');
const Conversation = require('../../../models/Conversation');
const Message = require('../../../models/Message');
const router = require('../../../routes/statsRoutes');
const { getRouteHandlers } = require('./routeTestUtils');

describe('statsRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET / computes stats and normalized satisfaction score', async () => {
    User.countDocuments
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(60);

    User.aggregate
      .mockResolvedValueOnce([
        { _id: 'artisan', value: 50 },
        { _id: 'manufacturer', value: 30 },
        { _id: 'expert', value: 20 },
      ])
      .mockResolvedValueOnce([]);

    Project.countDocuments
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(4);
    Project.aggregate.mockResolvedValueOnce([]);

    Invoice.countDocuments.mockResolvedValue(5);

    Quote.countDocuments
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7);

    const conversations = [
      {
        _id: 'c1',
        participants: [{ role: 'artisan' }, { role: 'manufacturer' }],
      },
      {
        _id: 'c2',
        participants: [{ role: 'artisan' }, { role: 'expert' }],
      },
      {
        _id: 'c3',
        participants: [{ role: 'artisan' }, { role: 'artisan' }],
      },
    ];
    Conversation.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(conversations),
    });

    Message.aggregate.mockResolvedValue([
      { _id: 'c1', count: 2 },
      { _id: 'c2', count: 1 },
    ]);

    const [handler] = getRouteHandlers(router, 'GET', '/');
    const req = buildReq();
    const res = buildRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.body.totalUsers).toBe(100);
    expect(res.body.activeUsers).toBe(60);
    expect(res.body.totalProjects).toBe(10);
    expect(res.body.activeProjects).toBe(4);
    expect(res.body.totalInvoices).toBe(5);
    expect(res.body.satisfaction).toBe(60);
    expect(res.body.roleCounts).toEqual({ artisan: 50, manufacturer: 30, expert: 20 });
    expect(Array.isArray(res.body.userGrowth)).toBe(true);
    expect(Array.isArray(res.body.projectActivity)).toBe(true);
    expect(res.body.userGrowth).toHaveLength(6);
    expect(res.body.projectActivity).toHaveLength(6);
  });

  test('GET / returns 500 when a dependency throws', async () => {
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    User.countDocuments.mockRejectedValue(new Error('db down'));

    const [handler] = getRouteHandlers(router, 'GET', '/');
    const req = buildReq();
    const res = buildRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ message: 'Server error' });
    expect(mockConsoleError).toHaveBeenCalled();

    mockConsoleError.mockRestore();
  });
});

