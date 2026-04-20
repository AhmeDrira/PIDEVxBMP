const mongoose = require('mongoose');
const Report = require('../../../models/Report');

describe('Report model', () => {
  const validPayload = () => ({
    reporter: new mongoose.Types.ObjectId(),
    reporterRole: 'artisan',
    reportType: 'app',
    reason: 'Issue description',
  });

  test('validateSync -> fails on required fields', () => {
    const doc = new Report({});
    const err = doc.validateSync();

    expect(err.errors.reporter).toBeDefined();
    expect(err.errors.reporterRole).toBeDefined();
    expect(err.errors.reportType).toBeDefined();
    expect(err.errors.reason).toBeDefined();
  });

  test('defaults -> targetRole unknown and status submitted', () => {
    const doc = new Report(validPayload());
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.targetRole).toBe('unknown');
    expect(doc.status).toBe('submitted');
  });

  test('validateSync -> rejects invalid enums', () => {
    const doc = new Report({ ...validPayload(), reporterRole: 'client', status: 'closed' });
    const err = doc.validateSync();

    expect(err.errors.reporterRole).toBeDefined();
    expect(err.errors.status).toBeDefined();
  });
});
