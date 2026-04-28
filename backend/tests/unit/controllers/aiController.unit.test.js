const { buildReq, buildRes, chainableQuery } = require('../mocks/http.mock');

jest.mock('../../../services/aiService', () => ({
  extractProjectData: jest.fn(),
}));

jest.mock('axios', () => ({
  post: jest.fn(),
}));

jest.mock('../../../models/Invoice', () => ({
  find: jest.fn(),
}));

const { extractProjectData } = require('../../../services/aiService');
const axios = require('axios');
const Invoice = require('../../../models/Invoice');
const { projectAutofill, copilotChat } = require('../../../controllers/aiController');

const expectStatusBeforeJson = (res, statusCode) => {
  expect(res.status).toHaveBeenCalledWith(statusCode);
  expect(res.status).toHaveBeenCalledTimes(1);
  expect(res.json).toHaveBeenCalledTimes(1);
  expect(res.status.mock.invocationCallOrder[0]).toBeLessThan(res.json.mock.invocationCallOrder[0]);
};

describe('aiController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-openai-key';
    delete process.env.OPENAI_MODEL;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  test('projectAutofill -> 400 when text is missing', async () => {
    const req = buildReq({ body: {} });
    const res = buildRes();

    await projectAutofill(req, res);

    expectStatusBeforeJson(res, 400);
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message).toMatch(/text/i);
    expect(res.body.hint).toMatch(/"text"/i);
  });

  test('projectAutofill -> 400 when text is too short after trim', async () => {
    const req = buildReq({ body: { text: '  court  ' } });
    const res = buildRes();

    await projectAutofill(req, res);

    expectStatusBeforeJson(res, 400);
    expect(res.body).toEqual(
      expect.objectContaining({
        minLength: 10,
        received: 5,
      })
    );
    expect(res.body.message).toMatch(/trop court/i);
  });

  test('projectAutofill -> 200 when extraction succeeds', async () => {
    extractProjectData.mockResolvedValue({
      title: { answer: 'Renovation SDB', score: 0.8 },
      location: { answer: 'Tunis', score: 0.9 },
      description: { answer: 'Refaire plomberie', score: 0.75 },
      date: { answer: '2026-05-10', score: 0.7 },
    });

    const req = buildReq({ body: { text: 'Renovation salle de bain a Tunis avec plomberie' } });
    const res = buildRes();

    await projectAutofill(req, res);

    expect(extractProjectData).toHaveBeenCalledWith('Renovation salle de bain a Tunis avec plomberie');
    expectStatusBeforeJson(res, 200);
    expect(res.body).toEqual({
      title: 'Renovation SDB',
      location: 'Tunis',
      description: 'Refaire plomberie',
      date: '2026-05-10',
    });
  });

  test('projectAutofill -> 500 when extraction throws', async () => {
    extractProjectData.mockRejectedValue(new Error('pipeline crash'));

    const req = buildReq({ body: { text: 'Long enough project text' } });
    const res = buildRes();

    await projectAutofill(req, res);

    expectStatusBeforeJson(res, 500);
    expect(res.body.message).toMatch(/Erreur lors de l'extraction/i);
    expect(res.body.detail).toBe('pipeline crash');
  });

  test('copilotChat -> 400 when message is missing', async () => {
    const req = buildReq({ body: {}, user: { _id: 'u1', role: 'artisan' } });
    const res = buildRes();

    await copilotChat(req, res);

    expectStatusBeforeJson(res, 400);
    expect(res.body.message).toMatch(/obligatoire/i);
  });

  test('copilotChat -> 200 and includes invoice summary for artisan invoice query', async () => {
    const invoiceQuery = chainableQuery([
      { invoiceNumber: 'INV-1', amount: 100, status: 'pending', dueDate: new Date('2026-04-10T00:00:00.000Z') },
    ]);
    Invoice.find.mockReturnValue(invoiceQuery);
    axios.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: { content: 'Plan d action facture: prioriser les echeances.' },
            finish_reason: 'stop',
          },
        ],
      },
    });

    const req = buildReq({
      body: { message: 'Aide moi pour mes factures', quickAction: 'check-invoices', history: [] },
      user: { _id: 'u1', role: 'artisan', firstName: 'Ali', email: 'ali@example.com' },
    });
    const res = buildRes();

    await copilotChat(req, res);

    expectStatusBeforeJson(res, 200);
    expect(Invoice.find).toHaveBeenCalledWith({ artisan: 'u1' });
    expect(invoiceQuery.select).toHaveBeenCalledWith('invoiceNumber amount status dueDate createdAt');
    expect(invoiceQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(invoiceQuery.limit).toHaveBeenCalledWith(30);
    expect(invoiceQuery.lean).toHaveBeenCalledTimes(1);
    expect(res.body.reply).toMatch(/facture|echeances|prioriser/i);
    expect(res.body.invoiceSummary).toEqual(
      expect.objectContaining({
        total: 1,
        pending: 1,
        pendingAmountTnd: 100,
        latest: expect.arrayContaining([
          expect.objectContaining({
            invoiceNumber: 'INV-1',
            status: 'pending',
            amount: 100,
            dueDate: '2026-04-10',
          }),
        ]),
      })
    );
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        model: 'gpt-4o-mini',
        temperature: 0.65,
        max_tokens: 900,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: expect.stringMatching(/Contexte utilisateur:/i) }),
          expect.objectContaining({ role: 'user', content: expect.stringMatching(/Contexte factures API:/i) }),
        ]),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-openai-key',
          'Content-Type': 'application/json',
        }),
        timeout: 35000,
      })
    );
  });
});
