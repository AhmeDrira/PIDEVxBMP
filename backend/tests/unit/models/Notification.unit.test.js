const Notification = require('../../../models/Notification');

describe('Notification model', () => {
  test('validateSync -> fails when title/message are missing', () => {
    const doc = new Notification({});
    const err = doc.validateSync();

    expect(err.errors.title).toBeDefined();
    expect(err.errors.message).toBeDefined();
  });

  test('defaults -> read and relatedModel are initialized', () => {
    const doc = new Notification({
      title: 'Title',
      message: 'Message',
    });

    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.read).toBe(false);
    expect(doc.relatedModel).toBe('User');
  });

  test('validateSync -> rejects invalid relatedModel enum', () => {
    const doc = new Notification({
      title: 'Title',
      message: 'Message',
      relatedModel: 'Invoice',
    });

    const err = doc.validateSync();

    expect(err.errors.relatedModel).toBeDefined();
  });
});
