import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowRight, Loader2, Package, Star } from 'lucide-react';
import { Button } from '../ui/button';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Galerie des « devis prets » : les modeles metier exposes par
 * GET /api/quotes/templates (backend/utils/quoteTemplates.js).
 *
 * Le modele correspondant au `domain` de l'artisan connecte est remonte en tete
 * et signale par un badge. Les autres restent accessibles : un artisan peut
 * facturer une prestation hors de sa specialite principale.
 */

/**
 * Les types vivent dans un module a part pour eviter un cycle avec
 * QuoteTemplateParams : chacun decrivait une partie de l'autre.
 * Reexportes ici, les appelants existants ne changent pas.
 */
export type {
  QuoteTemplate,
  QuoteTemplateLine,
  QuoteTemplateParam,
  QuoteTemplateParamOption,
} from './quoteTemplateTypes';

import type { QuoteTemplate } from './quoteTemplateTypes';

interface QuoteTemplateGalleryProps {
  /** Metier de l'artisan connecte, sert a mettre le bon modele en avant. */
  artisanDomain?: string;
  /**
   * Restreint la galerie a ces identifiants. Absent, tous les modeles sont
   * proposes. Sert au parcours « depuis un plan », limite aux metiers dont les
   * champs peuvent etre lus sur un plan.
   */
  allowedIds?: string[];
  onSelect: (template: QuoteTemplate) => void;
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

export default function QuoteTemplateGallery({
  artisanDomain,
  allowedIds,
  onSelect,
  onBack,
}: QuoteTemplateGalleryProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    (language === 'ar' ? ar : language === 'fr' ? fr : en);

  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const token = getToken();
        const { data } = await axios.get(`${API_URL}/quotes/templates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTemplates(Array.isArray(data) ? data : []);
      } catch {
        setError(
          tr(
            'Templates could not be loaded.',
            'Les modèles n\'ont pas pu être chargés.',
            'تعذر تحميل النماذج.'
          )
        );
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  /** Le modele du metier de l'artisan passe en premier. */
  const orderedTemplates = useMemo(() => {
    const visibles = Array.isArray(allowedIds)
      ? templates.filter((t) => allowedIds.includes(t.id))
      : templates;
    if (!artisanDomain) return visibles;
    const mine = visibles.filter((t) => t.domain === artisanDomain);
    const others = visibles.filter((t) => t.domain !== artisanDomain);
    return [...mine, ...others];
  }, [templates, artisanDomain, allowedIds]);

  const recommendedLabel = tr('Recommended', 'Recommandé', 'موصى به');

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
        <h2 className="text-3xl font-bold text-foreground mb-3">
          {tr('Ready-made quotes', 'Devis prêts', 'عروض أسعار جاهزة')}
        </h2>
        <p className="text-lg text-muted-foreground">
          {tr(
            'Pick a template, then adjust the quantities and prices.',
            'Choisissez un modèle, puis ajustez les quantités et les prix.',
            'اختر نموذجًا، ثم عدّل الكميات والأسعار.'
          )}
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          {tr('Loading templates...', 'Chargement des modèles...', 'جاري تحميل النماذج...')}
        </div>
      )}

      {!loading && error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && orderedTemplates.length === 0 && (
        <p className="text-muted-foreground">
          {tr('No template available yet.', 'Aucun modèle disponible pour le moment.', 'لا يوجد نموذج متاح حاليًا.')}
        </p>
      )}

      <div className="space-y-4">
        {orderedTemplates.map((template) => {
          const isRecommended = Boolean(artisanDomain) && template.domain === artisanDomain;
          const materialCount = template.lines.filter((l) => l.lineType === 'material').length;
          const laborCount = template.lines.filter((l) => l.lineType === 'labor').length;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              className={`w-full group text-left p-6 rounded-2xl border-2 bg-card transition-all duration-300 hover:shadow-xl ${
                isRecommended ? 'border-primary' : 'border-border hover:border-primary'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: '#1E40AF15', color: '#1E40AF' }}
                >
                  <Package size={26} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h4 className="text-xl font-bold text-foreground">{template.title}</h4>
                    {isRecommended && (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-semibold"
                        style={{ backgroundColor: '#1E40AF15', color: '#1E40AF' }}
                      >
                        <Star size={11} /> {recommendedLabel}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {tr(
                      `${template.lines.length} lines · ${materialCount} materials · ${laborCount} labor`,
                      `${template.lines.length} lignes · ${materialCount} matériaux · ${laborCount} main d'œuvre`,
                      `${template.lines.length} سطور · ${materialCount} مواد · ${laborCount} يد عاملة`
                    )}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
