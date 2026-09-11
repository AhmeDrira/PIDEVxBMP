import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { toast } from 'sonner';
import ArtisanQuotes from '@/components/artisan/ArtisanQuotes';
import { server } from '../../setup/mswServer';

const quotesFixture = [
  {
    _id: 'quote-1',
    quoteNumber: 'Q-1001',
    status: 'pending',
    project: { _id: 'project-1', title: 'Villa Sidi Bou Said' },
    clientName: 'Amal Ben Salah',
    description: 'Structural concrete and masonry work for the ground floor.',
    createdAt: '2026-04-20T10:00:00.000Z',
    validUntil: '2026-05-20T10:00:00.000Z',
    amount: 4200,
    laborHand: 2500,
    materialsAmount: 1700,
    hasInvoice: false,
    upfrontPercent: 50,
  },
  {
    _id: 'quote-2',
    quoteNumber: 'Q-1002',
    status: 'approved',
    project: { _id: 'project-2', title: 'Warehouse Sfax' },
    clientName: 'Sami Logistics',
    description: 'Interior finishing and coatings for the full site.',
    createdAt: '2026-04-18T10:00:00.000Z',
    validUntil: '2026-05-18T10:00:00.000Z',
    amount: 6100,
    laborHand: 3200,
    materialsAmount: 2900,
    hasInvoice: true,
    upfrontPercent: 40,
  },
];

describe('ArtisanQuotes', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'quotes-token-1');
    localStorage.setItem('user', JSON.stringify({ _id: 'artisan-1', role: 'artisan', token: 'quotes-token-1' }));
    sessionStorage.setItem('artisan-sub-active', '1');
  });

  it('should render quotes after loading state', async () => {
    // Arrange
    server.use(
      http.get('*/api/quotes', async () => {
        await delay(120);
        return HttpResponse.json(quotesFixture);
      })
    );

    // Act
    render(<ArtisanQuotes />);

    // Assert
    expect(screen.getByText(/loading quotes|chargement des devis/i)).toBeInTheDocument();
    expect(await screen.findByText(/quote q-1001|devis q-1001/i)).toBeInTheDocument();
    expect(screen.getByText(/quote q-1002|devis q-1002/i)).toBeInTheDocument();
  });

  it('should show empty state when no quotes are returned', async () => {
    // Arrange
    server.use(http.get('*/api/quotes', () => HttpResponse.json([])));

    // Act
    render(<ArtisanQuotes />);

    // Assert
    expect(await screen.findByText(/no quotes found|aucun devis/i)).toBeInTheDocument();
  });

  it('should gracefully show empty state when quotes request fails', async () => {
    // Arrange
    server.use(
      http.get('*/api/quotes', () =>
        HttpResponse.json({ message: 'Unable to load quotes' }, { status: 500 })
      )
    );

    // Act
    render(<ArtisanQuotes />);

    // Assert
    expect(await screen.findByText(/no quotes found|aucun devis/i)).toBeInTheDocument();
  });

  it('should filter quotes by search query and status', async () => {
    // Arrange
    server.use(http.get('*/api/quotes', () => HttpResponse.json(quotesFixture)));
    const user = userEvent.setup();

    // Act
    render(<ArtisanQuotes />);

    const searchInput = await screen.findByPlaceholderText(/search quotes|rechercher des devis/i);
    await user.clear(searchInput);
    await user.type(searchInput, 'warehouse');

    // Assert
    expect(screen.getByText(/quote q-1002|devis q-1002/i)).toBeInTheDocument();
    expect(screen.queryByText(/quote q-1001|devis q-1001/i)).not.toBeInTheDocument();

    // Act
    await user.clear(searchInput);
    const statusSelect = screen.getByDisplayValue(/all status|tous les statuts/i);
    await user.selectOptions(statusSelect, 'pending');

    // Assert
    expect(screen.getByText(/quote q-1001|devis q-1001/i)).toBeInTheDocument();
    expect(screen.queryByText(/quote q-1002|devis q-1002/i)).not.toBeInTheDocument();
  });

  it('should open the method choice screen instead of the form when generating a quote', async () => {
    // Arrange
    server.use(http.get('*/api/quotes', () => HttpResponse.json([])));
    const user = userEvent.setup();
    render(<ArtisanQuotes />);
    await screen.findByText(/no quotes found|aucun devis/i);

    // Act
    await user.click(
      screen.getByRole('button', { name: /generate quote|generer un devis/i })
    );

    // Assert : ecran de choix, pas le formulaire
    expect(
      await screen.findByRole('heading', { name: /generate a quote|g[ée]n[ée]rer un devis/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /blank quote|devis libre/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ready-made quote|devis pr[eê]t/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/client name|nom du client/i)).not.toBeInTheDocument();
  });

  it('should reach the existing form only after picking the blank quote option', async () => {
    // Arrange
    server.use(http.get('*/api/quotes', () => HttpResponse.json([])));
    const user = userEvent.setup();
    render(<ArtisanQuotes />);
    await screen.findByText(/no quotes found|aucun devis/i);

    // Act
    await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
    await user.click(await screen.findByRole('button', { name: /blank quote|devis libre/i }));

    // Assert : le formulaire existant, inchange
    expect(
      await screen.findByRole('heading', { name: /generate new quote|g[ée]n[ée]rer un nouveau devis/i })
    ).toBeInTheDocument();
  });

  it('should open the plan journey from the plan card', async () => {
    // Arrange
    server.use(http.get('*/api/quotes', () => HttpResponse.json([])));
    const user = userEvent.setup();
    render(<ArtisanQuotes />);
    await screen.findByText(/no quotes found|aucun devis/i);

    // Act
    await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
    const planCard = await screen.findByRole('button', { name: /from a plan|depuis un plan/i });

    // Assert : la carte est active, sans badge, et sa promesse est tenable.
    expect(planCard).toBeEnabled();
    expect(within(planCard).queryByText(/coming soon|bient[oô]t disponible/i)).toBeNull();
    // AutoCAD et DWG sont hors perimetre : la carte ne doit plus les promettre.
    expect(within(planCard).queryByText(/autocad|dwg/i)).toBeNull();

    // Elle mene a l ecran d import, pas a un formulaire de devis.
    await user.click(planCard);
    expect(
      await screen.findByRole('heading', { name: /importer un plan|import a plan/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /generate new quote|g[ée]n[ée]rer un nouveau devis/i })
    ).not.toBeInTheDocument();
  });

  it('should carry the plan reading through to the prefilled form', async () => {
    // Parcours complet : import -> lecture -> choix du metier -> formulaire.
    const lecture = {
      pieces: [{ libelle: 'SEJOUR', surface_m2: 18.5, texte_source_surface: 'SEJOUR 18,50 m2' }],
      cotations: [],
      illisible: [],
    };
    let lectureRecue = null;
    server.use(
      http.get('*/api/quotes', () => HttpResponse.json([])),
      http.get('*/api/quotes/templates', () => HttpResponse.json([
        {
          id: 'carreleur-salle-de-bain-8m2', domain: 'Tiling', title: 'Carrelage', lines: [],
          parameters: [
            { key: 'surface', label: 'Surface a carreler', type: 'number', unit: 'm2', min: 0.1, step: 0.1, default: 8 },
          ],
        },
      ])),
      http.post('*/api/quotes/plan-reading', () => HttpResponse.json({ lecture, avertissements: [] })),
      http.post('*/api/quotes/templates/:id/map-reading', async ({ request }) => {
        lectureRecue = (await request.json()).lecture;
        return HttpResponse.json({
          id: 'carreleur-salle-de-bain-8m2',
          title: 'Carrelage',
          propositions: [{
            champ_cible: 'surface', unite: 'm2',
            candidats: [{ piece_index: 0, valeur: 18.5, libelle: 'SEJOUR', texte_source: 'SEJOUR 18,50 m2' }],
          }],
          rejetees: [], avertissements: [],
        });
      })
    );

    const user = userEvent.setup();
    render(<ArtisanQuotes />);
    await screen.findByText(/no quotes found|aucun devis/i);

    await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
    await user.click(await screen.findByRole('button', { name: /from a plan|depuis un plan/i }));

    await user.upload(
      document.getElementById('planFile'),
      new File(['x'], 'plan.png', { type: 'image/png' })
    );
    // Sans description, rien n'est reconnu : l'artisan passe par la galerie.
    server.use(http.post('*/api/quotes/detect-trade', () => HttpResponse.json({
      templateId: null, motsCles: [], raison: 'description vide',
    })));
    await user.click(await screen.findByRole('button', { name: /continuer|continue/i }));

    // La galerie est filtree : seuls les metiers en perimetre v1.
    await user.click(await screen.findByRole('button', { name: /carrelage/i }));

    // La lecture est bien celle de l import, transmise telle quelle.
    await waitFor(() => {
      expect(lectureRecue).toEqual(lecture);
    });
    // Et la valeur lue atterrit dans le champ, signalee comme pre-remplie.
    expect(await screen.findByLabelText(/surface a carreler/i)).toHaveValue(18.5);
    expect(screen.getByText(/pr.-rempli|prefilled/i)).toBeInTheDocument();
  });

  it('should skip the gallery when the description names a trade', async () => {
    // Metier reconnu : l'artisan arrive directement au formulaire. Le detour
    // par la galerie serait une question dont on connait deja la reponse.
    const lecture = {
      pieces: [{ libelle: 'SEJOUR', surface_m2: 18.5, texte_source_surface: 'SEJOUR 18,50 m2' }],
      cotations: [],
      illisible: [],
    };
    const template = {
      id: 'carreleur-salle-de-bain-8m2', domain: 'Tiling', title: 'Carrelage', lines: [],
      parameters: [
        { key: 'surface', label: 'Surface a carreler', type: 'number', unit: 'm2', min: 0.1, step: 0.1, default: 8 },
      ],
    };
    server.use(
      http.get('*/api/quotes', () => HttpResponse.json([])),
      http.get('*/api/quotes/templates', () => HttpResponse.json([template])),
      http.post('*/api/quotes/plan-reading', () => HttpResponse.json({ lecture, avertissements: [] })),
      http.post('*/api/quotes/detect-trade', () => HttpResponse.json({
        templateId: template.id, template, motsCles: ['carrel'], raison: 'métier reconnu',
      })),
      http.post('*/api/quotes/templates/:id/map-reading', () => HttpResponse.json({
        id: template.id,
        propositions: [{
          champ_cible: 'surface', unite: 'm2',
          candidats: [{ piece_index: 0, valeur: 18.5, libelle: 'SEJOUR', texte_source: 'SEJOUR 18,50 m2' }],
        }],
        rejetees: [], avertissements: [], indications: [],
      }))
    );

    const user = userEvent.setup();
    render(<ArtisanQuotes />);
    await screen.findByText(/no quotes found|aucun devis/i);

    await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
    await user.click(await screen.findByRole('button', { name: /from a plan|depuis un plan/i }));
    await user.upload(
      document.getElementById('planFile'),
      new File(['x'], 'plan.png', { type: 'image/png' })
    );
    await user.type(
      await screen.findByLabelText(/que devez-vous faire|what do you need to do/i),
      'Carrelage'
    );
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    // Le formulaire, sans etre passe par la galerie.
    expect(await screen.findByLabelText(/surface a carreler/i)).toHaveValue(18.5);
    expect(screen.queryByRole('heading', { name: /devis pr.ts|ready-made/i })).toBeNull();
  });

  it('should ask which rooms are covered when the plan holds several', async () => {
    // Le plan couvre le logement entier, le devis non. Rien ne dit quelles
    // pieces sont concernees : on demande plutot que de sommer d'office.
    const lecture = {
      pieces: [
        { libelle: 'SALLE DE BAIN', surface_m2: 6.3, texte_source_surface: 'SALLE DE BAIN 6,30 m2' },
        { libelle: 'WC', surface_m2: 2.1, texte_source_surface: 'WC 2,10 m2' },
        { libelle: 'ENTREE', surface_m2: 4.1, texte_source_surface: 'ENTREE 4,10 m2' },
      ],
      cotations: [],
      illisible: [],
    };
    const template = {
      id: 'carreleur-salle-de-bain-8m2', domain: 'Tiling', title: 'Carrelage', lines: [],
      parameters: [
        { key: 'surface', label: 'Surface a carreler', type: 'number', unit: 'm2', min: 0.1, step: 0.1, default: 8 },
      ],
    };
    server.use(
      http.get('*/api/quotes', () => HttpResponse.json([])),
      http.get('*/api/quotes/templates', () => HttpResponse.json([template])),
      http.post('*/api/quotes/plan-reading', () => HttpResponse.json({ lecture, avertissements: [] })),
      http.post('*/api/quotes/detect-trade', () => HttpResponse.json({
        templateId: template.id, template, motsCles: ['carrel'], raison: 'métier reconnu',
      })),
      http.post('*/api/quotes/templates/:id/map-reading', () => HttpResponse.json({
        id: template.id,
        propositions: [{
          champ_cible: 'surface', unite: 'm²',
          candidats: lecture.pieces.map((p, i) => ({
            piece_index: i, valeur: p.surface_m2, libelle: p.libelle, texte_source: p.texte_source_surface,
          })),
        }],
        rejetees: [], avertissements: [], indications: [],
      }))
    );

    const user = userEvent.setup();
    render(<ArtisanQuotes />);
    await screen.findByText(/no quotes found|aucun devis/i);

    await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
    await user.click(await screen.findByRole('button', { name: /from a plan|depuis un plan/i }));
    await user.upload(
      document.getElementById('planFile'),
      new File(['x'], 'plan.png', { type: 'image/png' })
    );
    await user.type(
      await screen.findByLabelText(/que devez-vous faire|what do you need to do/i),
      'Carrelage'
    );
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    // L'ecran de selection s'intercale, rien n'est coche.
    await screen.findByTestId('plan-rooms');
    screen.getAllByRole('checkbox').forEach((c) => expect(c).not.toBeChecked());

    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    // La somme des pieces cochees, et le detail qui la justifie.
    expect(await screen.findByLabelText(/surface a carreler/i)).toHaveValue(8.4);
    expect(screen.getByText(/SALLE DE BAIN 6,3 \+ WC 2,1/)).toBeInTheDocument();
  });

  it('should show the ceiling height next to surfaceMurs without filling it', async () => {
    // On ne peut pas deduire la surface des murs sans le perimetre de la
    // piece. On donne la hauteur lue ; le calcul reste celui de l'artisan.
    const lecture = {
      pieces: [{ libelle: 'CHAMBRE', surface_m2: 12, texte_source_surface: 'CHAMBRE 12,00 m2' }],
      cotations: [],
      hauteurSousPlafond: { valeurM: 2.5, texteSource: 'Hauteur sous plafond 2,50 m' },
      illisible: [],
    };
    const template = {
      id: 'peintre-piece-25m2', domain: 'Painting', title: 'Peinture', lines: [],
      parameters: [
        { key: 'surfacePlafond', label: 'Surface plafond', type: 'number', unit: 'm2', min: 0.1, step: 0.1, default: 25 },
        {
          key: 'murs', type: 'list', label: 'Murs a peindre', addLabel: 'Ajouter un mur',
          itemLabel: 'Mur', itemNameKey: 'nom', min: 1,
          default: [{ nom: 'Mur 1', mode: 'surface', surfaceM2: 25, longueurM: 0, hauteurM: 2.5 }],
          itemFields: [
            { key: 'nom', label: 'Nom du mur', type: 'text', default: '' },
            { key: 'mode', label: 'Saisie', type: 'select', default: 'surface',
              options: [{ value: 'surface', label: 'Surface (m2)' }, { value: 'longueur', label: 'Longueur x hauteur' }] },
            { key: 'surfaceM2', label: 'Surface du mur', type: 'number', unit: 'm2', min: 0, step: 0.1, default: 0,
              showIf: { key: 'mode', equals: 'surface' } },
            { key: 'longueurM', label: 'Longueur', type: 'number', unit: 'ml', min: 0, step: 0.1, default: 0,
              showIf: { key: 'mode', equals: 'longueur' } },
            { key: 'hauteurM', label: 'Hauteur sous plafond', type: 'number', unit: 'ml', min: 0, step: 0.05, default: 2.5,
              showIf: { key: 'mode', equals: 'longueur' } },
          ],
        },
      ],
    };
    server.use(
      http.get('*/api/quotes', () => HttpResponse.json([])),
      http.get('*/api/quotes/templates', () => HttpResponse.json([template])),
      http.post('*/api/quotes/plan-reading', () => HttpResponse.json({ lecture, avertissements: [] })),
      http.post('*/api/quotes/detect-trade', () => HttpResponse.json({
        templateId: template.id, template, motsCles: ['peintur'], raison: 'métier reconnu',
      })),
      http.post('*/api/quotes/templates/:id/map-reading', () => HttpResponse.json({
        id: template.id,
        propositions: [{
          champ_cible: 'surfacePlafond', unite: 'm²',
          candidats: [{ piece_index: 0, valeur: 12, libelle: 'CHAMBRE', texte_source: 'CHAMBRE 12,00 m2' }],
        }],
        rejetees: [],
        avertissements: [],
        indications: [{
          champ_cible: 'murs',
          texte: 'Hauteur sous plafond indiquée sur le plan : 2.5 m',
          texte_source: 'Hauteur sous plafond 2,50 m',
        }],
      }))
    );

    const user = userEvent.setup();
    render(<ArtisanQuotes />);
    await screen.findByText(/no quotes found|aucun devis/i);

    await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
    await user.click(await screen.findByRole('button', { name: /from a plan|depuis un plan/i }));
    await user.upload(
      document.getElementById('planFile'),
      new File(['x'], 'plan.png', { type: 'image/png' })
    );
    await user.type(
      await screen.findByLabelText(/que devez-vous faire|what do you need to do/i),
      'Peinture'
    );
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    // Le plafond est pre-rempli, les murs gardent leur valeur par defaut.
    expect(await screen.findByLabelText(/surface plafond/i)).toHaveValue(12);
    expect(screen.getByLabelText(/surface du mur/i)).toHaveValue(25);
    // Et la hauteur est donnee a cote, comme renseignement.
    expect(screen.getByTestId('note-murs')).toHaveTextContent(/2\.5 m/);
  });

  it('should estimate the wall surface from the sides of the ticked rooms', async () => {
    // 2 x (4,2 + 5,1) x 2,5 = 46,5 pour le SEJOUR, 2 x (3 + 4) x 2,5 = 35 pour
    // la CHAMBRE. L'artisan n'en coche qu'une : seule celle-la compte.
    const lecture = {
      pieces: [
        {
          libelle: 'SEJOUR', surface_m2: 18.5, texte_source_surface: 'SEJOUR 18,50 m2',
          longueur_m: 4.2, largeur_m: 5.1, texte_source_dimensions: '4,20 m / 5,10 m',
        },
        {
          libelle: 'CHAMBRE', surface_m2: 12, texte_source_surface: 'CHAMBRE 12,00 m2',
          longueur_m: 3, largeur_m: 4, texte_source_dimensions: '3,00 m / 4,00 m',
        },
      ],
      cotations: [],
      hauteurSousPlafond: { valeurM: 2.5, texteSource: 'HSP 2,50 m' },
      illisible: [],
    };
    const template = {
      id: 'peintre-piece-25m2', domain: 'Painting', title: 'Peinture', lines: [],
      parameters: [
        { key: 'surfacePlafond', label: 'Surface plafond', type: 'number', unit: 'm2', min: 0.1, step: 0.1, default: 25 },
        {
          key: 'murs', type: 'list', label: 'Murs a peindre', addLabel: 'Ajouter un mur',
          itemLabel: 'Mur', itemNameKey: 'nom', min: 1,
          default: [{ nom: 'Mur 1', mode: 'surface', surfaceM2: 25, longueurM: 0, hauteurM: 2.5 }],
          itemFields: [
            { key: 'nom', label: 'Nom du mur', type: 'text', default: '' },
            { key: 'mode', label: 'Saisie', type: 'select', default: 'surface',
              options: [{ value: 'surface', label: 'Surface (m2)' }, { value: 'longueur', label: 'Longueur x hauteur' }] },
            { key: 'surfaceM2', label: 'Surface du mur', type: 'number', unit: 'm2', min: 0, step: 0.1, default: 0,
              showIf: { key: 'mode', equals: 'surface' } },
            { key: 'longueurM', label: 'Longueur', type: 'number', unit: 'ml', min: 0, step: 0.1, default: 0,
              showIf: { key: 'mode', equals: 'longueur' } },
            { key: 'hauteurM', label: 'Hauteur sous plafond', type: 'number', unit: 'ml', min: 0, step: 0.05, default: 2.5,
              showIf: { key: 'mode', equals: 'longueur' } },
          ],
        },
      ],
    };
    server.use(
      http.get('*/api/quotes', () => HttpResponse.json([])),
      http.get('*/api/quotes/templates', () => HttpResponse.json([template])),
      http.post('*/api/quotes/plan-reading', () => HttpResponse.json({ lecture, avertissements: [] })),
      http.post('*/api/quotes/detect-trade', () => HttpResponse.json({
        templateId: template.id, template, motsCles: ['peintur'], raison: 'métier reconnu',
      })),
      http.post('*/api/quotes/templates/:id/map-reading', () => HttpResponse.json({
        id: template.id,
        propositions: [{
          champ_cible: 'surfacePlafond', unite: 'm²',
          candidats: lecture.pieces.map((p, i) => ({
            piece_index: i, valeur: p.surface_m2, libelle: p.libelle, texte_source: p.texte_source_surface,
          })),
        }],
        rejetees: [], avertissements: [], indications: [],
        estimations: [{
          champ_cible: 'murs',
          unite: 'm²',
          estimation: true,
          mention: 'Estimation avant déduction des portes et fenêtres, pièce supposée rectangulaire — à vérifier et ajuster.',
          hauteur_utilisee: 2.5,
          candidats: [
            { piece_index: 0, libelle: 'SEJOUR', valeur: 46.5, longueur_m: 4.2, largeur_m: 5.1, texte_source: '4,20 m / 5,10 m' },
            { piece_index: 1, libelle: 'CHAMBRE', valeur: 35, longueur_m: 3, largeur_m: 4, texte_source: '3,00 m / 4,00 m' },
          ],
        }],
      }))
    );

    const user = userEvent.setup();
    render(<ArtisanQuotes />);
    await screen.findByText(/no quotes found|aucun devis/i);

    await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
    await user.click(await screen.findByRole('button', { name: /from a plan|depuis un plan/i }));
    await user.upload(
      document.getElementById('planFile'),
      new File(['x'], 'plan.png', { type: 'image/png' })
    );
    await user.type(
      await screen.findByLabelText(/que devez-vous faire|what do you need to do/i),
      'Peinture'
    );
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    // L'artisan ne coche que le sejour.
    await screen.findByTestId('plan-rooms');
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    expect(await screen.findByLabelText(/surface plafond/i)).toHaveValue(18.5);

    // Quatre murs plutot qu'un bloc : l'hypothese rectangulaire devient
    // visible dans la liste et chaque mur reste corrigeable separement.
    const longueurs = screen.getAllByLabelText(/^Longueur \(/i) as HTMLInputElement[];
    expect(longueurs.map((i) => Number(i.value))).toEqual([4.2, 4.2, 5.1, 5.1]);
    // La chambre n'a pas ete cochee : ses murs ne doivent pas y figurer.
    expect(longueurs).toHaveLength(4);
  });

  it('should never show the wall estimate without its caveat', async () => {
    // Le chiffre suppose la piece rectangulaire et ignore les ouvertures.
    // Affiche seul, il passerait pour un releve.
    const lecture = {
      pieces: [{
        libelle: 'SEJOUR', surface_m2: 18.5, texte_source_surface: 'SEJOUR 18,50 m2',
        longueur_m: 4.2, largeur_m: 5.1, texte_source_dimensions: '4,20 m / 5,10 m',
      }],
      cotations: [],
      hauteurSousPlafond: { valeurM: 2.5, texteSource: 'HSP 2,50 m' },
      illisible: [],
    };
    const template = {
      id: 'peintre-piece-25m2', domain: 'Painting', title: 'Peinture', lines: [],
      parameters: [
        {
          key: 'murs', type: 'list', label: 'Murs a peindre', addLabel: 'Ajouter un mur',
          itemLabel: 'Mur', itemNameKey: 'nom', min: 1,
          default: [{ nom: 'Mur 1', mode: 'surface', surfaceM2: 25, longueurM: 0, hauteurM: 2.5 }],
          itemFields: [
            { key: 'nom', label: 'Nom du mur', type: 'text', default: '' },
            { key: 'mode', label: 'Saisie', type: 'select', default: 'surface',
              options: [{ value: 'surface', label: 'Surface (m2)' }, { value: 'longueur', label: 'Longueur x hauteur' }] },
            { key: 'surfaceM2', label: 'Surface du mur', type: 'number', unit: 'm2', min: 0, step: 0.1, default: 0,
              showIf: { key: 'mode', equals: 'surface' } },
            { key: 'longueurM', label: 'Longueur', type: 'number', unit: 'ml', min: 0, step: 0.1, default: 0,
              showIf: { key: 'mode', equals: 'longueur' } },
            { key: 'hauteurM', label: 'Hauteur sous plafond', type: 'number', unit: 'ml', min: 0, step: 0.05, default: 2.5,
              showIf: { key: 'mode', equals: 'longueur' } },
          ],
        },
      ],
    };
    server.use(
      http.get('*/api/quotes', () => HttpResponse.json([])),
      http.get('*/api/quotes/templates', () => HttpResponse.json([template])),
      http.post('*/api/quotes/plan-reading', () => HttpResponse.json({ lecture, avertissements: [] })),
      http.post('*/api/quotes/detect-trade', () => HttpResponse.json({
        templateId: template.id, template, motsCles: ['peintur'], raison: 'métier reconnu',
      })),
      http.post('*/api/quotes/templates/:id/map-reading', () => HttpResponse.json({
        id: template.id,
        propositions: [{
          champ_cible: 'surfacePlafond', unite: 'm²',
          candidats: [{ piece_index: 0, valeur: 18.5, libelle: 'SEJOUR', texte_source: 'SEJOUR 18,50 m2' }],
        }],
        rejetees: [], avertissements: [], indications: [],
        estimations: [{
          champ_cible: 'murs', unite: 'm²', estimation: true,
          mention: 'Estimation avant déduction des portes et fenêtres, pièce supposée rectangulaire — à vérifier et ajuster.',
          hauteur_utilisee: 2.5,
          candidats: [{ piece_index: 0, libelle: 'SEJOUR', valeur: 46.5, longueur_m: 4.2, largeur_m: 5.1, texte_source: '4,20 m / 5,10 m' }],
        }],
      }))
    );

    const user = userEvent.setup();
    render(<ArtisanQuotes />);
    await screen.findByText(/no quotes found|aucun devis/i);

    await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
    await user.click(await screen.findByRole('button', { name: /from a plan|depuis un plan/i }));
    await user.upload(
      document.getElementById('planFile'),
      new File(['x'], 'plan.png', { type: 'image/png' })
    );
    await user.type(
      await screen.findByLabelText(/que devez-vous faire|what do you need to do/i),
      'Peinture'
    );
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    // Une seule piece : pas d'ecran de selection, on arrive au formulaire.
    const longueurs = await screen.findAllByLabelText(/^Longueur \(/i) as HTMLInputElement[];
    expect(longueurs.map((i) => Number(i.value))).toEqual([4.2, 4.2, 5.1, 5.1]);
    expect(screen.getByText(/portes et fenêtres/i)).toBeInTheDocument();
    expect(screen.getByText(/à vérifier et ajuster/i)).toBeInTheDocument();
  });

  it('should not pour a perimeter into a field that expects square metres', async () => {
    // Sans hauteur lue, le calcul ne donne qu'un perimetre en metres
    // lineaires. Le verser dans surfaceMurs ferait un devis faux d'un facteur
    // egal a la hauteur, sans que rien ne le signale.
    const lecture = {
      pieces: [{
        libelle: 'SEJOUR', surface_m2: 18.5, texte_source_surface: 'SEJOUR 18,50 m2',
        longueur_m: 4.2, largeur_m: 5.1, texte_source_dimensions: '4,20 m / 5,10 m',
      }],
      cotations: [],
      illisible: [],
    };
    const template = {
      id: 'peintre-piece-25m2', domain: 'Painting', title: 'Peinture', lines: [],
      parameters: [
        {
          key: 'murs', type: 'list', label: 'Murs a peindre', addLabel: 'Ajouter un mur',
          itemLabel: 'Mur', itemNameKey: 'nom', min: 1,
          default: [{ nom: 'Mur 1', mode: 'surface', surfaceM2: 25, longueurM: 0, hauteurM: 2.5 }],
          itemFields: [
            { key: 'nom', label: 'Nom du mur', type: 'text', default: '' },
            { key: 'mode', label: 'Saisie', type: 'select', default: 'surface',
              options: [{ value: 'surface', label: 'Surface (m2)' }, { value: 'longueur', label: 'Longueur x hauteur' }] },
            { key: 'surfaceM2', label: 'Surface du mur', type: 'number', unit: 'm2', min: 0, step: 0.1, default: 0,
              showIf: { key: 'mode', equals: 'surface' } },
            { key: 'longueurM', label: 'Longueur', type: 'number', unit: 'ml', min: 0, step: 0.1, default: 0,
              showIf: { key: 'mode', equals: 'longueur' } },
            { key: 'hauteurM', label: 'Hauteur sous plafond', type: 'number', unit: 'ml', min: 0, step: 0.05, default: 2.5,
              showIf: { key: 'mode', equals: 'longueur' } },
          ],
        },
      ],
    };
    server.use(
      http.get('*/api/quotes', () => HttpResponse.json([])),
      http.get('*/api/quotes/templates', () => HttpResponse.json([template])),
      http.post('*/api/quotes/plan-reading', () => HttpResponse.json({ lecture, avertissements: [] })),
      http.post('*/api/quotes/detect-trade', () => HttpResponse.json({
        templateId: template.id, template, motsCles: ['peintur'], raison: 'métier reconnu',
      })),
      http.post('*/api/quotes/templates/:id/map-reading', () => HttpResponse.json({
        id: template.id,
        propositions: [{
          champ_cible: 'surfacePlafond', unite: 'm²',
          candidats: [{ piece_index: 0, valeur: 18.5, libelle: 'SEJOUR', texte_source: 'SEJOUR 18,50 m2' }],
        }],
        rejetees: [], avertissements: [], indications: [],
        estimations: [{
          champ_cible: 'murs', unite: 'ml', estimation: true,
          mention: 'Estimation avant déduction des portes et fenêtres, pièce supposée rectangulaire — à vérifier et ajuster.',
          hauteur_utilisee: null,
          candidats: [{ piece_index: 0, libelle: 'SEJOUR', valeur: 18.6, longueur_m: 4.2, largeur_m: 5.1, texte_source: '4,20 m / 5,10 m' }],
        }],
      }))
    );

    const user = userEvent.setup();
    render(<ArtisanQuotes />);
    await screen.findByText(/no quotes found|aucun devis/i);

    await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
    await user.click(await screen.findByRole('button', { name: /from a plan|depuis un plan/i }));
    await user.upload(
      document.getElementById('planFile'),
      new File(['x'], 'plan.png', { type: 'image/png' })
    );
    await user.type(
      await screen.findByLabelText(/que devez-vous faire|what do you need to do/i),
      'Peinture'
    );
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    // La liste garde son mur par defaut : aucun perimetre n'a ete verse dans
    // un champ qui attend des m².
    expect(await screen.findByLabelText(/surface du mur/i)).toHaveValue(25);
    // A la place, on reclame la seule donnee qui manque.
    expect(screen.getByTestId('missing-murs'))
      .toHaveTextContent(/hauteur sous plafond non trouvée/i);
  });

  it('should fall back to the raw dimensions when no room carries its own', async () => {
    // Repli acte : pas de recollage apres coup, juste l'information brute a
    // cote du champ, qui reste manuel.
    const lecture = {
      pieces: [{ libelle: 'SEJOUR', surface_m2: 18.5, texte_source_surface: 'SEJOUR 18,50 m2' }],
      cotations: [{ valeur: 4.2, unite: 'm', texte_source: '4,20 m' }],
      illisible: [],
    };
    const template = {
      id: 'peintre-piece-25m2', domain: 'Painting', title: 'Peinture', lines: [],
      parameters: [
        {
          key: 'murs', type: 'list', label: 'Murs a peindre', addLabel: 'Ajouter un mur',
          itemLabel: 'Mur', itemNameKey: 'nom', min: 1,
          default: [{ nom: 'Mur 1', mode: 'surface', surfaceM2: 25, longueurM: 0, hauteurM: 2.5 }],
          itemFields: [
            { key: 'nom', label: 'Nom du mur', type: 'text', default: '' },
            { key: 'mode', label: 'Saisie', type: 'select', default: 'surface',
              options: [{ value: 'surface', label: 'Surface (m2)' }, { value: 'longueur', label: 'Longueur x hauteur' }] },
            { key: 'surfaceM2', label: 'Surface du mur', type: 'number', unit: 'm2', min: 0, step: 0.1, default: 0,
              showIf: { key: 'mode', equals: 'surface' } },
            { key: 'longueurM', label: 'Longueur', type: 'number', unit: 'ml', min: 0, step: 0.1, default: 0,
              showIf: { key: 'mode', equals: 'longueur' } },
            { key: 'hauteurM', label: 'Hauteur sous plafond', type: 'number', unit: 'ml', min: 0, step: 0.05, default: 2.5,
              showIf: { key: 'mode', equals: 'longueur' } },
          ],
        },
      ],
    };
    server.use(
      http.get('*/api/quotes', () => HttpResponse.json([])),
      http.get('*/api/quotes/templates', () => HttpResponse.json([template])),
      http.post('*/api/quotes/plan-reading', () => HttpResponse.json({ lecture, avertissements: [] })),
      http.post('*/api/quotes/detect-trade', () => HttpResponse.json({
        templateId: template.id, template, motsCles: ['peintur'], raison: 'métier reconnu',
      })),
      http.post('*/api/quotes/templates/:id/map-reading', () => HttpResponse.json({
        id: template.id,
        propositions: [{
          champ_cible: 'surfacePlafond', unite: 'm²',
          candidats: [{ piece_index: 0, valeur: 18.5, libelle: 'SEJOUR', texte_source: 'SEJOUR 18,50 m2' }],
        }],
        rejetees: [], avertissements: [],
        indications: [{
          champ_cible: 'murs',
          texte: 'Cotations lues sur le plan, sans rattachement à une pièce : 4.2 m',
          texte_source: '',
        }],
        estimations: [],
      }))
    );

    const user = userEvent.setup();
    render(<ArtisanQuotes />);
    await screen.findByText(/no quotes found|aucun devis/i);

    await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
    await user.click(await screen.findByRole('button', { name: /from a plan|depuis un plan/i }));
    await user.upload(
      document.getElementById('planFile'),
      new File(['x'], 'plan.png', { type: 'image/png' })
    );
    await user.type(
      await screen.findByLabelText(/que devez-vous faire|what do you need to do/i),
      'Peinture'
    );
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    expect(await screen.findByLabelText(/surface du mur/i)).toHaveValue(25);
    expect(screen.getByTestId('note-murs')).toHaveTextContent(/sans rattachement/i);
  });

  it('should delete a quote after confirmation', async () => {
    // Arrange
    let deletedId = '';
    server.use(
      http.get('*/api/quotes', () => HttpResponse.json(quotesFixture)),
      http.delete('*/api/quotes/:quoteId', ({ params }) => {
        deletedId = String(params.quoteId || '');
        return HttpResponse.json({ success: true });
      })
    );
    const user = userEvent.setup();

    // Act
    render(<ArtisanQuotes />);

    await screen.findByText(/quote q-1001|devis q-1001/i);
    await user.click(screen.getAllByRole('button', { name: /delete|supprimer/i })[0]);

    const modalTitle = await screen.findByText(/delete quote|supprimer le devis/i);
    const modal = modalTitle.closest('div')?.parentElement?.parentElement as HTMLElement;
    const confirmDeleteButton = within(modal).getByRole('button', { name: /delete|supprimer/i });
    await user.click(confirmDeleteButton);

    // Assert
    await waitFor(() => {
      expect(deletedId).toBe('quote-1');
    });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /quote q-1001|devis q-1001/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /quote q-1002|devis q-1002/i })).toBeInTheDocument();
  });

  describe('trade templates', () => {
    const templatesFixture = [
      {
        // Modele MIXTE : des champs scalaires de premier niveau ET une liste.
        id: 'electricien-5-points',
        domain: 'Electrical Installation',
        title: 'Installation 5 points electriques',
        parameters: [
          {
            key: 'typeTableau',
            label: 'Type de tableau',
            type: 'select',
            default: 'neuf',
            options: [
              { value: 'neuf', label: 'Neuf' },
              { value: 'extension', label: 'Extension sur tableau existant' },
            ],
          },
          {
            key: 'tableauPlein',
            label: 'Tableau deja plein ?',
            type: 'select',
            default: 'non',
            showIf: { key: 'typeTableau', equals: 'extension' },
            options: [
              { value: 'non', label: 'Non' },
              { value: 'oui', label: 'Oui' },
            ],
          },
          {
            key: 'longueurCableMl',
            label: 'Longueur totale de cable estimee',
            type: 'number',
            unit: 'ml',
            min: 0,
            step: 1,
            default: 0,
          },
          {
            key: 'pointsElectriques',
            type: 'list',
            label: 'Points electriques',
            addLabel: 'Ajouter un point electrique',
            itemLabel: 'Point',
            min: 1,
            default: [{ typeCircuit: 'eclairage', typePoint: 'point_lumineux', modePose: 'apparent' }],
            itemFields: [
              {
                key: 'typeCircuit',
                label: 'Type de circuit',
                type: 'select',
                default: 'eclairage',
                options: [
                  { value: 'eclairage', label: 'Eclairage' },
                  { value: 'prise_courante', label: 'Prise courante' },
                ],
              },
              {
                key: 'typePoint',
                label: 'Type de point',
                type: 'select',
                default: 'point_lumineux',
                options: [
                  { value: 'point_lumineux', label: 'Point lumineux' },
                  { value: 'prise_simple', label: 'Prise simple' },
                ],
              },
              {
                key: 'modePose',
                label: 'Mode de pose',
                type: 'select',
                default: 'apparent',
                options: [
                  { value: 'apparent', label: 'Apparent' },
                  { value: 'encastre', label: 'Encastre' },
                  { value: 'goulotte', label: 'Goulotte' },
                ],
              },
            ],
          },
        ],
        lines: [
          { designation: 'Cable electrique 2,5mm2', quantity: 15, unit: 'ml', unitPrice: 0, lineType: 'material', total: 0 },
          { designation: "Main d'oeuvre installation", quantity: 5, unit: 'heure', unitPrice: 0, lineType: 'labor', total: 0 },
        ],
      },
      {
        // Auto-calcule, avec un champ conditionne par `showIf`.
        id: 'peintre-piece-25m2',
        domain: 'Painting',
        title: 'Peinture interieure piece standard 25m2',
        parameters: [
          { key: 'surfaceMurs', label: 'Surface des murs', type: 'number', unit: 'm2', min: 0, step: 0.1, default: 25 },
          {
            key: 'contexte',
            label: 'Contexte',
            type: 'select',
            default: 'renovation',
            options: [
              { value: 'neuf', label: 'Neuf' },
              { value: 'renovation', label: 'Renovation' },
            ],
          },
          {
            key: 'changementCouleur',
            label: 'Changement de couleur radical',
            type: 'select',
            default: 'non',
            showIf: { key: 'contexte', equals: 'renovation' },
            options: [
              { value: 'non', label: 'Non' },
              { value: 'oui', label: 'Oui' },
            ],
          },
        ],
        lines: [
          { designation: 'Peinture murale blanche 15L', quantity: 2, unit: 'bidon', unitPrice: 0, lineType: 'material', total: 0 },
          { designation: "Main d'oeuvre peinture", quantity: 25, unit: 'm\u00b2', unitPrice: 0, lineType: 'labor', total: 0 },
        ],
      },
      {
        // Modele auto-calcule : porte un bloc `parameters`, ses `lines` ne
        // servent que d'apercu dans la galerie.
        id: 'carreleur-salle-de-bain-8m2',
        domain: 'Tiling',
        title: 'Carrelage salle de bain 8m2',
        parameters: [
          { key: 'surface', label: 'Surface a carreler', type: 'number', unit: 'm\u00b2', min: 0.1, step: 0.1, default: 8 },
          {
            key: 'typePose',
            label: 'Type de pose',
            type: 'select',
            default: 'droite',
            help: 'Determine le pourcentage de chute en coupe.',
            options: [
              { value: 'droite', label: 'Droite' },
              { value: 'diagonale', label: 'Diagonale' },
              { value: 'chevrons', label: 'Chevrons' },
            ],
          },
        ],
        lines: [
          { designation: 'Carreaux', quantity: 8.8, unit: 'm\u00b2', unitPrice: 0, lineType: 'material', total: 0 },
          { designation: "Main d'oeuvre pose carrelage", quantity: 8, unit: 'm\u00b2', unitPrice: 0, lineType: 'labor', total: 0 },
        ],
      },
      {
        // Modele a STRUCTURE DE LISTE : l'artisan ajoute autant de points qu'il veut.
        id: 'plombier-3-points-eau',
        domain: 'Plumbing',
        title: "Installation plomberie - points d'eau",
        parameters: [
          {
            key: 'pointsEau',
            type: 'list',
            label: "Points d'eau",
            addLabel: 'Ajouter un point',
            itemLabel: 'Point',
            min: 1,
            default: [{ sousType: 'lavabo', modePose: 'apparent', distanceMl: 0 }],
            itemFields: [
              {
                key: 'sousType',
                label: 'Type de point',
                type: 'select',
                default: 'lavabo',
                options: [
                  { value: 'lavabo', label: 'Lavabo' },
                  { value: 'wc', label: 'WC' },
                  { value: 'baignoire', label: 'Baignoire' },
                ],
              },
              {
                key: 'modePose',
                label: 'Mode de pose',
                type: 'select',
                default: 'apparent',
                options: [
                  { value: 'apparent', label: 'Apparent' },
                  { value: 'encastre', label: 'Encastre' },
                ],
              },
              {
                key: 'distanceMl',
                label: 'Distance de saignee',
                type: 'number',
                unit: 'ml',
                min: 0,
                step: 0.5,
                default: 0,
                showIf: { key: 'modePose', equals: 'encastre' },
              },
            ],
          },
        ],
        lines: [
          { designation: 'Tube cuivre 14/16mm', quantity: 9, unit: 'ml', unitPrice: 0, lineType: 'material', total: 0 },
        ],
      },
    ];

    /** Lignes que le backend renverrait pour 8 m\u00b2 en pose droite. */
    const computedLinesFixture = [
      { designation: 'Carreaux (pose droite, chute 6 %)', quantity: 8.48, unit: 'm\u00b2', unitPrice: 0, lineType: 'material', total: 0 },
      { designation: 'Colle carrelage (sol)', quantity: 39.6, unit: 'kg', unitPrice: 0, lineType: 'material', total: 0 },
      { designation: 'Croisillons', quantity: 160, unit: 'unit\u00e9e', unitPrice: 0, lineType: 'material', total: 0 },
      { designation: "Main d'oeuvre pose carrelage", quantity: 8, unit: 'm\u00b2', unitPrice: 0, lineType: 'labor', total: 0 },
    ];

    const mockTemplates = (domain = 'Painting') => {
      server.use(
        http.get('*/api/quotes', () => HttpResponse.json([])),
        http.get('*/api/quotes/templates', () => HttpResponse.json(templatesFixture)),
        http.get('*/api/auth/me', () => HttpResponse.json({ _id: 'artisan-1', role: 'artisan', domain }))
      );
    };

    /**
     * Modele SANS bloc `parameters`. Les 4 modeles metier sont auto-calcules,
     * mais le chemin « selection -> formulaire » reste supporte : c'est sur ce
     * modele-la qu'on eprouve la manipulation des lignes.
     */
    const figeFixture = [
      {
        id: 'modele-fige',
        domain: 'Masonry',
        title: 'Modele fige',
        lines: [
          { designation: 'Ciment 50kg', quantity: 4, unit: 'sac', unitPrice: 0, lineType: 'material', total: 0 },
          { designation: "Main d'oeuvre maconnerie", quantity: 10, unit: 'heure', unitPrice: 0, lineType: 'labor', total: 0 },
        ],
      },
    ];

    const mockFixedTemplate = () => {
      server.use(
        http.get('*/api/quotes', () => HttpResponse.json([])),
        http.get('*/api/quotes/templates', () => HttpResponse.json(figeFixture)),
        http.get('*/api/auth/me', () => HttpResponse.json({ _id: 'artisan-1', role: 'artisan', domain: 'Masonry' }))
      );
    };

    /** Va du bouton « Generer un devis » jusqu'a la galerie de modeles. */
    const openGallery = async (user) => {
      await user.click(screen.getByRole('button', { name: /generate quote|g[\u00e9e]n[\u00e9e]rer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /ready-made quote|devis pr[\u00eae]t/i }));
    };

    it('should list the templates and flag the one matching the artisan domain', async () => {
      // Arrange
      mockTemplates('Painting');
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);

      // Act
      await openGallery(user);

      // Assert : le modele du metier passe en premier et porte le badge
      const cards = await screen.findAllByRole('button', { name: /piece standard|points electriques/i });
      expect(cards[0]).toHaveTextContent(/peinture interieure/i);
      expect(within(cards[0]).getByText(/recommended|recommand[\u00e9e]/i)).toBeInTheDocument();
      expect(within(cards[1]).queryByText(/recommended|recommand[\u00e9e]/i)).toBeNull();
    });

    it('should open the form prefilled with the template lines', async () => {
      // Arrange
      mockFixedTemplate();
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);

      // Act
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /modele fige/i }));

      // Assert
      expect(
        await screen.findByRole('heading', { name: /generate new quote|g[\u00e9e]n[\u00e9e]rer un nouveau devis/i })
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('Ciment 50kg')).toBeInTheDocument();
      expect(screen.getByDisplayValue("Main d'oeuvre maconnerie")).toBeInTheDocument();
    });

    it('should recompute the line total when a unit price is entered', async () => {
      // Arrange
      mockFixedTemplate();
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /modele fige/i }));
      await screen.findByDisplayValue('Ciment 50kg');

      // Act : 4 sacs a 15 => 60
      const priceInputs = screen.getAllByLabelText(/unit price|prix unitaire/i);
      await user.clear(priceInputs[0]);
      await user.type(priceInputs[0], '15');

      // Assert
      await waitFor(() => {
        expect(screen.getAllByText(/60/).length).toBeGreaterThan(0);
      });
    });

    it('should let the artisan change the unit of a line', async () => {
      // Arrange
      mockFixedTemplate();
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /modele fige/i }));
      await screen.findByDisplayValue('Ciment 50kg');

      // Act : la premiere ligne passe de « sac » a « ml »
      const unitSelects = screen.getAllByLabelText(/^unit$|^unité$/i);
      expect(unitSelects[0]).toHaveValue('sac');
      await user.selectOptions(unitSelects[0], 'ml');

      // Assert
      expect(unitSelects[0]).toHaveValue('ml');
    });

    it('should let the artisan remove a template line', async () => {
      // Arrange
      mockFixedTemplate();
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /modele fige/i }));
      await screen.findByDisplayValue('Ciment 50kg');

      // Act
      const removeButtons = screen.getAllByLabelText(/remove line|supprimer la ligne/i);
      await user.click(removeButtons[0]);

      // Assert
      await waitFor(() => {
        expect(screen.queryByDisplayValue('Ciment 50kg')).not.toBeInTheDocument();
      });
      expect(screen.getByDisplayValue("Main d'oeuvre maconnerie")).toBeInTheDocument();
    });

    it('should show an empty line table on the free quote form', async () => {
      // Le tableau est desormais l'unique mode de saisie : il est affiche meme
      // en devis libre, vide, avec une invitation a ajouter une ligne.
      mockTemplates('Painting');
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);

      await user.click(screen.getByRole('button', { name: /generate quote|g[\u00e9e]n[\u00e9e]rer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /blank quote|devis libre/i }));

      expect(
        await screen.findByRole('heading', { name: /generate new quote|g[\u00e9e]n[\u00e9e]rer un nouveau devis/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /quote lines|lignes du devis/i })).toBeInTheDocument();
      expect(screen.getByText(/add at least one line|ajoutez au moins une ligne/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/designation|d[\u00e9e]signation/i)).not.toBeInTheDocument();
    });

    it('should add an editable line in one click and let its type change', async () => {
      mockTemplates('Painting');
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);

      await user.click(screen.getByRole('button', { name: /generate quote|g[\u00e9e]n[\u00e9e]rer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /blank quote|devis libre/i }));
      await screen.findByRole('heading', { name: /generate new quote|g[\u00e9e]n[\u00e9e]rer un nouveau devis/i });

      await user.click(screen.getByRole('button', { name: /add a line|ajouter une ligne/i }));

      // Le type est un vrai select relie a l'etat de la ligne.
      const type = await screen.findByLabelText(/line type|type de ligne/i);
      expect(type).toHaveValue('material');
      await user.selectOptions(type, 'labor');
      expect(type).toHaveValue('labor');

      // Les unites ajoutees sont proposees.
      const unit = screen.getByLabelText(/^unit$|^unit[\u00e9e]$/i);
      await user.selectOptions(unit, 'jours');
      expect(unit).toHaveValue('jours');
    });

    it('should ask for the parameters before filling the table', async () => {
      // Un modele auto-calcule n'insere pas ses lignes directement : il ouvre
      // d'abord son formulaire de parametres.
      mockTemplates('Tiling');
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);

      await user.click(await screen.findByRole('button', { name: /carrelage salle de bain/i }));

      expect(
        await screen.findByRole('heading', { name: /carrelage salle de bain/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/surface a carreler/i)).toHaveValue(8);
      expect(screen.getByLabelText(/type de pose/i)).toHaveValue('droite');
      // On n'est pas encore dans le formulaire de devis.
      expect(
        screen.queryByRole('heading', { name: /generate new quote|g[\u00e9e]n[\u00e9e]rer un nouveau devis/i })
      ).not.toBeInTheDocument();
    });

    it('should post the parameters and fill the table with the computed lines', async () => {
      mockTemplates('Tiling');
      let receivedBody: any = null;
      server.use(
        http.post('*/api/quotes/templates/:id/compute', async ({ request, params }) => {
          receivedBody = await request.json();
          return HttpResponse.json({ id: params.id, title: 'Carrelage', lines: computedLinesFixture });
        })
      );

      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /carrelage salle de bain/i }));

      const surface = await screen.findByLabelText(/surface a carreler/i);
      await user.clear(surface);
      await user.type(surface, '12');
      await user.selectOptions(screen.getByLabelText(/type de pose/i), 'chevrons');
      await user.click(screen.getByRole('button', { name: /generate the lines|g[\u00e9e]n[\u00e9e]rer les lignes/i }));

      // Le formulaire de devis s'ouvre, rempli par le resultat du calcul.
      expect(
        await screen.findByRole('heading', { name: /generate new quote|g[\u00e9e]n[\u00e9e]rer un nouveau devis/i })
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('Colle carrelage (sol)')).toBeInTheDocument();
      expect(screen.getAllByLabelText(/designation|d[\u00e9e]signation/i)).toHaveLength(4);

      // Les parametres partent typ\u00e9s : surface en nombre, choix en chaine.
      expect(receivedBody).toEqual({ surface: 12, typePose: 'chevrons' });
    });

    it('should keep the computed lines editable', async () => {
      mockTemplates('Tiling');
      server.use(
        http.post('*/api/quotes/templates/:id/compute', () =>
          HttpResponse.json({ id: 'carreleur-salle-de-bain-8m2', title: 'Carrelage', lines: computedLinesFixture })
        )
      );

      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /carrelage salle de bain/i }));
      await user.click(await screen.findByRole('button', { name: /generate the lines|g[\u00e9e]n[\u00e9e]rer les lignes/i }));

      // Le calcul est un point de depart : tout reste modifiable.
      const quantities = await screen.findAllByLabelText(/quantity|quantit[\u00e9e]/i);
      await user.clear(quantities[0]);
      await user.type(quantities[0], '20');
      expect(quantities[0]).toHaveValue(20);

      const types = screen.getAllByLabelText(/line type|type de ligne/i);
      await user.selectOptions(types[0], 'labor');
      expect(types[0]).toHaveValue('labor');
    });

    it('should surface the backend error and stay on the parameters form', async () => {
      mockTemplates('Tiling');
      server.use(
        http.post('*/api/quotes/templates/:id/compute', () =>
          HttpResponse.json({ message: 'surface must be a number greater than 0' }, { status: 400 })
        )
      );

      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /carrelage salle de bain/i }));
      await user.click(await screen.findByRole('button', { name: /generate the lines|g[\u00e9e]n[\u00e9e]rer les lignes/i }));

      expect(await screen.findByText(/surface must be a number/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /generate new quote|g[\u00e9e]n[\u00e9e]rer un nouveau devis/i })
      ).not.toBeInTheDocument();
    });

    it('should send a template without parameters straight to the form', async () => {
      // Les 4 modeles metier sont auto-calcules : on verifie le chemin d'origine
      // sur un modele sans bloc `parameters`, qui reste supporte.
      mockFixedTemplate();
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);

      await user.click(await screen.findByRole('button', { name: /modele fige/i }));

      // Pas d'etape de parametres : le formulaire s'ouvre directement.
      expect(
        await screen.findByRole('heading', { name: /generate new quote|g[\u00e9e]n[\u00e9e]rer un nouveau devis/i })
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('Ciment 50kg')).toBeInTheDocument();
    });

    it('should render scalar fields and a list side by side', async () => {
      // Modele mixte : le composant rend les deux formes dans le meme ecran.
      mockTemplates('Electrical Installation');
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /points electriques/i }));

      // Scalaires de premier niveau.
      expect(await screen.findByLabelText(/type de tableau/i)).toHaveValue('neuf');
      expect(screen.getByLabelText(/longueur totale de cable/i)).toHaveValue(0);
      // Le champ conditionnel de premier niveau reste masque.
      expect(screen.queryByLabelText(/tableau deja plein/i)).not.toBeInTheDocument();
      // Et la liste, avec son point par defaut.
      expect(screen.getByText(/^Point 1$/)).toBeInTheDocument();
      expect(screen.getAllByLabelText(/type de circuit/i)).toHaveLength(1);
    });

    it('should post scalars and the list together', async () => {
      mockTemplates('Electrical Installation');
      let receivedBody: any = null;
      server.use(
        http.post('*/api/quotes/templates/:id/compute', async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({ id: 'electricien-5-points', title: 'Electricite', lines: computedLinesFixture });
        })
      );

      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /points electriques/i }));

      // Passer en extension revele le champ conditionnel de premier niveau.
      await user.selectOptions(await screen.findByLabelText(/type de tableau/i), 'extension');
      const plein = await screen.findByLabelText(/tableau deja plein/i);
      await user.selectOptions(plein, 'oui');

      const longueur = screen.getByLabelText(/longueur totale de cable/i);
      await user.clear(longueur);
      await user.type(longueur, '35');

      await user.click(screen.getByRole('button', { name: /ajouter un point electrique/i }));
      await waitFor(() => {
        expect(screen.getAllByLabelText(/type de circuit/i)).toHaveLength(2);
      });
      await user.selectOptions(screen.getAllByLabelText(/type de circuit/i)[1], 'prise_courante');
      await user.selectOptions(screen.getAllByLabelText(/mode de pose/i)[1], 'goulotte');

      await user.click(screen.getByRole('button', { name: /generate the lines|g[\u00e9e]n[\u00e9e]rer les lignes/i }));

      await waitFor(() => {
        expect(receivedBody).not.toBeNull();
      });
      expect(receivedBody).toEqual({
        typeTableau: 'extension',
        tableauPlein: 'oui',
        longueurCableMl: 35,
        pointsElectriques: [
          { typeCircuit: 'eclairage', typePoint: 'point_lumineux', modePose: 'apparent' },
          { typeCircuit: 'prise_courante', typePoint: 'point_lumineux', modePose: 'goulotte' },
        ],
      });
    });

    it('should hide a conditional parameter until its condition is met', async () => {
      mockTemplates('Painting');
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /peinture interieure/i }));

      // Le defaut est « renovation » : le champ conditionnel est visible.
      const contexte = await screen.findByLabelText(/contexte/i);
      expect(contexte).toHaveValue('renovation');
      expect(screen.getByLabelText(/changement de couleur/i)).toBeInTheDocument();

      // En neuf, la question n'a plus de sens : le champ disparait.
      await user.selectOptions(contexte, 'neuf');
      await waitFor(() => {
        expect(screen.queryByLabelText(/changement de couleur/i)).not.toBeInTheDocument();
      });

      // Et il revient si l'artisan repasse en renovation.
      await user.selectOptions(contexte, 'renovation');
      expect(await screen.findByLabelText(/changement de couleur/i)).toBeInTheDocument();
    });

    it('should not post a parameter that is hidden', async () => {
      mockTemplates('Painting');
      let receivedBody: any = null;
      server.use(
        http.post('*/api/quotes/templates/:id/compute', async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({ id: 'peintre-piece-25m2', title: 'Peinture', lines: computedLinesFixture });
        })
      );

      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /peinture interieure/i }));

      await user.selectOptions(await screen.findByLabelText(/contexte/i), 'neuf');
      await user.click(screen.getByRole('button', { name: /generate the lines|g[\u00e9e]n[\u00e9e]rer les lignes/i }));

      await waitFor(() => {
        expect(receivedBody).not.toBeNull();
      });
      // Champ masque => absent du corps, le backend applique son propre defaut.
      expect(receivedBody).toEqual({ surfaceMurs: 25, contexte: 'neuf' });
      expect(receivedBody).not.toHaveProperty('changementCouleur');
    });

    it('should render a repeatable list with one item by default', async () => {
      mockTemplates('Plumbing');
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /installation plomberie/i }));

      // Un point par defaut, deja rendu avec son sous-formulaire.
      expect(await screen.findByText(/^Point 1$/)).toBeInTheDocument();
      expect(screen.getAllByLabelText(/type de point/i)).toHaveLength(1);
      expect(screen.getAllByLabelText(/mode de pose/i)).toHaveLength(1);
      expect(screen.getByRole('button', { name: /ajouter un point/i })).toBeInTheDocument();
    });

    it('should add and remove items from the list', async () => {
      mockTemplates('Plumbing');
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /installation plomberie/i }));

      const ajouter = await screen.findByRole('button', { name: /ajouter un point/i });
      await user.click(ajouter);
      await user.click(ajouter);

      await waitFor(() => {
        expect(screen.getAllByLabelText(/type de point/i)).toHaveLength(3);
      });
      expect(screen.getByText(/^Point 3$/)).toBeInTheDocument();

      // On retire le deuxieme.
      await user.click(screen.getByRole('button', { name: /supprimer point 2/i }));
      await waitFor(() => {
        expect(screen.getAllByLabelText(/type de point/i)).toHaveLength(2);
      });
    });

    it('should keep the last item when the list declares a minimum of one', async () => {
      mockTemplates('Plumbing');
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /installation plomberie/i }));

      await screen.findByText(/^Point 1$/);
      // min: 1 => pas de bouton de suppression sur le dernier element.
      expect(screen.queryByRole('button', { name: /supprimer point 1/i })).not.toBeInTheDocument();
    });

    it('should apply showIf inside an item, independently per item', async () => {
      mockTemplates('Plumbing');
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /installation plomberie/i }));

      await user.click(await screen.findByRole('button', { name: /ajouter un point/i }));
      await waitFor(() => {
        expect(screen.getAllByLabelText(/mode de pose/i)).toHaveLength(2);
      });

      // Apparent par defaut : aucune distance demandee.
      expect(screen.queryByLabelText(/distance de saignee/i)).not.toBeInTheDocument();

      // Seul le premier point passe en encastre.
      await user.selectOptions(screen.getAllByLabelText(/mode de pose/i)[0], 'encastre');
      await waitFor(() => {
        expect(screen.getAllByLabelText(/distance de saignee/i)).toHaveLength(1);
      });
    });

    it('should post the list as an array of objects', async () => {
      mockTemplates('Plumbing');
      let receivedBody: any = null;
      server.use(
        http.post('*/api/quotes/templates/:id/compute', async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({ id: 'plombier-3-points-eau', title: 'Plomberie', lines: computedLinesFixture });
        })
      );

      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /installation plomberie/i }));

      await user.click(await screen.findByRole('button', { name: /ajouter un point/i }));
      await waitFor(() => {
        expect(screen.getAllByLabelText(/type de point/i)).toHaveLength(2);
      });
      await user.selectOptions(screen.getAllByLabelText(/type de point/i)[1], 'wc');
      await user.selectOptions(screen.getAllByLabelText(/mode de pose/i)[1], 'encastre');

      const distance = await screen.findByLabelText(/distance de saignee/i);
      await user.clear(distance);
      await user.type(distance, '4');

      await user.click(screen.getByRole('button', { name: /generate the lines|g[\u00e9e]n[\u00e9e]rer les lignes/i }));

      await waitFor(() => {
        expect(receivedBody).not.toBeNull();
      });
      expect(receivedBody).toEqual({
        pointsEau: [
          // Point apparent : la distance masquee n'est pas envoyee.
          { sousType: 'lavabo', modePose: 'apparent' },
          { sousType: 'wc', modePose: 'encastre', distanceMl: 4 },
        ],
      });
    });

    it('should fill the table with the computed lines of a list template', async () => {
      mockTemplates('Plumbing');
      server.use(
        http.post('*/api/quotes/templates/:id/compute', () =>
          HttpResponse.json({ id: 'plombier-3-points-eau', title: 'Plomberie', lines: computedLinesFixture })
        )
      );

      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openGallery(user);
      await user.click(await screen.findByRole('button', { name: /installation plomberie/i }));
      await user.click(await screen.findByRole('button', { name: /generate the lines|g[\u00e9e]n[\u00e9e]rer les lignes/i }));

      expect(
        await screen.findByRole('heading', { name: /generate new quote|g[\u00e9e]n[\u00e9e]rer un nouveau devis/i })
      ).toBeInTheDocument();
      expect(screen.getAllByLabelText(/designation|d[\u00e9e]signation/i)).toHaveLength(
        computedLinesFixture.length
      );
    });
  });


  describe('payment schedule', () => {
    const openBlankForm = async (user, { total }: { total?: string } = {}) => {
      await user.click(screen.getByRole('button', { name: /generate quote|g[\u00e9e]n[\u00e9e]rer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /blank quote|devis libre/i }));
      await screen.findByRole('heading', { name: /generate new quote|g[\u00e9e]n[\u00e9e]rer un nouveau devis/i });
      if (total) {
        // Sans montant, le total vaut 0 et tout echeancier est trivialement
        // equilibre. Le montant vient desormais d'une ligne du tableau.
        await user.click(screen.getByRole('button', { name: /add a line|ajouter une ligne/i }));
        const unitPrice = await screen.findByLabelText(/unit price|prix unitaire/i);
        await user.clear(unitPrice);
        await user.type(unitPrice, total);
      }
    };

    beforeEach(() => {
      server.use(http.get('*/api/quotes', () => HttpResponse.json([])));
    });

    it('should start with the two default tranches', async () => {
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openBlankForm(user);

      const labels = screen.getAllByLabelText(/tranche label|libell[\u00e9e] de la tranche/i);
      expect(labels).toHaveLength(2);
      expect(labels[0]).toHaveValue('Acompte');
      expect(labels[1]).toHaveValue('Solde \u00e0 la livraison');

      const types = screen.getAllByLabelText(/tranche type|type de tranche/i);
      expect(types[0]).toHaveValue('percent');
      expect(types[1]).toHaveValue('remaining');
    });

    it('should disable the value input for a remaining tranche', async () => {
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openBlankForm(user);

      const values = screen.getAllByLabelText(/tranche value|valeur de la tranche/i);
      expect(values[0]).toBeEnabled();
      expect(values[1]).toBeDisabled();
    });

    it('should add and remove tranches', async () => {
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openBlankForm(user);

      await user.click(screen.getByRole('button', { name: /add a tranche|ajouter une tranche/i }));
      await waitFor(() => {
        expect(screen.getAllByLabelText(/tranche label|libell[\u00e9e] de la tranche/i)).toHaveLength(3);
      });

      const removeButtons = screen.getAllByLabelText(/remove tranche|supprimer la tranche/i);
      await user.click(removeButtons[2]);
      await waitFor(() => {
        expect(screen.getAllByLabelText(/tranche label|libell[\u00e9e] de la tranche/i)).toHaveLength(2);
      });
    });

    it('should block submission when the tranches do not add up', async () => {
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openBlankForm(user, { total: '1000' });

      // On retire la tranche « Solde restant » : les 50% restants ne sont plus couverts.
      const removeButtons = screen.getAllByLabelText(/remove tranche|supprimer la tranche/i);
      await user.click(removeButtons[1]);

      expect(
        await screen.findByText(/must add up to the quote total|somme des tranches doit correspondre/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate quote|generating/i })).toBeDisabled();
    });

    it('should stay balanced while a remaining tranche is present', async () => {
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openBlankForm(user, { total: '1000' });

      // Meme en changeant l'acompte, « Solde restant » absorbe l'ecart.
      const values = screen.getAllByLabelText(/tranche value|valeur de la tranche/i);
      await user.clear(values[0]);
      await user.type(values[0], '80');

      await waitFor(() => {
        expect(
          screen.queryByText(/must add up to the quote total|somme des tranches doit correspondre/i)
        ).not.toBeInTheDocument();
      });
    });
  });


  describe('retour depuis les parametres du modele', () => {
    const templatePeinture = {
      id: 'peintre-piece-25m2', domain: 'Painting', title: 'Peinture intérieure', lines: [],
      parameters: [
        { key: 'surfacePlafond', label: 'Surface plafond', type: 'number', unit: 'm2', min: 0.1, step: 0.1, default: 25 },
      ],
    };

    /** Lecture a deux pieces : l'ecran de selection s'intercale. */
    const lectureDeuxPieces = {
      pieces: [
        { libelle: 'SEJOUR', surface_m2: 18.5, texte_source_surface: 'SEJOUR 18,50 m2' },
        { libelle: 'CHAMBRE', surface_m2: 12, texte_source_surface: 'CHAMBRE 12,00 m2' },
      ],
      cotations: [], illisible: [],
    };

    /** Lecture a une seule piece : le parcours saute l'ecran de selection. */
    const lectureUnePiece = {
      pieces: [{ libelle: 'SEJOUR', surface_m2: 18.5, texte_source_surface: 'SEJOUR 18,50 m2' }],
      cotations: [], illisible: [],
    };

    const brancherPlan = (lecture: any) => {
      server.use(
        http.get('*/api/quotes', () => HttpResponse.json([])),
        http.get('*/api/quotes/templates', () => HttpResponse.json([templatePeinture])),
        http.post('*/api/quotes/plan-reading', () => HttpResponse.json({ lecture, avertissements: [] })),
        http.post('*/api/quotes/detect-trade', () => HttpResponse.json({
          templateId: templatePeinture.id, template: templatePeinture,
          motsCles: ['peintur'], raison: 'métier reconnu',
        })),
        http.post('*/api/quotes/templates/:id/map-reading', () => HttpResponse.json({
          id: templatePeinture.id,
          propositions: [{
            champ_cible: 'surfacePlafond', unite: 'm²',
            candidats: lecture.pieces.map((p: any, i: number) => ({
              piece_index: i, valeur: p.surface_m2, libelle: p.libelle, texte_source: p.texte_source_surface,
            })),
          }],
          rejetees: [], avertissements: [], indications: [], estimations: [],
        }))
      );
    };

    const parcoursPlan = async (user: any, lecture: any) => {
      brancherPlan(lecture);
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /from a plan|depuis un plan/i }));
      await user.upload(
        document.getElementById('planFile'),
        new File(['x'], 'plan.png', { type: 'image/png' })
      );
      await user.type(
        await screen.findByLabelText(/que devez-vous faire|what do you need to do/i),
        'Peinture'
      );
      await user.click(screen.getByRole('button', { name: /continuer|continue/i }));
    };

    it('should go back to the gallery on the ordinary ready-made path', async () => {
      // Parcours « devis pret » : reculer veut bien dire changer de metier.
      server.use(
        http.get('*/api/quotes', () => HttpResponse.json([])),
        http.get('*/api/quotes/templates', () => HttpResponse.json([templatePeinture]))
      );
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);

      await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /ready-made|devis pr[êe]t/i }));
      await user.click(await screen.findByRole('button', { name: /peinture intérieure/i }));

      const retour = await screen.findByRole('button', { name: /retour aux modèles|back to templates/i });
      await user.click(retour);

      expect(await screen.findByRole('heading', { name: /devis pr[êe]ts|ready-made/i })).toBeInTheDocument();
    });

    it('should go back to the plan measurements, not to the gallery', async () => {
      // Depuis un plan, reculer veut dire corriger sa selection de pieces.
      const user = userEvent.setup();
      await parcoursPlan(user, lectureDeuxPieces);

      // On traverse l'ecran de selection puis on arrive au formulaire.
      await screen.findByTestId('plan-rooms');
      await user.click(screen.getAllByRole('checkbox')[0]);
      await user.click(screen.getByRole('button', { name: /continuer|continue/i }));
      await screen.findByLabelText(/surface plafond/i);

      await user.click(screen.getByRole('button', { name: /retour aux mesures du plan|back to the plan measurements/i }));

      // Les mesures lues, pas la galerie de metiers.
      expect(await screen.findByTestId('plan-rooms')).toBeInTheDocument();
      expect(screen.getByText('SEJOUR')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /devis pr[êe]ts|ready-made/i })).toBeNull();
    });

    it('should name the destination it actually reaches', async () => {
      // Un libelle fige annoncerait la mauvaise page a la moitie des artisans.
      const user = userEvent.setup();
      await parcoursPlan(user, lectureDeuxPieces);

      await screen.findByTestId('plan-rooms');
      await user.click(screen.getAllByRole('checkbox')[0]);
      await user.click(screen.getByRole('button', { name: /continuer|continue/i }));
      await screen.findByLabelText(/surface plafond/i);

      expect(screen.getByRole('button', { name: /retour aux mesures du plan|back to the plan measurements/i }))
        .toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /retour aux modèles|back to templates/i })).toBeNull();
    });

    it('should still reach the measurements when the picker was skipped', async () => {
      // Une seule piece : le parcours saute l'ecran de selection a l'aller.
      // Au retour, l'artisan doit tout de meme pouvoir revoir ce qui a ete lu.
      const user = userEvent.setup();
      await parcoursPlan(user, lectureUnePiece);

      // Pas d'ecran de selection a l'aller : on arrive direct au formulaire.
      expect(await screen.findByLabelText(/surface plafond/i)).toHaveValue(18.5);
      expect(screen.queryByTestId('plan-rooms')).toBeNull();

      await user.click(screen.getByRole('button', { name: /retour aux mesures du plan|back to the plan measurements/i }));

      expect(await screen.findByTestId('plan-rooms')).toBeInTheDocument();
      expect(screen.getByText('SEJOUR')).toBeInTheDocument();
    });

    it('should let the artisan correct the selection and come back', async () => {
      // Le motif du retour : s'etre trompe de pieces.
      const user = userEvent.setup();
      await parcoursPlan(user, lectureDeuxPieces);

      await screen.findByTestId('plan-rooms');
      await user.click(screen.getAllByRole('checkbox')[0]);
      await user.click(screen.getByRole('button', { name: /continuer|continue/i }));
      expect(await screen.findByLabelText(/surface plafond/i)).toHaveValue(18.5);

      await user.click(screen.getByRole('button', { name: /retour aux mesures du plan|back to the plan measurements/i }));
      await screen.findByTestId('plan-rooms');
      await user.click(screen.getAllByRole('checkbox')[1]);
      await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

      // La nouvelle selection remplace l'ancienne.
      expect(await screen.findByLabelText(/surface plafond/i)).toHaveValue(12);
    });
  });

  describe("retour depuis l'ecran de saisie", () => {
    // ⚠ Bouton distinct de celui de QuoteTemplateParams : celui-ci est en haut
    // de l'ecran de saisie, une fois les lignes generees.
    const templatePeinture = {
      id: 'peintre-piece-25m2', domain: 'Painting', title: 'Peinture intérieure',
      lines: [],
      parameters: [
        { key: 'surfacePlafond', label: 'Surface plafond', type: 'number', unit: 'm2', min: 0.1, step: 0.1, default: 25 },
      ],
    };

    const lecture = {
      pieces: [
        { libelle: 'SEJOUR', surface_m2: 18.5, texte_source_surface: 'SEJOUR 18,50 m2' },
        { libelle: 'CHAMBRE', surface_m2: 12, texte_source_surface: 'CHAMBRE 12,00 m2' },
      ],
      cotations: [], illisible: [],
    };

    const lignesCalculees = [
      { designation: 'Peinture de finition mat (2 couches)', quantity: 2, unit: 'bidon', unitPrice: 0, lineType: 'material', total: 0 },
    ];

    const brancher = () => {
      server.use(
        http.get('*/api/quotes', () => HttpResponse.json([])),
        http.get('*/api/quotes/templates', () => HttpResponse.json([templatePeinture])),
        http.post('*/api/quotes/plan-reading', () => HttpResponse.json({ lecture, avertissements: [] })),
        http.post('*/api/quotes/detect-trade', () => HttpResponse.json({
          templateId: templatePeinture.id, template: templatePeinture,
          motsCles: ['peintur'], raison: 'métier reconnu',
        })),
        http.post('*/api/quotes/templates/:id/map-reading', () => HttpResponse.json({
          id: templatePeinture.id,
          propositions: [{
            champ_cible: 'surfacePlafond', unite: 'm²',
            candidats: lecture.pieces.map((p, i) => ({
              piece_index: i, valeur: p.surface_m2, libelle: p.libelle, texte_source: p.texte_source_surface,
            })),
          }],
          rejetees: [], avertissements: [], indications: [], estimations: [],
        })),
        http.post('*/api/quotes/templates/:id/compute', () => HttpResponse.json({
          id: templatePeinture.id, title: templatePeinture.title, lines: lignesCalculees,
        }))
      );
    };

    /** Parcours complet jusqu'aux lignes generees dans l'ecran de saisie. */
    const jusquAuxLignes = async (user: any) => {
      brancher();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /from a plan|depuis un plan/i }));
      await user.upload(
        document.getElementById('planFile'),
        new File(['x'], 'plan.png', { type: 'image/png' })
      );
      await user.type(
        await screen.findByLabelText(/que devez-vous faire|what do you need to do/i),
        'Peinture'
      );
      await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

      await screen.findByTestId('plan-rooms');
      await user.click(screen.getAllByRole('checkbox')[0]);
      await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

      await screen.findByLabelText(/surface plafond/i);
      await user.click(screen.getByRole('button', { name: /g[ée]n[ée]rer les lignes|generate the lines|g[ée]n[ée]rer/i }));

      // On est bien dans l'ecran de saisie, avec les lignes.
      return screen.findByDisplayValue(/Peinture de finition mat/i);
    };

    it('should go back to the plan measurements when the quote came from a plan', async () => {
      const user = userEvent.setup();
      await jusquAuxLignes(user);

      await user.click(screen.getByRole('button', {
        name: /retour aux mesures du plan|back to the plan measurements/i,
      }));

      expect(await screen.findByTestId('plan-rooms')).toBeInTheDocument();
      expect(screen.getByText('SEJOUR')).toBeInTheDocument();
      // Ni la liste des devis, ni un abandon.
      expect(screen.queryByText(/no quotes found|aucun devis/i)).toBeNull();
    });

    it('should let the artisan fix a wrongly ticked room and rebuild the lines', async () => {
      // Le motif meme du retour : une piece mal cochee.
      const user = userEvent.setup();
      await jusquAuxLignes(user);

      await user.click(screen.getByRole('button', {
        name: /retour aux mesures du plan|back to the plan measurements/i,
      }));
      await screen.findByTestId('plan-rooms');
      await user.click(screen.getAllByRole('checkbox')[1]);
      await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

      // Le metier est retrouve sans avoir a le rechoisir, avec la correction.
      expect(await screen.findByLabelText(/surface plafond/i)).toHaveValue(12);
    });

    it('should keep going back to the quote list on the ordinary path', async () => {
      // Devis libre : aucun plan, le bouton garde son comportement.
      server.use(http.get('*/api/quotes', () => HttpResponse.json([])));
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);

      await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /free quote|devis libre/i }));
      await screen.findByPlaceholderText(/client full name/i);

      const retour = screen.getByRole('button', { name: /retour aux devis|back to quotes/i });
      expect(screen.queryByRole('button', {
        name: /retour aux mesures du plan|back to the plan measurements/i,
      })).toBeNull();

      await user.click(retour);

      expect(await screen.findByText(/no quotes found|aucun devis/i)).toBeInTheDocument();
    });

    it('should keep the Cancel button meaning abandon', async () => {
      // « Annuler » exprime bien un abandon : il ramene a la liste meme
      // depuis un plan. C'est l'autre bouton qui devient contextuel.
      const user = userEvent.setup();
      await jusquAuxLignes(user);

      await user.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(await screen.findByText(/no quotes found|aucun devis/i)).toBeInTheDocument();
      expect(screen.queryByTestId('plan-rooms')).toBeNull();
    });
  });

  describe('hauteur sous plafond absente du plan', () => {
    /**
     * Cas normal d'une vue de dessus : elle porte longueur et largeur, jamais
     * la hauteur. Plutot que d'abandonner le calcul des murs, on reclame la
     * seule donnee qui manque — sans jamais la supposer.
     */
    const templatePeinture = {
      id: 'peintre-piece-25m2', domain: 'Painting', title: 'Peinture intérieure', lines: [],
      parameters: [
        { key: 'surfacePlafond', label: 'Surface plafond', type: 'number', unit: 'm2', min: 0.1, step: 0.1, default: 25 },
        {
          key: 'murs', type: 'list', label: 'Murs a peindre', addLabel: 'Ajouter un mur',
          itemLabel: 'Mur', itemNameKey: 'nom', min: 1,
          default: [{ nom: 'Mur 1', mode: 'surface', surfaceM2: 25, longueurM: 0, hauteurM: 2.5 }],
          itemFields: [
            { key: 'nom', label: 'Nom du mur', type: 'text', default: '' },
            { key: 'mode', label: 'Saisie', type: 'select', default: 'surface',
              options: [{ value: 'surface', label: 'Surface (m2)' }, { value: 'longueur', label: 'Longueur x hauteur' }] },
            { key: 'surfaceM2', label: 'Surface du mur', type: 'number', unit: 'm2', min: 0, step: 0.1, default: 0,
              showIf: { key: 'mode', equals: 'surface' } },
            { key: 'longueurM', label: 'Longueur', type: 'number', unit: 'ml', min: 0, step: 0.1, default: 0,
              showIf: { key: 'mode', equals: 'longueur' } },
            { key: 'hauteurM', label: 'Hauteur sous plafond', type: 'number', unit: 'ml', min: 0, step: 0.05, default: 2.5,
              showIf: { key: 'mode', equals: 'longueur' } },
          ],
        },
      ],
    };

    const lecture = {
      pieces: [{
        libelle: 'CHAMBRE', surface_m2: 9.97, texte_source_surface: 'Chambre 9,97 m²',
        longueur_m: 3.56, largeur_m: 2.8, texte_source_dimensions: '356 cm / 280 cm',
      }],
      cotations: [], illisible: [],
    };

    /** `estimations` tel que le backend le renvoie selon que la HSP est lue. */
    const estimationsSansHauteur = [{
      champ_cible: 'murs', unite: 'ml', estimation: true,
      mention: 'Estimation avant déduction des portes et fenêtres, pièce supposée rectangulaire — à vérifier et ajuster.',
      hauteur_utilisee: null,
      candidats: [{ piece_index: 0, libelle: 'CHAMBRE', valeur: 12.72, longueur_m: 3.56, largeur_m: 2.8, texte_source: '356 cm / 280 cm' }],
    }];

    const estimationsAvecHauteur = [{
      champ_cible: 'murs', unite: 'm²', estimation: true,
      mention: 'Estimation avant déduction des portes et fenêtres, pièce supposée rectangulaire — à vérifier et ajuster.',
      hauteur_utilisee: 2.5,
      candidats: [{ piece_index: 0, libelle: 'CHAMBRE', valeur: 31.8, longueur_m: 3.56, largeur_m: 2.8, texte_source: '356 cm / 280 cm' }],
    }];

    const parcourirPlan = async (user: any, estimations: any, lectureUtilisee: any = lecture) => {
      server.use(
        http.get('*/api/quotes', () => HttpResponse.json([])),
        http.get('*/api/quotes/templates', () => HttpResponse.json([templatePeinture])),
        http.post('*/api/quotes/plan-reading', () => HttpResponse.json({ lecture: lectureUtilisee, avertissements: [] })),
        http.post('*/api/quotes/detect-trade', () => HttpResponse.json({
          templateId: templatePeinture.id, template: templatePeinture,
          motsCles: ['peintur'], raison: 'métier reconnu',
        })),
        http.post('*/api/quotes/templates/:id/map-reading', () => HttpResponse.json({
          id: templatePeinture.id,
          propositions: [{
            champ_cible: 'surfacePlafond', unite: 'm²',
            candidats: lectureUtilisee.pieces.map((p: any, i: number) => ({
              piece_index: i, valeur: p.surface_m2, libelle: p.libelle, texte_source: p.texte_source_surface,
            })),
          }],
          rejetees: [], avertissements: [], indications: [], estimations,
        }))
      );

      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /from a plan|depuis un plan/i }));
      await user.upload(
        document.getElementById('planFile'),
        new File(['x'], 'plan.png', { type: 'image/png' })
      );
      await user.type(
        await screen.findByLabelText(/que devez-vous faire|what do you need to do/i),
        'Peinture'
      );
      await user.click(screen.getByRole('button', { name: /continuer|continue/i }));
      await screen.findByLabelText(/surface plafond/i);
    };

    it('should ask for the ceiling height when the plan gives sides but no height', async () => {
      const user = userEvent.setup();
      await parcourirPlan(user, estimationsSansHauteur);

      const rappel = screen.getByTestId('missing-murs');
      expect(rappel).toHaveTextContent(/hauteur sous plafond non trouvée sur ce plan/i);
      expect(rappel).toHaveTextContent(/calculer automatiquement la surface des murs/i);
    });

    it('should leave the height field empty, with only an example', async () => {
      // Proposer « 2,50 » reviendrait a supposer une valeur non verifiee a la
      // place de l'artisan — ce que toute la fonctionnalite s'interdit.
      const user = userEvent.setup();
      await parcourirPlan(user, estimationsSansHauteur);

      const champ = within(screen.getByTestId('missing-murs')).getByLabelText(/hauteur sous plafond/i);
      expect(champ).toHaveValue(null);
      expect(champ).toHaveAttribute('placeholder', expect.stringMatching(/2[.,]50/));
    });

    it('should NOT ask when the plan carries a height', async () => {
      // La hauteur est lue : les murs sont deja calcules, il n'y a rien a
      // demander.
      const user = userEvent.setup();
      await parcourirPlan(user, estimationsAvecHauteur);

      expect(screen.queryByTestId('missing-murs')).toBeNull();
      const longueurs = screen.getAllByLabelText(/^Longueur \(/i) as HTMLInputElement[];
      expect(longueurs.map((i) => Number(i.value))).toEqual([3.56, 3.56, 2.8, 2.8]);
    });

    it('should NOT ask when the room has no sides to work from', async () => {
      // Sans longueur ni largeur, une hauteur ne sert a rien : le rappel
      // serait une impasse.
      const user = userEvent.setup();
      await parcourirPlan(user, [], {
        pieces: [{ libelle: 'CHAMBRE', surface_m2: 9.97, texte_source_surface: 'Chambre 9,97 m²' }],
        cotations: [], illisible: [],
      });

      expect(screen.queryByTestId('missing-murs')).toBeNull();
    });

    it('should build the four walls once a valid height is entered', async () => {
      const user = userEvent.setup();
      await parcourirPlan(user, estimationsSansHauteur);

      await user.type(
        within(screen.getByTestId('missing-murs')).getByLabelText(/hauteur sous plafond/i),
        '2.5'
      );

      // Memes quatre murs que si la hauteur avait ete lue sur le plan.
      const longueurs = screen.getAllByLabelText(/^Longueur \(/i) as HTMLInputElement[];
      expect(longueurs.map((i) => Number(i.value))).toEqual([3.56, 3.56, 2.8, 2.8]);
      screen.getAllByLabelText(/^Hauteur sous plafond \(/i).forEach((champ) => {
        expect(champ).toHaveValue(2.5);
      });
      // Et les paires sont nommees d'apres la cote lue, sans orientation.
      const noms = (screen.getAllByLabelText(/nom du mur/i) as HTMLInputElement[]).map((i) => i.value);
      expect(noms).toEqual(['Mur 3,56 m (1/2)', 'Mur 3,56 m (2/2)', 'Mur 2,80 m (1/2)', 'Mur 2,80 m (2/2)']);
    });

    it('should keep the caveat attached to the computed walls', async () => {
      const user = userEvent.setup();
      await parcourirPlan(user, estimationsSansHauteur);

      await user.type(
        within(screen.getByTestId('missing-murs')).getByLabelText(/hauteur sous plafond/i),
        '2.5'
      );

      expect(screen.getByTestId('missing-murs')).toHaveTextContent(/portes et fenêtres/i);
      expect(screen.getByTestId('missing-murs')).toHaveTextContent(/à vérifier et ajuster/i);
    });

    it('should stay out of the way when the artisan ignores it', async () => {
      // Jamais bloquant : sans saisie, la liste reste celle du modele et
      // l'artisan ajoute ses murs un par un.
      const user = userEvent.setup();
      await parcourirPlan(user, estimationsSansHauteur);

      expect(screen.getByLabelText(/surface du mur/i)).toHaveValue(25);
      expect(screen.queryByLabelText(/^Longueur \(/i)).toBeNull();

      await user.click(screen.getByRole('button', { name: /ajouter un mur|add an item/i }));
      expect(screen.getAllByLabelText(/surface du mur/i)).toHaveLength(2);
    });

    it('should ignore a height that makes no sense', async () => {
      const user = userEvent.setup();
      await parcourirPlan(user, estimationsSansHauteur);

      await user.type(
        within(screen.getByTestId('missing-murs')).getByLabelText(/hauteur sous plafond/i),
        '0'
      );

      // Rien n'a ete calcule : la liste garde son mur par defaut.
      expect(screen.getByLabelText(/surface du mur/i)).toHaveValue(25);
    });

    it('should never show the reminder on a quote built without a plan', async () => {
      // Devis libre : aucune dimension de piece a exploiter.
      server.use(http.get('*/api/quotes', () => HttpResponse.json([])));
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);

      await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /free quote|devis libre/i }));
      await screen.findByPlaceholderText(/client full name/i);

      expect(screen.queryByTestId('missing-murs')).toBeNull();
    });
  });

  describe('echeancier a plus de deux tranches', () => {
    /**
     * Projet eligible. Il DOIT porter au moins un materiau : `validateField`
     * refuse un devis sur un projet qui n'en a aucun (ArtisanQuotes.tsx:1772).
     */
    const projet = {
      _id: 'p1', title: 'Villa Sidi Bou Said', status: 'in-progress', progress: 20,
      materials: [],
      personalMaterials: [{ _id: 'pm1', name: 'Peinture blanche', category: 'Peinture', price: 40, stock: 2 }],
    };

    const brancher = (extra: any[] = []) => server.use(
      http.get('*/api/quotes', () => HttpResponse.json([])),
      http.get('*/api/projects', () => HttpResponse.json([projet])),
      ...extra
    );

    const ouvrirDevisLibre = async (user: any) => {
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await user.click(screen.getByRole('button', { name: /generate quote|g[ée]n[ée]rer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /blank quote|devis libre/i }));
      await screen.findByPlaceholderText(/client full name/i);
      await screen.findByRole('option', { name: /Villa Sidi Bou Said/i });
    };

    /** Remplit tout ce que `validateForm` exige, plus une ligne facturable. */
    const remplirDevis = async (user: any) => {
      await user.selectOptions(screen.getByLabelText(/select project/i), 'p1');
      await user.type(screen.getByPlaceholderText(/client full name/i), 'M. Trabelsi');
      await user.type(screen.getByLabelText(/^description/i), 'Travaux de peinture');
      const echeance = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      await user.type(screen.getByLabelText(/valid until|validit[ée]/i), echeance);

      await user.click(screen.getByRole('button', { name: /add a line|ajouter une ligne/i }));
      await user.type(screen.getByLabelText(/designation|d[ée]signation/i), 'Main d oeuvre');
      const prix = screen.getByLabelText(/unit price|prix unitaire/i);
      await user.clear(prix);
      await user.type(prix, '1000');
    };

    const libelles = () =>
      screen.getAllByLabelText(/tranche label|libell[ée] de la tranche/i) as HTMLInputElement[];

    const boutonAjouterTranche = () =>
      screen.getByRole('button', { name: /add a tranche|ajouter une tranche/i });

    const boutonGenerer = () => screen.getByRole('button', { name: /^generate quote$/i });

    it('should name a newly added tranche instead of leaving it blank', async () => {
      // Le libelle vide etait la cause du 400 « Tranche 3: label is required ».
      brancher();
      const user = userEvent.setup();
      await ouvrirDevisLibre(user);

      await user.click(boutonAjouterTranche());

      expect(libelles()).toHaveLength(3);
      expect(libelles()[2].value.trim()).not.toBe('');
      expect(libelles()[2].value).toMatch(/tranche 3|instalment 3/i);
    });

    it('should refuse to submit while a tranche has no label', async () => {
      // L'equilibre seul ne suffisait pas : une tranche a 0 % sans nom
      // laissait l'echeancier equilibre et le bouton actif.
      brancher();
      const user = userEvent.setup();
      await ouvrirDevisLibre(user);
      await remplirDevis(user);

      await user.click(boutonAjouterTranche());
      await user.clear(libelles()[2]);

      expect(boutonGenerer()).toBeDisabled();
    });

    it('should let a three-tranche quote through once every tranche is named', async () => {
      let recu: any = null;
      brancher([
        http.post('*/api/quotes', async ({ request }) => {
          recu = await request.json();
          return HttpResponse.json({ _id: 'q1' }, { status: 201 });
        }),
      ]);
      const user = userEvent.setup();
      await ouvrirDevisLibre(user);
      await remplirDevis(user);

      await user.click(boutonAjouterTranche());
      expect(boutonGenerer()).toBeEnabled();
      await user.click(boutonGenerer());

      await waitFor(() => expect(recu).not.toBeNull());
      expect(recu.paymentSchedule).toHaveLength(3);
      recu.paymentSchedule.forEach((t: any) => expect(String(t.label).trim()).not.toBe(''));
    });

    it('should show the server message instead of a generic failure', async () => {
      // Le serveur nomme la tranche fautive et la regle violee ; un « Failed
      // to create quote » generique obligeait a deviner.
      brancher([
        http.post('*/api/quotes', () => HttpResponse.json(
          { message: 'Tranche 3: label is required' },
          { status: 400 }
        )),
      ]);
      const user = userEvent.setup();
      await ouvrirDevisLibre(user);
      await remplirDevis(user);

      await user.click(boutonGenerer());

      // Le Toaster de sonner vit dans App : ici on verifie l'appel lui-meme.
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Tranche 3: label is required');
      });
    });
  });

  describe('devis sans aucun materiau', () => {
    /**
     * Un devis 100 % main d'oeuvre est un cas legitime : nettoyage,
     * diagnostic, petite reparation, ou peinture dont le client fournit deja
     * le produit. Une regle de `validateField` l'interdisait, en exigeant au
     * moins un materiau sur le projet.
     */
    const projetSansMateriau = {
      _id: 'p-vide', title: 'Diagnostic humidite', status: 'in-progress', progress: 10,
      materials: [], personalMaterials: [],
    };

    it('should let a labour-only quote be created on a project with no material', async () => {
      let recu: any = null;
      server.use(
        http.get('*/api/quotes', () => HttpResponse.json([])),
        http.get('*/api/projects', () => HttpResponse.json([projetSansMateriau])),
        http.post('*/api/quotes', async ({ request }) => {
          recu = await request.json();
          return HttpResponse.json({ _id: 'q1' }, { status: 201 });
        })
      );

      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await user.click(screen.getByRole('button', { name: /generate quote|g[ée]n[ée]rer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /blank quote|devis libre/i }));
      await screen.findByPlaceholderText(/client full name/i);
      await screen.findByRole('option', { name: /Diagnostic humidite/i });

      await user.selectOptions(screen.getByLabelText(/select project/i), 'p-vide');
      await user.type(screen.getByPlaceholderText(/client full name/i), 'Mme Ben Ali');
      await user.type(screen.getByLabelText(/^description/i), 'Diagnostic et rapport');
      await user.type(
        screen.getByLabelText(/valid until|validit[ée]/i),
        new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      );

      await user.click(screen.getByRole('button', { name: /add a line|ajouter une ligne/i }));
      await user.type(screen.getByLabelText(/designation|d[ée]signation/i), 'Diagnostic sur site');
      await user.selectOptions(screen.getByLabelText(/line type|type de ligne/i), 'labor');
      const prix = screen.getByLabelText(/unit price|prix unitaire/i);
      await user.clear(prix);
      await user.type(prix, '250');

      // Aucun message ne barre plus la route.
      expect(screen.queryByText(/at least one material|au moins un mat[ée]riau/i)).toBeNull();

      const generer = screen.getByRole('button', { name: /^generate quote$/i });
      expect(generer).toBeEnabled();
      await user.click(generer);

      await waitFor(() => expect(recu).not.toBeNull());
      // Le devis part bien, entierement en main d'oeuvre.
      expect(recu.quoteLines).toHaveLength(1);
      expect(recu.quoteLines[0].lineType).toBe('labor');
      expect(recu.materialsAmount).toBe(0);
    });
  });

  describe('facturation a N tranches', () => {
    /**
     * Ce bloc remplace un garde-fou temporaire qui MASQUAIT le bouton sur un
     * devis a 3+ tranches, le temps que la facture sache les porter. Elle le
     * sait desormais : le bouton est offert quel que soit le nombre.
     */
    const devisApprouve = (nbTranches: number) => ({
      _id: 'q-multi',
      quoteNumber: 'QT-2026-9001',
      clientName: 'M. Trabelsi',
      description: 'Travaux',
      amount: 1000,
      status: 'approved',
      hasInvoice: false,
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      project: { _id: 'p1', title: 'Villa' },
      paymentSchedule: Array.from({ length: nbTranches }, (_, i) => ({
        label: `Tranche ${i + 1}`, type: 'percent', value: 100 / nbTranches,
        amount: 1000 / nbTranches, percentage: 100 / nbTranches,
      })),
    });

    const afficherListe = async (quote: any) => {
      server.use(http.get('*/api/quotes', () => HttpResponse.json([quote])));
      render(<ArtisanQuotes />);
      await screen.findByText(/QT-2026-9001/i);
    };

    it.each([2, 3, 5])('should offer the invoice button on a %s-tranche quote', async (n) => {
      await afficherListe(devisApprouve(n));

      expect(screen.getByRole('button', { name: /generate invoice|generer la facture/i }))
        .toBeInTheDocument();
    });

    it('should no longer explain a refusal that does not happen', async () => {
      const user = userEvent.setup();
      await afficherListe(devisApprouve(3));

      await user.click(screen.getAllByRole('button', { name: /view|voir|d[ée]tail/i })[0]);

      expect(screen.queryByTestId('invoice-tranches-unsupported')).toBeNull();
      expect(await screen.findByRole('button', { name: /generate invoice|generer la facture/i }))
        .toBeInTheDocument();
    });
  });

  describe('colonne Designation', () => {
    /** Designation reelle produite par le modele Peinture. */
    const LONGUE = 'Peinture de finition mat (2 couches) — ≈ 1 bidon de 10 L';

    const ouvrirDevisLibre = async (user: any) => {
      server.use(http.get('*/api/quotes', () => HttpResponse.json([])));
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /free quote|devis libre/i }));
      await user.click(await screen.findByRole('button', { name: /ajouter une ligne|add a line/i }));
      return screen.getByLabelText(/designation|d[\u00e9e]signation/i);
    };

    it('should let the designation wrap instead of clipping it', async () => {
      // Un <input> ne revient jamais a la ligne, quelle que soit la CSS : la
      // fin du libelle — « ≈ 1 bidon de 10 L » — disparaissait purement.
      const user = userEvent.setup();
      const champ = await ouvrirDevisLibre(user);

      expect(champ.tagName).toBe('TEXTAREA');
    });

    it('should keep the whole text, quantity included', async () => {
      const user = userEvent.setup();
      const champ = await ouvrirDevisLibre(user);

      await user.clear(champ);
      await user.type(champ, LONGUE);

      expect(champ).toHaveValue(LONGUE);
      // La partie apres le tiret est ce qui se perdait.
      expect((champ as HTMLTextAreaElement).value).toContain('≈ 1 bidon de 10 L');
    });

    it('should not hide the overflow behind an ellipsis or a scrollbar', async () => {
      // Les trois solutions ecartees : troncature, defilement dans la cellule,
      // et infobulle — cette derniere ne s'ouvre pas au doigt sur mobile.
      const user = userEvent.setup();
      const champ = await ouvrirDevisLibre(user);

      expect(champ.className).not.toMatch(/truncate|text-ellipsis|whitespace-nowrap/);
      expect(champ.className).not.toMatch(/overflow-x-auto|overflow-x-scroll/);
      expect(champ).not.toHaveAttribute('title');
    });

    it('should give the designation column the leftover width', async () => {
      // Les voisines sont a largeur fixe ; `w-full` fait absorber le reste a
      // la designation, `min-w` l'empeche d'etre ecrasee.
      const user = userEvent.setup();
      const champ = await ouvrirDevisLibre(user);

      const cellule = champ.closest('td') as HTMLElement;
      expect(cellule.className).toMatch(/w-full/);
      expect(cellule.className).toMatch(/min-w-\[15rem\]/);
    });

    it('should let the row grow rather than crop it', async () => {
      // Les autres cellules s'alignent en haut : sans ca, elles flotteraient
      // au milieu d'une ligne devenue haute.
      const user = userEvent.setup();
      const champ = await ouvrirDevisLibre(user);

      const rangee = champ.closest('tr') as HTMLElement;
      [...rangee.children].forEach((cellule) => {
        expect((cellule as HTMLElement).className).toMatch(/align-top/);
      });
    });

    it('should show a long designation coming from a generated line, not only a typed one', async () => {
      // Le cas signale vient d'une ligne generee, jamais saisie a la main :
      // ici, un produit rapporte du Marketplace.
      localStorage.setItem('all_draft_quotes', JSON.stringify([{
        id: 'draft-long',
        timestamp: Date.now(),
        title: 'M. Trabelsi',
        formData: { project: '', clientName: 'M. Trabelsi', description: '', validUntil: '' },
        quoteLines: [], paymentSchedule: [], importedMaterialKeys: [], marketplaceProductKeys: [],
      }]));
      sessionStorage.setItem('bmp:quote-marketplace-selection', JSON.stringify({
        draftId: 'draft-long',
        produits: [{ _id: 'p1', name: LONGUE, price: 42, category: 'Peinture' }],
        timestamp: Date.now(),
      }));
      window.history.replaceState({}, '', '/?artisanView=quotes&quoteDraftId=draft-long');
      server.use(http.get('*/api/quotes', () => HttpResponse.json([])));

      render(<ArtisanQuotes />);

      const champ = await screen.findByDisplayValue(LONGUE);
      expect(champ.tagName).toBe('TEXTAREA');
      window.history.replaceState({}, '', '/');
    });
  });

  describe('aller-retour vers le Marketplace', () => {
    const CLE_SELECTION = 'bmp:quote-marketplace-selection';
    const CLE_BROUILLONS = 'all_draft_quotes';

    /** Intercepte la navigation, que jsdom n'execute pas. */
    let destinations: string[] = [];
    let locationOriginale: Location;

    beforeEach(() => {
      destinations = [];
      locationOriginale = window.location;
      // @ts-expect-error remplacement de test
      delete window.location;
      // Les accesseurs restent branches sur la vraie location : un simple
      // etalement figerait `search`, que `replaceState` fait ensuite evoluer.
      // @ts-expect-error remplacement de test
      window.location = {
        get href() { return locationOriginale.href; },
        set href(valeur: string) { destinations.push(valeur); },
        get search() { return locationOriginale.search; },
        get pathname() { return locationOriginale.pathname; },
        get origin() { return locationOriginale.origin; },
        assign: (v: string) => destinations.push(v),
        replace: (v: string) => destinations.push(v),
      };
      // Surtout pas `sessionStorage.clear()` : le beforeEach parent y pose le
      // drapeau d'abonnement, sans lequel guard() bloque tout le parcours.
      sessionStorage.removeItem(CLE_SELECTION);
    });

    afterEach(() => {
      // @ts-expect-error remplacement de test
      window.location = locationOriginale;
      window.history.replaceState({}, '', '/');
    });

    const ouvrirDevisLibre = async (user: any) => {
      server.use(http.get('*/api/quotes', () => HttpResponse.json([])));
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await user.click(screen.getByRole('button', { name: /generate quote|generer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /free quote|devis libre/i }));
      await screen.findByPlaceholderText(/client full name/i);
    };

    it('should force a save before navigating away', async () => {
      // L'autosauvegarde attend 2500 ms : un rechargement parti avant elle
      // emporterait les lignes tout juste saisies.
      const user = userEvent.setup();
      await ouvrirDevisLibre(user);

      await user.type(screen.getByPlaceholderText(/client full name/i), 'M. Trabelsi');
      await user.click(screen.getByRole('button', { name: /ajouter une ligne|add a line/i }));
      await user.type(screen.getByLabelText(/designation|d[\u00e9e]signation/i), 'Ciment');

      await user.click(screen.getByRole('button', {
        name: /ajouter depuis le marketplace|add from marketplace/i,
      }));

      const brouillon = JSON.parse(localStorage.getItem(CLE_BROUILLONS) || '[]')[0];
      expect(brouillon.quoteLines[0].designation).toBe('Ciment');
      expect(destinations[0]).toBe(
        `/?artisanView=marketplace&quoteDraftId=${encodeURIComponent(brouillon.id)}`
      );
    });

    it('should not open the picker window any more', async () => {
      const user = userEvent.setup();
      await ouvrirDevisLibre(user);

      await user.click(screen.getByRole('button', {
        name: /ajouter depuis le marketplace|add from marketplace/i,
      }));

      expect(screen.queryByTestId('marketplace-picker')).toBeNull();
    });

    /** Prepare un brouillon et l'adresse de retour. */
    const preparerRetour = (draftId: string, selection: any) => {
      localStorage.setItem(CLE_BROUILLONS, JSON.stringify([{
        id: draftId,
        timestamp: Date.now(),
        title: 'M. Trabelsi',
        formData: { project: '', clientName: 'M. Trabelsi', description: '', validUntil: '' },
        quoteLines: [
          { designation: 'Ciment', quantity: 3, unit: 'sac', unitPrice: 18.5, lineType: 'material', total: 55.5 },
        ],
        paymentSchedule: [], importedMaterialKeys: [], marketplaceProductKeys: [],
      }]));
      if (selection) sessionStorage.setItem(CLE_SELECTION, JSON.stringify(selection));
      window.history.replaceState({}, '', `/?artisanView=quotes&quoteDraftId=${draftId}`);
      server.use(http.get('*/api/quotes', () => HttpResponse.json([])));
    };

    it('should reopen the draft and inject the selected products', async () => {
      preparerRetour('draft-7', {
        draftId: 'draft-7',
        produits: [
          { _id: 'p1', name: 'Sable lavé 0/4', price: 42, category: 'Granulats' },
          { _id: 'p2', name: 'Gravier 10/20', price: 55, category: 'Granulats' },
        ],
        timestamp: Date.now(),
      });

      render(<ArtisanQuotes />);

      // Les lignes du brouillon ET celles du marketplace.
      expect(await screen.findByDisplayValue('Ciment')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Sable lavé 0/4')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Gravier 10/20')).toBeInTheDocument();
    });

    it('should apply the agreed mapping to the injected products', async () => {
      preparerRetour('draft-7', {
        draftId: 'draft-7',
        produits: [{ _id: 'p1', name: 'Sable lavé 0/4', price: 42, category: 'Granulats' }],
        timestamp: Date.now(),
      });

      render(<ArtisanQuotes />);

      const ligne = (await screen.findByDisplayValue('Sable lavé 0/4')).closest('tr') as HTMLElement;
      expect(within(ligne).getByLabelText(/quantity|quantit[ée]/i)).toHaveValue(1);
      expect(within(ligne).getByLabelText(/unit price|prix unitaire/i)).toHaveValue(42);
      expect(within(ligne).getByLabelText(/^unit$|^unit[ée]$/i)).toHaveValue('unité');
      expect(within(ligne).getByLabelText(/line type|type de ligne/i)).toHaveValue('material');
    });

    it('should consume the selection so a reload does not duplicate it', async () => {
      preparerRetour('draft-7', {
        draftId: 'draft-7',
        produits: [{ _id: 'p1', name: 'Sable lavé 0/4', price: 42, category: 'Granulats' }],
        timestamp: Date.now(),
      });

      render(<ArtisanQuotes />);
      await screen.findByDisplayValue('Sable lavé 0/4');

      await waitFor(() => expect(sessionStorage.getItem(CLE_SELECTION)).toBeNull());
      expect(screen.getAllByDisplayValue('Sable lavé 0/4')).toHaveLength(1);
    });

    it('should never inject a selection meant for another quote', async () => {
      // Garde-fou : le `draftId` accompagne la selection precisement pour ca.
      preparerRetour('draft-7', {
        draftId: 'draft-AUTRE',
        produits: [{ _id: 'p1', name: 'Sable lavé 0/4', price: 42, category: 'Granulats' }],
        timestamp: Date.now(),
      });

      render(<ArtisanQuotes />);
      await screen.findByDisplayValue('Ciment');

      expect(screen.queryByDisplayValue('Sable lavé 0/4')).toBeNull();
      // Et elle est ecartee plutot que laissee a trainer.
      await waitFor(() => expect(sessionStorage.getItem(CLE_SELECTION)).toBeNull());
    });

    it('should clean the query string once the draft is reopened', async () => {
      preparerRetour('draft-7', null);

      render(<ArtisanQuotes />);
      await screen.findByDisplayValue('Ciment');

      await waitFor(() => {
        expect(window.location.search).not.toContain('quoteDraftId');
        expect(window.location.search).not.toContain('artisanView');
      });
    });

    it('should keep the selection pending when the subscription blocks the draft', async () => {
      // `handleResumeDraft` passe par guard() : abonnement expire, le
      // brouillon ne s'ouvre pas. La selection doit attendre, pas disparaitre.
      sessionStorage.setItem('artisan-sub-active', '0');
      preparerRetour('draft-7', {
        draftId: 'draft-7',
        produits: [{ _id: 'p1', name: 'Sable lavé 0/4', price: 42, category: 'Granulats' }],
        timestamp: Date.now(),
      });

      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);

      // Rien n'a ete injecte...
      expect(screen.queryByDisplayValue('Sable lavé 0/4')).toBeNull();
      // ...et la selection reste disponible pour plus tard.
      expect(sessionStorage.getItem(CLE_SELECTION)).not.toBeNull();
      sessionStorage.setItem('artisan-sub-active', '1');
    });
  });


  describe('project materials shortcut', () => {
    const projectWithMaterials = {
      _id: 'project-1',
      title: 'Villa Sidi Bou Said',
      status: 'in-progress',
      progress: 40,
      materials: [
        { _id: 'mat-1', name: 'Ciment 50kg', price: 25 },
        { _id: 'mat-1', name: 'Ciment 50kg', price: 25 },
        { _id: 'mat-2', name: 'Sable', price: 40 },
      ],
      personalMaterials: [],
    };

    beforeEach(() => {
      server.use(
        http.get('*/api/quotes', () => HttpResponse.json([])),
        http.get('*/api/projects', () => HttpResponse.json([projectWithMaterials]))
      );
    });

    const openFormWithProject = async (user) => {
      await user.click(screen.getByRole('button', { name: /generate quote|g[\u00e9e]n[\u00e9e]rer un devis/i }));
      await user.click(await screen.findByRole('button', { name: /blank quote|devis libre/i }));
      await screen.findByRole('heading', { name: /generate new quote|g[\u00e9e]n[\u00e9e]rer un nouveau devis/i });
      const projectSelect = await screen.findByLabelText(/project/i);
      await user.selectOptions(projectSelect, 'project-1');
    };

    it('should import each project material once and disappear once done', async () => {
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openFormWithProject(user);

      // Deux materiaux distincts (mat-1 apparait deux fois cote projet).
      const importButton = await screen.findByRole('button', {
        name: /from project materials \(2 left\)|mat[\u00e9e]riaux du projet \(2 restants\)/i,
      });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getAllByLabelText(/designation|d[\u00e9e]signation/i)).toHaveLength(2);
      });
      expect(screen.getByDisplayValue('Ciment 50kg')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Sable')).toBeInTheDocument();

      // Plus rien a importer : le bouton disparait, un second clic est impossible.
      expect(
        screen.queryByRole('button', { name: /from project materials|mat[\u00e9e]riaux du projet/i })
      ).not.toBeInTheDocument();
    });

    it('should only import the materials still missing', async () => {
      const user = userEvent.setup();
      render(<ArtisanQuotes />);
      await screen.findByText(/no quotes found|aucun devis/i);
      await openFormWithProject(user);

      await user.click(
        await screen.findByRole('button', { name: /from project materials|mat[\u00e9e]riaux du projet/i })
      );
      await waitFor(() => {
        expect(screen.getAllByLabelText(/designation|d[\u00e9e]signation/i)).toHaveLength(2);
      });

      // L'artisan supprime une ligne : elle reste consideree comme importee,
      // le raccourci ne la reproposera pas.
      const removeButtons = screen.getAllByLabelText(/remove line|supprimer la ligne/i);
      await user.click(removeButtons[0]);
      await waitFor(() => {
        expect(screen.getAllByLabelText(/designation|d[\u00e9e]signation/i)).toHaveLength(1);
      });
      expect(
        screen.queryByRole('button', { name: /from project materials|mat[\u00e9e]riaux du projet/i })
      ).not.toBeInTheDocument();
    });
  });

});
