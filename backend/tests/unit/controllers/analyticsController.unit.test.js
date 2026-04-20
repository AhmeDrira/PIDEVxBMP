const { buildReq, buildRes } = require('../../http.mock');

jest.mock('../../../models/MissingProductSearch', () => ({
  create: jest.fn(),
}));

const MissingProductSearch = require('../../../models/MissingProductSearch');
const { trackMissingProduct } = require('../../../controllers/analyticsController');

describe('analyticsController', () => {
  test('trackMissingProduct -> 201 on valid payload', async () => {
    MissingProductSearch.create.mockResolvedValue({ _id: 'm1' });

    const req = buildReq({
      user: { _id: 'u1' },
      body: {
        generic_name: 'colle carrelage',
        search_keyword: 'colle sol',
        suggested_brand: 'BrandA',
        projectId: 'p1',
      },
    });
    const res = buildRes();

    await trackMissingProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body).toEqual({ success: true, id: 'm1' });
    expect(MissingProductSearch.create).toHaveBeenCalled();
  });

  test('trackMissingProduct -> 400 when generic_name is missing', async () => {
    const req = buildReq({ user: { _id: 'u1' }, body: {} });
    const res = buildRes();

    await trackMissingProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/generic_name is required/i);
  });

  test('trackMissingProduct -> 500 when create fails', async () => {
    MissingProductSearch.create.mockRejectedValue(new Error('db error'));

    const req = buildReq({ user: { _id: 'u1' }, body: { generic_name: 'X' } });
    const res = buildRes();

    await trackMissingProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.message).toMatch(/Unable to track/i);
  });
});
