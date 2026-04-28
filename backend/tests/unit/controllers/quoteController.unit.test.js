const { buildReq, buildRes, chainableQuery } = require('../mocks/http.mock');

jest.mock('../../../models/Quote', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  exists: jest.fn(),
}));

jest.mock('../../../models/Invoice', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../../models/Project', () => ({
  findOne: jest.fn(),
}));

jest.mock('mongoose', () => ({
  Types: {
    ObjectId: {
      isValid: jest.fn((value) => value !== 'bad-id'),
    },
  },
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn(),
}));

jest.mock('../../../services/quoteAIDraftService', () => ({
  generateQuoteAIDraft: jest.fn(),
}));

const Quote = require('../../../models/Quote');
const Project = require('../../../models/Project');
const { logAction } = require('../../../utils/actionLogger');
const { generateQuoteAIDraft } = require('../../../services/quoteAIDraftService');
const controller = require('../../../controllers/quoteController');

describe('quoteController', () => {
  test('generateQuoteDraft -> 400 for invalid projectId', async () => {
    const req = buildReq({ user: { _id: 'u1' }, body: { projectId: 'bad-id' } });
    const res = buildRes();

    await controller.generateQuoteDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('generateQuoteDraft -> 404 when project is not found', async () => {
    Project.findOne.mockReturnValue(chainableQuery(null));

    const req = buildReq({ user: { _id: 'u1' }, body: { projectId: 'p1' } });
    const res = buildRes();

    await controller.generateQuoteDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('generateQuoteDraft -> 200 with AI draft payload', async () => {
    Project.findOne.mockReturnValue(
      chainableQuery({
        _id: 'p1',
        artisan: 'u1',
        title: 'Maison',
        status: 'ongoing',
        progress: 40,
        materials: [],
      })
    );
    generateQuoteAIDraft.mockResolvedValue({
      recommendations: { laborHand: { value: 1200 } },
    });

    const req = buildReq({ user: { _id: 'u1' }, body: { projectId: 'p1', clientName: 'Client' } });
    const res = buildRes();

    await controller.generateQuoteDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(generateQuoteAIDraft).toHaveBeenCalled();
  });

  test('createQuote -> 400 when required fields are missing', async () => {
    const req = buildReq({ user: { _id: 'u1' }, body: { project: 'p1' } });
    const res = buildRes();

    await controller.createQuote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createQuote -> 201 on valid quote', async () => {
    Quote.create.mockResolvedValue({ _id: 'q1', quoteNumber: 'QT-2026-1111' });

    const req = buildReq({
      user: { _id: 'u1' },
      body: {
        project: 'p1',
        clientName: 'Client A',
        laborHand: 100,
        materialsAmount: 300,
        description: 'Work package',
        validUntil: '2026-05-30',
      },
    });
    const res = buildRes();

    await controller.createQuote(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(logAction).toHaveBeenCalled();
  });

  test('updateQuoteStatus -> 401 when user is missing', async () => {
    const req = buildReq({ user: null, params: { id: 'q1' }, body: { status: 'approved' } });
    const res = buildRes();

    await controller.updateQuoteStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('updateQuoteStatus -> 403 when quote exists but user does not own it', async () => {
    Quote.findOneAndUpdate.mockReturnValue(chainableQuery(null));
    Quote.exists.mockResolvedValue(true);

    const req = buildReq({ user: { _id: 'u1' }, params: { id: 'q1' }, body: { status: 'approved' } });
    const res = buildRes();

    await controller.updateQuoteStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('updateQuoteStatus -> 500 on unexpected error', async () => {
    Quote.findOneAndUpdate.mockImplementation(() => {
      throw new Error('db explode');
    });

    const req = buildReq({ user: { _id: 'u1' }, params: { id: 'q1' }, body: { status: 'approved' } });
    const res = buildRes();

    await controller.updateQuoteStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
