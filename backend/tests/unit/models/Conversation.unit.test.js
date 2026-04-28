const mongoose = require('mongoose');
const Conversation = require('../../../models/Conversation');

describe('Conversation model', () => {
  test('validateSync -> accepts participants array', () => {
    const doc = new Conversation({
      participants: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
      lastMessage: 'Hello',
    });

    const err = doc.validateSync();

    expect(err).toBeUndefined();
  });

  test('defaults -> deletedBy and blockedBy are arrays', () => {
    const doc = new Conversation({ participants: [] });

    expect(Array.isArray(doc.deletedBy)).toBe(true);
    expect(Array.isArray(doc.blockedBy)).toBe(true);
  });

  test('timestamps option is enabled', () => {
    expect(Conversation.schema.options.timestamps).toBe(true);
  });
});
