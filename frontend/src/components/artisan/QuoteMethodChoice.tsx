import React from 'react';
import { ArrowRight, FileText, LayoutTemplate, DraftingCompass } from 'lucide-react';
import { Button } from '../ui/button';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Ecran de choix affiche entre le clic sur « Generer un devis » et le formulaire.
 *
 * Le style reprend celui de components/auth/RegisterRoleSelection.tsx (cartes
 * cliquables, memes classes), a deux differences pres : les libelles passent par
 * tr() et les icones viennent de lucide-react plutot que d'emojis.
 */

export type QuoteMethod = 'free' | 'template' | 'plan';

interface QuoteMethodChoiceProps {
  /** Appele avec la methode choisie ; les cartes desactivees ne declenchent rien. */
  onSelect: (method: QuoteMethod) => void;
  /** Retour vers la liste des devis. */
  onBack: () => void;
}

export default function QuoteMethodChoice({ onSelect, onBack }: QuoteMethodChoiceProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    (language === 'ar' ? ar : language === 'fr' ? fr : en);

  const methods = [
    {
      id: 'free' as QuoteMethod,
      title: tr('Blank quote', 'Devis libre', 'عرض أسعار حر'),
      description: tr(
        'Fill in every line yourself, starting from an empty form.',
        'Remplissez vous-même chaque ligne, à partir d\'un formulaire vierge.',
        'املأ كل سطر بنفسك، انطلاقًا من نموذج فارغ.'
      ),
      Icon: FileText,
      color: '#1E40AF',
      available: true,
    },
    {
      id: 'template' as QuoteMethod,
      title: tr('Ready-made quote', 'Devis prêt', 'عرض أسعار جاهز'),
      description: tr(
        'Start from a template matching your trade, then adjust it.',
        'Partez d\'un modèle correspondant à votre métier, puis ajustez-le.',
        'ابدأ من نموذج يناسب مهنتك، ثم عدّله.'
      ),
      Icon: LayoutTemplate,
      color: '#10B981',
      available: true,
    },
    {
      id: 'plan' as QuoteMethod,
      title: tr('From a plan', 'Depuis un plan', 'من مخطط'),
      // AutoCAD et DWG ont ete retires : hors perimetre, et aucune conversion
      // libre fiable n'existe. La description dit « ecrites » a dessein — on
      // lit les cotations, on ne mesure jamais le dessin.
      description: tr(
        'Import a photo or a PDF of your plan: the dimensions written on it prefill the quote.',
        'Importez une photo ou un PDF de votre plan : les cotations qui y sont écrites pré-remplissent le devis.',
        'استورد صورة أو PDF لمخططك: الأبعاد المكتوبة عليه تملأ عرض السعر.'
      ),
      Icon: DraftingCompass,
      color: '#8B5CF6',
      available: true,
    },
  ];

  const comingSoonLabel = tr('Coming soon', 'Bientôt disponible', 'قريبًا');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 lg:px-8">
      <Button
        variant="outline"
        onClick={onBack}
        className="mb-6 rounded-lg border border-gray-300 shadow-sm"
      >
        <ArrowRight size={20} className="mr-2 rotate-180" />
        {tr('Back to Quotes', 'Retour aux devis', 'العودة إلى العروض')}
      </Button>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-3">
          {tr('Generate a quote', 'Générer un devis', 'إنشاء عرض أسعار')}
        </h2>
        <p className="text-lg text-muted-foreground">
          {tr(
            'Choose how you want to start.',
            'Choisissez comment vous souhaitez commencer.',
            'اختر الطريقة التي تريد البدء بها.'
          )}
        </p>
      </div>

      <div className="space-y-4">
        {methods.map(({ id, title, description, Icon, color, available }) => (
          <button
            key={id}
            type="button"
            disabled={!available}
            aria-disabled={!available}
            onClick={available ? () => onSelect(id as QuoteMethod) : undefined}
            className={
              available
                ? 'w-full group text-left p-6 rounded-2xl border-2 border-border hover:border-primary hover:shadow-xl transition-all duration-300 bg-card'
                : 'w-full text-left p-6 rounded-2xl border-2 border-border bg-card opacity-60 cursor-default'
            }
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-md ${
                  available ? 'group-hover:scale-110 transition-transform' : ''
                }`}
                style={{ backgroundColor: `${color}15`, color }}
              >
                <Icon size={26} />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h4 className="text-xl font-bold text-foreground">{title}</h4>
                  {!available && (
                    // Meme pastille que les « features » de RegisterRoleSelection.
                    <span
                      className="text-xs px-3 py-1 rounded-full font-semibold"
                      style={{ backgroundColor: `${color}15`, color }}
                    >
                      {comingSoonLabel}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
