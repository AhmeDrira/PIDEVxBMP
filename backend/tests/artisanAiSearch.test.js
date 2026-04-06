const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongod;

const makeDeterministicVector = (text) => {
  const normalized = String(text || '').toLowerCase();
  const vector = [0, 0, 0, 0, 0, 0];

  if (/plomb|lavabo|pipe|sanit/.test(normalized)) vector[0] += 1;
  if (/elect|cabl|wiring|villa/.test(normalized)) vector[1] += 1;
  if (/paint|peint/.test(normalized)) vector[2] += 1;
  if (/rating|score|note/.test(normalized)) vector[3] += 1;
  if (/project|projet|completed|termine/.test(normalized)) vector[4] += 1;
  vector[5] = normalized.length ? 1 : 0;

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  return vector.map((value) => value / norm);
};

const createArtisanFixtures = async () => {
  const { Artisan, Expert } = require('../models/User');
  const Project = require('../models/Project');
  const Review = require('../models/Review');

  const expert = await Expert.create({
    firstName: 'Expert',
    lastName: 'Reviewer',
    email: 'expert@test.com',
    password: 'Password123!',
    domain: 'Construction',
  });

  const plumber = await Artisan.create({
    firstName: 'Ali',
    lastName: 'Plombier',
    email: 'ali@test.com',
    password: 'Password123!',
    domain: 'Plumbing',
    yearsExperience: 7,
    location: 'Tunis',
    bio: 'Expert in plomberie residentielle et installation sanitaire.',
    skills: ['plomberie', 'pipes'],
    certifications: ['CAP plomberie'],
  });

  const electrician = await Artisan.create({
    firstName: 'Sami',
    lastName: 'Electricien',
    email: 'sami@test.com',
    password: 'Password123!',
    domain: 'Electrical Installation',
    yearsExperience: 9,
    location: 'Sfax',
    bio: 'Installations electriques, tableaux, cablage et maintenance.',
    skills: ['electricity', 'wiring'],
    certifications: ['Certification BT'],
  });

  const painter = await Artisan.create({
    firstName: 'Moez',
    lastName: 'Peintre',
    email: 'moez@test.com',
    password: 'Password123!',
    domain: 'Painting',
    yearsExperience: 4,
    location: 'Sousse',
    bio: 'Peinture decorative et finitions interieures.',
    skills: ['painting'],
  });

  await Review.create([
    { artisan: plumber._id, expert: expert._id, rating: 4.2, comment: 'Solid work' },
    { artisan: electrician._id, expert: expert._id, rating: 5, comment: 'Excellent' },
  ]);

  await Project.create([
    {
      title: 'Salle de bain',
      description: 'Plomberie complete',
      location: 'Tunis',
      budget: 1200,
      startDate: '2026-01-02',
      endDate: '2026-01-15',
      status: 'completed',
      artisan: plumber._id,
    },
    {
      title: 'Villa elec 1',
      description: 'Installation electrique',
      location: 'Sfax',
      budget: 2400,
      startDate: '2026-02-02',
      endDate: '2026-02-20',
      status: 'completed',
      artisan: electrician._id,
    },
    {
      title: 'Villa elec 2',
      description: 'Renforcement tableau',
      location: 'Sfax',
      budget: 2000,
      startDate: '2026-03-01',
      endDate: '2026-03-20',
      status: 'completed',
      artisan: electrician._id,
    },
  ]);

  return { plumber, electrician, painter };
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = 'testsecret';
  process.env.APP_URL = 'http://localhost:3000';
  global.fetch = async () => ({ ok: true, text: async () => 'ok' });
  app = require('../app');
  const aiSearchService = require('../services/artisanAiSearchService');
  aiSearchService.__setEmbeddingProviderForTests(async (texts) => texts.map(makeDeterministicVector));
});

afterAll(async () => {
  const aiSearchService = require('../services/artisanAiSearchService');
  aiSearchService.__resetEmbeddingProviderForTests();
  await mongoose.connection.close();
  await mongod.stop();
});

beforeEach(async () => {
  const { User } = require('../models/User');
  const Review = require('../models/Review');
  const Project = require('../models/Project');
  await Review.deleteMany({});
  await Project.deleteMany({});
  await User.deleteMany({});
  await createArtisanFixtures();
});

describe('POST /api/artisans/ai-search', () => {
  test('finds plumbers from natural-language expertise query', async () => {
    const response = await request(app)
      .post('/api/artisans/ai-search')
      .send({ query: 'Donne-moi un artisan specialise dans la plomberie.' });

    expect(response.status).toBe(200);
    expect(response.body.artisans.length).toBeGreaterThan(0);
    expect(response.body.artisans[0].domain).toBe('Plumbing');
    expect(response.body.analysis.matchedDomains).toContain('Plumbing');
  });

  test('prioritizes best rating when requested', async () => {
    const response = await request(app)
      .post('/api/artisans/ai-search')
      .send({ query: "Propose-moi l'artisan qui a le meilleur score rating." });

    expect(response.status).toBe(200);
    expect(response.body.analysis.sortBy).toBe('rating');
    expect(response.body.artisans[0].domain).toBe('Electrical Installation');
    expect(response.body.artisans[0].rating).toBe(5);
  });

  test('prioritizes completed projects and respects experience filters', async () => {
    const response = await request(app)
      .post('/api/artisans/ai-search')
      .send({ query: "Je veux des artisans connus pour les installations electriques avec plus de 5 ans d'experience." });

    expect(response.status).toBe(200);
    expect(response.body.analysis.matchedDomains).toContain('Electrical Installation');
    expect(response.body.analysis.minYearsExperience).toBe(5);
    expect(response.body.artisans.length).toBe(1);
    expect(response.body.artisans[0].domain).toBe('Electrical Installation');
    expect(response.body.artisans[0].completedProjects).toBe(2);
  });
});
