import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { server } from '../../setup/mswServer';
import ArtisanMarketplace from '@/components/artisan/ArtisanMarketplace';

/**
 * Mode « selection pour devis » du Marketplace.
 *
 * ⚠ Cette page n'avait aucun test avant ce fichier, et elle porte aussi le
 * panier, le paiement Stripe et les avis. Les tests ci-dessous couvrent le
 * nouveau mode ET verifient que le mode ordinaire n'a pas bouge — c'est le
 * seul filet avant d'y toucher.
 */

const SELECTION_KEY = 'bmp:quote-marketplace-selection';

const produits = [
  {
    _id: 'p1', name: 'Ciment Portland CPJ 45', category: 'Liants', price: 18.5, stock: 380,
    status: 'active', rating: 4.2, numReviews: 8, image: '', manufacturer: { companyName: 'Cimenterie du Sud' },
  },
  {
    _id: 'p2', name: 'Fer à béton HA 12 mm', category: 'Armatures', price: 29.9, stock: 0,
    status: 'out-of-stock', rating: 4, numReviews: 3, image: '', manufacturer: { companyName: 'Aciers Tunisie' },
  },
  {
    _id: 'p3', name: 'Sable lavé 0/4', category: 'Granulats', price: 42, stock: 90,
    status: 'active', rating: 3.8, numReviews: 5, image: '', manufacturer: { firstName: 'Karim' },
  },
];

/** Place l'URL comme le ferait la navigation depuis le devis. */
const allerSur = (recherche: string) => {
  window.history.replaceState({}, '', `/${recherche}`);
};

const carteDe = async (nom: string) => {
  const titre = await screen.findByTitle(nom);
  return titre.closest('[data-slot="card"]') as HTMLElement
    || titre.closest('div.group') as HTMLElement;
};

beforeEach(() => {
  localStorage.setItem('token', 'marketplace-token');
  localStorage.setItem('user', JSON.stringify({ _id: 'artisan-1', role: 'artisan' }));
  sessionStorage.clear();
  sessionStorage.setItem('artisan-sub-active', '1');
  server.use(
    http.get('*/api/products/marketplace', () => HttpResponse.json(produits)),
    http.get('*/api/projects*', () => HttpResponse.json([])),
    http.get('*/api/auth/me', () => HttpResponse.json({ subscription: { status: 'active' } }))
  );
});

afterEach(() => {
  allerSur('');
});

describe('ArtisanMarketplace — mode selection pour devis', () => {
  it('should show a checkbox per product when a quote draft is passed', async () => {
    allerSur('?quoteDraftId=draft-1');
    render(<ArtisanMarketplace />);
    await screen.findByTitle('Ciment Portland CPJ 45');

    expect(screen.getAllByRole('checkbox')).toHaveLength(produits.length);
  });

  it('should announce that it is selecting for a quote', async () => {
    allerSur('?quoteDraftId=draft-1');
    render(<ArtisanMarketplace />);

    expect(await screen.findByRole('heading', { name: /s[ée]lectionner des mat[ée]riaux pour le devis|select materials for the quote/i }))
      .toBeInTheDocument();
  });

  it('should keep the bar disabled until something is ticked', async () => {
    allerSur('?quoteDraftId=draft-1');
    render(<ArtisanMarketplace />);
    await screen.findByTitle('Ciment Portland CPJ 45');

    expect(screen.getByRole('button', { name: /ajouter les 0 produits au devis|add 0 products/i }))
      .toBeDisabled();
  });

  it('should let an out-of-stock product be picked in quote mode', async () => {
    // Un devis peut legitimement porter un produit qu'on commandera. Le badge
    // reste, mais il n'empeche plus la selection.
    allerSur('?quoteDraftId=draft-1');
    const user = userEvent.setup();
    render(<ArtisanMarketplace />);

    const carte = await carteDe('Fer à béton HA 12 mm');
    expect(within(carte).getByText(/rupture de stock|out of stock/i)).toBeInTheDocument();

    const caseACocher = within(carte).getByRole('checkbox');
    expect(caseACocher).toBeEnabled();
    await user.click(caseACocher);

    expect(screen.getByRole('button', { name: /ajouter les 1 produit/i })).toBeEnabled();
  });

  it('should still block an out-of-stock product outside quote mode', async () => {
    // Le comportement ordinaire du marketplace ne bouge pas : hors devis, on
    // ne met pas au panier ce qui n'est pas en stock.
    allerSur('');
    render(<ArtisanMarketplace />);

    const carte = await carteDe('Fer à béton HA 12 mm');
    expect(within(carte).getByRole('button', { name: /ajouter|add/i })).toBeDisabled();
    expect(within(carte).queryByRole('checkbox')).toBeNull();
  });

  it('should write the selection to sessionStorage and go back to the quote', async () => {
    allerSur('?quoteDraftId=draft-42');
    const user = userEvent.setup();
    render(<ArtisanMarketplace />);
    await screen.findByTitle('Ciment Portland CPJ 45');

    await user.click(within(await carteDe('Ciment Portland CPJ 45')).getByRole('checkbox'));
    await user.click(within(await carteDe('Sable lavé 0/4')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /ajouter les 2 produits au devis/i }));

    await waitFor(() => {
      const brut = sessionStorage.getItem(SELECTION_KEY);
      expect(brut).not.toBeNull();
      const charge = JSON.parse(brut as string);
      expect(charge.draftId).toBe('draft-42');
      expect(charge.produits.map((p: any) => p._id)).toEqual(['p1', 'p3']);
      // Juste ce qu'il faut pour batir une ligne, rien de plus.
      expect(Object.keys(charge.produits[0]).sort()).toEqual(['_id', 'category', 'name', 'price']);
      expect(typeof charge.timestamp).toBe('number');
    });
  });

  it('should write nothing when the artisan cancels', async () => {
    allerSur('?quoteDraftId=draft-42');
    const user = userEvent.setup();
    render(<ArtisanMarketplace />);
    await screen.findByTitle('Ciment Portland CPJ 45');

    await user.click(within(await carteDe('Ciment Portland CPJ 45')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /retour au devis|back to the quote/i }));

    expect(sessionStorage.getItem(SELECTION_KEY)).toBeNull();
  });

  it('should leave the ordinary marketplace untouched without a draft id', async () => {
    allerSur('');
    render(<ArtisanMarketplace />);
    await screen.findByTitle('Ciment Portland CPJ 45');

    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /au devis|to the quote/i })).toBeNull();
    expect(screen.getByRole('heading', { name: /^marketplace$/i })).toBeInTheDocument();
  });
});
