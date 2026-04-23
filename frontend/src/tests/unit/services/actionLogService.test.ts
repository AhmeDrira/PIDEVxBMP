import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import actionLogService from '@/services/actionLogService';
import { server } from '../../setup/mswServer';

describe('actionLogService', () => {
  it('should send query params and Authorization header when listing logs', async () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'logs-token-1' }));

    server.use(
      http.get('*/api/logs', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          logs: [],
          pagination: {
            total: 0,
            page: Number(url.searchParams.get('page') || 1),
            limit: Number(url.searchParams.get('limit') || 20),
            pages: 0,
          },
          receivedAuthorization: request.headers.get('authorization'),
          receivedSearch: url.searchParams.get('search'),
        });
      })
    );

    // Act
    const result = await actionLogService.list({ page: 2, limit: 10, search: 'payment' });

    // Assert
    expect((result as any).receivedAuthorization).toBe('Bearer logs-token-1');
    expect((result as any).receivedSearch).toBe('payment');
    expect(result.pagination.page).toBe(2);
    expect(result.pagination.limit).toBe(10);
  });

  it('should send payload for bulk delete', async () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'logs-token-2' }));
    let receivedIds: string[] = [];

    server.use(
      http.post('*/api/logs/bulk-delete', async ({ request }) => {
        const body = (await request.json()) as { ids?: string[] };
        receivedIds = body.ids || [];
        return HttpResponse.json({ success: true, deleted: receivedIds.length });
      })
    );

    // Act
    const result = await actionLogService.bulkDelete(['l1', 'l2']);

    // Assert
    expect(receivedIds).toEqual(['l1', 'l2']);
    expect(result.deleted).toBe(2);
  });

  it('should propagate API errors when list fails', async () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'logs-token-3' }));

    server.use(
      http.get('*/api/logs', () =>
        HttpResponse.json({ message: 'Server unavailable' }, { status: 503 })
      )
    );

    // Act + Assert
    await expect(actionLogService.list()).rejects.toThrow();
  });

  it('should send delete request with Authorization header when deleting one log', async () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'logs-token-4' }));

    server.use(
      http.delete('*/api/logs/:id', ({ request, params }) => {
        return HttpResponse.json({
          deletedId: params.id,
          receivedAuthorization: request.headers.get('authorization'),
        });
      })
    );

    // Act
    const result = await actionLogService.deleteById('log-77');

    // Assert
    expect((result as any).deletedId).toBe('log-77');
    expect((result as any).receivedAuthorization).toBe('Bearer logs-token-4');
  });

  it('should propagate API errors when deleting one log fails', async () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'logs-token-5' }));

    server.use(
      http.delete('*/api/logs/:id', () =>
        HttpResponse.json({ message: 'Delete failed' }, { status: 500 })
      )
    );

    // Act + Assert
    await expect(actionLogService.deleteById('log-fail')).rejects.toThrow();
  });
});
