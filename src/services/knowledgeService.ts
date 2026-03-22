import axios from 'axios';
import { authenticatedApi } from './authService';

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
  createdAt: string;
  updatedAt: string;
  attachments?: string[];
}

const knowledgeService = {
  async list(): Promise<KnowledgeArticle[]> {
    const response = await axios.get('/api/knowledge');
    return response.data;
  },
  async getById(id: string): Promise<KnowledgeArticle> {
    const response = await axios.get(`/api/knowledge/${id}`);
    return response.data;
  },
  async create(payload: Partial<KnowledgeArticle>) {
    const response = await authenticatedApi.post('/knowledge', payload);
    return response.data;
  },
  async remove(id: string) {
    const response = await authenticatedApi.delete(`/knowledge/${id}`);
    return response.data;
  },
};

export default knowledgeService;
