/// <reference types="vitest/globals" />

/**
 * ════════════════════════════════════════════════════════════════════
 *  TEST SUITE #2 — Schémas de validation Zod
 *  Fichier source : src/lib/validations.ts
 * ════════════════════════════════════════════════════════════════════
 *
 *  Pourquoi tester les schémas Zod ?
 *  ──────────────────────────────────
 *  Les schémas Zod sont la couche de défense critique entre l'entrée
 *  utilisateur et le backend. Une validation incorrecte peut :
 *  - Laisser passer des données malformées vers l'API
 *  - Bloquer à tort des utilisateurs légitimes (UX cassée)
 *
 *  Ces règles métier (ex: "les mots de passe doivent correspondre",
 *  "le prénom ne peut contenir que des lettres") sont les plus
 *  importantes à protéger par des tests automatisés.
 *
 *  Stratégie de test :
 *  ───────────────────
 *  On utilise `safeParse()` (ne lance pas d'exception) puis on
 *  inspecte `result.success` et `result.error.issues`.
 *  Aucun mock nécessaire — logique 100% pure.
 *
 *  Note technique : Ce projet utilise Zod v4 (breaking change v3→v4).
 *  En v4, l'accès aux erreurs se fait via `.issues` (et non `.errors`).
 */

import {
  loginSchema,
  registerSchema,
  updatePasswordSchema,
  resetPasswordSchema,
} from '../validations';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrait tous les messages d'erreur d'un résultat safeParse() échoué.
 * Retourne un tableau de strings (ex: ["Email is required", "Passwords don't match"])
 */
function getErrors(result: ReturnType<typeof loginSchema.safeParse>): string[] {
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
}

// ══════════════════════════════════════════════════════════════════════════════
//  BLOC 1 : loginSchema
//  Règles : email valide obligatoire, mot de passe obligatoire
// ══════════════════════════════════════════════════════════════════════════════
describe('loginSchema — Validation du formulaire de connexion', () => {

  it('accepte des données valides', () => {
    const result = loginSchema.safeParse({
      email: 'ahmed@bmp.tn',
      password: 'secret123',
    });
    // Une donnée correcte doit toujours passer sans erreur
    expect(result.success).toBe(true);
  });

  it('rejette si l\'email est absent', () => {
    const result = loginSchema.safeParse({ email: '', password: 'secret123' });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain('Email is required');
  });

  it('rejette un email au format invalide', () => {
    // "not-an-email" n'a pas de @, ce n'est pas une adresse valide
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret123' });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain('Please enter a valid email address');
  });

  it('rejette si le mot de passe est absent', () => {
    const result = loginSchema.safeParse({ email: 'ahmed@bmp.tn', password: '' });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain('Password is required');
  });

  it('rejette si les deux champs sont absents', () => {
    const result = loginSchema.safeParse({ email: '', password: '' });
    expect(result.success).toBe(false);
    const errors = getErrors(result);
    // Les deux erreurs doivent être présentes simultanément
    expect(errors).toContain('Email is required');
    expect(errors).toContain('Password is required');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  BLOC 2 : registerSchema
//  Règles : firstName/lastName lettres uniquement + min 2 chars,
//           email valide, password ≥ 6 chars, passwords doivent correspondre
// ══════════════════════════════════════════════════════════════════════════════
describe('registerSchema — Validation du formulaire d\'inscription', () => {

  // Objet valide de référence : tous les champs corrects
  const validData = {
    firstName: 'Ahmed',
    lastName: 'Belhaj',
    email: 'ahmed@bmp.tn',
    password: 'password123',
    confirmPassword: 'password123',
  };

  it('accepte des données d\'inscription complètes et valides', () => {
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejette si les mots de passe ne correspondent pas', () => {
    // Règle métier critique : confirmPassword doit être identique à password
    const result = registerSchema.safeParse({
      ...validData,
      confirmPassword: 'different_password',
    });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain("Passwords don't match");
  });

  it('rejette un prénom contenant des chiffres', () => {
    // La regex /^[a-zA-Z\s]+$/ interdit les caractères non-alphabétiques
    const result = registerSchema.safeParse({
      ...validData,
      firstName: 'Ahmed123',
    });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain(
      'Only letters allowed, no numbers or special characters'
    );
  });

  it('rejette un prénom contenant des caractères spéciaux', () => {
    const result = registerSchema.safeParse({
      ...validData,
      firstName: 'Ahmed@!',
    });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain(
      'Only letters allowed, no numbers or special characters'
    );
  });

  it('rejette un prénom d\'un seul caractère (minimum 2)', () => {
    const result = registerSchema.safeParse({ ...validData, firstName: 'A' });
    expect(result.success).toBe(false);
    // La règle min(2) doit déclencher cette erreur
    expect(getErrors(result)).toContain('First name must be at least 2 characters');
  });

  it('rejette un mot de passe trop court (minimum 6 caractères)', () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: 'abc',
      confirmPassword: 'abc',
    });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain('Password must be at least 6 characters');
  });

  it('rejette un email invalide à l\'inscription', () => {
    const result = registerSchema.safeParse({
      ...validData,
      email: 'invalid-email',
    });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain('Please enter a valid email address');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  BLOC 3 : updatePasswordSchema
//  Règles : newPassword ≥ 6 chars, confirmPassword = newPassword,
//           newPassword ≠ currentPassword
// ══════════════════════════════════════════════════════════════════════════════
describe('updatePasswordSchema — Changement de mot de passe', () => {

  const validUpdate = {
    currentPassword: 'oldPassword1',
    newPassword: 'newPassword1',
    confirmPassword: 'newPassword1',
  };

  it('accepte un changement de mot de passe valide', () => {
    const result = updatePasswordSchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
  });

  it('rejette si les nouveaux mots de passe ne correspondent pas', () => {
    const result = updatePasswordSchema.safeParse({
      ...validUpdate,
      confirmPassword: 'wrongConfirm',
    });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain("Passwords don't match");
  });

  it('rejette si le nouveau mot de passe est identique à l\'ancien', () => {
    // Règle de sécurité : forcer l'utilisateur à choisir un vrai nouveau mdp
    const result = updatePasswordSchema.safeParse({
      currentPassword: 'samePassword',
      newPassword: 'samePassword',
      confirmPassword: 'samePassword',
    });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain(
      'New password must be different from current password'
    );
  });

  it('rejette si le nouveau mot de passe fait moins de 6 caractères', () => {
    const result = updatePasswordSchema.safeParse({
      currentPassword: 'oldPass',
      newPassword: 'abc',
      confirmPassword: 'abc',
    });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain('New password must be at least 6 characters');
  });

  it('rejette si le mot de passe actuel est vide', () => {
    const result = updatePasswordSchema.safeParse({
      ...validUpdate,
      currentPassword: '',
    });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain('Current password is required');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  BLOC 4 : resetPasswordSchema
//  Règles : password ≥ 6 chars, confirmPassword doit correspondre
// ══════════════════════════════════════════════════════════════════════════════
describe('resetPasswordSchema — Réinitialisation de mot de passe', () => {

  it('accepte un reset valide', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'newSecure123',
      confirmPassword: 'newSecure123',
    });
    expect(result.success).toBe(true);
  });

  it('rejette si les mots de passe ne correspondent pas', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'newSecure123',
      confirmPassword: 'different456',
    });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain("Passwords don't match");
  });

  it('rejette si le mot de passe fait moins de 6 caractères', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'abc',
      confirmPassword: 'abc',
    });
    expect(result.success).toBe(false);
    expect(getErrors(result)).toContain('Password must be at least 6 characters');
  });
});
