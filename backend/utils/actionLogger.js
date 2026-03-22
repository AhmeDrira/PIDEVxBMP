const ActionLog = require('../models/ActionLog');

const getActorName = (actor) => {
  if (!actor) return 'Unknown';
  const fullName = `${actor.firstName || ''} ${actor.lastName || ''}`.trim();
  if (fullName) return fullName;
  if (actor.email) return actor.email;
  if (actor.role === 'admin' && (actor.adminType === 'super' || actor.isSuperAdmin)) {
    return 'Super Admin';
  }
  return 'Unknown';
};

const getIpAddress = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '';
};

const logAction = async (req, payload) => {
  try {
    const actor = payload.actorOverride || req.user || null;
    const safeRole = ['artisan', 'expert', 'manufacturer', 'admin'].includes(actor?.role)
      ? actor.role
      : 'system';

    await ActionLog.create({
      actorId: actor?._id || null,
      actorName: getActorName(actor),
      actorRole: safeRole,
      actorAdminType: actor?.adminType || (actor?.isSuperAdmin ? 'super' : null),
      actionKey: payload.actionKey,
      actionLabel: payload.actionLabel,
      entityType: payload.entityType,
      entityId: payload.entityId ? String(payload.entityId) : null,
      targetName: payload.targetName || '',
      targetRole: payload.targetRole || '',
      description: payload.description || '',
      metadata: payload.metadata || {},
      ipAddress: getIpAddress(req),
      userAgent: req.headers['user-agent'] || '',
    });
  } catch (error) {
    console.error('Failed to write action log:', error.message);
  }
};

module.exports = {
  logAction,
};
