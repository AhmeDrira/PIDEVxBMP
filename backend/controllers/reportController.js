const Report = require('../models/Report');
const Notification = require('../models/Notification');
const nodemailer = require('nodemailer');
const { logAction } = require('../utils/actionLogger');

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SERVICE } = process.env;

  if (SMTP_SERVICE && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      service: SMTP_SERVICE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  return null;
}

const getUserDisplayName = (user) => {
  if (!user) return 'Client';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || 'Client';
};

const sendReportStatusEmail = async ({ reporter, status }) => {
  const reporterEmail = String(reporter?.email || '').trim();
  if (!reporterEmail) return;
  if (!['accepted', 'rejected'].includes(status)) return;

  const transporter = getTransporter();
  if (!transporter) return;

  const appName = process.env.APP_NAME || 'our platform';
  const decisionLabel = status === 'accepted' ? 'accepted' : 'rejected';
  const name = getUserDisplayName(reporter);
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

  const subject = `Report Update: Your Report Was ${status === 'accepted' ? 'Accepted' : 'Rejected'}`;

  const text =
    `Dear ${name},\n\n` +
    `After reviewing the report you submitted, we would like to inform you that your report was ${decisionLabel}.\n\n` +
    `Thank you for helping us improve ${appName}.\n\n` +
    `Best regards,\n${appName} Team`;

  const html = `
    <p>Dear ${name},</p>
    <p>
      After reviewing the report you submitted, we would like to inform you that
      your report was <strong>${decisionLabel}</strong>.
    </p>
    <p>Thank you for helping us improve ${appName}.</p>
    <p>Best regards,<br/>${appName} Team</p>
  `;

  await transporter.sendMail({
    from: fromEmail,
    to: reporterEmail,
    subject,
    text,
    html,
  });
};

const createReport = async (req, res) => {
  try {
    if (!req.user?._id || !req.user?.role) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { reportType, targetUserId, targetRole, reason, details } = req.body || {};

    if (!['user', 'app'].includes(reportType)) {
      return res.status(400).json({ message: 'reportType must be user or app' });
    }

    const normalizedReason = String(reason || '').trim();
    if (!normalizedReason) {
      return res.status(400).json({ message: 'reason is required' });
    }

    if (reportType === 'user' && !targetUserId) {
      return res.status(400).json({ message: 'targetUserId is required for user reports' });
    }

    const report = await Report.create({
      reporter: req.user._id,
      reporterRole: req.user.role,
      reportType,
      targetUser: reportType === 'user' ? targetUserId : null,
      targetRole: reportType === 'user'
        ? (targetRole && ['artisan', 'expert', 'manufacturer', 'admin'].includes(targetRole) ? targetRole : 'unknown')
        : 'unknown',
      reason: normalizedReason,
      details: String(details || '').trim(),
      status: 'submitted',
    });

    await logAction(req, {
      actionKey: 'report.submit',
      actionLabel: 'Submitted Report',
      entityType: 'report',
      entityId: report._id,
      targetName: reportType === 'app' ? 'Application' : String(targetUserId || ''),
      targetRole: reportType === 'app' ? 'app' : String(targetRole || 'unknown'),
      description: `Submitted a ${reportType} report.`,
      metadata: {
        reportType,
        status: 'submitted',
        reason: normalizedReason,
        hasDetails: Boolean(String(details || '').trim()),
        targetUserId: reportType === 'user' ? String(targetUserId || '') : null,
      },
    });

    const reporterName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ').trim() || 'A user';
    const notificationMessage = reportType === 'user'
      ? `${reporterName} submitted a user report.`
      : `${reporterName} submitted an app report.`;

    await Notification.create({
      type: 'report_submitted',
      title: 'New Report Submitted',
      message: notificationMessage,
      recipient: null,
    });

    return res.status(201).json(report);
  } catch (err) {
    console.error('createReport error:', err);
    return res.status(500).json({ message: 'Failed to submit report' });
  }
};

const getMyReports = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const reports = await Report.find({ reporter: req.user._id })
      .populate('targetUser', 'firstName lastName role email companyName')
      .sort({ createdAt: -1 });

    return res.json(reports);
  } catch (err) {
    console.error('getMyReports error:', err);
    return res.status(500).json({ message: 'Failed to fetch your reports' });
  }
};

const getAdminReports = async (req, res) => {
  try {
    const type = String(req.query?.type || '').trim().toLowerCase();
    const filter = {};

    if (type === 'user' || type === 'app') {
      filter.reportType = type;
    }

    const reports = await Report.find(filter)
      .populate('reporter', 'firstName lastName role email')
      .populate('targetUser', 'firstName lastName role email companyName')
      .sort({ createdAt: -1 });

    return res.json(reports);
  } catch (err) {
    console.error('getAdminReports error:', err);
    return res.status(500).json({ message: 'Failed to fetch reports' });
  }
};

const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const isSuperAdmin = Boolean(req.user?.role === 'admin' && (req.user?.isSuperAdmin || req.user?.adminType === 'super'));
    const canManageReports = Boolean(req.user?.permissions?.canManageReports);
    if (!isSuperAdmin && !canManageReports) {
      return res.status(403).json({ message: 'You do not have permission to manage reports' });
    }

    if (!['accepted', 'rejected', 'submitted'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const report = await Report.findById(id)
      .populate('reporter', 'firstName lastName role email')
      .populate('targetUser', 'firstName lastName role email companyName');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const previousStatus = report.status;
    report.status = status;
    await report.save();

    const targetName = report.targetUser
      ? [report.targetUser.firstName, report.targetUser.lastName].filter(Boolean).join(' ').trim() || report.targetUser.companyName || 'User'
      : 'Application';

    await logAction(req, {
      actionKey: 'admin.report.status.update',
      actionLabel: 'Updated Report Status',
      entityType: 'report',
      entityId: report._id,
      targetName,
      targetRole: report.targetRole || 'unknown',
      description: `Updated report status from ${previousStatus} to ${status}.`,
      metadata: {
        previousStatus,
        newStatus: status,
        reportType: report.reportType,
        reason: report.reason,
        reporterName: getUserDisplayName(report.reporter),
        reporterEmail: report.reporter?.email || '',
      },
    });

    const shouldNotifyReporter = previousStatus !== status && ['accepted', 'rejected'].includes(status);
    if (shouldNotifyReporter) {
      try {
        await sendReportStatusEmail({
          reporter: report.reporter,
          status,
        });
      } catch (emailError) {
        console.error('sendReportStatusEmail error:', emailError);
      }
    }

    return res.json(report);
  } catch (err) {
    console.error('updateReportStatus error:', err);
    return res.status(500).json({ message: 'Failed to update report status' });
  }
};

module.exports = {
  createReport,
  getMyReports,
  getAdminReports,
  updateReportStatus,
};
