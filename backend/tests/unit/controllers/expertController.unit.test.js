const { buildReq, buildRes, chainableQuery } = require('../mocks/http.mock');

jest.mock('../../../models/User', () => ({
  Expert: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

const { Expert } = require('../../../models/User');
const { getCurrentExpert, updateExpertProfile } = require('../../../controllers/expertController');

describe('expertController', () => {
  test('getCurrentExpert -> 401 when user is not authenticated', async () => {
    const req = buildReq({ user: null });
    const res = buildRes();

    await getCurrentExpert(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('getCurrentExpert -> 404 when expert is not found', async () => {
    Expert.findById.mockReturnValue(chainableQuery(null));

    const req = buildReq({ user: { _id: 'e1' } });
    const res = buildRes();

    await getCurrentExpert(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.message).toBe('Expert not found');
  });

  test('getCurrentExpert -> 200 with expert payload', async () => {
    Expert.findById.mockReturnValue(chainableQuery({ _id: 'e1', firstName: 'Expert' }));

    const req = buildReq({ user: { _id: 'e1' } });
    const res = buildRes();

    await getCurrentExpert(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body._id).toBe('e1');
  });

  test('updateExpertProfile -> 200 with allowed fields', async () => {
    Expert.findByIdAndUpdate.mockReturnValue(chainableQuery({ _id: 'e1', firstName: 'New' }));

    const req = buildReq({
      user: { _id: 'e1' },
      body: { firstName: 'New', domain: 'Civil', ignored: 'x' },
    });
    const res = buildRes();

    await updateExpertProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Expert.findByIdAndUpdate).toHaveBeenCalledWith(
      'e1',
      { firstName: 'New', domain: 'Civil' },
      { new: true, runValidators: true }
    );
  });

  test('updateExpertProfile -> 500 on db failure', async () => {
    Expert.findByIdAndUpdate.mockImplementation(() => {
      throw new Error('db write fail');
    });

    const req = buildReq({ user: { _id: 'e1' }, body: { firstName: 'A' } });
    const res = buildRes();

    await updateExpertProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.message).toBe('Server error');
  });
});
