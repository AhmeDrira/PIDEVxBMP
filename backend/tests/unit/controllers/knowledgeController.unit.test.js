const { buildReq, buildRes, chainableQuery } = require('../mocks/http.mock');

jest.mock('../../../models/KnowledgeArticle', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const KnowledgeArticle = require('../../../models/KnowledgeArticle');
const controller = require('../../../controllers/knowledgeController');

describe('knowledgeController', () => {
  test('listArticles -> 200 with published items', async () => {
    KnowledgeArticle.find.mockReturnValue(
      chainableQuery([
        {
          _id: 'a1',
          title: 'Guide beton',
          category: 'Beton',
          summary: '...',
          content: '...',
          authorName: 'BMP',
          status: 'published',
          views: 2,
          likes: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          likedBy: [],
          attachments: [],
        },
      ])
    );

    const req = buildReq();
    const res = buildRes();

    await controller.listArticles(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].title).toBe('Guide beton');
  });

  test('aiSearchArticles -> 400 when query is missing', async () => {
    const req = buildReq({ body: {}, user: { role: 'expert', _id: 'e1' } });
    const res = buildRes();

    await controller.aiSearchArticles(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('aiSearchArticles -> 403 for non-expert user', async () => {
    const req = buildReq({ body: { query: 'isolation toiture' }, user: { role: 'artisan', _id: 'u1' } });
    const res = buildRes();

    await controller.aiSearchArticles(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.message).toMatch(/Only expert users/i);
  });

  test('getArticleById -> 404 when article is not found', async () => {
    KnowledgeArticle.findById.mockResolvedValue(null);

    const req = buildReq({ params: { id: 'missing' } });
    const res = buildRes();

    await controller.getArticleById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('createArticle -> 403 without admin permission', async () => {
    const req = buildReq({
      user: { _id: 'a1', role: 'admin', isSuperAdmin: false, permissions: { canManageKnowledge: false } },
      body: { title: 'T', category: 'C', summary: 'S', content: 'X' },
      files: [],
    });
    const res = buildRes();

    await controller.createArticle(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('createArticle -> 201 with valid admin permission', async () => {
    KnowledgeArticle.create.mockResolvedValue({
      _id: 'a1',
      title: 'Title',
      category: 'Cat',
      summary: 'Summary',
      content: 'Content',
      authorName: 'Admin',
      status: 'published',
      views: 0,
      likes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['x'],
      likedBy: [],
      attachments: [],
    });

    const req = buildReq({
      user: { _id: 'admin1', role: 'admin', isSuperAdmin: true, firstName: 'Super', lastName: 'Admin' },
      body: { title: 'Title', category: 'Cat', summary: 'Summary', content: 'Content', tags: '["x"]' },
      files: [],
    });
    const res = buildRes();

    await controller.createArticle(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(KnowledgeArticle.create).toHaveBeenCalled();
  });

  test('likeArticle -> 401 when user is not authenticated', async () => {
    const req = buildReq({ params: { id: 'a1' }, user: null });
    const res = buildRes();

    await controller.likeArticle(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('listArticles -> 500 on model error', async () => {
    KnowledgeArticle.find.mockImplementation(() => {
      throw new Error('query fail');
    });

    const req = buildReq();
    const res = buildRes();

    await controller.listArticles(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
