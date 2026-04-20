const mongoose = require('mongoose');
const Message = require('../../../models/Message');

describe('Message model', () => {
  test('validateSync -> fails when conversation/sender are missing', () => {
    const doc = new Message({});
    const err = doc.validateSync();

    expect(err.errors.conversation).toBeDefined();
    expect(err.errors.sender).toBeDefined();
  });

  test('defaults -> content and deleted flags are initialized', () => {
    const doc = new Message({
      conversation: new mongoose.Types.ObjectId(),
      sender: new mongoose.Types.ObjectId(),
    });

    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.content).toBe('');
    expect(doc.deleted).toBe(false);
    expect(doc.deletedAt).toBeNull();
  });

  test('validateSync -> rejects invalid reaction subdocument', () => {
    const doc = new Message({
      conversation: new mongoose.Types.ObjectId(),
      sender: new mongoose.Types.ObjectId(),
      reactions: [{ emoji: '👍' }],
    });

    const err = doc.validateSync();

    expect(err.errors['reactions.0.user']).toBeDefined();
  });
});
