const { buildReq, buildRes } = require('../../http.mock');

jest.mock('../../../models/Project', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  deleteOne: jest.fn(),
}));

jest.mock('mongoose', () => ({
  Types: {
    ObjectId: {
      isValid: jest.fn(() => true),
    },
  },
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn(),
}));

const mongoose = require('mongoose');
const Project = require('../../../models/Project');
const { logAction } = require('../../../utils/actionLogger');
const controller = require('../../../controllers/projectController');

describe('projectController', () => {
  test('createProject -> 400 when required fields are missing', async () => {
    const req = buildReq({ user: { _id: 'u1' }, body: { title: 'New Project' } });
    const res = buildRes();

    await controller.createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.missingFields.length).toBeGreaterThan(0);
  });

  test('createProject -> 400 for invalid negative budget', async () => {
    const req = buildReq({
      user: { _id: 'u1' },
      body: {
        title: 'Projet',
        description: 'Desc',
        location: 'Tunis',
        budget: -5,
        startDate: '2026-05-01',
        endDate: '2026-05-20',
      },
    });
    const res = buildRes();

    await controller.createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/Budget must be a valid non-negative number/i);
  });

  test('createProject -> 201 on valid payload', async () => {
    const createdProject = { _id: 'p1', title: 'Projet', budget: 1500 };
    Project.create.mockResolvedValue(createdProject);

    const req = buildReq({
      user: { _id: 'u1' },
      body: {
        title: 'Projet',
        description: 'Desc',
        location: 'Tunis',
        budget: 1500,
        startDate: '2026-05-01',
        endDate: '2026-05-20',
        progress: 20,
        tasks: [],
      },
    });
    const res = buildRes();

    await controller.createProject(req, res);

    expect(Project.create).toHaveBeenCalled();
    expect(logAction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body).toEqual(createdProject);
  });

  test('updateProject -> 404 when project does not exist', async () => {
    Project.findById.mockResolvedValue(null);

    const req = buildReq({ user: { _id: 'u1' }, params: { id: 'p1' }, body: {} });
    const res = buildRes();

    await controller.updateProject(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('updateProject -> 400 when materials is not an array', async () => {
    Project.findById.mockResolvedValue({ artisan: { toString: () => 'u1' } });

    const req = buildReq({
      user: { _id: 'u1' },
      params: { id: 'p1' },
      body: { materials: 'invalid' },
    });
    const res = buildRes();

    await controller.updateProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/materials must be an array/i);
  });

  test('deleteProject -> 400 when project ID is invalid', async () => {
    mongoose.Types.ObjectId.isValid.mockReturnValue(false);

    const req = buildReq({ user: { _id: 'u1' }, params: { id: 'bad-id' } });
    const res = buildRes();

    await controller.deleteProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('uploadPersonalMaterialImage -> 400 when file is missing', async () => {
    mongoose.Types.ObjectId.isValid.mockReturnValue(true);

    const req = buildReq({
      user: { _id: 'u1' },
      params: { id: 'p1', materialId: 'm1' },
      file: null,
    });
    const res = buildRes();

    await controller.uploadPersonalMaterialImage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/Image file is required/i);
  });
});
