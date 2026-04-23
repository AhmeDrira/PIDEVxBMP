import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import knowledgeService from '@/services/knowledgeService';
import { server } from '../../setup/mswServer';

describe('knowledgeService', () => {
  it('should include Authorization header when fetching article by id', async () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'knowledge-token-1' }));

    server.use(
      http.get('*/api/knowledge/:id', ({ request, params }) => {
        return HttpResponse.json({
          _id: params.id,
          authHeader: request.headers.get('authorization'),
        });
      })
    );

    // Act
    const article = await knowledgeService.getById('article-42');

    // Assert
    expect(article._id).toBe('article-42');
    expect((article as any).authHeader).toBe('Bearer knowledge-token-1');
  });

  it('should send the expected payload for AI search', async () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'knowledge-token-2' }));
    let receivedQuery = '';

    server.use(
      http.post('*/api/knowledge/ai-search', async ({ request }) => {
        const body = (await request.json()) as { query?: string };
        receivedQuery = String(body.query || '');
        return HttpResponse.json({ query: receivedQuery, total: 0, articles: [] });
      })
    );

    // Act
    const response = await knowledgeService.aiSearch('cement blocks');

    // Assert
    expect(receivedQuery).toBe('cement blocks');
    expect(response.query).toBe('cement blocks');
  });

  it('should propagate API errors when AI search fails', async () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'knowledge-token-3' }));

    server.use(
      http.post('*/api/knowledge/ai-search', () =>
        HttpResponse.json({ message: 'AI unavailable' }, { status: 503 })
      )
    );

    // Act + Assert
    await expect(knowledgeService.aiSearch('paint')).rejects.toThrow();
  });

  it('should list knowledge articles from the public endpoint', async () => {
    // Arrange
    server.use(
      http.get('*/api/knowledge', () =>
        HttpResponse.json([
          {
            _id: 'k1',
            title: 'Public article',
          },
        ])
      )
    );

    // Act
    const articles = await knowledgeService.list();

    // Assert
    expect(articles).toHaveLength(1);
    expect(articles[0]._id).toBe('k1');
  });

  it('should send authenticated request when creating an article', async () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'knowledge-token-create' }));

    server.use(
      http.post('*/api/knowledge', ({ request }) => {
        return HttpResponse.json({
          receivedAuthorization: request.headers.get('authorization'),
          createdId: 'k-created-1',
        });
      })
    );

    // Act
    const response = await knowledgeService.create({
      title: 'Concrete Basics',
      category: 'general',
      summary: 'Short summary',
      content: 'Long content',
      tags: ['cement'],
    });

    // Assert
    expect((response as any).receivedAuthorization).toBe('Bearer knowledge-token-create');
    expect((response as any).createdId).toBe('k-created-1');
  });

  it('should send authenticated delete request for article removal', async () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'knowledge-token-delete' }));

    server.use(
      http.delete('*/api/knowledge/:id', ({ request, params }) => {
        return HttpResponse.json({
          removedId: params.id,
          receivedAuthorization: request.headers.get('authorization'),
        });
      })
    );

    // Act
    const result = await knowledgeService.remove('article-delete-1');

    // Assert
    expect((result as any).removedId).toBe('article-delete-1');
    expect((result as any).receivedAuthorization).toBe('Bearer knowledge-token-delete');
  });

  it('should toggle like on an article and return updated counters', async () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'knowledge-token-like' }));

    server.use(
      http.post('*/api/knowledge/:id/like', ({ request, params }) => {
        return HttpResponse.json({
          id: params.id,
          likes: 14,
          liked: true,
          receivedAuthorization: request.headers.get('authorization'),
        });
      })
    );

    // Act
    const result = await knowledgeService.toggleLike('article-like-1');

    // Assert
    expect((result as any).id).toBe('article-like-1');
    expect(result.likes).toBe(14);
    expect(result.liked).toBe(true);
    expect((result as any).receivedAuthorization).toBe('Bearer knowledge-token-like');
  });
});
