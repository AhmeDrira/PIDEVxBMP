const { createMockReq, createMockRes } = require('../mocks/http.mock');

jest.mock('../../../models/Project', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  find: jest.fn(),
  deleteOne: jest.fn(),
}));

jest.mock('../../../utils/actionLogger', () => ({
  logAction: jest.fn(),
}));

const Project = require('../../../models/Project');
const { logAction } = require('../../../utils/actionLogger');
const { createProject, updateProject } = require('../../../controllers/projectController');

describe('projectController (unit)', () => {
  it('should create project successfully with valid payload', async () => {
    // Arrange
    const createdProject = {
      _id: 'project-1',
      title: 'Renovation Project',
      budget: 5000,
      artisan: 'artisan-1',
    };
    Project.create.mockResolvedValue(createdProject);

    const req = createMockReq({
      user: { _id: 'artisan-1' },
      body: {
        title: 'Renovation Project',
        description: 'Renovate kitchen and bathroom',
        location: 'Tunis',
        budget: 5000,
        startDate: '2026-01-10',
        endDate: '2026-02-10',
      },
    });
    const res = createMockRes();

    // Act
    await createProject(req, res);

    // Assert
    expect(Project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Renovation Project',
        artisan: 'artisan-1',
      })
    );
    expect(logAction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(createdProject);
  });

  it('should reject invalid data when required fields are missing', async () => {
    // Arrange
    const req = createMockReq({
      user: { _id: 'artisan-2' },
      body: {
        title: '',
        description: 'Missing key fields',
        location: '',
        startDate: '',
      },
    });
    const res = createMockRes();

    // Act
    await createProject(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Please add all required fields' })
    );
    expect(Project.create).not.toHaveBeenCalled();
  });

  it('should return 500 when Project.create throws an error', async () => {
    // Arrange
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    Project.create.mockRejectedValueOnce(new Error('db write error'));

    const req = createMockReq({
      user: { _id: 'artisan-3' },
      body: {
        title: 'Project Fail',
        description: 'Trigger DB error',
        location: 'Sfax',
        budget: 1200,
        startDate: '2026-01-10',
        endDate: '2026-02-10',
      },
    });
    const res = createMockRes();

    // Act
    await createProject(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Server error while creating project' });
    consoleSpy.mockRestore();
  });

  it('should reject unauthorized update on foreign project', async () => {
    // Arrange
    Project.findById.mockResolvedValue({
      _id: 'project-10',
      artisan: { toString: () => 'owner-1' },
    });

    const req = createMockReq({
      params: { id: 'project-10' },
      user: { _id: 'owner-2' },
      body: { title: 'Hacked title' },
    });
    const res = createMockRes();

    // Act
    await updateProject(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized' });
    expect(Project.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
