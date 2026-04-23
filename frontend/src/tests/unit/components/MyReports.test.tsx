import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import MyReports from '@/components/common/MyReports';
import { LanguageProvider } from '@/context/LanguageContext';
import { server } from '../../setup/mswServer';

type ReportPayload = {
  reportType?: string;
  targetUserId?: string;
  targetRole?: string;
  reason?: string;
  details?: string;
};

function renderMyReports() {
  return render(
    <LanguageProvider>
      <MyReports role="artisan" userId="artisan-1" />
    </LanguageProvider>
  );
}

describe('MyReports', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'reports-token-1');
    localStorage.setItem('user', JSON.stringify({ _id: 'artisan-1', role: 'artisan', token: 'reports-token-1' }));
    localStorage.setItem('app-language', 'en');
  });

  it('should show loading state then render report history entries', async () => {
    // Arrange
    server.use(
      http.get('*/api/reports/me', async () => {
        await delay(120);
        return HttpResponse.json([
          {
            _id: 'rep-1',
            reportType: 'user',
            reason: 'Harassment',
            details: 'Repeated abusive messages.',
            status: 'submitted',
            createdAt: '2026-04-20T10:00:00.000Z',
            targetUser: {
              _id: 'expert-1',
              firstName: 'Nour',
              lastName: 'Expert',
              role: 'expert',
            },
          },
          {
            _id: 'rep-2',
            reportType: 'app',
            reason: 'Bug in dashboard',
            details: 'Page freezes when opening reports.',
            status: 'accepted',
            createdAt: '2026-04-21T10:00:00.000Z',
            targetUser: null,
          },
        ]);
      })
    );

    // Act
    renderMyReports();

    // Assert
    expect(screen.getByText(/loading reports/i)).toBeInTheDocument();
    expect(await screen.findByText(/user report - nour expert/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /app report/i })).toBeInTheDocument();
  });

  it('should show empty state when no reports are available', async () => {
    // Arrange
    server.use(http.get('*/api/reports/me', () => HttpResponse.json([])));

    // Act
    renderMyReports();

    // Assert
    expect(await screen.findByText(/no reports found/i)).toBeInTheDocument();
  });

  it('should submit a user report after selecting a target user', async () => {
    // Arrange
    const reportsStore: any[] = [];
    let receivedPayload: ReportPayload = {};

    server.use(
      http.get('*/api/reports/me', () => HttpResponse.json(reportsStore)),
      http.get('*/api/conversations', () =>
        HttpResponse.json([
          {
            _id: 'conv-1',
            participants: [
              { _id: 'artisan-1', firstName: 'Amine', lastName: 'Artisan', role: 'artisan' },
              { _id: 'expert-1', firstName: 'Nour', lastName: 'Expert', role: 'expert' },
            ],
          },
        ])
      ),
      http.post('*/api/reports', async ({ request }) => {
        receivedPayload = (await request.json()) as ReportPayload;
        reportsStore.push({
          _id: 'rep-new-1',
          reportType: 'user',
          reason: receivedPayload.reason || 'Reason',
          details: receivedPayload.details || '',
          status: 'submitted',
          createdAt: '2026-04-22T10:00:00.000Z',
          targetUser: { _id: 'expert-1', firstName: 'Nour', lastName: 'Expert', role: 'expert' },
        });
        return HttpResponse.json({ success: true }, { status: 201 });
      })
    );
    const user = userEvent.setup();

    // Act
    renderMyReports();

    await user.click(await screen.findByRole('button', { name: /add report/i }));
    await user.click(screen.getByRole('button', { name: /report user/i }));
    await user.click(await screen.findByRole('button', { name: /nour expert/i }));
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    // Assert
    await waitFor(() => {
      expect(receivedPayload.reportType).toBe('user');
      expect(receivedPayload.targetUserId).toBe('expert-1');
      expect(receivedPayload.targetRole).toBe('expert');
    });
    expect(await screen.findByText(/user report - nour expert/i)).toBeInTheDocument();
  });

  it('should show target loading error when user candidates cannot be fetched', async () => {
    // Arrange
    server.use(
      http.get('*/api/reports/me', () => HttpResponse.json([])),
      http.get('*/api/conversations', () => HttpResponse.error())
    );
    const user = userEvent.setup();

    // Act
    renderMyReports();

    await user.click(await screen.findByRole('button', { name: /add report/i }));
    await user.click(screen.getByRole('button', { name: /report user/i }));

    // Assert
    expect(await screen.findByText(/unable to load users right now/i)).toBeInTheDocument();
  });
});
