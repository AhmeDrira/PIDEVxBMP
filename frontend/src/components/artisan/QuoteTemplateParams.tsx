import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowRight, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useLanguage } from '../../context/LanguageContext';
// Depuis le module de types, jamais depuis la galerie : lire ses exports
// creerait un cycle entre les deux composants.
import type {
  QuoteTemplate,
  QuoteTemplateLine,
  QuoteTemplateParam,
  QuoteTemplateParamOption,
  ItemValues,
  ParamValue,
  PrefilledField,
} from './quoteTemplateTypes';

export type {
  QuoteTemplateParam,
  QuoteTemplateParamOption,
  ItemValues,
  ParamValue,
  PrefilledField,
} from './quoteTemplateTypes';

/**
 * Formulaire de parametres d'un modele auto-calcule.
 *
 * Certains modeles metier ne livrent pas une liste de lignes figee : ils
 * exposent un bloc `parameters` (backend/utils/quoteTemplates.js) decrivant les
 * quelques valeurs dont depend le chiffrage. Ce composant rend ce formulaire
 * puis appelle POST /api/quotes/templates/:id/compute, qui renvoie les lignes.
 *
 * Le formulaire est entierement pilote par les donnees : ajouter un metier
 * auto-calcule cote backend suffit, il n'y a rien a ecrire ici.
 *
 * Les lignes obtenues sont un point de depart — elles restent editables dans le
 * formulaire de devis, exactement comme celles d'un modele fige.
 */

interface QuoteTemplateParamsProps {
  template: QuoteTemplate;
  onGenerated: (template: QuoteTemplate, lines: QuoteTemplateLine[]) => void;
  onBack: () => void;
  /**
   * Libelle du bouton de retour. Il doit nommer la destination reelle, qui
   * depend du parcours : la galerie de modeles en « devis pret », les mesures
   * du plan quand on arrive depuis un import. Un libelle fige annoncerait la
   * mauvaise page a la moitie des artisans.
   */
  backLabel?: string;
  /**
   * Valeurs de depart, indexees par cle de champ. Absente sur le chemin
   * « devis pret », ou le formulaire reste purement manuel.
   */
  prefill?: Record<string, PrefilledField>;
  /**
   * Renseignements affiches a cote d'un champ, indexes par cle. Ils
   * n'ecrivent RIEN dans le formulaire : ce sont des informations dont
   * l'artisan se sert pour saisir lui-meme, quand la valeur ne peut pas etre
   * deduite de facon sure.
   */
  notes?: Record<string, string>;
  /**
   * Donnee absente du plan, sans laquelle une liste ne peut pas etre calculee.
   *
   * Le composant affiche un rappel et un champ de saisie a cote du parametre
   * vise ; il ne sait pas ce que la valeur signifie. C'est l'appelant qui,
   * via `buildItems`, dit quoi en faire — ici : batir les quatre murs d'une
   * piece dont le plan donne la longueur et la largeur mais pas la hauteur.
   *
   * Jamais bloquant : ignorer le champ laisse la liste telle quelle.
   */
  missingInput?: {
    /** Cle du parametre `list` concerne. */
    champ: string;
    message: string;
    label: string;
    placeholder?: string;
    unit?: string;
    /** Reserve a afficher une fois la valeur saisie. */
    caveat?: string;
    /** Elements a poser dans la liste, ou null si la valeur ne suffit pas. */
    buildItems: (valeur: number) => Array<Record<string, string | number>> | null;
  };
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => {
  const direct = localStorage.getItem('token');
  if (direct) return direct;
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').token || null;
  } catch {
    return null;
  }
};

export default function QuoteTemplateParams({
  template,
  onGenerated,
  onBack,
  backLabel,
  prefill,
  notes,
  missingInput,
}: QuoteTemplateParamsProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    (language === 'ar' ? ar : language === 'fr' ? fr : en);

  const parameters = useMemo<QuoteTemplateParam[]>(
    () => (Array.isArray(template.parameters) ? template.parameters : []),
    [template]
  );

  /** Valeurs initiales des sous-champs d'un element de liste. */
  const buildItem = (fields: QuoteTemplateParam[]): ItemValues => {
    const item: ItemValues = {};
    fields.forEach((field) => {
      item[field.key] = String(field.default ?? '');
    });
    return item;
  };

  /** Valeurs initiales : les defauts declares par le backend. */
  const [values, setValues] = useState<Record<string, ParamValue>>(() => {
    const initial: Record<string, ParamValue> = {};
    parameters.forEach((param) => {
      if (param.type === 'list') {
        // Une liste pre-remplie remplace les elements par defaut : sur un
        // parcours « depuis un plan », les murs proposes sont ceux de la
        // piece lue, pas le mur type du modele.
        const prefilledList = prefill && prefill[param.key];
        const fromPrefill = prefilledList && Array.isArray(prefilledList.value)
          ? prefilledList.value
          : null;
        const declared = fromPrefill || (Array.isArray(param.default) ? param.default : []);
        initial[param.key] = declared.length > 0
          ? declared.map((item) => ({ ...item }))
          : [buildItem(param.itemFields || [])];
      } else {
        // Une valeur pre-remplie prend le pas sur le defaut du modele.
        const prefilled = prefill && prefill[param.key];
        initial[param.key] = prefilled
          ? String(prefilled.value)
          : String(param.default ?? '');
      }
    });
    return initial;
  });

  /**
   * Valeur saisie dans le rappel de donnee manquante.
   *
   * Volontairement vide au depart : proposer « 2,50 » reviendrait a supposer
   * une hauteur a la place de l'artisan, ce que toute cette fonctionnalite
   * s'interdit. Le format attendu passe par le placeholder.
   */
  const [missingValue, setMissingValue] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  /**
   * Champs encore porteurs de leur valeur pre-remplie. Des que l'artisan en
   * corrige un, il sort de cette liste : l'indice ne decrirait plus la valeur
   * affichee.
   */
  const [champsPrefilles, setChampsPrefilles] = useState<string[]>(
    () => Object.keys(prefill || {})
  );


  /**
   * Un champ est pertinent si sa condition est remplie. Le contexte est le
   * formulaire pour un champ de premier niveau, l'element pour un sous-champ.
   */
  const isVisible = (param: QuoteTemplateParam, context: Record<string, ParamValue>) =>
    !param.showIf || context[param.showIf.key] === param.showIf.equals;

  const visibleParameters = parameters.filter((param) => isVisible(param, values));

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Une saisie manuelle reprend la main : l'indice ne vaut plus.
    setChampsPrefilles((prev) => prev.filter((k) => k !== key));
    setError('');
  };

  /** Elements d'une liste, toujours sous forme de tableau. */
  const itemsOf = (key: string): ItemValues[] => {
    const value = values[key];
    return Array.isArray(value) ? value : [];
  };

  /**
   * Nom sequentiel libre pour un element ajoute a la main : « Mur 3 ».
   *
   * On evite les doublons plutot que de renumeroter : supprimer le mur 2 puis
   * en ajouter un doit donner « Mur 4 », pas un second « Mur 3 ». Renumeroter
   * ecraserait aussi les noms que l'artisan a lui-meme saisis.
   */
  const nomSequentiel = (param: QuoteTemplateParam, items: ItemValues[]) => {
    const prefixe = param.itemLabel || tr('Item', 'Élément', 'عنصر');
    const cle = param.itemNameKey as string;
    const pris = new Set(items.map((item) => String(item[cle] || '')));
    let n = items.length + 1;
    while (pris.has(`${prefixe} ${n}`)) n += 1;
    return `${prefixe} ${n}`;
  };

  /**
   * Applique la donnee manquante des qu'elle est exploitable.
   *
   * Le remplacement est integral : les elements calcules decrivent la meme
   * piece, les melanger avec ceux d'un essai precedent donnerait un total
   * compte deux fois.
   */
  const handleMissingValue = (brut: string) => {
    setMissingValue(brut);
    if (!missingInput) return;

    const valeur = Number(String(brut).replace(',', '.'));
    if (!Number.isFinite(valeur) || valeur <= 0) return;

    const items = missingInput.buildItems(valeur);
    if (!items || items.length === 0) return;

    setValues((prev) => ({
      ...prev,
      [missingInput.champ]: items.map((item) => ({ ...item })) as ItemValues[],
    }));
    setError('');
  };

  const addItem = (param: QuoteTemplateParam) => {
    setValues((prev) => {
      const items = Array.isArray(prev[param.key]) ? (prev[param.key] as ItemValues[]) : [];
      const nouveau = buildItem(param.itemFields || []);
      if (param.itemNameKey) {
        nouveau[param.itemNameKey] = nomSequentiel(param, items);
      }
      return { ...prev, [param.key]: [...items, nouveau] };
    });
    setError('');
  };

  const removeItem = (key: string, index: number) => {
    setValues((prev) => ({
      ...prev,
      [key]: itemsOf(key).filter((_, i) => i !== index),
    }));
    setError('');
  };

  /**
   * Valeur d'un champ deduite de ses voisins, ou null si le calcul n'a pas de
   * sens — voisin absent, ou division par zero.
   */
  const derive = (field: QuoteTemplateParam, item: ItemValues): number | null => {
    const regle = field.derivedFrom;
    if (!regle) return null;

    const nombre = (cle: string) => Number(item[cle]);

    if (regle.multiply) {
      const facteurs = regle.multiply.map(nombre);
      if (facteurs.some((n) => !Number.isFinite(n) || n <= 0)) return null;
      return facteurs.reduce((produit, n) => produit * n, 1);
    }

    if (regle.divide) {
      const [numerateur, denominateur] = regle.divide.map(nombre);
      if (!Number.isFinite(numerateur) || numerateur <= 0) return null;
      if (!Number.isFinite(denominateur) || denominateur <= 0) return null;
      return numerateur / denominateur;
    }

    return null;
  };

  /**
   * Applique un changement a un element de liste.
   *
   * Quand la modification fait APPARAITRE un champ jusque-la masque — typique
   * d'un basculement « m² » / « longueur x hauteur » — ce champ reprend
   * l'equivalent de ce qui etait deja saisi, au lieu de repartir de zero.
   * L'artisan qui a entre 3,56 ml sous 2,50 m voit bien 8,9 m², et non 0.
   *
   * Le recalcul est systematique, y compris sur un champ deja renseigne : les
   * deux modes expriment la MEME grandeur, donc la valeur du champ masque est
   * perimee par construction. La garder produirait deux chiffres contradictoires
   * pour un seul mur, celui affiche ne correspondant plus a la derniere saisie.
   *
   * Seule exception : un calcul impossible — voisin absent ou hauteur nulle.
   * On laisse alors le champ tel quel plutot que d'ecrire un zero ou un NaN.
   */
  const updateItem = (param: QuoteTemplateParam, index: number, patch: ItemValues) => {
    const fields = param.itemFields || [];

    setValues((prev) => ({
      ...prev,
      [param.key]: itemsOf(param.key).map((item, i) => {
        if (i !== index) return item;

        const suivant: ItemValues = { ...item, ...patch };

        fields.forEach((field) => {
          if (!field.derivedFrom) return;
          // Uniquement a l'apparition : sinon on recalculerait le champ a
          // chaque frappe et l'artisan ne pourrait plus le corriger.
          if (isVisible(field, item)) return;
          if (!isVisible(field, suivant)) return;

          const valeur = derive(field, suivant);
          if (valeur === null) return;
          suivant[field.key] = String(Math.round(valeur * 100) / 100);
        });

        return suivant;
      }),
    }));
    setError('');
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const token = getToken();
      // Les champs numeriques repartent en nombre : le backend refuse une chaine.
      // Un champ masque n'est pas envoye : le backend applique son propre defaut.
      const typed = (param: QuoteTemplateParam, raw: string) =>
        (param.type === 'number' ? Number(raw) : raw);

      const payload: Record<string, unknown> = {};
      visibleParameters.forEach((param) => {
        if (param.type === 'list') {
          const fields = param.itemFields || [];
          payload[param.key] = itemsOf(param.key).map((item) => {
            const encoded: Record<string, string | number> = {};
            fields
              // Le nom sert a s'y retrouver dans le formulaire ; le calcul
              // travaille sur des surfaces. Rien a en faire cote serveur.
              .filter((field) => field.key !== param.itemNameKey)
              .filter((field) => isVisible(field, item))
              .forEach((field) => {
                encoded[field.key] = typed(field, item[field.key]);
              });
            return encoded;
          });
        } else {
          payload[param.key] = typed(param, String(values[param.key] ?? ''));
        }
      });

      const { data } = await axios.post(
        `${API_URL}/quotes/templates/${template.id}/compute`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const lines = Array.isArray(data?.lines) ? data.lines : [];
      if (lines.length === 0) {
        setError(tr('No line could be computed.', 'Aucune ligne n\'a pu être calculée.', 'تعذر حساب أي سطر.'));
        return;
      }
      onGenerated(template, lines);
    } catch (err: any) {
      setError(
        err?.response?.data?.message
          || tr('Lines could not be computed.', 'Le calcul des lignes a échoué.', 'فشل حساب السطور.')
      );
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Rend un champ scalaire. Sert aussi bien aux parametres de premier niveau
   * qu'aux sous-champs d'un element de liste : seuls l'identifiant, la valeur
   * et le callback changent.
   */
  const renderScalarField = (
    param: QuoteTemplateParam,
    inputId: string,
    value: string,
    onChange: (next: string) => void
  ) => (
    <div key={inputId} className="space-y-2">
      <Label htmlFor={inputId} className="text-sm font-semibold text-foreground">
        {param.label}
        {param.unit ? ` (${param.unit})` : ''}
      </Label>

      {param.type === 'text' ? (
        <Input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-lg border border-border bg-card shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : param.type === 'number' ? (
        <Input
          id={inputId}
          type="number"
          min={param.min}
          step={param.step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-lg border border-border bg-card shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {(param.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {champsPrefilles.includes(param.key) && (
        <p className="text-xs font-medium text-blue-700">
          {tr('Prefilled — check it', 'Pré-rempli — vérifiez', 'مملوء مسبقًا — تحقق')}
          {prefill && prefill[param.key] && prefill[param.key].hint
            ? ` : ${prefill[param.key].hint}`
            : ''}
        </p>
      )}

      {notes && notes[param.key] && (
        <p className="text-xs font-medium text-amber-700" data-testid={`note-${param.key}`}>
          {notes[param.key]}
        </p>
      )}

      {param.help && <p className="text-xs text-muted-foreground">{param.help}</p>}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 lg:px-8">
      <Button
        variant="outline"
        onClick={onBack}
        className="mb-6 rounded-lg border border-gray-300 shadow-sm"
      >
        <ArrowRight size={20} className="mr-2 rotate-180" />
        {backLabel || tr('Back to templates', 'Retour aux modèles', 'العودة إلى النماذج')}
      </Button>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-3">{template.title}</h2>
        <p className="text-lg text-muted-foreground">
          {tr(
            'Fill in these details and the lines will be computed for you.',
            'Renseignez ces quelques informations, les lignes seront calculées pour vous.',
            'أدخل هذه المعلومات وسيتم حساب السطور تلقائيًا.'
          )}
        </p>
      </div>

      <section className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
        <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
          {visibleParameters.map((param) => {
            // Liste repetable : un sous-formulaire par element, plus les
            // boutons d'ajout et de retrait.
            const indiceListe = champsPrefilles.includes(param.key)
              && prefill && prefill[param.key] && prefill[param.key].hint;

            if (param.type === 'list') {
              const items = itemsOf(param.key);
              const minItems = param.min ?? 0;
              const champNom = param.itemNameKey
                ? (param.itemFields || []).find((f) => f.key === param.itemNameKey)
                : undefined;

              return (
                <div key={param.key} className="space-y-3 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Label className="text-sm font-semibold text-foreground">
                      {param.label}
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => addItem(param)}
                    >
                      <Plus size={14} className="mr-1" />
                      {param.addLabel || tr('Add an item', 'Ajouter un élément', 'أضف عنصرًا')}
                    </Button>
                  </div>

                  {indiceListe && (
                    <p className="text-xs font-medium text-blue-700" data-testid={`prefill-${param.key}`}>
                      {tr('Prefilled — check it', 'Pré-rempli — vérifiez', 'مملوء مسبقًا — تحقق')} : {indiceListe}
                    </p>
                  )}

                  {notes && notes[param.key] && (
                    <p className="text-xs font-medium text-amber-700" data-testid={`note-${param.key}`}>
                      {notes[param.key]}
                    </p>
                  )}

                  {missingInput && missingInput.champ === param.key && (
                    <div
                      className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
                      data-testid={`missing-${param.key}`}
                    >
                      <p className="text-sm text-amber-900">{missingInput.message}</p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                          <Label
                            htmlFor={`missing-${param.key}-input`}
                            className="text-xs font-semibold text-amber-900"
                          >
                            {missingInput.label}
                            {missingInput.unit ? ` (${missingInput.unit})` : ''}
                          </Label>
                          <Input
                            id={`missing-${param.key}-input`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={missingValue}
                            placeholder={missingInput.placeholder}
                            onChange={(e) => handleMissingValue(e.target.value)}
                            className="h-10 w-40 rounded-lg border border-amber-300 bg-card shadow-sm"
                          />
                        </div>
                      </div>
                      {missingInput.caveat && Number(missingValue) > 0 && (
                        <p className="text-xs font-medium text-amber-800">{missingInput.caveat}</p>
                      )}
                    </div>
                  )}

                  {items.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                      {tr(
                        'Add at least one item.',
                        'Ajoutez au moins un élément.',
                        'أضف عنصرًا واحدًا على الأقل.'
                      )}
                    </p>
                  )}

                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        {/*
                          Le nom remplace le libelle numerote : « Mur 1 » ne
                          dit rien de plus que la position. L'artisan est le
                          seul a connaitre l'orientation reelle sur place, on
                          lui laisse donc ecrire ce qu'il veut plutot que de
                          deduire une gauche et une droite du dessin.
                        */}
                        {champNom ? (
                          <Input
                            aria-label={champNom.label}
                            value={item[champNom.key] ?? ''}
                            onChange={(e) => updateItem(param, index, { [champNom.key]: e.target.value })}
                            placeholder={`${param.itemLabel || ''} ${index + 1}`.trim()}
                            className="h-9 max-w-xs rounded-lg border border-border bg-card text-sm font-semibold shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-foreground">
                            {param.itemLabel || tr('Item', 'Élément', 'عنصر')} {index + 1}
                          </span>
                        )}
                        {items.length > minItems && (
                          <button
                            type="button"
                            aria-label={`${tr('Remove', 'Supprimer', 'حذف')} ${
                              (champNom && item[champNom.key])
                                || `${param.itemLabel || tr('item', 'élément', 'عنصر')} ${index + 1}`
                            }`}
                            onClick={() => removeItem(param.key, index)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
                        {(param.itemFields || [])
                          .filter((field) => field.key !== param.itemNameKey)
                          .filter((field) => isVisible(field, item))
                          .map((field) =>
                            renderScalarField(
                              field,
                              `template-param-${param.key}-${index}-${field.key}`,
                              item[field.key] ?? '',
                              (next) => updateItem(param, index, { [field.key]: next })
                            )
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            return renderScalarField(
              param,
              `template-param-${param.key}`,
              String(values[param.key] ?? ''),
              (next) => setValue(param.key, next)
            );
          })}
        </div>

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        <div className="mt-8 flex justify-end">
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="rounded-lg"
          >
            {isGenerating ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Sparkles size={16} className="mr-2" />
            )}
            {isGenerating
              ? tr('Computing...', 'Calcul en cours...', 'جاري الحساب...')
              : tr('Generate the lines', 'Générer les lignes', 'إنشاء السطور')}
          </Button>
        </div>
      </section>


      <p className="text-sm text-muted-foreground">
        {tr(
          'Every computed line stays editable afterwards, and unit prices are yours to fill in.',
          'Chaque ligne calculée reste modifiable ensuite, et les prix unitaires restent à votre saisie.',
          'يبقى كل سطر محسوب قابلاً للتعديل، وتبقى أسعار الوحدة من إدخالك.'
        )}
      </p>
    </div>
  );
}
