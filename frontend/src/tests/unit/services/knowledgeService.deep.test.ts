/**
 * Extra coverage for knowledgeService — focuses on update + multipart payload
 * branches not covered by the original suite.
 */

import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import knowledgeService from '@/services/knowledgeService';
import { server } from '../../setup/mswServer';

describe('knowledgeService — extended coverage', () => {
  it('create: sends an authenticated multipart request and returns the body', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 'k-create' }));
    let receivedAuth: string | null = null;
    server.use(
      http.post('*/api/knowledge', async ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return HttpResponse.json({ id: 'k-1' });
      })
    );

    const file = new File(['file content'], 'doc.pdf', { type: 'application/pdf' });
    const res = await knowledgeService.create({
      title: 'T',
      category: 'general',
      summary: 'S',
      content: 'C',
      authorName: 'Author',
      tags: ['tag1', 'tag2'],
      attachments: [file],
    });

    expect((res as any).id).toBe('k-1');
    expect(receivedAuth).toBe('Bearer k-create');
  });

  it('create: works without optional authorName / tags / attachments (defaults branch)', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 'k-create-min' }));
    server.use(
      http.post('*/api/knowledge', () => HttpResponse.json({ id: 'k-min' }))
    );
    const res = await knowledgeService.create({
      title: 'T',
      category: 'cat',
      summary: 'S',
      content: 'C',
    });
    expect((res as any).id).toBe('k-min');
  });

  it('update: hits the right endpoint with the article id', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 'k-update' }));
    let receivedAuth: string | null = null;
    server.use(
      http.put('*/api/knowledge/:id', ({ request, params }) => {
        receivedAuth = request.headers.get('authorization');
        return HttpResponse.json({ id: params.id });
      })
    );

    const file = new File(['xx'], 'doc.pdf', { type: 'application/pdf' });
    const res = await knowledgeService.update('article-99', {
      title: 'T2',
      category: 'electric',
      summary: 'S2',
      content: 'C2',
      authorName: 'A2',
      tags: ['x'],
      removeAttachmentUrls: ['/uploads/old.pdf'],
      attachments: [file],
    });

    expect((res as any).id).toBe('article-99');
    expect(receivedAuth).toBe('Bearer k-update');
  });

  it('update: works without optional fields (defaults branch)', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 'k-update-2' }));
    server.use(
      http.put('*/api/knowledge/:id', ({ params }) =>
        HttpResponse.json({ id: params.id })
      )
    );

    const res = await knowledgeService.update('art-2', {
      title: 'T',
      category: 'cat',
      summary: 'S',
      content: 'C',
    });
    expect((res as any).id).toBe('art-2');
  });

  it('list: propagates errors from the public endpoint', async () => {
    server.use(
      http.get('*/api/knowledge', () =>
        HttpResponse.json({ message: 'down' }, { status: 503 })
      )
    );
    await expect(knowledgeService.list()).rejects.toThrow();
  });
});
