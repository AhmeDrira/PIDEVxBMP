jest.mock('../../../models/ActionLog', () => ({
  create: jest.fn(),
}));

const ActionLog = require('../../../models/ActionLog');
const { logAction } = require('../../../utils/actionLogger');

describe('actionLogger (unit)', () => {
  it('should persist normalized payload with actor details and forwarded ip', async () => {
    // Arrange
    const req = {
      user: {
        _id: 'user-1',
        firstName: 'Alice',
        lastName: 'Martin',
        role: 'artisan',
      },
      headers: {
        'x-forwarded-for': '12.13.14.15, 10.0.0.1',
        'user-agent': 'jest-agent',
      },
      socket: { remoteAddress: '127.0.0.1' },
    };

    const payload = {
      actionKey: 'artisan.project.create',
      actionLabel: 'Created project',
      entityType: 'project',
      entityId: 'project-10',
      targetName: 'Project X',
      description: 'Project created',
      metadata: { safe: true },
    };

    // Act
    await logAction(req, payload);

    // Assert
    expect(ActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        actorName: 'Alice Martin',
        actorRole: 'artisan',
        actionKey: 'artisan.project.create',
        entityType: 'project',
        entityId: 'project-10',
        ipAddress: '12.13.14.15',
        userAgent: 'jest-agent',
      })
    );
  });

  it('should fallback actor name to email and role to system when role is unsupported', async () => {
    // Arrange
    const req = {
      user: {
        _id: 'u-2',
        firstName: '',
        lastName: '',
        email: 'ops@example.com',
        role: 'guest',
      },
      headers: {},
      socket: { remoteAddress: '10.10.10.10' },
    };

    // Act
    await logAction(req, {
      actionKey: 'system.action',
      actionLabel: 'System action',
      entityType: 'audit',
    });

    // Assert
    expect(ActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorName: 'ops@example.com',
        actorRole: 'system',
        ipAddress: '10.10.10.10',
      })
    );
  });

  it('should support actorOverride and keep metadata object intact', async () => {
    // Arrange
    const req = {
      user: null,
      headers: { 'user-agent': 'override-agent' },
      socket: { remoteAddress: '172.16.0.5' },
    };

    const payload = {
      actorOverride: {
        _id: 'admin-1',
        role: 'admin',
        isSuperAdmin: true,
        firstName: '',
        lastName: '',
      },
      actionKey: 'admin.user.suspend',
      actionLabel: 'Suspended user',
      entityType: 'user',
      metadata: { reason: 'policy', nested: { severity: 'high' } },
    };

    // Act
    await logAction(req, payload);

    // Assert
    expect(ActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        actorRole: 'admin',
        actorAdminType: 'super',
        metadata: { reason: 'policy', nested: { severity: 'high' } },
        userAgent: 'override-agent',
      })
    );
  });

  it('should swallow persistence failures without throwing to caller', async () => {
    // Arrange
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    ActionLog.create.mockRejectedValueOnce(new Error('insert failed'));

    // Act + Assert
    await expect(
      logAction(
        { user: { role: 'artisan' }, headers: {}, socket: {} },
        { actionKey: 'k', actionLabel: 'l', entityType: 't' }
      )
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
