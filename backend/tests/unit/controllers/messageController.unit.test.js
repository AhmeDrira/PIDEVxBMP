const { buildReq, buildRes, chainableQuery } = require('../mocks/http.mock');

jest.mock('../../../models/Message', () => ({
  find: jest.fn(),
  updateMany: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../../../models/Conversation', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../socket', () => ({
  getIo: jest.fn(() => ({
    to: jest.fn(() => ({ emit: jest.fn() })),
  })),
}));

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: jest.fn((err) => Boolean(err && err.isAxiosError)),
}));

const Message = require('../../../models/Message');
const Conversation = require('../../../models/Conversation');
const axios = require('axios');
const controller = require('../../../controllers/messageController');

describe('messageController', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    process.env.GEMINI_API_VERSION = 'v1';
  });

  test('getMessages -> 400 when conversationId is missing', async () => {
    const req = buildReq({ user: { _id: 'u1' }, query: {} });
    const res = buildRes();

    await controller.getMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('getMessages -> 404 when conversation is not found', async () => {
    Conversation.findById.mockResolvedValue(null);

    const req = buildReq({ user: { _id: 'u1' }, query: { conversationId: 'c1' } });
    const res = buildRes();

    await controller.getMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('getMessages -> 403 when user is not participant', async () => {
    Conversation.findById.mockResolvedValue({ _id: 'c1', participants: ['u2'] });

    const req = buildReq({ user: { _id: 'u1' }, query: { conversationId: 'c1' } });
    const res = buildRes();

    await controller.getMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('sendMessage -> 400 when content and attachments are empty', async () => {
    Conversation.findById.mockResolvedValue({
      _id: 'c1',
      participants: ['u1', 'u2'],
      blockedBy: [],
    });

    const req = buildReq({
      user: { _id: 'u1' },
      body: { conversationId: 'c1', content: '   ' },
      files: [],
    });
    const res = buildRes();

    await controller.sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('sendMessage -> 200 on valid message', async () => {
    const conversationDoc = {
      _id: 'c1',
      participants: ['u1', 'u2'],
      blockedBy: [],
      deletedBy: [],
      save: jest.fn().mockResolvedValue(),
    };
    Conversation.findById.mockResolvedValue(conversationDoc);
    Message.create.mockResolvedValue({ _id: 'm1' });
    Message.findById.mockReturnValue(chainableQuery({ _id: 'm1', content: 'Bonjour' }));

    const req = buildReq({
      user: { _id: 'u1' },
      body: { conversationId: 'c1', content: 'Bonjour' },
      files: [],
    });
    const res = buildRes();

    await controller.sendMessage(req, res);

    expect(res.json).toHaveBeenCalled();
    expect(Message.create).toHaveBeenCalled();
    expect(conversationDoc.save).toHaveBeenCalled();
  });

  test('generateAIDraftMessage -> 403 for unauthorized role', async () => {
    const req = buildReq({
      user: { _id: 'm1', role: 'manufacturer' },
      body: { aiInstruction: 'Informer du retard' },
    });
    const res = buildRes();

    await controller.generateAIDraftMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('generateAIDraftMessage -> 200 with fallback on Gemini capacity error', async () => {
    axios.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 429, data: { error: { message: 'quota exceeded' } } },
      message: 'quota exceeded',
    });

    const req = buildReq({
      user: { _id: 'u1', role: 'artisan' },
      body: { aiInstruction: 'Je veux envoyer un message pour dire que le chantier est retarde' },
    });
    const res = buildRes();

    await controller.generateAIDraftMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.fallbackUsed).toBe(true);
    expect(res.body.generatedMessage).toMatch(/Bonjour/i);
  });

  test('getMessages -> 500 on unexpected error', async () => {
    Conversation.findById.mockRejectedValue(new Error('db crash'));

    const req = buildReq({ user: { _id: 'u1' }, query: { conversationId: 'c1' } });
    const res = buildRes();

    await controller.getMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
