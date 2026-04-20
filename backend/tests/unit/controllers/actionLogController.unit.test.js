const { buildReq, buildRes, chainableQuery } = require('../../http.mock');

jest.mock('../../../models/ActionLog', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  deleteMany: jest.fn(),
}));

const ActionLog = require('../../../models/ActionLog');
const {
  listActionLogs,
  deleteActionLog,
  deleteManyActionLogs,
} = require('../../../controllers/actionLogController');

const expectStatusBeforeJson = (res, statusCode) => {
  expect(res.status).toHaveBeenCalledWith(statusCode);
  expect(res.status).toHaveBeenCalledTimes(1);
  expect(res.json).toHaveBeenCalledTimes(1);
  expect(res.status.mock.invocationCallOrder[0]).toBeLessThan(res.json.mock.invocationCallOrder[0]);
};

describe('actionLogController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listActionLogs -> 200 with pagination and summary', async () => {
    const logs = [{ _id: 'l1', actionKey: 'marketplace.checkout' }];
    const logQuery = chainableQuery(logs);
    ActionLog.find.mockReturnValue(logQuery);
    ActionLog.countDocuments
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4);
    ActionLog.aggregate
      .mockResolvedValueOnce([{ _id: 'artisan', count: 7 }])
      .mockResolvedValueOnce([{ _id: 'marketplace.checkout', count: 3, actionLabel: 'Checkout' }]);

    const req = buildReq({ query: { page: '1', limit: '20' } });
    const res = buildRes();

    await listActionLogs(req, res);

    expectStatusBeforeJson(res, 200);
    expect(res.body.logs).toEqual(logs);
    expect(res.body.pagination).toEqual(
      expect.objectContaining({
        total: 12,
        page: 1,
        limit: 20,
      })
    );
    expect(res.body.summary.byRole.artisan).toBe(7);
    expect(ActionLog.find).toHaveBeenCalledWith({});
    expect(logQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(logQuery.skip).toHaveBeenCalledWith(0);
    expect(logQuery.limit).toHaveBeenCalledWith(20);
    expect(ActionLog.countDocuments).toHaveBeenCalledTimes(7);
  });

  test('listActionLogs -> defaults invalid page and non-numeric limit', async () => {
    const logQuery = chainableQuery([]);
    ActionLog.find.mockReturnValue(logQuery);
    ActionLog.countDocuments.mockResolvedValue(0);
    ActionLog.aggregate.mockResolvedValue([]);

    const req = buildReq({ query: { page: '0', limit: 'abc' } });
    const res = buildRes();

    await listActionLogs(req, res);

    expectStatusBeforeJson(res, 200);
    expect(logQuery.skip).toHaveBeenCalledWith(0);
    expect(logQuery.limit).toHaveBeenCalledWith(20);
    expect(res.body.pagination).toEqual(
      expect.objectContaining({
        total: 0,
        page: 1,
        limit: 20,
        pages: 1,
      })
    );
  });

  test('listActionLogs -> clamps oversized limit to 100', async () => {
    const logQuery = chainableQuery([]);
    ActionLog.find.mockReturnValue(logQuery);
    ActionLog.countDocuments.mockResolvedValue(0);
    ActionLog.aggregate.mockResolvedValue([]);

    const req = buildReq({ query: { page: '-5', limit: '999' } });
    const res = buildRes();

    await listActionLogs(req, res);

    expectStatusBeforeJson(res, 200);
    expect(logQuery.skip).toHaveBeenCalledWith(0);
    expect(logQuery.limit).toHaveBeenCalledWith(100);
    expect(res.body.pagination.limit).toBe(100);
  });

  test('deleteManyActionLogs -> 400 when ids are missing', async () => {
    const req = buildReq({ body: { ids: [] } });
    const res = buildRes();

    await deleteManyActionLogs(req, res);

    expectStatusBeforeJson(res, 400);
    expect(res.body.message).toMatch(/at least one log id/i);
  });

  test('deleteActionLog -> 404 when log does not exist', async () => {
    ActionLog.findByIdAndDelete.mockResolvedValue(null);

    const req = buildReq({ params: { id: 'missing' } });
    const res = buildRes();

    await deleteActionLog(req, res);

    expectStatusBeforeJson(res, 404);
    expect(res.body).toEqual({ message: 'Log not found' });
  });

  test('deleteActionLog -> 500 on internal error', async () => {
    ActionLog.findByIdAndDelete.mockRejectedValue(new Error('db down'));

    const req = buildReq({ params: { id: 'x' } });
    const res = buildRes();

    await deleteActionLog(req, res);

    expectStatusBeforeJson(res, 500);
    expect(res.body.message).toBe('Server error');
  });
});
