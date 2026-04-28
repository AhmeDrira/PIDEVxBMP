jest.mock('../../../models/ActionLog', () => ({
  create: jest.fn(),
}));

const ActionLog = require('../../../models/ActionLog');
const { logAction } = require('../../../utils/actionLogger');

describe('actionLogger utility', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('logAction -> writes action log with actor metadata and forwarded IP', async () => {
    ActionLog.create.mockResolvedValue({ _id: 'log1' });

    const req = {
      user: {
        _id: 'u1',
        firstName: 'Ali',
        lastName: 'Ben',
        role: 'artisan',
      },
      headers: {
        'x-forwarded-for': '1.1.1.1, 2.2.2.2',
        'user-agent': 'jest-agent',
      },
      socket: { remoteAddress: '9.9.9.9' },
    };

    await logAction(req, {
      actionKey: 'project.create',
      actionLabel: 'Created project',
      entityType: 'project',
      entityId: 'p1',
      description: 'Created from unit test',
    });

    expect(ActionLog.create).toHaveBeenCalledTimes(1);
    const payload = ActionLog.create.mock.calls[0][0];
    expect(payload.actorName).toBe('Ali Ben');
    expect(payload.actorRole).toBe('artisan');
    expect(payload.ipAddress).toBe('1.1.1.1');
    expect(payload.userAgent).toBe('jest-agent');
  });

  test('logAction -> uses Super Admin label when actor override is super admin without name', async () => {
    ActionLog.create.mockResolvedValue({ _id: 'log2' });

    const req = {
      user: null,
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    };

    await logAction(req, {
      actorOverride: {
        _id: 'admin1',
        role: 'admin',
        adminType: 'super',
      },
      actionKey: 'admin.audit',
      actionLabel: 'Audit action',
      entityType: 'user',
      entityId: 'u2',
      description: 'Audit',
    });

    const payload = ActionLog.create.mock.calls[0][0];
    expect(payload.actorName).toBe('Super Admin');
    expect(payload.actorRole).toBe('admin');
    expect(payload.actorAdminType).toBe('super');
  });

  test('logAction -> swallows persistence errors without throwing', async () => {
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    ActionLog.create.mockRejectedValue(new Error('write failed'));

    const req = {
      user: { _id: 'u1', role: 'artisan' },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    };

    await expect(
      logAction(req, {
        actionKey: 'x',
        actionLabel: 'y',
        entityType: 'z',
      })
    ).resolves.toBeUndefined();

    expect(mockConsoleError).toHaveBeenCalled();
    mockConsoleError.mockRestore();
  });
});
