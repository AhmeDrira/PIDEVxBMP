import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArtisanProjects from '@/components/artisan/ArtisanProjects';
import { server } from '../../setup/mswServer';

vi.mock('@/components/artisan/MaterialRecommendation', () => ({
  default: () => <div data-testid="material-recommendation-mock" />,
}));

const projectsFixture = [
  {
    _id: 'project-1',
    title: 'Villa Sidi',
    description: 'Concrete and finishing project',
    location: 'Tunis',
    budget: 10000,
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-06-01T00:00:00.000Z',
    status: 'active',
    priority: 'high',
    materials: [],
    personalMaterials: [],
    tasks: [],
    progress: 10,
  },
  {
    _id: 'project-2',
    title: 'Warehouse Sfax',
    description: 'Steel frame project',
    location: 'Sfax',
    budget: 24000,
    startDate: '2026-05-05T00:00:00.000Z',
    endDate: '2026-08-20T00:00:00.000Z',
    status: 'pending',
    priority: 'medium',
    materials: [],
    personalMaterials: [],
    tasks: [],
    progress: 0,
  },
];

describe('ArtisanProjects', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'artisan-projects-token');
    localStorage.setItem('user', JSON.stringify({ _id: 'expert-1', role: 'expert', token: 'artisan-projects-token' }));

    server.use(
      http.get('*/api/projects', () => HttpResponse.json(projectsFixture)),
      http.get('*/api/auth/me', () => HttpResponse.json({ user: { location: 'Tunis, Sfax' } }))
    );
  });

  it('should render projects after loading state', async () => {
    // Act
    render(<ArtisanProjects />);

    // Assert
    expect(screen.getByText(/loading your projects/i)).toBeInTheDocument();
    expect(await screen.findByText('Villa Sidi')).toBeInTheDocument();
    expect(screen.getByText('Warehouse Sfax')).toBeInTheDocument();
  });

  it('should filter projects by search query', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(<ArtisanProjects />);

    const searchInput = await screen.findByPlaceholderText(/search projects|rechercher des projets/i);
    await user.clear(searchInput);
    await user.type(searchInput, 'sfax');

    // Assert
    expect(screen.getByText('Warehouse Sfax')).toBeInTheDocument();
    expect(screen.queryByText('Villa Sidi')).not.toBeInTheDocument();
  });

  it('should open the project details view when clicking View', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(<ArtisanProjects />);

    await screen.findByText('Villa Sidi');
    await user.click(screen.getAllByRole('button', { name: /view/i })[0]);

    // Assert
    expect(await screen.findByRole('button', { name: /back to projects|retour aux projets/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Villa Sidi' })).toBeInTheDocument();
  });

  it('should open create form when clicking create project button', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(<ArtisanProjects />);

    await screen.findByText('Villa Sidi');
    await user.click(screen.getByRole('button', { name: /create project|creer un projet/i }));

    // Assert
    const createHeading = await screen.findByRole('heading', { name: /nouveau projet/i });
    const createForm = createHeading.parentElement?.querySelector('form') as HTMLFormElement | null;
    const submitButton = createForm?.querySelector('button[type="submit"]') as HTMLButtonElement | null;

    expect(createHeading).toBeInTheDocument();
    expect(submitButton).not.toBeNull();
    expect(submitButton!).toBeDisabled();
  });

  it('should delete a project after confirmation', async () => {
    // Arrange
    const user = userEvent.setup();
    const deleteSpy = vi.fn();

    server.use(
      http.delete('*/api/projects/:projectId', ({ params }) => {
        deleteSpy(String(params.projectId || ''));
        return HttpResponse.json({ success: true });
      })
    );

    // Act
    render(<ArtisanProjects />);

    await screen.findByText('Villa Sidi');
    await user.click(screen.getAllByTitle('Delete project')[0]);

    const modalHeading = await screen.findByRole('heading', { name: /delete project|supprimer le projet/i });
    const modalContainer = modalHeading.parentElement as HTMLElement;
    const deleteButton = Array.from(modalContainer.querySelectorAll('button')).find((button) =>
      /delete|supprimer/i.test(button.textContent || '')
    ) as HTMLButtonElement | undefined;

    await user.click(deleteButton as HTMLButtonElement);

    // Assert
    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('project-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Villa Sidi')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Warehouse Sfax')).toBeInTheDocument();
  });
});
describe('ArtisanProjects - localisation libre a la creation', () => {
  /**
   * La creation de projet exigeait que la localisation appartienne aux
   * gouvernorats declares dans le profil de l'artisan, et qu'elle provienne
   * d'une suggestion d'autocompletion. Un artisan sans gouvernorat renseigne
   * ne recevait donc aucune suggestion et ne pouvait creer aucun projet.
   *
   * Rien dans le produit n'impose qu'un chantier se situe dans le gouvernorat
   * declare : un artisan se deplace. Ces tests verrouillent la levee de cette
   * contrainte.
   *
   * Nominatim est volontairement mocke sur une reponse vide : c'est exactement
   * la situation ou l'ancienne regle bloquait la soumission.
   */
  const ouvrirLeFormulaire = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByRole('button', { name: /create project|creer un projet/i });
    await user.click(screen.getByRole('button', { name: /create project|creer un projet/i }));
    await screen.findByRole('heading', { name: /nouveau projet/i });
  };

  const saisirLaLocalisation = async (user: ReturnType<typeof userEvent.setup>, localisation: string) => {
    await user.type(screen.getByLabelText(/localisation/i), localisation);
    // Attendre que le debounce de l'autocompletion soit passe, pour eprouver
    // le cas « aucune suggestion » plutot qu'un simple champ pas encore sonde.
    await screen.findByText(/aucune suggestion pour cette saisie/i);
  };

  const remplirLeReste = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText(/titre du projet/i), 'Renovation hors zone');
    await user.type(screen.getByLabelText(/^description/i), 'Travaux de renovation complete du sejour');
    fireEvent.change(screen.getByLabelText(/date de d[ée]but/i), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText(/date de fin/i), { target: { value: '2026-11-01' } });
  };

  const boutonCreer = () => screen.getByRole('button', { name: /^cr[ée]er le projet$/i });

  beforeEach(() => {
    localStorage.setItem('token', 'artisan-projects-token');
    localStorage.setItem('user', JSON.stringify({ _id: 'artisan-1', role: 'artisan', token: 'artisan-projects-token' }));
    // Artisan abonne : seule la contrainte de localisation est en jeu ici.
    sessionStorage.setItem('artisan-sub-active', '1');

    server.use(
      http.get('*/api/projects', () => HttpResponse.json([])),
      http.get('https://nominatim.openstreetmap.org/search', () => HttpResponse.json([]))
    );
  });

  it('should create a project located outside the profile governorates', async () => {
    // Arrange - profil a Tunis et Sfax, chantier a Djerba (Medenine).
    let corpsRecu: any = null;
    server.use(
      http.get('*/api/auth/me', () => HttpResponse.json({ user: { location: 'Tunis, Sfax' } })),
      http.post('*/api/projects', async ({ request }) => {
        corpsRecu = await request.json();
        return HttpResponse.json({ _id: 'project-new', ...corpsRecu }, { status: 201 });
      })
    );

    const user = userEvent.setup();

    // Act
    render(<ArtisanProjects />);
    await ouvrirLeFormulaire(user);
    await remplirLeReste(user);
    await saisirLaLocalisation(user, 'Houmt Souk, Djerba, Medenine');

    // Assert - le formulaire est soumettable et la localisation part telle quelle.
    await waitFor(() => expect(boutonCreer()).toBeEnabled());
    await user.click(boutonCreer());

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu.location).toBe('Houmt Souk, Djerba, Medenine');
  });

  it('should create a project when the artisan profile has no governorate at all', async () => {
    // Arrange - profil sans localisation : le cas qui rendait la creation impossible.
    let corpsRecu: any = null;
    server.use(
      http.get('*/api/auth/me', () => HttpResponse.json({ user: { location: '' } })),
      http.post('*/api/projects', async ({ request }) => {
        corpsRecu = await request.json();
        return HttpResponse.json({ _id: 'project-new', ...corpsRecu }, { status: 201 });
      })
    );

    const user = userEvent.setup();

    // Act
    render(<ArtisanProjects />);
    await ouvrirLeFormulaire(user);
    await remplirLeReste(user);
    await saisirLaLocalisation(user, 'Tozeur');

    // Assert - aucun message ne reclame plus une localisation issue du profil.
    expect(screen.queryByText(/gouvernorats de profil/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aucune localisation detectee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/selectionnez une ville valide/i)).not.toBeInTheDocument();

    await waitFor(() => expect(boutonCreer()).toBeEnabled());
    await user.click(boutonCreer());

    await waitFor(() => expect(corpsRecu).not.toBeNull());
    expect(corpsRecu.location).toBe('Tozeur');
  });

  it('should still require the location field to be filled', async () => {
    // Lever la contrainte de gouvernorat ne rend pas le champ facultatif.
    server.use(http.get('*/api/auth/me', () => HttpResponse.json({ user: { location: '' } })));

    const user = userEvent.setup();

    render(<ArtisanProjects />);
    await ouvrirLeFormulaire(user);
    await remplirLeReste(user);

    expect(boutonCreer()).toBeDisabled();
  });

  it('should keep autocompletion and voice input available on the location field', async () => {
    // C'est la contrainte qui tombe, pas l'outillage de saisie.
    server.use(
      http.get('*/api/auth/me', () => HttpResponse.json({ user: { location: '' } })),
      http.get('https://nominatim.openstreetmap.org/search', () =>
        HttpResponse.json([{ place_id: 1, display_name: 'Tozeur, Tunisie' }])
      )
    );

    const user = userEvent.setup();

    render(<ArtisanProjects />);
    await ouvrirLeFormulaire(user);

    // La dictee vocale reste proposee sur le champ localisation.
    expect(
      screen.getByText(/voice input for location|dictee vocale pour la localisation/i)
    ).toBeInTheDocument();

    // Et une suggestion hors profil est bien proposee, puis selectionnable.
    await user.type(screen.getByLabelText(/localisation/i), 'Tozeur');
    const suggestion = await screen.findByText('Tozeur, Tunisie');
    await user.click(suggestion);

    expect(screen.getByLabelText(/localisation/i)).toHaveValue('Tozeur, Tunisie');
  });
});
