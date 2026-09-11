import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PlanRoomPicker from '@/components/artisan/PlanRoomPicker';

/**
 * Un plan porte les surfaces de tout le logement, un devis n'en couvre qu'une
 * partie. Ces tests portent sur le point qui compte : rien n'est somme sans un
 * geste explicite de l'artisan.
 */

const candidats = [
  { piece_index: 0, libelle: 'SALLE DE BAIN', valeur: 6.3, texte_source: 'SALLE DE BAIN 6,30 m2' },
  { piece_index: 1, libelle: 'WC', valeur: 2.1, texte_source: 'WC 2,10 m2' },
  { piece_index: 3, libelle: 'ENTREE', valeur: 4.1, texte_source: 'ENTREE 4,10 m2' },
];

const monter = (props: Partial<React.ComponentProps<typeof PlanRoomPicker>> = {}) =>
  render(
    <PlanRoomPicker
      candidats={candidats}
      onConfirm={() => {}}
      onSkip={() => {}}
      onBack={() => {}}
      {...props}
    />
  );

describe('PlanRoomPicker', () => {
  it('should list every room read, with its source text', () => {
    monter();

    expect(screen.getByText('SALLE DE BAIN')).toBeInTheDocument();
    expect(screen.getByText('WC')).toBeInTheDocument();
    expect(screen.getByText(/SALLE DE BAIN 6,30 m2/)).toBeInTheDocument();
  });

  it('should tick nothing by default', () => {
    // Pre-cocher proposerait un total que l'artisan validerait sans le lire.
    // Le devis serait faux et rien ne l'aurait alerte.
    monter();

    screen.getAllByRole('checkbox').forEach((c) => expect(c).not.toBeChecked());
    expect(screen.queryByTestId('plan-rooms-total')).not.toBeInTheDocument();
  });

  it('should keep the confirm button out of reach until something is ticked', () => {
    monter();

    expect(screen.getByRole('button', { name: /continuer|continue/i })).toBeDisabled();
  });

  it('should add up the ticked rooms', async () => {
    const user = userEvent.setup();
    monter();

    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getAllByRole('checkbox')[1]);

    // 6,30 + 2,10 — et pas 8,399999999 : le total est arrondi.
    expect(screen.getByTestId('plan-rooms-total')).toHaveTextContent('8,4 m²');
  });

  it('should hand over the total and the detail that composes it', async () => {
    // Le detail permet a l'artisan de retrouver d'ou vient le chiffre une fois
    // dans le formulaire, sans revenir en arriere.
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    monter({ onConfirm });

    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getAllByRole('checkbox')[2]);
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    expect(onConfirm).toHaveBeenCalledWith(12.5, 'SALLE DE BAIN 6,3 + WC 2,1 + ENTREE 4,1', [0, 1, 3]);
  });

  it('should report the rooms by their rank in the reading, not by row', async () => {
    // Les rangs servent a recouper d'autres champs calcules sur la meme
    // selection : une piece sans surface exploitable est absente de la liste,
    // donc le rang de ligne et le rang de lecture divergent.
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    monter({ onConfirm });

    await user.click(screen.getAllByRole('checkbox')[2]);
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    expect(onConfirm).toHaveBeenCalledWith(4.1, 'ENTREE 4,1', [3]);
  });

  it('should keep the plan order in the detail, whatever the ticking order', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    monter({ onConfirm });

    await user.click(screen.getAllByRole('checkbox')[2]);
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /continuer|continue/i }));

    expect(onConfirm).toHaveBeenCalledWith(10.4, 'SALLE DE BAIN 6,3 + ENTREE 4,1', [0, 3]);
  });

  it('should let a room be unticked', async () => {
    const user = userEvent.setup();
    monter();

    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getByRole('button', { name: /continuer|continue/i })).toBeDisabled();
  });

  it('should offer a way out for an artisan who wants to type the surface', async () => {
    // Sans cette porte de sortie, un artisan dont le chantier ne correspond a
    // aucune piece lue serait bloque sur cet ecran.
    const onSkip = vi.fn();
    const user = userEvent.setup();
    monter({ onSkip });

    await user.click(screen.getByRole('button', { name: /saisir moi-même|type it myself/i }));

    expect(onSkip).toHaveBeenCalled();
  });

  it('should go back when asked', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    monter({ onBack });

    await user.click(screen.getByRole('button', { name: /retour|back/i }));

    expect(onBack).toHaveBeenCalled();
  });

  it('should show the unit it was given', () => {
    monter({ unite: 'ml' });

    expect(screen.getByText(/6,3 ml/)).toBeInTheDocument();
  });
});
