import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '../../setup/mswServer';
import QuoteTemplateParams from '@/components/artisan/QuoteTemplateParams';

/**
 * Liste de murs du modele Peinture : un mur se saisit en m², ou en longueur
 * multipliee par une hauteur. Ces deux formes expriment la MEME grandeur, donc
 * basculer de l'une a l'autre ne doit rien perdre.
 */

const template = {
  id: 'peintre-piece-25m2',
  domain: 'Painting',
  title: 'Peinture intérieure',
  lines: [],
  parameters: [
    {
      key: 'murs',
      type: 'list',
      label: 'Murs à peindre',
      addLabel: 'Ajouter un mur',
      itemLabel: 'Mur',
      itemNameKey: 'nom',
      min: 1,
      default: [{ nom: 'Mur 1', mode: 'surface', surfaceM2: 25, longueurM: 0, hauteurM: 2.5 }],
      itemFields: [
        { key: 'nom', label: 'Nom du mur', type: 'text', default: '' },
        {
          key: 'mode', label: 'Saisie', type: 'select', default: 'surface',
          options: [
            { value: 'surface', label: 'Surface (m²)' },
            { value: 'longueur', label: 'Longueur × hauteur' },
          ],
        },
        {
          key: 'surfaceM2', label: 'Surface du mur', type: 'number', unit: 'm²',
          min: 0, step: 0.1, default: 0,
          showIf: { key: 'mode', equals: 'surface' },
          derivedFrom: { multiply: ['longueurM', 'hauteurM'] },
        },
        {
          key: 'longueurM', label: 'Longueur', type: 'number', unit: 'ml',
          min: 0, step: 0.1, default: 0,
          showIf: { key: 'mode', equals: 'longueur' },
          derivedFrom: { divide: ['surfaceM2', 'hauteurM'] },
        },
        {
          key: 'hauteurM', label: 'Hauteur sous plafond', type: 'number', unit: 'ml',
          min: 0, step: 0.05, default: 2.5,
          showIf: { key: 'mode', equals: 'longueur' },
        },
      ],
    },
  ],
} as any;

const monter = (props: any = {}) =>
  render(<QuoteTemplateParams template={template} onGenerated={() => {}} onBack={() => {}} {...props} />);

/** Le sélecteur « Saisie » du mur n° index. */
const selecteurMode = (index = 0) => screen.getAllByLabelText(/^saisie$/i)[index];

beforeEach(() => {
  localStorage.setItem('token', 'params-token');
});

describe('QuoteTemplateParams - liste de murs', () => {
  it('should start with one wall entered as a surface', () => {
    monter();

    expect(screen.getByLabelText(/surface du mur/i)).toHaveValue(25);
    expect(screen.queryByLabelText(/^longueur \(/i)).not.toBeInTheDocument();
  });

  it('should let the artisan add and remove walls', async () => {
    const user = userEvent.setup();
    monter();

    await user.click(screen.getByRole('button', { name: /ajouter un mur|add an item/i }));
    expect(screen.getAllByLabelText(/surface du mur/i)).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /supprimer.*mur 2|remove.*mur 2/i }));
    expect(screen.getAllByLabelText(/surface du mur/i)).toHaveLength(1);
  });

  it('should convert a length × height wall into its surface', async () => {
    // Le cas signale : 3,56 ml sous 2,50 m valent 8,9 m², pas 0.
    const user = userEvent.setup();
    monter();

    await user.selectOptions(selecteurMode(), 'longueur');
    const longueur = screen.getByLabelText(/^longueur \(/i);
    await user.clear(longueur);
    await user.type(longueur, '3.56');
    expect(screen.getByLabelText(/hauteur sous plafond/i)).toHaveValue(2.5);

    await user.selectOptions(selecteurMode(), 'surface');

    expect(screen.getByLabelText(/surface du mur/i)).toHaveValue(8.9);
  });

  it('should convert a surface back into a length', async () => {
    // Sens inverse : 25 m² sous 2,50 m redonnent 10 ml.
    const user = userEvent.setup();
    monter();

    await user.selectOptions(selecteurMode(), 'longueur');

    expect(screen.getByLabelText(/^longueur \(/i)).toHaveValue(10);
    expect(screen.getByLabelText(/hauteur sous plafond/i)).toHaveValue(2.5);
  });

  it('should survive a round trip in both directions', async () => {
    const user = userEvent.setup();
    monter();

    // m² -> longueur -> m² : on retrouve la valeur de depart.
    await user.selectOptions(selecteurMode(), 'longueur');
    expect(screen.getByLabelText(/^longueur \(/i)).toHaveValue(10);

    await user.selectOptions(selecteurMode(), 'surface');
    expect(screen.getByLabelText(/surface du mur/i)).toHaveValue(25);
  });

  it('should not reset the length and height when switching away and back', async () => {
    // Meme sans conversion, revenir en arriere ne doit rien effacer.
    const user = userEvent.setup();
    monter();

    await user.selectOptions(selecteurMode(), 'longueur');
    const longueur = screen.getByLabelText(/^longueur \(/i);
    await user.clear(longueur);
    await user.type(longueur, '4.2');
    const hauteur = screen.getByLabelText(/hauteur sous plafond/i);
    await user.clear(hauteur);
    await user.type(hauteur, '2.7');

    await user.selectOptions(selecteurMode(), 'surface');
    await user.selectOptions(selecteurMode(), 'longueur');

    expect(screen.getByLabelText(/^longueur \(/i)).toHaveValue(4.2);
    expect(screen.getByLabelText(/hauteur sous plafond/i)).toHaveValue(2.7);
  });

  it('should follow the last value entered, not a stale one', async () => {
    // Le champ masque est perime par construction : le garder afficherait
    // deux chiffres contradictoires pour un seul mur.
    const user = userEvent.setup();
    monter();

    await user.selectOptions(selecteurMode(), 'longueur');
    const longueur = screen.getByLabelText(/^longueur \(/i);
    await user.clear(longueur);
    await user.type(longueur, '3');

    await user.selectOptions(selecteurMode(), 'surface');
    // 3 x 2,5, et non les 25 m² du depart.
    expect(screen.getByLabelText(/surface du mur/i)).toHaveValue(7.5);

    const surface = screen.getByLabelText(/surface du mur/i);
    await user.clear(surface);
    await user.type(surface, '12');
    await user.selectOptions(selecteurMode(), 'longueur');

    // L'artisan a dit « 12 m² » en dernier : la longueur suit.
    expect(screen.getByLabelText(/^longueur \(/i)).toHaveValue(4.8);
  });

  it('should leave the field untouched when the conversion is impossible', async () => {
    // Hauteur a zero : multiplier donnerait 0, ce qui effacerait la saisie
    // sans le dire. On prefere ne rien ecrire.
    const user = userEvent.setup();
    monter();

    await user.selectOptions(selecteurMode(), 'longueur');
    const hauteur = screen.getByLabelText(/hauteur sous plafond/i);
    await user.clear(hauteur);
    await user.type(hauteur, '0');

    await user.selectOptions(selecteurMode(), 'surface');

    // La surface de depart est conservee telle quelle, pas remise a zero.
    expect(screen.getByLabelText(/surface du mur/i)).toHaveValue(25);
  });

  it('should convert each wall independently', async () => {
    const user = userEvent.setup();
    monter();

    await user.click(screen.getByRole('button', { name: /ajouter un mur|add an item/i }));
    // Le second mur part du defaut du modele, pas de la valeur du premier.
    const surfaces = screen.getAllByLabelText(/surface du mur/i);
    await user.clear(surfaces[1]);
    await user.type(surfaces[1], '5');

    await user.selectOptions(selecteurMode(1), 'longueur');

    // Seul le second bascule ; le premier garde ses 25 m².
    expect(screen.getByLabelText(/^longueur \(/i)).toHaveValue(2);
    expect(screen.getByLabelText(/surface du mur/i)).toHaveValue(25);
  });

  it('should keep a prefilled wall list convertible', async () => {
    // Les murs venant d'une lecture de plan arrivent en longueur x hauteur :
    // ils doivent se convertir comme les autres.
    const user = userEvent.setup();
    monter({
      prefill: {
        murs: {
          value: [{ nom: 'Mur 3,56 m (1/2)', mode: 'longueur', surfaceM2: 0, longueurM: 3.56, hauteurM: 2.5 }],
          hint: 'Estimation — à vérifier',
        },
      },
    });

    expect(screen.getByLabelText(/^longueur \(/i)).toHaveValue(3.56);
    await user.selectOptions(selecteurMode(), 'surface');

    expect(screen.getByLabelText(/surface du mur/i)).toHaveValue(8.9);
  });
});

describe('QuoteTemplateParams - nom de chaque mur', () => {
  const nomsAffiches = () =>
    (screen.getAllByLabelText(/nom du mur/i) as HTMLInputElement[]).map((i) => i.value);

  it('should replace the numbered label with an editable name', () => {
    monter();

    const champ = screen.getByLabelText(/nom du mur/i);
    expect(champ.tagName).toBe('INPUT');
    expect(champ).toHaveValue('Mur 1');
  });

  it('should let the artisan rename a wall freely', async () => {
    // L'orientation reelle, l'artisan est le seul a la connaitre sur place.
    const user = userEvent.setup();
    monter();

    const champ = screen.getByLabelText(/nom du mur/i);
    await user.clear(champ);
    await user.type(champ, 'Mur côté fenêtre');

    expect(champ).toHaveValue('Mur côté fenêtre');
  });

  it('should number a manually added wall sequentially', async () => {
    const user = userEvent.setup();
    monter();

    await user.click(screen.getByRole('button', { name: /ajouter un mur|add an item/i }));
    await user.click(screen.getByRole('button', { name: /ajouter un mur|add an item/i }));

    expect(nomsAffiches()).toEqual(['Mur 1', 'Mur 2', 'Mur 3']);
  });

  it('should keep each name with its own wall when one is removed', async () => {
    // Le nom vit dans l'element : il suit son mur, il ne suit pas le rang.
    const user = userEvent.setup();
    monter();

    await user.click(screen.getByRole('button', { name: /ajouter un mur|add an item/i }));
    await user.click(screen.getByRole('button', { name: /ajouter un mur|add an item/i }));

    const champs = screen.getAllByLabelText(/nom du mur/i);
    await user.clear(champs[1]);
    await user.type(champs[1], 'Mur du couloir');

    // On supprime le premier : les deux autres gardent leur nom.
    await user.click(screen.getAllByRole('button', { name: /supprimer/i })[0]);

    expect(nomsAffiches()).toEqual(['Mur du couloir', 'Mur 3']);
  });

  it('should not reuse a name already taken after a removal', async () => {
    // Supprimer le mur 2 puis en ajouter un doit donner « Mur 4 », pas un
    // second « Mur 3 » — renumeroter ecraserait les noms saisis a la main.
    const user = userEvent.setup();
    monter();

    await user.click(screen.getByRole('button', { name: /ajouter un mur|add an item/i }));
    await user.click(screen.getByRole('button', { name: /ajouter un mur|add an item/i }));
    await user.click(screen.getAllByRole('button', { name: /supprimer/i })[1]);
    await user.click(screen.getByRole('button', { name: /ajouter un mur|add an item/i }));

    expect(nomsAffiches()).toEqual(['Mur 1', 'Mur 3', 'Mur 4']);
  });

  it('should keep the name out of the values sent for computing', async () => {
    // Le nom sert a s'y retrouver ; le calcul travaille sur des surfaces.
    let recu: any = null;
    server.use(http.post('*/api/quotes/templates/:id/compute', async ({ request }) => {
      recu = await request.json();
      return HttpResponse.json({ id: template.id, title: template.title, lines: [] });
    }));

    const user = userEvent.setup();
    monter();
    await user.click(screen.getByRole('button', { name: /g[ée]n[ée]rer/i }));

    await waitFor(() => expect(recu).not.toBeNull());
    expect(recu.murs[0]).not.toHaveProperty('nom');
    expect(recu.murs[0]).toHaveProperty('surfaceM2');
  });

  it('should name a prefilled wall after the dimension that was read', () => {
    // Jamais une orientation : « (1/2) » distingue les deux murs d'une paire
    // sans rien affirmer sur leur position.
    monter({
      prefill: {
        murs: {
          value: [
            { nom: 'Mur 3,56 m (1/2)', mode: 'longueur', surfaceM2: 0, longueurM: 3.56, hauteurM: 2.5 },
            { nom: 'Mur 3,56 m (2/2)', mode: 'longueur', surfaceM2: 0, longueurM: 3.56, hauteurM: 2.5 },
            { nom: 'Mur 2,90 m (1/2)', mode: 'longueur', surfaceM2: 0, longueurM: 2.9, hauteurM: 2.5 },
            { nom: 'Mur 2,90 m (2/2)', mode: 'longueur', surfaceM2: 0, longueurM: 2.9, hauteurM: 2.5 },
          ],
          hint: 'Estimation — à vérifier',
        },
      },
    });

    expect(nomsAffiches()).toEqual([
      'Mur 3,56 m (1/2)', 'Mur 3,56 m (2/2)', 'Mur 2,90 m (1/2)', 'Mur 2,90 m (2/2)',
    ]);
    // Aucune orientation devinee.
    expect(screen.queryByDisplayValue(/gauche|droit|nord|sud/i)).toBeNull();
  });

  it('should target the right wall when removing, by name', async () => {
    const user = userEvent.setup();
    monter();

    await user.click(screen.getByRole('button', { name: /ajouter un mur|add an item/i }));

    // Le bouton de suppression nomme le mur qu'il retire.
    expect(screen.getByRole('button', { name: /supprimer mur 2/i })).toBeInTheDocument();
  });
});
