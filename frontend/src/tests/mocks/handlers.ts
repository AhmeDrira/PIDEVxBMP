import { delay, http, HttpResponse } from 'msw';
import { conversationsResponse, makePostedMessage, messagesResponse, statsResponse } from '../fixtures/api.fixtures';
import { adminUser, artisanUser, expertUser, manufacturerUser, TestUser, usersByRole } from '../fixtures/user.fixtures';

const tokenToUser = new Map<string, TestUser>([
  [artisanUser.token, artisanUser],
  [expertUser.token, expertUser],
  [manufacturerUser.token, manufacturerUser],
  [adminUser.token, adminUser],
]);

function getRoleFromEmail(email: string): keyof typeof usersByRole {
  const normalized = email.toLowerCase();
  if (normalized.includes('expert')) return 'expert';
  if (normalized.includes('manufacturer')) return 'manufacturer';
  if (normalized.includes('admin')) return 'admin';
  return 'artisan';
}

function getUserFromAuthorization(request: Request): TestUser {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  return tokenToUser.get(token) || artisanUser;
}

export const handlers = [
  http.get('*/api/stats', async () => {
    await delay(40);
    return HttpResponse.json(statsResponse);
  }),

  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = String(body.email || '');

    if (email.toLowerCase() === 'error@example.com') {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const role = getRoleFromEmail(email);
    return HttpResponse.json(usersByRole[role]);
  }),

  http.post('*/api/auth/register', async () => {
    await delay(40);
    return HttpResponse.json({ message: 'Registration successful' }, { status: 201 });
  }),

  http.get('*/api/auth/check-email', async ({ request }) => {
    const url = new URL(request.url);
    const email = (url.searchParams.get('email') || '').toLowerCase();
    return HttpResponse.json({ available: email !== 'taken@example.com' });
  }),

  http.get('*/api/auth/check-phone', async () => {
    return HttpResponse.json({ available: true });
  }),

  http.get('*/api/auth/me', async ({ request }) => {
    const user = getUserFromAuthorization(request);
    return HttpResponse.json({ user });
  }),

  http.get('*/api/auth/admin/manufacturers/pending', async () => {
    return HttpResponse.json([]);
  }),

  http.get('*/api/conversations', async () => {
    await delay(120);
    return HttpResponse.json(conversationsResponse);
  }),

  http.post('*/api/conversations', async ({ request }) => {
    const body = (await request.json()) as { participantId?: string };
    return HttpResponse.json({
      _id: 'conv-created-1',
      participants: [
        { _id: artisanUser._id, firstName: artisanUser.firstName, lastName: artisanUser.lastName, role: artisanUser.role },
        { _id: body.participantId || expertUser._id, firstName: 'New', lastName: 'Participant', role: 'expert' },
      ],
      lastMessage: '',
      updatedAt: new Date().toISOString(),
      unread: 0,
      blockedByMe: false,
      blockedByOther: false,
    });
  }),

  http.get('*/api/messages', async () => {
    return HttpResponse.json(messagesResponse);
  }),

  http.post('*/api/messages', async () => {
    return HttpResponse.json(makePostedMessage('Mocked sent message'));
  }),

  http.get('*/api/conversations/:conversationId/status', async () => {
    return HttpResponse.json({ blockedByMe: false, blockedByOther: false });
  }),

  http.get('*/api/knowledge/:id', async ({ params }) => {
    return HttpResponse.json({
      _id: params.id,
      title: 'Mock knowledge article',
      category: 'general',
      summary: 'Mock summary',
      content: 'Mock content',
      authorName: 'System',
      status: 'published',
      views: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      attachments: [],
    });
  }),

  http.post('*/api/knowledge/ai-search', async ({ request }) => {
    const body = (await request.json()) as { query?: string };
    return HttpResponse.json({
      query: body.query || '',
      total: 1,
      articles: [
        {
          _id: 'knowledge-1',
          title: 'AI generated result',
          category: 'general',
          summary: 'Summary',
          content: 'Content',
          authorName: 'System',
          status: 'published',
          views: 12,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  }),

  http.get('*/api/logs', async ({ request }) => {
    const auth = request.headers.get('authorization');
    const url = new URL(request.url);

    return HttpResponse.json({
      logs: [],
      pagination: {
        total: 0,
        page: Number(url.searchParams.get('page') || 1),
        limit: Number(url.searchParams.get('limit') || 20),
        pages: 0,
      },
      receivedAuthHeader: auth,
    });
  }),

  http.delete('*/api/logs/:id', async () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('*/api/logs/bulk-delete', async () => {
    return HttpResponse.json({ success: true });
  }),
];
