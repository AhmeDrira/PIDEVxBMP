/// <reference types="vitest/globals" />

/**
 * ════════════════════════════════════════════════════════════════════
 *  TEST SUITE #1 — cn() : Utilitaire de fusion de classes Tailwind
 *  Fichier source : src/components/ui/utils.ts
 * ════════════════════════════════════════════════════════════════════
 *
 *  Pourquoi tester cn() ?
 *  ─────────────────────
 *  `cn()` est la fonction la plus utilisée dans tout le projet.
 *  Elle est appelée dans chaque composant Shadcn/UI pour combiner
 *  les classes conditionnelles. Une régression ici casse l'affichage
 *  de l'ensemble de l'application. C'est le premier test à avoir
 *  dans tout pipeline CI.
 *
 *  Stratégie de test :
 *  ───────────────────
 *  Fonction pure (input → output), aucun mock nécessaire.
 *  On couvre : fusion simple, résolution de conflits, valeurs falsy,
 *  syntaxe objet (clsx), tableaux, et entrée vide.
 */

import { cn } from '../utils';

describe('cn() — Utilitaire de fusion de classes Tailwind', () => {

  // ─── Cas de base ──────────────────────────────────────────────────

  it('fusionne plusieurs chaînes de classes sans conflit', () => {
    // Cas classique : deux classes différentes → les deux doivent apparaître
    expect(cn('px-2', 'py-3')).toBe('px-2 py-3');
  });

  it('retourne une chaîne vide si aucun argument n\'est fourni', () => {
    // S'assure qu'il n'y a pas d'erreur sur un appel vide
    expect(cn()).toBe('');
  });

  // ─── Résolution de conflits (rôle clé de tailwind-merge) ──────────

  it('résout les conflits de padding (le dernier argument gagne)', () => {
    // tailwind-merge doit détecter que px-2 et px-4 sont le même groupe
    // et ne garder que la dernière valeur
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('résout les conflits de couleur de texte', () => {
    // text-red-500 et text-blue-500 → seul text-blue-500 doit rester
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('résout les conflits de taille de police', () => {
    // text-sm puis text-lg → text-lg doit l'emporter
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  // ─── Valeurs falsy (intégration clsx) ────────────────────────────

  it('ignore les valeurs undefined et null', () => {
    // Pattern très courant : cn('base', condition && 'extra')
    // quand condition est false → cn('base', false) → doit retourner 'base'
    expect(cn('px-2', undefined, null)).toBe('px-2');
    expect(cn(undefined)).toBe('');
  });

  it('n\'ajoute pas la classe si la condition booléenne est false', () => {
    // Simule : cn('btn', isActive && 'btn-active') avec isActive = false
    const isActive = false;
    expect(cn('btn', isActive && 'btn-active')).toBe('btn');
  });

  it('ajoute bien la classe si la condition booléenne est true', () => {
    // Simule : cn('btn', isActive && 'btn-active') avec isActive = true
    const isActive = true;
    expect(cn('btn', isActive && 'btn-active')).toBe('btn btn-active');
  });

  // ─── Syntaxe objet (clsx) ─────────────────────────────────────────

  it('supporte la syntaxe objet { className: boolean }', () => {
    // clsx permet { 'text-red-500': true, 'text-blue-500': false }
    // Seul text-red-500 doit apparaître
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500');
  });

  it('supporte la syntaxe objet avec plusieurs classes actives', () => {
    expect(cn({ 'flex': true, 'items-center': true, 'hidden': false })).toBe('flex items-center');
  });

  // ─── Tableaux (clsx) ─────────────────────────────────────────────

  it('supporte les tableaux de classes', () => {
    // On peut passer un tableau au lieu de plusieurs arguments
    expect(cn(['px-2', 'py-3', 'rounded'])).toBe('px-2 py-3 rounded');
  });

  // ─── Combinaison avancée ──────────────────────────────────────────

  it('combine syntaxe objet, chaîne et tableau ensemble', () => {
    // Reproduit un usage réel dans les composants du projet
    const result = cn(
      'base-class',
      ['array-class'],
      { 'conditional-class': true, 'inactive-class': false }
    );
    expect(result).toBe('base-class array-class conditional-class');
  });
});
