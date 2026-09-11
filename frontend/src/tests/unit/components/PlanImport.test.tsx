import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../setup/mswServer';
import PlanImport from '@/components/artisan/PlanImport';
import QuoteTemplateParams from '@/components/artisan/QuoteTemplateParams';
import QuoteTemplateGallery from '@/components/artisan/QuoteTemplateGallery';

/** Lecture type renvoyee par /plan-reading pour un plan a deux pieces. */
const lectureType = {
  pieces: [
    { libelle: 'SEJOUR', surface_m2: 18.5, texte_source_surface: 'SEJOUR 18,50 m2' },
    { libelle: 'CUISINE', surface_m2: 12, texte_source_surface: 'CUISINE 12,00 m2' },
  ],
  cotations: [{ valeur: 4.2, unite: 'm', texte_source: '4,20 m' }],
  illisible: [],
};

const mockReading = (body: any = { lecture: lectureType, avertissements: [] }, status = 200) => {
  server.use(http.post('*/api/quotes/plan-reading', () => HttpResponse.json(body, { status })));
};

/** Modele carrelage, tel que renvoye par /detect-trade quand il reconnait. */
const templateCarrelage = { id: 'carreleur-salle-de-bain-8m2', title: 'Carreleur', parameters: [] };

const mockDetection = (body: any) => {
  server.use(http.post('*/api/quotes/detect-trade', () => HttpResponse.json(body)));
};

const importer = async (user: any) => {
  await user.upload(
    document.getElementById('planFile') as HTMLInputElement,
    new File(['x'], 'plan.png', { type: 'image/png' })
  );
};

beforeEach(() => {
  localStorage.setItem('token', 'plan-token');
  localStorage.setItem('user', JSON.stringify({ _id: 'artisan-1', role: 'artisan' }));
});

describe('PlanImport', () => {
  const monter = (props: Partial<React.ComponentProps<typeof PlanImport>> = {}) =>
    render(<PlanImport onRead={() => {}} onBack={() => {}} {...props} />);

  it('should state that it reads the plan and never measures it', () => {
    monter();

    // Limite fondatrice : elle doit etre dite a l'artisan, pas seulement
    // respectee dans le code.
    expect(screen.getByText(/lues, jamais mesurées|read, never measured/i)).toBeInTheDocument();
  });

  it('should accept images and PDF only', () => {
    monter();

    const accept = (document.getElementById('planFile') as HTMLInputElement)
      .getAttribute('accept') || '';
    expect(accept).toContain('.png');
    expect(accept).toContain('.pdf');
    // Le DWG a ete abandonne : aucune conversion libre fiable.
    expect(accept).not.toContain('.dwg');
  });

  it('should announce the resolution floor before the artisan uploads', () => {
    monter();

    expect(screen.getByText(/1000 px/)).toBeInTheDocument();
  });

  it('should show what was read, with the source text', async () => {
    mockReading();
    const user = userEvent.setup();
    monter();
    await importer(user);

    expect(await screen.findByTestId('plan-reading')).toBeInTheDocument();
    // « SEJOUR » figure et dans le libelle et dans le texte source : on vise
    // le libelle exact pour ne pas confondre les deux.
    expect(screen.getByText('SEJOUR')).toBeInTheDocument();
    // Le texte lu est montre : l'artisan peut verifier contre son plan.
    expect(screen.getByText(/SEJOUR 18,50 m2/)).toBeInTheDocument();
  });

  it('should show the dimensions read, not only the surfaces', async () => {
    // Les cotations ne pre-remplissent rien pour l'instant, mais les cacher
    // laisserait croire que le plan n'a pas ete lu en entier.
    mockReading();
    const user = userEvent.setup();
    monter();
    await importer(user);

    expect(await screen.findByTestId('plan-cotations')).toBeInTheDocument();
    expect(screen.getByText(/4\.2 m/)).toBeInTheDocument();
  });

  it('should ask what the artisan needs to do, in plain words', async () => {
    // Le libelle doit annoncer son role reel : il sert a choisir le metier,
    // pas a decrire le chantier. Un champ vague ferait ecrire un paragraphe
    // dont rien ne serait exploite.
    mockReading();
    const user = userEvent.setup();
    monter();
    await importer(user);

    expect(await screen.findByLabelText(/que devez-vous faire|what do you need to do/i))
      .toBeInTheDocument();
    expect(screen.getByPlaceholderText(/carrelage, peinture|tiling, painting/i))
      .toBeInTheDocument();
  });

  it('should hand over the reading and the trade it recognised', async () => {
    mockReading();
    mockDetection({ templateId: templateCarrelage.id, template: templateCarrelage, raison: 'métier reconnu' });
    const onRead = vi.fn();
    const user = userEvent.setup();
    monter({ onRead });
    await importer(user);

    await user.type(
      await screen.findByLabelText(/que devez-vous faire|what do you need to do/i),
      'Carrelage salle de bain'
    );
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    await waitFor(() => expect(onRead).toHaveBeenCalledWith(lectureType, templateCarrelage));
  });

  it('should move on with no trade when nothing was recognised', async () => {
    // Ne rien reconnaitre n'est pas un echec : l'artisan choisira lui-meme.
    mockReading();
    mockDetection({ templateId: null, motsCles: [], raison: 'aucun mot-clé reconnu' });
    const onRead = vi.fn();
    const user = userEvent.setup();
    monter({ onRead });
    await importer(user);

    await user.click(await screen.findByRole('button', { name: /continuer|continue/i }));

    await waitFor(() => expect(onRead).toHaveBeenCalledWith(lectureType, null));
  });

  it('should not block the artisan when the detection call fails', async () => {
    // La detection n'est qu'un raccourci. Son echec ne doit pas coincer
    // l'artisan sur un ecran dont la lecture, elle, a bien reussi.
    mockReading();
    server.use(http.post('*/api/quotes/detect-trade', () => HttpResponse.json({}, { status: 500 })));
    const onRead = vi.fn();
    const user = userEvent.setup();
    monter({ onRead });
    await importer(user);

    await user.click(await screen.findByRole('button', { name: /continuer|continue/i }));

    await waitFor(() => expect(onRead).toHaveBeenCalledWith(lectureType, null));
  });

  it('should show the ceiling height when the plan carries one', async () => {
    mockReading({
      lecture: {
        ...lectureType,
        hauteurSousPlafond: { valeurM: 2.5, texteSource: 'Hauteur sous plafond 2,50 m' },
      },
      avertissements: [],
    });
    const user = userEvent.setup();
    monter();
    await importer(user);

    expect(await screen.findByText(/hauteur sous plafond|ceiling height/i)).toBeInTheDocument();
    expect(screen.getByText(/2\.5 m/)).toBeInTheDocument();
  });

  it('should say nothing about ceiling height when the plan carries none', async () => {
    mockReading();
    const user = userEvent.setup();
    monter();
    await importer(user);

    await screen.findByTestId('plan-reading');
    expect(screen.queryByText(/hauteur sous plafond|ceiling height/i)).not.toBeInTheDocument();
  });

  it('should surface the resolution refusal', async () => {
    mockReading(
      { message: 'Image trop petite (600×420 px). Il faut au moins 1000 px.', code: 'PLAN_RESOLUTION_TOO_LOW' },
      400
    );
    const user = userEvent.setup();
    monter();
    await importer(user);

    expect(await screen.findByText(/trop petite/)).toBeInTheDocument();
    expect(screen.queryByTestId('plan-reading')).not.toBeInTheDocument();
  });

  it('should tell the artisan when the daily quota is reached', async () => {
    // Le palier gratuit est de 20 lectures par jour et par modele. Ce n est
    // ni son plan ni une panne : le message doit lui parvenir intact.
    mockReading(
      {
        message: 'La limite quotidienne de lecture de plans est atteinte. Reessayez demain, ou saisissez les valeurs a la main.',
        code: 'GEMINI_QUOTA_EXHAUSTED',
      },
      429
    );
    const user = userEvent.setup();
    monter();
    await importer(user);

    expect(await screen.findByText(/limite quotidienne/)).toBeInTheDocument();
  });

  it('should tell the artisan when the plan carries too much text', async () => {
    mockReading(
      { message: 'Le plan comporte trop de texte pour etre lu en une fois.', code: 'PLAN_TOO_DENSE' },
      400
    );
    const user = userEvent.setup();
    monter();
    await importer(user);

    expect(await screen.findByText(/trop de texte/)).toBeInTheDocument();
  });

  it('should show the illegible zones the backend reports', async () => {
    mockReading({
      lecture: lectureType,
      avertissements: ['Le modèle signale des zones illisibles : la surface du SEJOUR est masquée'],
    });
    const user = userEvent.setup();
    monter();
    await importer(user);

    expect(await screen.findByText(/zones illisibles/)).toBeInTheDocument();
  });

  it('should let the artisan continue even when nothing usable was read', async () => {
    mockReading({ lecture: { pieces: [], cotations: [], illisible: [] }, avertissements: [] });
    const user = userEvent.setup();
    monter();
    await importer(user);

    expect(await screen.findByText(/aucune surface exploitable|no usable surface/i)).toBeInTheDocument();
    // Le parcours n'est pas bloque : l'artisan saisira les valeurs a la main.
    expect(screen.getByRole('button', { name: /continuer|continue/i })).toBeEnabled();
  });
});

describe('QuoteTemplateGallery - filtrage par identifiants', () => {
  const templates = [
    { id: 'carreleur-salle-de-bain-8m2', domain: 'Tiling', title: 'Carrelage', lines: [] },
    { id: 'peintre-piece-25m2', domain: 'Painting', title: 'Peinture intérieure', lines: [] },
    { id: 'plombier-3-points-eau', domain: 'Plumbing', title: 'Plomberie', lines: [] },
    { id: 'electricien-5-points', domain: 'Electrical Installation', title: 'Électricité', lines: [] },
  ];

  beforeEach(() => {
    server.use(http.get('*/api/quotes/templates', () => HttpResponse.json(templates)));
  });

  it('should show every template when no filter is given', async () => {
    render(<QuoteTemplateGallery onSelect={() => {}} onBack={() => {}} />);

    expect(await screen.findByText('Carrelage')).toBeInTheDocument();
    expect(screen.getByText('Plomberie')).toBeInTheDocument();
  });

  it('should keep only the allowed ones', async () => {
    render(
      <QuoteTemplateGallery
        allowedIds={['carreleur-salle-de-bain-8m2', 'peintre-piece-25m2']}
        onSelect={() => {}}
        onBack={() => {}}
      />
    );

    expect(await screen.findByText('Carrelage')).toBeInTheDocument();
    expect(screen.getByText('Peinture intérieure')).toBeInTheDocument();
    // Hors perimetre v1 : leurs champs ne se lisent pas sur un plan.
    expect(screen.queryByText('Plomberie')).not.toBeInTheDocument();
    expect(screen.queryByText('Électricité')).not.toBeInTheDocument();
  });
});

describe('QuoteTemplateParams - prop prefill generique', () => {
  const template = {
    id: 'carreleur-salle-de-bain-8m2',
    domain: 'Tiling',
    title: 'Carrelage',
    lines: [],
    parameters: [
      { key: 'surface', label: 'Surface à carreler', type: 'number', unit: 'm²', min: 0.1, step: 0.1, default: 8 },
      {
        key: 'typePose', label: 'Type de pose', type: 'select', default: 'droite',
        options: [{ value: 'droite', label: 'Droite' }, { value: 'diagonale', label: 'Diagonale' }],
      },
    ],
  } as any;

  it('should stay identical to before when no prefill is given', () => {
    // Chemin « devis pret » : purement manuel, rien ne doit avoir change.
    render(<QuoteTemplateParams template={template} onGenerated={() => {}} onBack={() => {}} />);

    expect(screen.getByLabelText(/surface à carreler/i)).toHaveValue(8);
    expect(screen.queryByText(/pré-rempli|prefilled/i)).not.toBeInTheDocument();
    // Aucune trace d'un quelconque import.
    expect(screen.queryByRole('button', { name: /importer|import/i })).not.toBeInTheDocument();
  });

  it('should start from the prefilled value and show its hint', () => {
    render(
      <QuoteTemplateParams
        template={template}
        prefill={{ surface: { value: 18.5, hint: 'SEJOUR — « SEJOUR 18,50 m2 »' } }}
        onGenerated={() => {}}
        onBack={() => {}}
      />
    );

    expect(screen.getByLabelText(/surface à carreler/i)).toHaveValue(18.5);
    expect(screen.getByText(/pré-rempli|prefilled/i)).toBeInTheDocument();
    expect(screen.getByText(/SEJOUR 18,50 m2/)).toBeInTheDocument();
  });

  it('should drop the hint once the artisan edits the field', async () => {
    const user = userEvent.setup();
    render(
      <QuoteTemplateParams
        template={template}
        prefill={{ surface: { value: 18.5, hint: 'SEJOUR' } }}
        onGenerated={() => {}}
        onBack={() => {}}
      />
    );

    const champ = screen.getByLabelText(/surface à carreler/i);
    await user.clear(champ);
    await user.type(champ, '20');

    // L'indice ne decrirait plus la valeur affichee.
    expect(screen.queryByText(/pré-rempli|prefilled/i)).not.toBeInTheDocument();
  });

  it('should leave the selects alone', () => {
    render(
      <QuoteTemplateParams
        template={template}
        prefill={{ surface: { value: 18.5 } }}
        onGenerated={() => {}}
        onBack={() => {}}
      />
    );

    // Un plan n'ecrit pas un type de pose : le select garde son defaut.
    expect(screen.getByLabelText(/type de pose/i)).toHaveValue('droite');
  });

  it('should send the prefilled value through to the compute endpoint', async () => {
    let recu: any = null;
    server.use(http.post('*/api/quotes/templates/:id/compute', async ({ request }) => {
      recu = await request.json();
      return HttpResponse.json({ id: 'carreleur', title: 'Carrelage', lines: [
        { designation: 'Carreaux', quantity: 1, unit: 'm²', unitPrice: 0, lineType: 'material', total: 0 },
      ] });
    }));

    const user = userEvent.setup();
    render(
      <QuoteTemplateParams
        template={template}
        prefill={{ surface: { value: 18.5 } }}
        onGenerated={() => {}}
        onBack={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /générer les lignes|generate the lines/i }));

    await waitFor(() => {
      // La valeur pre-remplie part en nombre, comme une saisie manuelle.
      expect(recu).toEqual({ surface: 18.5, typePose: 'droite' });
    });
  });
});
