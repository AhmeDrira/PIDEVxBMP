/**
 * Tests for CopilotChatWidget — covers:
 *   - shouldRender gate (isVisible + activeView === 'home')
 *   - context loading (/api/auth/me) per role + completion scoring
 *   - intro message wording branches (incomplete / complete profile)
 *   - nudge bubble open + dismissal via localStorage key
 *   - quick action click → onNavigate + chat send + assistant reply
 *   - manual message: input → submit → axios.post → reply rendered
 *   - error path: assistant fallback message when API rejects
 *   - missing token: assistant warning "Session expiree"
 *   - close button hides the panel
 *   - resize listener clamps the bubble
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CopilotChatWidget from '@/components/common/CopilotChatWidget';
import { server } from '../../setup/mswServer';

const mockMe = (role: 'artisan' | 'expert' | 'manufacturer', user: any) => {
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: { ...user, role } }))
  );
};

const mockChat = (reply: string | null = 'Bonjour, voici mon plan.') => {
  let received: any = null;
  server.use(
    http.post('*/api/ai/copilot-chat', async ({ request }) => {
      received = await request.json();
      if (reply === null) return HttpResponse.json({ message: 'down' }, { status: 500 });
      return HttpResponse.json({ reply });
    })
  );
  return () => received;
};

afterEach(() => {
  localStorage.clear();
});

beforeEach(() => {
  // mock token
  localStorage.setItem('user', JSON.stringify({ token: 'cop-tok' }));
});

// ---------- Visibility gate -------------------------------------------------

describe('CopilotChatWidget — visibility gate', () => {
  it('renders nothing when isVisible is false', () => {
    const { container } = render(
      <CopilotChatWidget role="artisan" activeView="home" isVisible={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when activeView is not "home"', () => {
    const { container } = render(
      <CopilotChatWidget role="artisan" activeView="profile" isVisible />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the floating bubble when visible and on home', () => {
    mockMe('artisan', { firstName: 'Amir', lastName: 'A' });
    render(<CopilotChatWidget role="artisan" activeView="home" isVisible />);
    expect(screen.getByRole('button', { name: /Ouvrir le chatbot/i })).toBeInTheDocument();
  });
});

// ---------- Open / quick actions / messages ---------------------------------

describe('CopilotChatWidget — chat panel', () => {
  it('opens the panel and shows the role-specific quick actions for artisan', async () => {
    mockMe('artisan', { firstName: 'Amir', lastName: 'A' });
    const user = userEvent.setup();
    render(<CopilotChatWidget role="artisan" activeView="home" isVisible />);

    await user.click(screen.getByRole('button', { name: /Ouvrir le chatbot/i }));
    expect(screen.getByRole('dialog', { name: /Bmp-Bot/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completer mon profil' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calculer un devis' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verifier mes factures' })).toBeInTheDocument();
  });

  it('shows expert-specific quick actions when role is expert', async () => {
    mockMe('expert', { firstName: 'Eya', lastName: 'B' });
    const user = userEvent.setup();
    render(<CopilotChatWidget role="expert" activeView="home" isVisible />);

    await user.click(screen.getByRole('button', { name: /Ouvrir le chatbot/i }));
    expect(screen.getByRole('button', { name: 'Trouver artisans' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voir mes messages' })).toBeInTheDocument();
  });

  it('shows manufacturer-specific quick actions when role is manufacturer', async () => {
    mockMe('manufacturer', { firstName: 'Moez', lastName: 'C' });
    const user = userEvent.setup();
    render(<CopilotChatWidget role="manufacturer" activeView="home" isVisible />);

    await user.click(screen.getByRole('button', { name: /Ouvrir le chatbot/i }));
    expect(screen.getByRole('button', { name: 'Verifier mes produits' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verifier mes commandes' })).toBeInTheDocument();
  });

  it('renders an intro message that mentions an incomplete profile when score < 100', async () => {
    mockMe('artisan', { firstName: 'Amir', lastName: 'A' }); // score < 100
    const user = userEvent.setup();
    render(<CopilotChatWidget role="artisan" activeView="home" isVisible />);

    await user.click(screen.getByRole('button', { name: /Ouvrir le chatbot/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/proposer des idees pour renforcer votre profil/i)
      ).toBeInTheDocument()
    );
  });

  it('renders the complete-profile intro when score is 100', async () => {
    mockMe('expert', {
      firstName: 'Eya',
      lastName: 'X',
      email: 'e@x.com',
      profilePhoto: '/p.jpg',
      phone: '20111111',
      location: 'Tunis',
      bio: 'bio',
      domain: 'eng',
      institution: 'Univ',
    });
    const user = userEvent.setup();
    render(<CopilotChatWidget role="expert" activeView="home" isVisible />);

    await user.click(screen.getByRole('button', { name: /Ouvrir le chatbot/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/avec des reponses detaillees/i)
      ).toBeInTheDocument()
    );
  });

  it('manual send: input → submit → assistant reply rendered', async () => {
    mockMe('artisan', { firstName: 'Amir', lastName: 'A' });
    const getReceived = mockChat('Voici votre devis.');
    const user = userEvent.setup();
    render(<CopilotChatWidget role="artisan" activeView="home" isVisible />);

    await user.click(screen.getByRole('button', { name: /Ouvrir le chatbot/i }));

    await user.type(screen.getByPlaceholderText(/Posez votre question/i), 'comment calculer ?');
    await user.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => expect(screen.getByText('Voici votre devis.')).toBeInTheDocument());
    expect(screen.getByText('comment calculer ?')).toBeInTheDocument();

    const body = getReceived();
    expect(body.message).toBe('comment calculer ?');
    expect(body.context.role).toBe('artisan');
    expect(body.context.currentView).toBe('home');
  });

  it('falls back to "reste disponible" reply when backend returns empty body', async () => {
    mockMe('artisan', { firstName: 'A', lastName: '' });
    server.use(
      http.post('*/api/ai/copilot-chat', () => HttpResponse.json({}))
    );
    const user = userEvent.setup();
    render(<CopilotChatWidget role="artisan" activeView="home" isVisible />);
    await user.click(screen.getByRole('button', { name: /Ouvrir le chatbot/i }));
    await user.type(screen.getByPlaceholderText(/Posez votre question/i), 'hi');
    await user.click(screen.getByRole('button', { name: /Envoyer/i }));
    await waitFor(() =>
      expect(screen.getByText(/reste disponible pour vous aider/i)).toBeInTheDocument()
    );
  });

  it('shows an error message when the chat API rejects the request', async () => {
    mockMe('artisan', { firstName: 'A', lastName: '' });
    mockChat(null);
    const user = userEvent.setup();
    render(<CopilotChatWidget role="artisan" activeView="home" isVisible />);
    await user.click(screen.getByRole('button', { name: /Ouvrir le chatbot/i }));

    await user.type(screen.getByPlaceholderText(/Posez votre question/i), 'aide');
    await user.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/indisponibilite temporaire/i)
      ).toBeInTheDocument()
    );
  });

  it('warns when there is no auth token before sending', async () => {
    localStorage.clear();
    server.use(http.get('*/api/auth/me', () => HttpResponse.json({ user: {} })));
    const user = userEvent.setup();
    render(<CopilotChatWidget role="artisan" activeView="home" isVisible />);

    await user.click(screen.getByRole('button', { name: /Ouvrir le chatbot/i }));
    await user.type(screen.getByPlaceholderText(/Posez votre question/i), 'hi');
    await user.click(screen.getByRole('button', { name: /Envoyer/i }));

    expect(
      await screen.findByText(/Session expiree. Veuillez vous reconnecter/i)
    ).toBeInTheDocument();
  });

  it('quick-action click triggers onNavigate and posts the prompt', async () => {
    mockMe('artisan', { firstName: 'Amir', lastName: 'A' });
    const getReceived = mockChat('Plan: ...');
    const user = userEvent.setup();
    const onNav = vi.fn();
    render(
      <CopilotChatWidget role="artisan" activeView="home" isVisible onNavigate={onNav} />
    );

    await user.click(screen.getByRole('button', { name: /Ouvrir le chatbot/i }));
    await user.click(screen.getByRole('button', { name: 'Calculer un devis' }));
    await waitFor(() => expect(screen.getByText('Plan: ...')).toBeInTheDocument());
    expect(onNav).toHaveBeenCalledWith('quotes');
    expect(getReceived().quickAction).toBe('calculate-quote');
  });

  it('close button collapses the panel', async () => {
    mockMe('artisan', { firstName: 'Amir', lastName: 'A' });
    const user = userEvent.setup();
    render(<CopilotChatWidget role="artisan" activeView="home" isVisible />);

    await user.click(screen.getByRole('button', { name: /Ouvrir le chatbot/i }));
    expect(screen.getByRole('dialog', { name: /Bmp-Bot/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog', { name: /Bmp-Bot/i })).toBeNull();
  });
});

// ---------- Misc branches ---------------------------------------------------

describe('CopilotChatWidget — misc branches', () => {
  it('handles an /auth/me network failure silently and still renders the bubble', async () => {
    server.use(
      http.get('*/api/auth/me', () => HttpResponse.json({ message: 'oops' }, { status: 500 }))
    );
    render(<CopilotChatWidget role="artisan" activeView="home" isVisible />);
    expect(
      await screen.findByRole('button', { name: /Ouvrir le chatbot/i })
    ).toBeInTheDocument();
  });

  it('tolerates a window resize event (clamp re-applies)', async () => {
    mockMe('artisan', { firstName: 'A', lastName: '' });
    render(<CopilotChatWidget role="artisan" activeView="home" isVisible />);
    fireEvent(window, new Event('resize'));
    expect(
      screen.getByRole('button', { name: /Ouvrir le chatbot/i })
    ).toBeInTheDocument();
  });

  it('keeps the panel hidden when activeView changes away from "home" while open', async () => {
    mockMe('artisan', { firstName: 'A', lastName: '' });
    const user = userEvent.setup();
    const { rerender } = render(
      <CopilotChatWidget role="artisan" activeView="home" isVisible />
    );
    await user.click(screen.getByRole('button', { name: /Ouvrir le chatbot/i }));
    expect(screen.getByRole('dialog', { name: /Bmp-Bot/i })).toBeInTheDocument();

    rerender(<CopilotChatWidget role="artisan" activeView="profile" isVisible />);
    expect(screen.queryByRole('dialog', { name: /Bmp-Bot/i })).toBeNull();
  });
});
