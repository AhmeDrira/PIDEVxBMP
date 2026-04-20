const mongoose = require('mongoose');
const ActionLog = require('../../../models/ActionLog');

describe('ActionLog model', () => {
  test('validateSync -> fails when required fields are missing', () => {
    const doc = new ActionLog({});
    const err = doc.validateSync();

    expect(err.errors.actionKey).toBeDefined();
    expect(err.errors.actionLabel).toBeDefined();
    expect(err.errors.entityType).toBeDefined();
  });

  test('validateSync -> applies defaults for actor metadata', () => {
    const doc = new ActionLog({
      actionKey: 'report.submit',
      actionLabel: 'Submit report',
      entityType: 'report',
    });

    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.actorRole).toBe('system');
    expect(doc.actorName).toBe('Unknown');
  });

  test('validateSync -> rejects invalid actorRole enum', () => {
    const doc = new ActionLog({
      actionKey: 'x',
      actionLabel: 'y',
      entityType: 'z',
      actorRole: 'invalid-role',
    });

    const err = doc.validateSync();

    expect(err.errors.actorRole).toBeDefined();
  });

  test('schema has text index for search fields', () => {
    const indexes = ActionLog.schema.indexes();
    const hasTextIndex = indexes.some(([fields]) =>
      fields.actorName === 'text' && fields.actionLabel === 'text'
    );

    expect(hasTextIndex).toBe(true);
  });
});
