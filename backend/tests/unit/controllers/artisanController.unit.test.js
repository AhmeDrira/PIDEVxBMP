const { buildReq, buildRes, chainableQuery } = require('../../http.mock');

jest.mock('../../../models/User', () => ({
  Artisan: {
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('../../../models/Project', () => ({
  countDocuments: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../../../models/Review', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  aggregate: jest.fn(),
}));

jest.mock('../../../models/Notification', () => ({
  create: jest.fn(),
}));

jest.mock('../../../models/ActionLog', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../../../services/artisanAiSearchService', () => ({
  analyzeIntent: jest.fn(),
  buildMongoFilter: jest.fn(),
  searchArtisansWithAI: jest.fn(),
}));

const { Artisan } = require('../../../models/User');
const Project = require('../../../models/Project');
const Review = require('../../../models/Review');
const Notification = require('../../../models/Notification');
const controller = require('../../../controllers/artisanController');

describe('artisanController', () => {
  test('getArtisanById -> 200 with computed rating stats', async () => {
    const artisanDoc = {
      _id: 'a1',
      portfolio: [{ title: 'P1' }],
      toObject: () => ({ _id: 'a1', firstName: 'Artisan' }),
    };

    Artisan.findById.mockReturnValue(chainableQuery(artisanDoc));
    Project.countDocuments.mockResolvedValue(3);
    Review.find.mockResolvedValue([{ rating: 4 }, { rating: 5 }]);

    const req = buildReq({ params: { id: 'a1' } });
    const res = buildRes();

    await controller.getArtisanById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.completedProjects).toBe(3);
    expect(res.body.rating).toBe(4.5);
    expect(res.body.reviewCount).toBe(2);
  });

  test('addArtisanReview -> 400 when rating is invalid', async () => {
    const req = buildReq({
      params: { id: 'a1' },
      body: { rating: 0, comment: 'bad' },
      user: { _id: 'e1' },
    });
    const res = buildRes();

    await controller.addArtisanReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/Rating must be between 1 and 5/i);
  });

  test('addArtisanReview -> 404 when artisan is missing', async () => {
    Artisan.findById.mockResolvedValue(null);

    const req = buildReq({
      params: { id: 'missing' },
      body: { rating: 5, comment: 'Great' },
      user: { _id: 'e1' },
    });
    const res = buildRes();

    await controller.addArtisanReview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.message).toMatch(/Artisan not found/i);
  });

  test('addPortfolioItemFromProject -> 403 when project ownership fails', async () => {
    const artisanDoc = { portfolio: [], save: jest.fn().mockResolvedValue() };
    Artisan.findById.mockResolvedValue(artisanDoc);
    Project.findById.mockResolvedValue({ _id: 'p1', artisan: 'other', status: 'completed' });

    const req = buildReq({ params: { projectId: 'p1' }, user: { _id: 'u1' } });
    const res = buildRes();

    await controller.addPortfolioItemFromProject(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.message).toMatch(/Not authorized/i);
  });

  test('addPortfolioItem -> 201 with new portfolio item', async () => {
    const artisanDoc = {
      portfolio: [],
      save: jest.fn().mockResolvedValue(),
    };
    Artisan.findById.mockResolvedValue(artisanDoc);

    const req = buildReq({
      user: { _id: 'u1' },
      body: {
        title: 'Villa facade',
        description: 'Facade complete',
        location: 'Sfax',
      },
      files: [],
    });
    const res = buildRes();

    await controller.addPortfolioItem(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(artisanDoc.portfolio.length).toBe(1);
    expect(artisanDoc.save).toHaveBeenCalled();
  });

  test('getAllArtisans -> 500 on internal error', async () => {
    Artisan.find.mockImplementation(() => {
      throw new Error('db failure');
    });

    const req = buildReq();
    const res = buildRes();

    await controller.getAllArtisans(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.message).toBe('Server error');
  });
});
