import { render, screen, waitFor } from '@testing-library/react';
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