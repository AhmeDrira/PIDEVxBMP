const mongoose = require('mongoose');
const Project = require('../../../models/Project');

const buildValidProject = (overrides = {}) => ({
  title: 'House Construction',
  description: 'Build a small residential extension',
  location: 'Tunis',
  budget: 25000,
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-03-01'),
  artisan: new mongoose.Types.ObjectId(),
  ...overrides,
});

describe('Project model (unit)', () => {
  it('should validate a complete project payload', () => {
    // Arrange
    const project = new Project(buildValidProject());

    // Act
    const error = project.validateSync();

    // Assert
    expect(error).toBeUndefined();
    expect(project.status).toBe('active');
    expect(project.priority).toBe('medium');
    expect(project.progress).toBe(0);
  });

  it('should reject missing required fields and artisan ownership reference', () => {
    // Arrange
    const project = new Project(
      buildValidProject({ title: '', artisan: undefined, description: '' })
    );

    // Act
    const error = project.validateSync();

    // Assert
    expect(error).toBeDefined();
    expect(error.errors.title).toBeDefined();
    expect(error.errors.description).toBeDefined();
    expect(error.errors.artisan).toBeDefined();
  });

  it('should reject invalid dates and negative budget values', () => {
    // Arrange
    const project = new Project(
      buildValidProject({
        budget: -100,
        startDate: 'not-a-date',
      })
    );

    // Act
    const error = project.validateSync();

    // Assert
    expect(error).toBeDefined();
    expect(error.errors.budget).toBeDefined();
    expect(error.errors.startDate).toBeDefined();
  });

  it('should enforce enum constraints for status, priority and task status', () => {
    // Arrange
    const project = new Project(
      buildValidProject({
        status: 'archived',
        priority: 'urgent',
        tasks: [{ title: 'Task 1', status: 'blocked' }],
      })
    );

    // Act
    const error = project.validateSync();

    // Assert
    expect(error).toBeDefined();
    expect(error.errors.status).toBeDefined();
    expect(error.errors.priority).toBeDefined();
    expect(error.errors['tasks.0.status']).toBeDefined();
  });
});
