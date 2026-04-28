import { Type, Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAccessibility, TextSize } from '../../context/AccessibilityContext';
import { Card } from '../ui/card';

// ─── Text size config ──────────────────────────────────────────────────────────

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string; labelFr: string; labelAr: string; symbol: string; px: string }[] = [
  { value: 'small',  label: 'Small',     labelFr: 'Petit',      labelAr: 'صغير',      symbol: 'A⁻',  px: '14px' },
  { value: 'medium', label: 'Medium',    labelFr: 'Moyen',      labelAr: 'متوسط',     symbol: 'A',   px: '16px' },
  { value: 'large',  label: 'Large',     labelFr: 'Grand',      labelAr: 'كبير',      symbol: 'A⁺',  px: '18px' },
  { value: 'xlarge', label: 'Very large',labelFr: 'Très grand', labelAr: 'كبير جداً', symbol: 'A⁺⁺', px: '20px' },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PersonalisationSettings() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const { textSize, setTextSize } = useAccessibility();

  const previewSizes: Record<TextSize, string> = {
    small:  'text-sm',
    medium: 'text-base',
    large:  'text-lg',
    xlarge: 'text-xl',
  };

  return (
    <div className="space-y-6 w-full">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Type size={26} className="text-primary" />
          {tr('Text size', 'Taille du texte', 'حجم النص')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tr(
            'Choose the text size that suits you. The change applies immediately across the entire platform.',
            "Choisissez la taille du texte qui vous convient. Le changement s'applique immédiatement sur toute la plateforme.",
            'اختر حجم النص المناسب لك. يُطبَّق التغيير فوراً على المنصة بأكملها.'
          )}
        </p>
      </div>

      {/* ── Size buttons ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {TEXT_SIZE_OPTIONS.map(opt => {
          const label = language === 'fr' ? opt.labelFr : language === 'ar' ? opt.labelAr : opt.label;
          const isActive = textSize === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTextSize(opt.value)}
              className="relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 py-8 px-4 transition-all hover:shadow-md"
              style={{
                borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                background:  isActive ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'var(--card)',
              }}
            >
              {isActive && (
                <span
                  className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <Check size={13} color="white" strokeWidth={3} />
                </span>
              )}
              <span
                className="font-black leading-none"
                style={{
                  fontSize: opt.px,
                  color: isActive ? 'var(--primary)' : 'var(--foreground)',
                }}
              >
                {opt.symbol}
              </span>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.px}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Preview ── */}
      <Card className="p-6 rounded-2xl border border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {tr('Preview', 'Aperçu', 'معاينة')}
        </p>
        <p className={`${previewSizes[textSize]} text-foreground leading-relaxed`}>
          {tr(
            'This is a preview of the selected text size. The entire platform will use this size.',
            'Ceci est un aperçu de la taille de texte sélectionnée. Toute la plateforme utilisera cette taille.',
            'هذه معاينة لحجم النص المختار. ستستخدم المنصة بأكملها هذا الحجم.'
          )}
        </p>
      </Card>

      {/* ── Info banner ── */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4">
        <span className="text-blue-500 text-lg flex-shrink-0">💡</span>
        <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
          {tr(
            'Your preferences are saved automatically and applied every time you log in.',
            'Vos préférences sont sauvegardées automatiquement et appliquées à chaque connexion.',
            'يتم حفظ تفضيلاتك تلقائياً وتطبيقها في كل مرة تسجل فيها الدخول.'
          )}
        </p>
      </div>
    </div>
  );
}
