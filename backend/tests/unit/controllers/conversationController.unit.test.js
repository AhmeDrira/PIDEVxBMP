const { buildReq, buildRes, chainableQuery } = require('../mocks/http.mock');

jest.mock('../../../models/Conversation', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../../../models/User', () => ({}));

jest.mock('../../../models/Message', () => ({
  countDocuments: jest.fn(),
}));

const Conversation = require('../../../models/Conversation');
const Message = require('../../../models/Message');
const controller = require('../../../controllers/conversationController');

describe('conversationController', () => {
  test('createConversation -> 400 when participantId is missing', async () => {
    const req = buildReq({ user: { _id: 'u1' }, body: {} });
    const res = buildRes();

    await controller.createConversation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/participantId/i);
  });

  test('createConversation -> 200 for existing conversation restore path', async () => {
    const conv = {
      _id: 'c1',
      participants: ['u1', 'u2'],
      deletedBy: ['u1'],
      save: jest.fn().mockResolvedValue(),
      populate: jest.fn().mockResolvedValue({ _id: 'c1', participants: ['u1', 'u2'] }),
    };
    Conversation.findOne.mockResolvedValue(conv);

    const req = buildReq({ user: { _id: 'u1' }, body: { participantId: 'u2' } });
    const res = buildRes();

    await controller.createConversation(req, res);

    expect(conv.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  test('deleteConversation -> 404 when conversation does not exist', async () => {
    Conversation.findById.mockResolvedValue(null);

    const req = buildReq({ user: { _id: 'u1' }, params: { id: 'missing' } });
    const res = buildRes();

    await controller.deleteConversation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('deleteConversation -> 403 when user is not a participant', async () => {
    Conversation.findById.mockResolvedValue({ participants: ['u2'], deletedBy: [], save: jest.fn() });

    const req = buildReq({ user: { _id: 'u1' }, params: { id: 'c1' } });
    const res = buildRes();

    await controller.deleteConversation(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.message).toMatch(/Acc[eè]s refus[eé]/i);
  });

  test('getConversations -> 500 on query failure', async () => {
    Conversation.find.mockImplementation(() => {
      throw new Error('db down');
    });

    const req = buildReq({ user: { _id: 'u1' } });
    const res = buildRes();

    await controller.getConversations(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
