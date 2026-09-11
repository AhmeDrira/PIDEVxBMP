import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import { Input, stripLeadingZeros } from '@/components/ui/input';

/**
 * Un champ numerique initialise a 0 affiche « 0 ». Sans precaution, la frappe
 * s'INSERE au lieu de remplacer : « 55 » devenait « 055 », et le prix du devis
 * etait faux sans que rien ne le signale.
 *
 * Deux protections, testees ici : la selection du contenu a la prise de focus,
 * et la normalisation de la valeur au changement. La seconde existe parce que
 * la premiere ne couvre pas tout — collage, dictee, ou navigateur qui refuse
 * `select()` sur un champ numerique.
 */

/** Cablage de la colonne « Prix unitaire » : la valeur est un nombre. */
function ChampNombre({ initial = 0 }: { initial?: number }) {
  const [valeur, setValeur] = useState(initial);
  return (
    <Input
      aria-label="Prix unitaire"
      type="number"
      min="0"
      step="0.01"
      value={valeur}
      onChange={(e) => setValeur(Number(e.target.value))}
    />
  );
}

/** Cablage de QuoteTemplateParams : la valeur est une CHAINE, non convertie. */
function ChampChaine({ initial = '0' }: { initial?: string }) {
  const [valeur, setValeur] = useState(initial);
  return (
    <Input
      aria-label="Surface du mur"
      type="number"
      value={valeur}
      onChange={(e) => setValeur(e.target.value)}
    />
  );
}

function ChampTexte() {
  const [valeur, setValeur] = useState('Mme Ben Ali');
  return <Input aria-label="Nom du client" value={valeur} onChange={(e) => setValeur(e.target.value)} />;
}

describe('stripLeadingZeros', () => {
  it.each([
    ['055', '55'],
    ['0123', '123'],
    ['00', '0'],
    ['0055', '55'],
    ['-055', '-55'],
  ])('normalises %s into %s', (entree, attendu) => {
    expect(stripLeadingZeros(entree)).toBe(attendu);
  });

  it.each(['0', '0.5', '0,5', '0.05', '5', '', '12.5'])(
    'leaves %s untouched',
    (valeur) => {
      // Casser « 0,5 » rendrait tout champ sous l'unite impossible a remplir.
      expect(stripLeadingZeros(valeur)).toBe(valeur);
    }
  );
});

describe('Input numerique — la frappe remplace le zero', () => {
  it('should end up at 55, never 055, on a number-backed field', async () => {
    // Le cas signale, sur la colonne « Prix unitaire ».
    const user = userEvent.setup();
    render(<ChampNombre />);
    const champ = screen.getByLabelText('Prix unitaire') as HTMLInputElement;

    await user.click(champ);
    await user.type(champ, '55');

    expect(champ.value).toBe('55');
    expect(champ.value).not.toBe('055');
  });

  it('should end up at 55, never 055, on a string-backed field', async () => {
    // Les champs de QuoteTemplateParams ne convertissent pas en nombre : sans
    // normalisation, « 055 » y resterait tel quel jusqu'a l'envoi.
    const user = userEvent.setup();
    render(<ChampChaine />);
    const champ = screen.getByLabelText('Surface du mur') as HTMLInputElement;

    await user.click(champ);
    await user.type(champ, '55');

    expect(champ.value).toBe('55');
  });

  it('should select the whole content when a numeric field takes focus', async () => {
    // C'est ce qui fait que la premiere touche remplace au lieu d'inserer.
    const user = userEvent.setup();
    render(<ChampNombre initial={42} />);
    const champ = screen.getByLabelText('Prix unitaire') as HTMLInputElement;
    const select = vi.spyOn(champ, 'select');

    await user.click(champ);

    expect(select).toHaveBeenCalled();
  });

  it('should still let a decimal below one be typed', async () => {
    // « 0,5 » commence par un zero legitime : le normaliser le rendrait
    // impossible a saisir.
    const user = userEvent.setup();
    render(<ChampChaine initial="" />);
    const champ = screen.getByLabelText('Surface du mur') as HTMLInputElement;

    await user.click(champ);
    await user.type(champ, '0.5');

    expect(champ.value).toBe('0.5');
  });

  it('should normalise a pasted value too', async () => {
    // La selection au focus ne couvre pas le collage.
    const user = userEvent.setup();
    render(<ChampChaine initial="" />);
    const champ = screen.getByLabelText('Surface du mur') as HTMLInputElement;

    await user.click(champ);
    await user.paste('0075');

    expect(champ.value).toBe('75');
  });

  it('should leave text fields alone', async () => {
    // Selectionner tout le nom d'un client a chaque clic empecherait de le
    // corriger d'un seul caractere.
    const user = userEvent.setup();
    render(<ChampTexte />);
    const champ = screen.getByLabelText('Nom du client') as HTMLInputElement;
    const select = vi.spyOn(champ, 'select');

    await user.click(champ);

    expect(select).not.toHaveBeenCalled();
    expect(champ.value).toBe('Mme Ben Ali');
  });

  it('should keep calling the caller own focus handler', async () => {
    const onFocus = vi.fn();
    const user = userEvent.setup();
    render(<Input aria-label="Quantité" type="number" defaultValue={0} onFocus={onFocus} />);

    await user.click(screen.getByLabelText('Quantité'));

    expect(onFocus).toHaveBeenCalled();
  });

  it('should survive an engine that refuses select() on a number field', async () => {
    // `setSelectionRange` leve deja sur un input numerique ; on ne laisse pas
    // une exception casser la prise de focus.
    const user = userEvent.setup();
    render(<ChampNombre />);
    const champ = screen.getByLabelText('Prix unitaire') as HTMLInputElement;
    vi.spyOn(champ, 'select').mockImplementation(() => {
      throw new Error('select() ne s applique pas a ce type');
    });

    await user.click(champ);
    await user.type(champ, '7');

    // Le champ reste utilisable, et la normalisation prend le relais.
    expect(champ.value).toBe('7');
  });
});
