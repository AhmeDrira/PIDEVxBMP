const mongoose = require('mongoose');
const Project = require('../../../models/Project');

describe('Project model', () => {
  const validPayload = () => ({
    title: 'Renovation appartement',
    description: 'Travaux interieurs',
    location: 'Tunis',
    budget: 3000,
    startDate: new Date('2026-05-01'),
    endDate: new Date('2026-06-01'),
    artisan: new mongoose.Types.ObjectId(),
  });

  test('validateSync -> fails on missing required fields', () => {
    const doc = new Project({});
    const err = doc.validateSync();

    expect(err.errors.title).toBeDefined();
    expect(err.errors.description).toBeDefined();
    expect(err.errors.location).toBeDefined();
    expect(err.errors.startDate).toBeDefined();
    expect(err.errors.endDate).toBeDefined();
    expect(err.errors.artisan).toBeDefined();
  });

  test('defaults -> status priority and progress are initialized', () => {
    const doc = new Project(validPayload());
    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.status).toBe('active');
    expect(doc.priority).toBe('medium');
    expect(doc.progress).toBe(0);
  });

  test('validateSync -> rejects progress above 100', () => {
    const doc = new Project({ ...validPayload(), progress: 101 });
    const err = doc.validateSync();

    expect(err.errors.progress).toBeDefined();
  });

  test('validateSync -> personalMaterials require name/category/price', () => {
    const doc = new Project({
      ...validPayload(),
      personalMaterials: [{ stock: 2 }],
    });

    const err = doc.validateSync();

    expect(err.errors['personalMaterials.0.name']).toBeDefined();
    expect(err.errors['personalMaterials.0.category']).toBeDefined();
    expect(err.errors['personalMaterials.0.price']).toBeDefined();
  });

  test('schema defines artisan+status index', () => {
    const indexes = Project.schema.indexes();
    const hasIndex = indexes.some(([fields]) => fields.artisan === 1 && fields.status === 1);

    expect(hasIndex).toBe(true);
  });
});
