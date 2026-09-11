import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Ecran intermediaire du parcours « depuis un plan » : quelles pieces ce devis
 * couvre-t-il ?
 *
 * Un plan porte les surfaces de TOUT le logement, un devis n'en traite
 * generalement qu'une partie. Rien ne permet de deviner laquelle — le plan ne
 * le dit pas, la description libre non plus. On demande donc, plutot que de
 * choisir a la place de l'artisan.
 *
 * ⚠ AUCUNE CASE N'EST COCHEE AU DEPART. Pre-cocher reviendrait a proposer un
 * total que l'artisan validerait sans le lire ; le devis serait faux et il
 * n'aurait rien vu passer. Le total ne doit exister qu'apres un geste explicite.
 */

export interface PlanRoomCandidate {
  /** Rang de la piece dans la lecture, pour recouper les autres champs. */
  piece_index: number;
  libelle: string;
  valeur: number;
  texte_source: string;
}

interface PlanRoomPickerProps {
  candidats: PlanRoomCandidate[];
  /** Unite affichee a cote du total. */
  unite?: string;
  /**
   * Remonte la somme des pieces cochees, le detail qui la compose, et le rang
   * des pieces retenues — d'autres champs que la surface se calculent sur la
   * meme selection.
   */
  onConfirm: (total: number, detail: string, indices: number[]) => void;
  /** Poursuite sans pre-remplissage : l'artisan saisira sa surface. */
  onSkip: () => void;
  onBack: () => void;
}

/** Deux decimales, virgule francaise, sans zeros inutiles. */
const formatSurface = (valeur: number) =>
  String(Math.round(valeur * 100) / 100).replace('.', ',');

export default function PlanRoomPicker({
  candidats,
  unite = 'm²',
  onConfirm,
  onSkip,
  onBack,
}: PlanRoomPickerProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    (language === 'ar' ? ar : language === 'fr' ? fr : en);

  const [selection, setSelection] = useState<number[]>([]);

  const bascule = (index: number) => {
    setSelection((prev) =>
      (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index])
    );
  };

  // L'ordre du plan est conserve : le detail se relit sur le dessin.
  const retenues = candidats.filter((_, index) => selection.includes(index));
  const total = Math.round(retenues.reduce((somme, piece) => somme + Number(piece.valeur), 0) * 100) / 100;
  const detail = retenues
    .map((piece) => `${piece.libelle} ${formatSurface(piece.valeur)}`)
    .join(' + ');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 lg:px-8">
      <Button
        variant="outline"
        onClick={onBack}
        className="mb-6 rounded-lg border border-gray-300 shadow-sm"
      >
        <ArrowRight size={20} className="mr-2 rotate-180" />
        {tr('Back', 'Retour', 'رجوع')}
      </Button>

      <div className="mb-8">
        <h2 className="mb-3 text-3xl font-bold text-foreground">
          {tr(
            'Which rooms does this quote cover?',
            'Quelles pièces sont concernées par ce devis ?',
            'ما الغرف المعنية بهذا العرض؟'
          )}
        </h2>
        <p className="text-lg text-muted-foreground">
          {tr(
            'The surfaces you tick are added up and prefill the form.',
            'Les surfaces cochées sont additionnées et pré-remplissent le formulaire.',
            'تُجمع المساحات المحددة وتملأ النموذج.'
          )}
        </p>
      </div>

      <ul className="mb-6 space-y-2" data-testid="plan-rooms">
        {candidats.map((piece, index) => {
          const inputId = `piece-${index}`;
          return (
            <li key={`${piece.libelle}-${index}`}>
              <label
                htmlFor={inputId}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm transition hover:border-blue-400"
              >
                <input
                  id={inputId}
                  type="checkbox"
                  checked={selection.includes(index)}
                  onChange={() => bascule(index)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span>
                  <span className="font-medium text-foreground">{piece.libelle}</span>
                  {' — '}
                  <span className="font-semibold">{formatSurface(piece.valeur)} {unite}</span>
                  <span className="block text-xs text-muted-foreground">
                    {tr('read', 'lu', 'مقروء')} : « {String(piece.texte_source).replace(/\s+/g, ' ')} »
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          {selection.length === 0
            ? tr(
              'Tick at least one room, or type the surface yourself.',
              'Cochez au moins une pièce, ou saisissez la surface vous-même.',
              'حدد غرفة واحدة على الأقل.'
            )
            : (
              <>
                {tr('Total', 'Total', 'المجموع')}
                {' : '}
                <span className="font-semibold text-foreground" data-testid="plan-rooms-total">
                  {formatSurface(total)} {unite}
                </span>
              </>
            )}
        </p>

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="rounded-lg" onClick={onSkip}>
            {tr('Type it myself', 'Saisir moi-même', 'أدخلها بنفسي')}
          </Button>
          <Button
            type="button"
            className="rounded-lg"
            disabled={selection.length === 0}
            onClick={() => onConfirm(total, detail, retenues.map((piece) => piece.piece_index))}
          >
            {tr('Continue', 'Continuer', 'متابعة')}
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
