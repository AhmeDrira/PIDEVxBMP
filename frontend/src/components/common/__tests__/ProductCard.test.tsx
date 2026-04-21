/// <reference types="vitest/globals" />

/**
 * ════════════════════════════════════════════════════════════════════
 *  TEST SUITE #3 — Composant <ProductCard />
 *  Fichier source : src/components/common/ProductCard.tsx
 * ════════════════════════════════════════════════════════════════════
 *
 *  Pourquoi tester ProductCard ?
 *  ──────────────────────────────
 *  ProductCard est le composant "vitrine" central de la marketplace.
 *  Il contient :
 *    1. Un rendu basé sur des props (nom, prix, stock, fabricant...)
 *    2. Une logique conditionnelle sur le stock (3 niveaux de couleur)
 *    3. Deux handlers de click distincts (View Details / Add to Cart)
 *
 *  Toute régression ici est immédiatement visible par l'utilisateur.
 *
 *  Stratégie de test :
 *  ───────────────────
 *  - On rend le composant avec @testing-library/react
 *  - Le contexte LanguageContext fournit une valeur par défaut (language: 'fr')
 *    via le createContext → aucun Provider explicite nécessaire
 *  - On mock les handlers avec vi.fn() pour vérifier les appels
 *  - Pour les couleurs de stock, on inspecte le className du nœud DOM
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProductCard from '../ProductCard';

// ─── Props de base réutilisées dans tous les tests ────────────────────────────
const defaultProps = {
  id: 42,
  name: 'Ciment Portland CEM I',
  category: 'Ciment',
  price: 18.5,
  manufacturer: 'SOTACIB',
  stock: 100,
  image: '/uploads/products/ciment.jpg',
  rating: 4.7,
  onAddToCart: vi.fn(),    // mock Vitest — enregistre chaque appel
  onViewDetails: vi.fn(),  // mock Vitest — enregistre chaque appel
};

// Réinitialise les mocks avant chaque test pour éviter les interférences
beforeEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
//  BLOC 1 : Rendu des données produit (props → DOM)
// ══════════════════════════════════════════════════════════════════════════════
describe('ProductCard — Rendu des données produit', () => {

  it('affiche le nom du produit', () => {
    render(<ProductCard {...defaultProps} />);
    // Le nom doit apparaître dans un élément h3
    expect(screen.getByRole('heading', { name: /Ciment Portland CEM I/i })).toBeInTheDocument();
  });

  it('affiche le fabricant', () => {
    render(<ProductCard {...defaultProps} />);
    // Le nom du fabricant doit être visible
    expect(screen.getByText('SOTACIB')).toBeInTheDocument();
  });

  it('affiche le prix avec le suffixe TND', () => {
    render(<ProductCard {...defaultProps} />);
    // Le prix doit être formaté "18.5 TND"
    expect(screen.getByText('18.5 TND')).toBeInTheDocument();
  });

  it('affiche la note (rating)', () => {
    render(<ProductCard {...defaultProps} />);
    // La note 4.7 doit être visible
    expect(screen.getByText('4.7')).toBeInTheDocument();
  });

  it('affiche la catégorie dans le badge', () => {
    render(<ProductCard {...defaultProps} />);
    // La catégorie "Ciment" doit apparaître dans le badge superposé à l'image
    expect(screen.getByText('Ciment')).toBeInTheDocument();
  });

  it('affiche la quantité en stock', () => {
    render(<ProductCard {...defaultProps} />);
    // Le texte "{stock} units" doit être présent
    expect(screen.getByText('100 units')).toBeInTheDocument();
  });

  it('affiche le bouton "View Details"', () => {
    render(<ProductCard {...defaultProps} />);
    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  BLOC 2 : Logique de couleur du stock
//  Règle : stock > 50 → text-accent | 11-50 → text-secondary | ≤10 → text-destructive
// ══════════════════════════════════════════════════════════════════════════════
describe('ProductCard — Couleur du stock selon le niveau', () => {

  /**
   * Helper : rend le composant avec un stock donné et retourne
   * l'élément DOM affichant "{stock} units"
   */
  function renderAndGetStockElement(stock: number): HTMLElement {
    const { container } = render(
      <ProductCard {...defaultProps} stock={stock} />
    );
    // On cherche le paragraphe qui contient "units" (ex: "100 units")
    const stockEl = container.querySelector('p.text-sm.font-semibold');
    if (!stockEl) throw new Error('Élément de stock introuvable dans le rendu');
    return stockEl as HTMLElement;
  }

  it('applique text-accent quand le stock > 50 (niveau élevé)', () => {
    // Stock = 100 → classe "text-accent" (couleur verte du projet)
    const el = renderAndGetStockElement(100);
    expect(el.className).toContain('text-accent');
  });

  it('applique text-secondary quand le stock est entre 11 et 50 (niveau moyen)', () => {
    // Stock = 30 → classe "text-secondary" (couleur orange/warning)
    const el = renderAndGetStockElement(30);
    expect(el.className).toContain('text-secondary');
  });

  it('applique text-destructive quand le stock ≤ 10 (stock critique)', () => {
    // Stock = 5 → classe "text-destructive" (couleur rouge)
    const el = renderAndGetStockElement(5);
    expect(el.className).toContain('text-destructive');
  });

  it('applique text-destructive pour un stock exactement à 0', () => {
    // Stock = 0 → doit aussi afficher la couleur rouge (≤ 10)
    const el = renderAndGetStockElement(0);
    expect(el.className).toContain('text-destructive');
  });

  it('applique text-secondary pour un stock exactement à 10', () => {
    // Stock = 10 → 10 n'est PAS > 10, donc on passe au cas ≤ 10 → text-destructive
    // CORRECTION : stock > 10 est faux pour stock = 10, donc → text-destructive
    const el = renderAndGetStockElement(10);
    expect(el.className).toContain('text-destructive');
  });

  it('applique text-secondary pour un stock exactement à 11 (borne basse)', () => {
    // Stock = 11 → 11 > 10 est vrai → text-secondary
    const el = renderAndGetStockElement(11);
    expect(el.className).toContain('text-secondary');
  });

  it('applique text-accent pour un stock exactement à 51 (borne haute)', () => {
    // Stock = 51 → 51 > 50 est vrai → text-accent
    const el = renderAndGetStockElement(51);
    expect(el.className).toContain('text-accent');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  BLOC 3 : Interactions utilisateur (click handlers)
// ══════════════════════════════════════════════════════════════════════════════
describe('ProductCard — Interactions utilisateur', () => {

  it('appelle onViewDetails avec l\'id correct au clic sur "View Details"', () => {
    render(<ProductCard {...defaultProps} />);

    // Simule un clic sur le bouton "View Details"
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    // Le handler doit avoir été appelé exactement 1 fois avec l'id du produit
    expect(defaultProps.onViewDetails).toHaveBeenCalledTimes(1);
    expect(defaultProps.onViewDetails).toHaveBeenCalledWith(42);
  });

  it('appelle onAddToCart avec l\'id correct au clic sur le bouton panier', () => {
    render(<ProductCard {...defaultProps} />);

    // Le bouton "Add to Cart" n'a pas de texte visible (icône ShoppingCart seulement)
    // On le trouve via son rôle + le fait qu'il soit le 2ème bouton du composant
    const buttons = screen.getAllByRole('button');
    // buttons[0] = "View Details", buttons[1] = icône panier
    fireEvent.click(buttons[1]);

    expect(defaultProps.onAddToCart).toHaveBeenCalledTimes(1);
    expect(defaultProps.onAddToCart).toHaveBeenCalledWith(42);
  });

  it('n\'appelle pas onAddToCart quand on clique sur "View Details"', () => {
    render(<ProductCard {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    // S'assure que le mauvais handler n'est PAS déclenché
    expect(defaultProps.onAddToCart).not.toHaveBeenCalled();
  });

  it('n\'appelle pas onViewDetails quand on clique sur le bouton panier', () => {
    render(<ProductCard {...defaultProps} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);

    // S'assure que le mauvais handler n'est PAS déclenché
    expect(defaultProps.onViewDetails).not.toHaveBeenCalled();
  });

  it('transmet le bon id même quand plusieurs cartes sont rendues', () => {
    // Scénario réaliste : une liste de produits affiche plusieurs ProductCard
    const onViewDetails1 = vi.fn();
    const onViewDetails2 = vi.fn();

    const { getAllByRole } = render(
      <>
        <ProductCard {...defaultProps} id={1} onViewDetails={onViewDetails1} onAddToCart={vi.fn()} />
        <ProductCard {...defaultProps} id={2} onViewDetails={onViewDetails2} onAddToCart={vi.fn()} />
      </>
    );

    // Clique sur le 1er bouton "View Details" (appartient à la carte id=1)
    const viewButtons = getAllByRole('button', { name: /view details/i });
    fireEvent.click(viewButtons[0]);

    expect(onViewDetails1).toHaveBeenCalledWith(1);
    expect(onViewDetails2).not.toHaveBeenCalled();
  });
});
