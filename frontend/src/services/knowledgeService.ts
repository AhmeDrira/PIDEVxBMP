import axios from 'axios';
import { authenticatedApi } from './authService';

export interface KnowledgeAttachment {
  name: string;
  size: string; // keep as string for consistent rendering
  type: string;
  url?: string;
}

export interface KnowledgeArticle {
  _id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  authorName: string;
  status: 'draft' | 'published';
  views: number;
  likes?: number;
  liked?: boolean;
  likedByUser?: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  attachments?: KnowledgeAttachment[];
}

export interface KnowledgeAiSearchResponse {
  query: string;
  total: number;
  sorting?: { primary: string; secondary: string };
  analysis?: { keywords?: string[]; categories?: string[]; mustIncludePhrases?: string[] };
  modelUsed?: string | null;
  warning?: string;
  articles: KnowledgeArticle[];
}

const knowledgeService = {
  async list(): Promise<KnowledgeArticle[]> {
    const response = await axios.get('/api/knowledge');
    return response.data;
  },
  async getById(id: string): Promise<KnowledgeArticle> {
    const response = await authenticatedApi.get(`/knowledge/${id}`);
    return response.data;
  },
  async aiSearch(query: string): Promise<KnowledgeAiSearchResponse> {
    const response = await authenticatedApi.post('/knowledge/ai-search', { query });
    return response.data as KnowledgeAiSearchResponse;
  },
  async create(payload: {
    title: string;
    category: string;
    summary: string;
    content: string;
    authorName?: string;
    tags?: string[];
    attachments?: File[];
  }) {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('category', payload.category);
    formData.append('summary', payload.summary);
    formData.append('content', payload.content);
    if (payload.authorName) formData.append('authorName', payload.authorName);
    formData.append('tags', JSON.stringify(payload.tags ?? []));

    if (payload.attachments?.length) {
      payload.attachments.forEach((file) => formData.append('attachments', file));
    }

    const response = await authenticatedApi.post('/knowledge', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  async update(
    id: string,
    payload: {
      title: string;
      category: string;
      summary: string;
      content: string;
      authorName?: string;
      tags?: string[];
      attachments?: File[]; // new files to append
      removeAttachmentUrls?: string[]; // existing files to remove
    }
  ) {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('category', payload.category);
    formData.append('summary', payload.summary);
    formData.append('content', payload.content);
    if (payload.authorName) formData.append('authorName', payload.authorName);
    formData.append('tags', JSON.stringify(payload.tags ?? []));
    formData.append('removeAttachmentUrls', JSON.stringify(payload.removeAttachmentUrls ?? []));

    if (payload.attachments?.length) {
      payload.attachments.forEach((file) => formData.append('attachments', file));
    }

    const response = await authenticatedApi.put(`/knowledge/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  async remove(id: string) {
    const response = await authenticatedApi.delete(`/knowledge/${id}`);
    return response.data;
  },
  async toggleLike(id: string): Promise<{ likes: number; liked: boolean }> {
    const response = await authenticatedApi.post(`/knowledge/${id}/like`);
    return response.data as { likes: number; liked: boolean };
  },
};

export default knowledgeService;
