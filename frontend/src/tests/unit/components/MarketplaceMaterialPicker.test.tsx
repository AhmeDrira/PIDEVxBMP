import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../setup/mswServer';
import MarketplaceMaterialPicker from '@/components/artisan/MarketplaceMaterialPicker';

/**
 * Le selecteur ne fait qu'une chose : choisir QUOI ajouter. La quantite reste
 * a 1 et se regle sur la ligne, comme pour les materiaux du projet.
 */

const produits = [
  {
    _id: 'p1', name: 'Ciment Portland CPJ 45', category: 'Liants', price: 18.5, stock: 380,
    status: 'active', manufacturer: { companyName: 'Cimenterie du Sud' },
  },
  {
    _id: 'p2', name: 'Fer à béton HA 12 mm', category: 'Armatures', price: 29.9, stock: 0,
    status: 'out-of-stock', manufacturer: { companyName: 'Aciers Tunisie' },
  },
  {
    _id: 'p3', name: 'Sable lavé 0/4', category: 'Granulats', price: 42, stock: 90,
    status: 'active', manufacturer: { firstName: 'Karim' },
  },
];

const mockCatalogue = (data: any = produits, status = 200) => {
  server.use(http.get('*/api/products/marketplace', () => HttpResponse.json(data, { status })));
};

const monter = (props: Partial<React.ComponentProps<typeof MarketplaceMaterialPicker>> = {}) =>
  render(<MarketplaceMaterialPicker onAdd={() => {}} onClose={() => {}} {...props} />);

beforeEach(() => {
  localStorage.setItem('token', 'marketplace-token');
  mockCatalogue();
});

describe('MarketplaceMaterialPicker', () => {
  it('should list the marketplace catalogue', async () => {
    monter();

    expect(await screen.findByText('Ciment Portland CPJ 45')).toBeInTheDocument();
    expect(screen.getByText('Fer à béton HA 12 mm')).toBeInTheDocument();
    expect(screen.getByText(/Cimenterie du Sud/)).toBeInTheDocument();
  });

  it('should tick nothing by default', async () => {
    monter();
    await screen.findByText('Ciment Portland CPJ 45');

    screen.getAllByRole('checkbox').forEach((c) => expect(c).not.toBeChecked());
    expect(screen.getByRole('button', { name: /ajouter les|add 0/i })).toBeDisabled();
  });

  it('should hand over every ticked product at once', async () => {
    // Un artisan qui commande plusieurs materiaux pour un chantier ne doit pas
    // rouvrir le selecteur a chaque produit.
    const onAdd = vi.fn();
    const user = userEvent.setup();
    monter({ onAdd });
    await screen.findByText('Ciment Portland CPJ 45');

    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getAllByRole('checkbox')[2]);
    await user.click(screen.getByRole('button', { name: /ajouter les 2|add 2/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].map((p: any) => p._id)).toEqual(['p1', 'p3']);
  });

  it('should count the selection on the button', async () => {
    const user = userEvent.setup();
    monter();
    await screen.findByText('Ciment Portland CPJ 45');

    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getByRole('button', { name: /ajouter les 1|add 1/i })).toBeEnabled();
  });

  it('should let a product be unticked', async () => {
    const user = userEvent.setup();
    monter();
    await screen.findByText('Ciment Portland CPJ 45');

    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getByRole('button', { name: /ajouter les 0|add 0/i })).toBeDisabled();
  });

  it('should mark an out-of-stock product without hiding it', async () => {
    // Un devis peut legitimement porter un produit qu'on commandera : le
    // masquer retirerait une information sans que l'artisan l'ait demande.
    const user = userEvent.setup();
    const onAdd = vi.fn();
    monter({ onAdd });

    const ligne = (await screen.findByText('Fer à béton HA 12 mm')).closest('label') as HTMLElement;
    expect(within(ligne).getByText(/rupture de stock|out of stock/i)).toBeInTheDocument();

    // ...et il reste selectionnable.
    await user.click(within(ligne).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /ajouter les 1|add 1/i }));

    expect(onAdd.mock.calls[0][0].map((p: any) => p._id)).toEqual(['p2']);
  });

  it('should flag an already added product without blocking it', async () => {
    // L'artisan a pu supprimer la ligne entre-temps : le griser le laisserait
    // sans recours et sans explication.
    const user = userEvent.setup();
    const onAdd = vi.fn();
    monter({ alreadyAddedIds: ['p1'], onAdd });

    const ligne = (await screen.findByText('Ciment Portland CPJ 45')).closest('label') as HTMLElement;
    expect(within(ligne).getByText(/déjà ajouté|already added/i)).toBeInTheDocument();
    expect(within(ligne).getByRole('checkbox')).toBeEnabled();

    await user.click(within(ligne).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /ajouter les 1|add 1/i }));

    expect(onAdd.mock.calls[0][0].map((p: any) => p._id)).toEqual(['p1']);
  });

  it('should not flag a product that was never added', async () => {
    monter({ alreadyAddedIds: ['p1'] });

    const ligne = (await screen.findByText('Sable lavé 0/4')).closest('label') as HTMLElement;
    expect(within(ligne).queryByText(/déjà ajouté|already added/i)).toBeNull();
  });

  it('should filter by name or category', async () => {
    const user = userEvent.setup();
    monter();
    await screen.findByText('Ciment Portland CPJ 45');

    await user.type(screen.getByLabelText(/rechercher|search/i), 'granulats');

    // La categorie compte comme le nom : « Sable lave » ne contient pas le mot.
    await waitFor(() => expect(screen.getByText('Sable lavé 0/4')).toBeInTheDocument());
    expect(screen.queryByText('Ciment Portland CPJ 45')).toBeNull();
  });

  it('should filter by category', async () => {
    const user = userEvent.setup();
    monter();
    await screen.findByText('Ciment Portland CPJ 45');

    await user.selectOptions(screen.getByLabelText(/catégorie|category/i), 'Armatures');

    expect(screen.getByText('Fer à béton HA 12 mm')).toBeInTheDocument();
    expect(screen.queryByText('Ciment Portland CPJ 45')).toBeNull();
  });

  it('should say so when nothing matches', async () => {
    const user = userEvent.setup();
    monter();
    await screen.findByText('Ciment Portland CPJ 45');

    await user.type(screen.getByLabelText(/rechercher|search/i), 'parpaing');

    expect(await screen.findByText(/aucun produit ne correspond|no product matches/i))
      .toBeInTheDocument();
  });

  it('should surface a catalogue failure instead of an empty list', async () => {
    mockCatalogue({ message: 'boom' }, 500);
    monter();

    expect(await screen.findByText(/n'a pas pu être chargé|could not be loaded/i))
      .toBeInTheDocument();
  });

  it('should close without adding anything', async () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    monter({ onAdd, onClose });
    await screen.findByText('Ciment Portland CPJ 45');

    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /annuler|cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('should offer a link to the full marketplace page, in a new tab', async () => {
    // Fiches completes, avis et photos que cette fenetre ne reprend pas.
    // Un nouvel onglet : le devis en cours reste intact derriere.
    monter();

    const lien = await screen.findByRole('link', {
      name: /voir la fiche complète sur le marketplace|see the full listing/i,
    });
    expect(lien).toHaveAttribute('href', '/?artisanView=marketplace');
    expect(lien).toHaveAttribute('target', '_blank');
    expect(lien).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('should keep the picker open and the selection intact when the link is used', async () => {
    // Consultation en parallele : ni fermeture, ni perte de la selection.
    const onAdd = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    monter({ onAdd, onClose });
    await screen.findByText('Ciment Portland CPJ 45');

    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('link', {
      name: /voir la fiche complète sur le marketplace|see the full listing/i,
    }));

    expect(onClose).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByTestId('marketplace-picker')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
  });

  it('should say that quantity is set on the line, not here', async () => {
    // Le selecteur choisit QUOI, pas COMBIEN : autant le dire.
    monter();

    expect(await screen.findByText(/quantité démarre à 1|quantity starts at 1/i))
      .toBeInTheDocument();
  });
});
