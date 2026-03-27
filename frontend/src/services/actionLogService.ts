import { authenticatedApi } from './authService';

export interface ActionLogItem {
  _id: string;
  actorName: string;
  actorRole: string;
  actorAdminType?: 'super' | 'sub' | null;
  actionKey: string;
  actionLabel: string;
  entityType: string;
  entityId?: string | null;
  targetName?: string;
  targetRole?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ActionLogResponse {
  logs: ActionLogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  summary?: {
    total: number;
    paymentEvents: number;
    marketplaceEvents: number;
    invoiceInstallmentEvents: number;
    manufacturerProductEvents: number;
    adminSecurityEvents: number;
    byRole: Record<string, number>;
    topActions: Array<{
      actionKey: string;
      actionLabel: string;
      count: number;
    }>;
  };
}

interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  actorRole?: string;
  actionKey?: string;
  from?: string;
  to?: string;
}

const actionLogService = {
  async list(params: ListParams = {}): Promise<ActionLogResponse> {
    const response = await authenticatedApi.get('/logs', { params });
    return response.data;
  },

  async deleteById(id: string) {
    const response = await authenticatedApi.delete(`/logs/${id}`);
    return response.data;
  },

  async bulkDelete(ids: string[]) {
    const response = await authenticatedApi.post('/logs/bulk-delete', { ids });
    return response.data;
  },
};

export default actionLogService;
