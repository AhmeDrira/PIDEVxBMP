import React, { useRef, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, ArrowRight, FileUp, Loader2, Ruler } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { useLanguage } from '../../context/LanguageContext';
import type { QuoteTemplate } from './quoteTemplateTypes';

/**
 * Premier ecran du parcours « Depuis un plan » : import et lecture.
 *
 * ⚠ CE N'EST PAS UN OUTIL DE MESURE. Le modele LIT les cotations deja ecrites
 * sur le plan ; il ne mesure jamais le dessin. C'est la limite fondatrice de la
 * fonctionnalite : la lecture de texte est fiable, la mesure geometrique
 * visuelle ne l'est pas.
 *
 * Le fichier ne quitte pas la memoire : il part au serveur, qui l'envoie au
 * modele sans jamais l'ecrire sur disque.
 *
 * C'est le seul appel payant du parcours. La lecture obtenue est ensuite
 * projetee sur le metier choisi sans jamais relire le plan.
 */

export interface PlanReadingPiece {
  libelle: string;
  surface_m2: number | null;
  texte_source_surface: string;
  /**
   * Cotes de cote, renseignees seulement quand le modele les a trouvees
   * ecrites juste a cote de cette piece. Nulles des qu'il faudrait raisonner
   * sur le dessin pour decider a quelle piece elles se rapportent.
   */
  longueur_m?: number | null;
  largeur_m?: number | null;
  texte_source_dimensions?: string | null;
}

export interface PlanReading {
  pieces: PlanReadingPiece[];
  cotations: Array<{ valeur: number; unite: string; texte_source: string }>;
  /** Renseignee seulement si le plan porte la mention explicitement. */
  hauteurSousPlafond?: { valeurM: number; texteSource: string } | null;
  illisible: string[];
}

interface PlanImportProps {
  /**
   * Remonte la lecture et le metier deduit de la description.
   * `template` a null : rien n'a ete reconnu, l'appelant proposera la galerie.
   */
  onRead: (lecture: PlanReading, template: QuoteTemplate | null) => void;
  onBack: () => void;
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

/** Le DWG est volontairement absent : aucune conversion libre fiable. */
const ACCEPTED = '.jpg,.jpeg,.png,.pdf';

export default function PlanImport({ onRead, onBack }: PlanImportProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    (language === 'ar' ? ar : language === 'fr' ? fr : en);

  const [description, setDescription] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [lecture, setLecture] = useState<PlanReading | null>(null);
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reinitialise pour permettre de reimporter le meme fichier.
    event.target.value = '';
    if (!file) return;

    setIsReading(true);
    setError('');
    setLecture(null);
    setAvertissements([]);
    try {
      const formData = new FormData();
      formData.append('plan', file);

      const { data } = await axios.post(`${API_URL}/quotes/plan-reading`, formData, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setLecture(data.lecture);
      setAvertissements(Array.isArray(data.avertissements) ? data.avertissements : []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message
          || tr('The plan could not be read.', "Le plan n'a pas pu être lu.", 'تعذر قراءة المخطط.')
      );
    } finally {
      setIsReading(false);
    }
  };

  const piecesLues = (lecture?.pieces || []).filter(
    (piece) => Number.isFinite(Number(piece.surface_m2)) && Number(piece.surface_m2) > 0
  );

  const cotationsLues = (lecture?.cotations || []).filter(
    (cote) => Number.isFinite(Number(cote.valeur)) && Number(cote.valeur) > 0
  );

  /**
   * Deduit le metier du texte libre puis passe la main.
   *
   * Une detection infructueuse n'est pas un echec : on avance avec
   * `templateId` a null et l'artisan choisira dans la galerie.
   */
  const handleContinue = async () => {
    if (!lecture) return;

    setIsDetecting(true);
    try {
      const { data } = await axios.post(
        `${API_URL}/quotes/detect-trade`,
        { description },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      onRead(lecture, data.template || null);
    } catch {
      // La detection n'est qu'un raccourci : son echec ne doit pas bloquer.
      onRead(lecture, null);
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 lg:px-8">
      <Button
        variant="outline"
        onClick={onBack}
        className="mb-6 rounded-lg border border-gray-300 shadow-sm"
      >
        <ArrowRight size={20} className="mr-2 rotate-180" />
        {tr('Back to choices', 'Retour au choix', 'العودة إلى الخيارات')}
      </Button>

      <div className="mb-8">
        <h2 className="mb-3 text-3xl font-bold text-foreground">
          {tr('Import a plan', 'Importer un plan', 'استيراد مخطط')}
        </h2>
        <p className="text-lg text-muted-foreground">
          {tr(
            'The dimensions written on the plan are read, never measured from the drawing.',
            'Les cotations écrites sur le plan sont lues, jamais mesurées sur le dessin.',
            'تُقرأ الأبعاد المكتوبة على المخطط، ولا تُقاس من الرسم.'
          )}
        </p>
      </div>

      <section className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-6">
        <input
          id="planFile"
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          onChange={handleFile}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-lg"
          disabled={isReading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isReading
            ? <Loader2 size={16} className="mr-2 animate-spin" />
            : <FileUp size={16} className="mr-2" />}
          {isReading
            ? tr('Reading the plan...', 'Lecture du plan...', 'جاري القراءة...')
            : tr('Choose a photo or a PDF', 'Choisir une photo ou un PDF', 'اختر صورة أو PDF')}
        </Button>

        <p className="mt-2 text-xs text-muted-foreground">
          {tr(
            'insert Image or PDF',
            'insérer une Image ou PDF',
            'صورة أو PDF'
          )}
        </p>
      </section>

      {error && (
        <p className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {avertissements.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {avertissements.map((a, i) => (
            <p key={i} className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {a}
            </p>
          ))}
        </div>
      )}

      {lecture && (
        <section className="space-y-4" data-testid="plan-reading">
          <h3 className="text-lg font-semibold text-foreground">
            {tr('What was read on the plan', 'Ce qui a été lu sur le plan', 'ما تمت قراءته')}
          </h3>

          {piecesLues.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              {tr(
                'No usable surface was read. You can still pick a trade and type the values yourself.',
                "Aucune surface exploitable n'a été lue. Vous pouvez tout de même choisir un métier et saisir les valeurs à la main.",
                'لم تُقرأ أي مساحة قابلة للاستخدام.'
              )}
            </p>
          ) : (
            <ul className="space-y-2">
              {piecesLues.map((piece, index) => (
                <li
                  key={`${piece.libelle}-${index}`}
                  className="rounded-lg border border-border bg-card px-4 py-3 text-sm"
                >
                  <span className="font-medium text-foreground">{piece.libelle}</span>
                  {' — '}
                  <span className="font-semibold">{piece.surface_m2} m²</span>
                  <span className="block text-xs text-muted-foreground">
                    {tr('read', 'lu', 'مقروء')} : « {String(piece.texte_source_surface).replace(/\s+/g, ' ')} »
                  </span>
                </li>
              ))}
            </ul>
          )}

          {cotationsLues.length > 0 && (
            <div className="space-y-2" data-testid="plan-cotations">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Ruler size={15} className="text-muted-foreground" />
                {tr('Dimensions read', 'Cotations lues', 'الأبعاد المقروءة')}
                {' '}({cotationsLues.length})
              </h4>
              <p className="flex flex-wrap gap-2">
                {cotationsLues.map((cote, index) => (
                  <span
                    key={`${cote.valeur}-${index}`}
                    title={String(cote.texte_source)}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
                  >
                    {cote.valeur} {cote.unite || 'm'}
                  </span>
                ))}
              </p>
              <p className="text-xs text-muted-foreground">
                {tr(
                  'Shown for reference. Only surfaces prefill the form for now.',
                  'À titre indicatif. Seules les surfaces pré-remplissent le formulaire pour l\'instant.',
                  'للإشارة فقط.'
                )}
              </p>
            </div>
          )}

          {lecture.hauteurSousPlafond && (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
              {tr('Ceiling height read on the plan', 'Hauteur sous plafond lue sur le plan', 'ارتفاع السقف')}
              {' : '}
              <span className="font-semibold">{lecture.hauteurSousPlafond.valeurM} m</span>
            </p>
          )}

          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="planDescription" className="text-sm font-semibold text-foreground">
              {tr('What do you need to do?', 'Que devez-vous faire ?', 'ما العمل المطلوب؟')}
            </Label>
            <Input
              id="planDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr('e.g. tiling, painting', 'Ex : carrelage, peinture', 'مثال: بلاط، دهان')}
              className="h-11 rounded-lg"
            />
            <p className="text-xs text-muted-foreground">
              {tr(
                'Used only to pick the trade. The other details stay yours to fill in.',
                'Sert uniquement à choisir le métier. Les autres détails restent à saisir vous-même.',
                'يُستخدم فقط لاختيار المهنة.'
              )}
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              className="rounded-lg"
              disabled={isDetecting}
              onClick={handleContinue}
            >
              {isDetecting && <Loader2 size={16} className="mr-2 animate-spin" />}
              {tr('Continue', 'Continuer', 'متابعة')}
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
