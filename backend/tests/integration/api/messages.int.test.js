/**
 * Integration tests for messageController via /api/messages.
 * - axios is mocked so AI draft endpoint is deterministic.
 * - socket.io getIo() throws "not initialized" inside the controller, but every
 *   call sites wraps it with try/catch — so socket emission becomes a no-op.
 */

jest.setTimeout(60000);

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));

const request = require('supertest');
const mongoose = require('mongoose');
const axios = require('axios');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-gemini-key';

const { startTestDb, stopTestDb, clearTestDb } = require('../helpers/testDb');
const { buildMessageApp } = require('../helpers/buildMessageApp');
const { createArtisan, createExpert, authHeader } = require('../helpers/auth.helpers');

const Conversation = require('../../../models/Conversation');
const Message = require('../../../models/Message');
const ProjectProposal = require('../../../models/ProjectProposal');
const Contract = require('../../../models/Contract');

let app;

beforeAll(async () => {
  await startTestDb();
  app = buildMessageApp();
});

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  await clearTestDb();
  axios.post.mockReset();
  axios.get.mockReset();
});

const seedConversation = async (a, b, overrides = {}) =>
  Conversation.create({
    participants: [a._id, b._id],
    lastMessage: '',
    deletedBy: [],
    blockedBy: [],
    ...overrides,
  });

// --- GET /api/messages -------------------------------------------------------

describe('GET /api/messages', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/messages');
    expect(res.status).toBe(401);
  });

  it('returns 400 when conversationId is missing', async () => {
    const u = await createArtisan();
    const res = await request(app).get('/api/messages').set(authHeader(u));
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown conversation', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .get('/api/messages')
      .query({ conversationId: new mongoose.Types.ObjectId().toString() })
      .set(authHeader(u));
    expect(res.status).toBe(404);
  });

  it('returns 403 for a non-participant', async () => {
    const a = await createArtisan();
    const b = await createExpert();
    const stranger = await createArtisan();
    const conv = await seedConversation(a, b);

    const res = await request(app)
      .get('/api/messages')
      .query({ conversationId: conv._id.toString() })
      .set(authHeader(stranger));
    expect(res.status).toBe(403);
  });

  it('returns the conversation messages and marks unread ones as read', async () => {
    const a = await createArtisan();
    const b = await createExpert();
    const conv = await seedConversation(a, b);

    await Message.create({ conversation: conv._id, sender: b._id, content: 'hi from B' });
    await Message.create({ conversation: conv._id, sender: a._id, content: 'reply from A', readBy: [a._id] });

    const res = await request(app)
      .get('/api/messages')
      .query({ conversationId: conv._id.toString() })
      .set(authHeader(a));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    // unread message from B should now be marked read by A
    const persistedB = await Message.findOne({ conversation: conv._id, sender: b._id });
    expect(persistedB.readBy.map(String)).toContain(a._id.toString());
  });
});

// --- POST /api/messages ------------------------------------------------------

describe('POST /api/messages', () => {
  it('returns 400 when conversationId missing', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/messages')
      .set(authHeader(u))
      .send({ content: 'hello' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when conversation not found', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/messages')
      .set(authHeader(u))
      .send({ conversationId: new mongoose.Types.ObjectId().toString(), content: 'hi' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not a participant', async () => {
    const a = await createArtisan();
    const b = await createExpert();
    const stranger = await createArtisan();
    const conv = await seedConversation(a, b);

    const res = await request(app)
      .post('/api/messages')
      .set(authHeader(stranger))
      .send({ conversationId: conv._id.toString(), content: 'hello' });
    expect(res.status).toBe(403);
  });

  it('rejects when caller has blocked the other party', async () => {
    const a = await createArtisan();
    const b = await createExpert();
    const conv = await seedConversation(a, b, { blockedBy: [a._id] });

    const res = await request(app)
      .post('/api/messages')
      .set(authHeader(a))
      .send({ conversationId: conv._id.toString(), content: 'hi' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/blocked this user/i);
  });

  it('rejects when caller is blocked by the other party', async () => {
    const a = await createArtisan();
    const b = await createExpert();
    const conv = await seedConversation(a, b, { blockedBy: [b._id] });

    const res = await request(app)
      .post('/api/messages')
      .set(authHeader(a))
      .send({ conversationId: conv._id.toString(), content: 'hi' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/blocked by this user/i);
  });

  it('returns 400 when neither content nor attachments are present', async () => {
    const a = await createArtisan();
    const b = await createExpert();
    const conv = await seedConversation(a, b);

    const res = await request(app)
      .post('/api/messages')
      .set(authHeader(a))
      .send({ conversationId: conv._id.toString(), content: '   ' });
    expect(res.status).toBe(400);
  });

  it('creates a message and updates the conversation lastMessage', async () => {
    const a = await createArtisan();
    const b = await createExpert();
    const conv = await seedConversation(a, b);

    const res = await request(app)
      .post('/api/messages')
      .set(authHeader(a))
      .send({ conversationId: conv._id.toString(), content: 'hello world' });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('hello world');

    const refreshed = await Conversation.findById(conv._id);
    expect(refreshed.lastMessage).toBe('hello world');
  });
});

// --- DELETE /api/messages/:id -----------------------------------------------

describe('DELETE /api/messages/:id', () => {
  it('returns 404 for unknown id', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .delete(`/api/messages/${new mongoose.Types.ObjectId()}`)
      .set(authHeader(u));
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the sender', async () => {
    const a = await createArtisan();
    const b = await createExpert();
    const conv = await seedConversation(a, b);
    const m = await Message.create({ conversation: conv._id, sender: a._id, content: 'mine' });

    const res = await request(app)
      .delete(`/api/messages/${m._id}`)
      .set(authHeader(b));
    expect(res.status).toBe(403);
  });

  it('marks the message as deleted (soft delete)', async () => {
    const a = await createArtisan();
    const b = await createExpert();
    const conv = await seedConversation(a, b);
    const m = await Message.create({ conversation: conv._id, sender: a._id, content: 'mine' });

    const res = await request(app)
      .delete(`/api/messages/${m._id}`)
      .set(authHeader(a));
    expect(res.status).toBe(200);
    const refreshed = await Message.findById(m._id);
    expect(refreshed.deleted).toBe(true);
    expect(String(refreshed.deletedBy)).toBe(a._id.toString());
  });
});

// --- POST /api/messages/:id/reaction ----------------------------------------

describe('POST /api/messages/:id/reaction', () => {
  it('rejects unsupported emojis', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post(`/api/messages/${new mongoose.Types.ObjectId()}/reaction`)
      .set(authHeader(u))
      .send({ emoji: '🦄' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when message is unknown', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post(`/api/messages/${new mongoose.Types.ObjectId()}/reaction`)
      .set(authHeader(u))
      .send({ emoji: '👍' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not in the conversation', async () => {
    const a = await createArtisan();
    const b = await createExpert();
    const stranger = await createArtisan();
    const conv = await seedConversation(a, b);
    const m = await Message.create({ conversation: conv._id, sender: a._id, content: 'x' });

    const res = await request(app)
      .post(`/api/messages/${m._id}/reaction`)
      .set(authHeader(stranger))
      .send({ emoji: '👍' });
    expect(res.status).toBe(403);
  });

  it('toggles the reaction (add → switch → remove)', async () => {
    const a = await createArtisan();
    const b = await createExpert();
    const conv = await seedConversation(a, b);
    const m = await Message.create({ conversation: conv._id, sender: a._id, content: 'x' });

    let res = await request(app)
      .post(`/api/messages/${m._id}/reaction`)
      .set(authHeader(b))
      .send({ emoji: '👍' });
    expect(res.status).toBe(200);
    let refreshed = await Message.findById(m._id);
    expect(refreshed.reactions).toHaveLength(1);
    expect(refreshed.reactions[0].emoji).toBe('👍');

    // switch
    res = await request(app)
      .post(`/api/messages/${m._id}/reaction`)
      .set(authHeader(b))
      .send({ emoji: '❤️' });
    expect(res.status).toBe(200);
    refreshed = await Message.findById(m._id);
    expect(refreshed.reactions[0].emoji).toBe('❤️');

    // same emoji removes the reaction
    res = await request(app)
      .post(`/api/messages/${m._id}/reaction`)
      .set(authHeader(b))
      .send({ emoji: '❤️' });
    expect(res.status).toBe(200);
    refreshed = await Message.findById(m._id);
    expect(refreshed.reactions).toHaveLength(0);
  });
});

// --- POST /api/messages/voice ------------------------------------------------

describe('POST /api/messages/voice', () => {
  it('returns 400 when conversationId missing', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/messages/voice')
      .set(authHeader(u))
      .field('duration', '10');
    expect(res.status).toBe(400);
  });

  it('returns 400 when no voice file is uploaded', async () => {
    const a = await createArtisan();
    const b = await createExpert();
    const conv = await seedConversation(a, b);
    const res = await request(app)
      .post('/api/messages/voice')
      .set(authHeader(a))
      .field('conversationId', conv._id.toString())
      .field('duration', '10');
    expect(res.status).toBe(400);
  });
});

// --- POST /api/messages/price-proposal --------------------------------------

describe('POST /api/messages/price-proposal', () => {
  const seedProposal = async (artisan, expert, overrides = {}) =>
    ProjectProposal.create({
      artisanId: artisan._id,
      expertId: expert._id,
      description: 'desc',
      localisation: 'Tunis',
      proposedPrice: 1000,
      startDate: new Date(),
      status: 'pending',
      ...overrides,
    });

  it('returns 400 when proposalId missing', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/messages/price-proposal')
      .set(authHeader(u))
      .send({ proposedPrice: 100 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when proposedPrice is invalid', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/messages/price-proposal')
      .set(authHeader(u))
      .send({ proposalId: new mongoose.Types.ObjectId().toString(), proposedPrice: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 404 when proposal does not exist', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/messages/price-proposal')
      .set(authHeader(u))
      .send({ proposalId: new mongoose.Types.ObjectId().toString(), proposedPrice: 100 });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the artisan of the proposal', async () => {
    const artisan = await createArtisan();
    const expert = await createExpert();
    const proposal = await seedProposal(artisan, expert);

    const res = await request(app)
      .post('/api/messages/price-proposal')
      .set(authHeader(expert))
      .send({ proposalId: proposal._id.toString(), proposedPrice: 100 });
    expect(res.status).toBe(403);
  });

  it('rejects proposals not in pending/negotiating', async () => {
    const artisan = await createArtisan();
    const expert = await createExpert();
    const proposal = await seedProposal(artisan, expert, { status: 'accepted' });

    const res = await request(app)
      .post('/api/messages/price-proposal')
      .set(authHeader(artisan))
      .send({ proposalId: proposal._id.toString(), proposedPrice: 100 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot propose/i);
  });

  it('creates a price-proposal message and updates the proposal', async () => {
    const artisan = await createArtisan();
    const expert = await createExpert();
    const proposal = await seedProposal(artisan, expert);

    const res = await request(app)
      .post('/api/messages/price-proposal')
      .set(authHeader(artisan))
      .send({ proposalId: proposal._id.toString(), proposedPrice: 1500, content: 'rev offer' });

    expect(res.status).toBe(201);
    expect(res.body.messageType).toBe('price_proposal');
    expect(res.body.proposedPrice).toBe(1500);

    const refreshed = await ProjectProposal.findById(proposal._id);
    expect(refreshed.status).toBe('negotiating');
    expect(refreshed.currentPrice).toBe(1500);
    expect(refreshed.lastProposedBy).toBe('artisan');
    expect(refreshed.negotiationHistory).toHaveLength(1);
  });
});

// --- PUT /api/messages/proposal/:proposalId/accept --------------------------

describe('PUT /api/messages/proposal/:proposalId/accept', () => {
  const seedProposal = async (artisan, expert, overrides = {}) =>
    ProjectProposal.create({
      artisanId: artisan._id,
      expertId: expert._id,
      description: 'desc',
      localisation: 'Tunis',
      proposedPrice: 1000,
      startDate: new Date(),
      status: 'pending',
      ...overrides,
    });

  it('returns 404 when proposal does not exist', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .put(`/api/messages/proposal/${new mongoose.Types.ObjectId()}/accept`)
      .set(authHeader(u));
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is neither artisan nor expert', async () => {
    const artisan = await createArtisan();
    const expert = await createExpert();
    const stranger = await createArtisan();
    const proposal = await seedProposal(artisan, expert);

    const res = await request(app)
      .put(`/api/messages/proposal/${proposal._id}/accept`)
      .set(authHeader(stranger));
    expect(res.status).toBe(403);
  });

  it('rejects accepting a proposal not in pending/negotiating', async () => {
    const artisan = await createArtisan();
    const expert = await createExpert();
    const proposal = await seedProposal(artisan, expert, { status: 'rejected' });

    const res = await request(app)
      .put(`/api/messages/proposal/${proposal._id}/accept`)
      .set(authHeader(artisan));
    expect(res.status).toBe(400);
  });

  it('marks the proposal as accepted', async () => {
    const artisan = await createArtisan();
    const expert = await createExpert();
    const proposal = await seedProposal(artisan, expert, { currentPrice: 1500 });

    const res = await request(app)
      .put(`/api/messages/proposal/${proposal._id}/accept`)
      .set(authHeader(expert));

    expect(res.status).toBe(200);
    expect(res.body.proposal.status).toBe('accepted');

    // setImmediate side-effects fire after the response — assert the proposal mutation only.
    const refreshed = await ProjectProposal.findById(proposal._id);
    expect(refreshed.status).toBe('accepted');
  });
});

// --- PUT /api/messages/proposal/:proposalId/reject --------------------------

describe('PUT /api/messages/proposal/:proposalId/reject', () => {
  const seedProposal = async (artisan, expert, overrides = {}) =>
    ProjectProposal.create({
      artisanId: artisan._id,
      expertId: expert._id,
      description: 'desc',
      localisation: 'Tunis',
      proposedPrice: 1000,
      startDate: new Date(),
      status: 'pending',
      ...overrides,
    });

  it('returns 404 when proposal does not exist', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .put(`/api/messages/proposal/${new mongoose.Types.ObjectId()}/reject`)
      .set(authHeader(u));
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not party to the proposal', async () => {
    const artisan = await createArtisan();
    const expert = await createExpert();
    const stranger = await createArtisan();
    const proposal = await seedProposal(artisan, expert);

    const res = await request(app)
      .put(`/api/messages/proposal/${proposal._id}/reject`)
      .set(authHeader(stranger));
    expect(res.status).toBe(403);
  });

  it('rejects when proposal is not in pending/negotiating', async () => {
    const artisan = await createArtisan();
    const expert = await createExpert();
    const proposal = await seedProposal(artisan, expert, { status: 'accepted' });

    const res = await request(app)
      .put(`/api/messages/proposal/${proposal._id}/reject`)
      .set(authHeader(artisan));
    expect(res.status).toBe(400);
  });

  it('marks the proposal as rejected', async () => {
    const artisan = await createArtisan();
    const expert = await createExpert();
    const proposal = await seedProposal(artisan, expert);

    const res = await request(app)
      .put(`/api/messages/proposal/${proposal._id}/reject`)
      .set(authHeader(artisan));
    expect(res.status).toBe(200);
    expect(res.body.proposal.status).toBe('rejected');
  });
});

// --- POST /api/messages/ai-generate -----------------------------------------

describe('POST /api/messages/ai-generate', () => {
  it('returns 400 when aiInstruction is empty', async () => {
    const u = await createArtisan();
    const res = await request(app)
      .post('/api/messages/ai-generate')
      .set(authHeader(u))
      .send({ aiInstruction: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 403 for roles other than artisan/expert', async () => {
    // We don't have a manufacturer/admin token easily — abuse a fresh user with role manipulation
    // Easiest: hit with an admin token (super-admin shape, role=admin)
    const jwt = require('jsonwebtoken');
    const adminToken = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await request(app)
      .post('/api/messages/ai-generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ aiInstruction: 'write me a draft' });
    expect(res.status).toBe(403);
  });
});
