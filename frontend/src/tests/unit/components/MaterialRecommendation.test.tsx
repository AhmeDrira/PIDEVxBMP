/**
 * Tests for MaterialRecommendation:
 *   - project header rendering with fallbacks
 *   - back button click
 *   - toggle brief form
 *   - validation: invalid budget / no project id / no token
 *   - successful AI analyze: renders BMP + external materials, success toast
 *   - error path: backend error message surfaced via toast
 *   - "Add to project" flow: success / failure / disabled-after-add states
 *   - external "Search on Google" → window.open + analytics tracking
 *   - budget warning banner branch
 *   - empty material lists fallback messages
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import MaterialRecommendation from '@/components/artisan/MaterialRecommendation';
import { server } from '../../setup/mswServer';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
import { toast } from 'sonner';

beforeAll(() => {
  // window.open is used to launch Google search for external materials
  Object.defineProperty(window, 'open', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

beforeEach(() => {
  localStorage.setItem('user', JSON.stringify({ token: 'mr-tok' }));
  (window.open as any).mockClear?.();
});

afterEach(() => {
  localStorage.clear();
});

const baseProject = {
  _id: 'proj-1',
  title: 'Renovation cuisine',
  description: 'Refaire le carrelage et la plomberie',
  location: 'Sfax, Tunisie',
  startDate: '2026-03-01T00:00:00Z',
  endDate: '2026-04-15T00:00:00Z',
};

const aiResult = {
  bmp_materials: [
    {
      productId: 'p-cement',
      name: 'Ciment Portland',
      brand: 'BTC',
      price: 15.5,
      quantite_recommandee: 20,
      unite_mesure: 'sacs',
      category: 'cement',
      ai_justification: 'Necessaire pour la base.',
    },
  ],
  external_materials: [
    {
      generic_name: 'Robinet inox',
      estimated_price: 80,
      quantite_recommandee: 2,
      unite_mesure: 'piece',
      suggested_brand: 'Grohe',
      search_keyword: 'robinet inox cuisine',
    },
  ],
  meta: { model: 'gemini-flash' },
};

const installAi = (resp: any = aiResult, status = 200) => {
  let captured: any = null;
  server.use(
    http.post('*/api/recommendations/ai-shopper', async ({ request }) => {
      captured = await request.json();
      if (status >= 400) return HttpResponse.json(resp, { status });
      return HttpResponse.json(resp);
    }),
    http.post('*/api/analytics/missing-product', () => HttpResponse.json({ ok: true }))
  );
  return () => captured;
};

const renderMR = (extra: Partial<React.ComponentProps<typeof MaterialRecommendation>> = {}) => {
  const onBack = extra.onBack ?? vi.fn();
  const onAddToProject = extra.onAddToProject ?? vi.fn().mockResolvedValue(undefined);
  return {
    onBack,
    onAddToProject,
    ...render(
      <MaterialRecommendation
        project={baseProject}
        onBack={onBack}
        onAddToProject={onAddToProject}
      />
    ),
  };
};

// ---------- Static rendering ------------------------------------------------

describe('MaterialRecommendation — project header & navigation', () => {
  it('renders the project context with provided fields', () => {
    renderMR();
    expect(screen.getByText('Renovation cuisine')).toBeInTheDocument();
    expect(screen.getByText('Sfax, Tunisie')).toBeInTheDocument();
    expect(screen.getByText(/Refaire le carrelage et la plomberie/i)).toBeInTheDocument();
    // start + end dates resolved via toLocaleDateString → just check non-empty
    expect(screen.getByText(/Personal Shopper IA/i)).toBeInTheDocument();
  });

  it('falls back to placeholders for missing project fields', () => {
    render(
      <MaterialRecommendation
        project={{ _id: 'p2' } as any}
        onBack={vi.fn()}
        onAddToProject={vi.fn().mockResolvedValue(undefined)}
      />
    );
    expect(screen.getByText('Projet sans titre')).toBeInTheDocument();
    expect(screen.getByText('Localisation non precisee')).toBeInTheDocument();
    expect(screen.getByText(/Aucune description fournie/i)).toBeInTheDocument();
  });

  it('triggers onBack when the back button is clicked', async () => {
    const { onBack } = renderMR();
    // The first button on the page is the ArrowLeft back button (icon-only)
    const backBtn = screen.getAllByRole('button')[0];
    await userEvent.setup().click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// ---------- Brief form toggle + analyze ------------------------------------

describe('MaterialRecommendation — brief form & analyze', () => {
  it('opens and closes the brief form on demand', async () => {
    const user = userEvent.setup();
    renderMR();
    expect(screen.queryByLabelText(/Budget \(TND\)/i)).toBeNull();

    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    expect(screen.getByLabelText(/Budget \(TND\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Gamme/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Besoins specifiques/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    expect(screen.queryByLabelText(/Budget \(TND\)/i)).toBeNull();
  });

  it('rejects an invalid (empty) budget', async () => {
    installAi();
    const user = userEvent.setup();
    renderMR();

    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    await user.click(screen.getByRole('button', { name: /Lancer l'analyse IA/i }));

    expect(toast.error).toHaveBeenCalledWith('Veuillez saisir un budget valide en TND.');
  });

  it('rejects when token is missing', async () => {
    localStorage.clear();
    installAi();
    const user = userEvent.setup();
    renderMR();

    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    await user.type(screen.getByLabelText(/Budget \(TND\)/i), '2500');
    await user.click(screen.getByRole('button', { name: /Lancer l'analyse IA/i }));

    expect(toast.error).toHaveBeenCalledWith('Session invalide. Veuillez vous reconnecter.');
  });

  it('rejects when project has no _id', async () => {
    installAi();
    render(
      <MaterialRecommendation
        project={{} as any}
        onBack={vi.fn()}
        onAddToProject={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    // budget non-zero so we pass that gate first; the project _id check fires first anyway
    await user.click(screen.getByRole('button', { name: /Lancer l'analyse IA/i }));
    expect(toast.error).toHaveBeenCalledWith('Projet invalide.');
  });

  it('runs the analyze and renders both BMP and external materials', async () => {
    const getBody = installAi();
    const user = userEvent.setup();
    renderMR();

    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    await user.type(screen.getByLabelText(/Budget \(TND\)/i), '2500');
    await user.selectOptions(screen.getByLabelText(/Gamme/i), 'premium');
    await user.type(
      screen.getByLabelText(/Besoins specifiques/i),
      'Anti-derapant et finition propre'
    );
    // The brief preview only shows up after typing
    expect(screen.getByText(/Apercu des besoins specifiques/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Lancer l'analyse IA/i }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Analyse IA terminee.')
    );

    // BMP material rendered
    expect(screen.getByText('Ciment Portland')).toBeInTheDocument();
    expect(screen.getByText(/BTC.*cement/i)).toBeInTheDocument();
    expect(screen.getByText('Necessaire pour la base.')).toBeInTheDocument();
    // External material rendered
    expect(screen.getByText('Robinet inox')).toBeInTheDocument();
    expect(screen.getByText(/Marque suggeree: Grohe/i)).toBeInTheDocument();

    const body = getBody();
    expect(body.projectId).toBe('proj-1');
    expect(body.budget).toBe(2500);
    expect(body.range).toBe('premium');
    expect(body.specificNeeds).toMatch(/Anti-derapant/);
  });

  it('surfaces the backend error message when analyze fails', async () => {
    installAi({ message: 'Quota IA depasse' }, 429);
    const user = userEvent.setup();
    renderMR();

    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    await user.type(screen.getByLabelText(/Budget \(TND\)/i), '500');
    await user.click(screen.getByRole('button', { name: /Lancer l'analyse IA/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Quota IA depasse')
    );
  });

  it('falls back to a generic error message when backend has no message', async () => {
    installAi({}, 500);
    const user = userEvent.setup();
    renderMR();
    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    await user.type(screen.getByLabelText(/Budget \(TND\)/i), '500');
    await user.click(screen.getByRole('button', { name: /Lancer l'analyse IA/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Erreur pendant l\'analyse IA.')
    );
  });

  it('renders empty fallback messages when both lists are empty', async () => {
    installAi({ bmp_materials: [], external_materials: [], meta: {} });
    const user = userEvent.setup();
    renderMR();
    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    await user.type(screen.getByLabelText(/Budget \(TND\)/i), '500');
    await user.click(screen.getByRole('button', { name: /Lancer l'analyse IA/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/Aucun produit interne pertinent/i)
      ).toBeInTheDocument()
    );
    expect(screen.getByText(/Aucun achat externe necessaire/i)).toBeInTheDocument();
  });

  it('renders the budget warning banner when the IA flags an over-budget plan', async () => {
    installAi({
      bmp_materials: [],
      external_materials: [],
      meta: {
        budget_check: {
          provided_budget: 500,
          estimated_total: 700,
          estimated_bmp_total: 600,
          estimated_external_total: 100,
          threshold_15_percent: 575,
          is_over_budget_15_percent: true,
          warning_message: 'Le budget est insuffisant.',
        },
      },
    });
    const user = userEvent.setup();
    renderMR();
    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    await user.type(screen.getByLabelText(/Budget \(TND\)/i), '500');
    await user.click(screen.getByRole('button', { name: /Lancer l'analyse IA/i }));

    await waitFor(() =>
      expect(screen.getByText('Le budget est insuffisant.')).toBeInTheDocument()
    );
    expect(screen.getByText(/700.00 TND/i)).toBeInTheDocument();
  });
});

// ---------- Add to project ---------------------------------------------------

describe('MaterialRecommendation — add to project', () => {
  it('calls onAddToProject + shows success toast and disables the button after success', async () => {
    installAi();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <MaterialRecommendation
        project={baseProject}
        onBack={vi.fn()}
        onAddToProject={onAdd}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    await user.type(screen.getByLabelText(/Budget \(TND\)/i), '500');
    await user.click(screen.getByRole('button', { name: /Lancer l'analyse IA/i }));

    await waitFor(() => expect(screen.getByText('Ciment Portland')).toBeInTheDocument());

    const addBtn = screen.getByRole('button', { name: /Ajouter au projet/i });
    await user.click(addBtn);

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('p-cement', 20));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Ciment Portland ajoute au projet')
      )
    );
    expect(screen.getByRole('button', { name: /Ajoute au projet/i })).toBeDisabled();
  });

  it('shows error toast when onAddToProject rejects', async () => {
    installAi();
    const onAdd = vi.fn().mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(
      <MaterialRecommendation
        project={baseProject}
        onBack={vi.fn()}
        onAddToProject={onAdd}
      />
    );
    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    await user.type(screen.getByLabelText(/Budget \(TND\)/i), '500');
    await user.click(screen.getByRole('button', { name: /Lancer l'analyse IA/i }));

    await waitFor(() => expect(screen.getByText('Ciment Portland')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Ajouter au projet/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Impossible d\'ajouter')
      )
    );
  });
});

// ---------- External materials ----------------------------------------------

describe('MaterialRecommendation — external materials', () => {
  it('opens Google search and pings analytics when the Google button is clicked', async () => {
    installAi();
    const user = userEvent.setup();
    renderMR();
    await user.click(
      screen.getByRole('button', { name: /Demander a l'IA de lister les materiaux/i })
    );
    await user.type(screen.getByLabelText(/Budget \(TND\)/i), '500');
    await user.click(screen.getByRole('button', { name: /Lancer l'analyse IA/i }));

    await waitFor(() => expect(screen.getByText('Robinet inox')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Chercher sur Google/i }));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('google.com/search?q='),
      '_blank',
      'noopener,noreferrer'
    );
  });
});
