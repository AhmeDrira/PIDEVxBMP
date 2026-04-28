const { buildReq, buildRes, chainableQuery } = require('../mocks/http.mock');

jest.mock('../../../models/Report', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../../../models/Notification', () => ({
  create: jest.fn(),
}));

const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn(),
}));

const Report = require('../../../models/Report');
const Notification = require('../../../models/Notification');
const nodemailer = require('nodemailer');
const { logAction } = require('../../../utils/actionLogger');
const controller = require('../../../controllers/reportController');

describe('reportController', () => {
  test('createReport -> 401 without authenticated user', async () => {
    const req = buildReq({ user: null, body: {} });
    const res = buildRes();

    await controller.createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('createReport -> 400 for invalid reportType', async () => {
    const req = buildReq({
      user: { _id: 'u1', role: 'artisan' },
      body: { reportType: 'bad', reason: 'Issue' },
    });
    const res = buildRes();

    await controller.createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createReport -> 201 on valid input', async () => {
    Report.create.mockResolvedValue({ _id: 'r1' });

    const req = buildReq({
      user: { _id: 'u1', role: 'artisan', firstName: 'Ali', lastName: 'Ben' },
      body: { reportType: 'app', reason: 'Bug detail', details: 'Screen crashes' },
    });
    const res = buildRes();

    await controller.createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Notification.create).toHaveBeenCalled();
    expect(logAction).toHaveBeenCalled();
  });

  test('updateReportStatus -> 403 when user lacks permissions', async () => {
    const req = buildReq({
      user: { _id: 'a1', role: 'admin', isSuperAdmin: false, permissions: { canManageReports: false } },
      params: { id: 'r1' },
      body: { status: 'accepted' },
    });
    const res = buildRes();

    await controller.updateReportStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('updateReportStatus -> 404 when report does not exist', async () => {
    Report.findById.mockReturnValue(chainableQuery(null));

    const req = buildReq({
      user: { _id: 'a1', role: 'admin', isSuperAdmin: true },
      params: { id: 'missing' },
      body: { status: 'accepted' },
    });
    const res = buildRes();

    await controller.updateReportStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('updateReportStatus -> 200 and sends email when status changes', async () => {
    process.env.SMTP_SERVICE = 'gmail';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'password';

    const reportDoc = {
      _id: 'r1',
      reportType: 'user',
      targetRole: 'artisan',
      reason: 'spam',
      status: 'submitted',
      reporter: { firstName: 'A', lastName: 'B', email: 'reporter@example.com' },
      targetUser: null,
      save: jest.fn().mockResolvedValue(),
    };
    Report.findById.mockReturnValue(chainableQuery(reportDoc));

    const req = buildReq({
      user: { _id: 'a1', role: 'admin', isSuperAdmin: true },
      params: { id: 'r1' },
      body: { status: 'accepted' },
    });
    const res = buildRes();

    await controller.updateReportStatus(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(logAction).toHaveBeenCalled();
    expect(nodemailer.createTransport).toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalled();
  });

  test('getMyReports -> 500 on internal error', async () => {
    Report.find.mockImplementation(() => {
      throw new Error('db fail');
    });

    const req = buildReq({ user: { _id: 'u1' } });
    const res = buildRes();

    await controller.getMyReports(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
