/**
 * SmartAIInput.tsx — BMP.tn
 * ──────────────────────────────────────────────────────────────────────────────
 * Composant d'auto-remplissage interactif via IA locale (DistilBERT).
 *
 * L'artisan décrit son projet en langage naturel ; le backend extrait
 * automatiquement : title, location, description, date.
 * Après extraction, une bulle de chatbot indique ce qui a été trouvé
 * et demande de compléter les champs manquants.
 *
 * Props :
 *   onDataExtracted(data)  — appelé avec les champs extraits après succès
 *   placeholder            — texte indicatif dans le textarea (optionnel)
 *   disabled               — désactive le composant (optionnel)
 *   className              — classe CSS supplémentaire sur le wrapper (optionnel)
 */

import { useState } from 'react';
import { Sparkles, Loader2, Wand2, Bot, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { cn } from '../ui/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedProjectData {
  title?:       string | null;
  location?:    string | null;
  description?: string | null;
  date?:        string | null;
}

interface SmartAIInputProps {
  onDataExtracted: (data: ExtractedProjectData) => void;
  placeholder?:    string;
  disabled?:       boolean;
  className?:      string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const getToken = (): string | null => {
  const direct = localStorage.getItem('token');
  if (direct) return direct;
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').token ?? null;
  } catch {
    return null;
  }
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const DEFAULT_PLACEHOLDER =
  "Décrivez votre projet en langage naturel…\n\nEx : « Je dois construire une villa à Sousse avec 4 chambres et une piscine. Le projet s'appelle Villa Jasmin et démarrera en juin. »";

const MIN_CHARS = 10;

// ── Exemples affichés sous le textarea ───────────────────────────────────────

const EXAMPLES = [
  "Build a new villa in Sousse with 4 bedrooms and a pool.",
  "Rénover la salle de bain de l'appartement à Tunis Lac 2.",
  "Construction d'un entrepôt industriel à Sfax, projet « LogiPark ».",
];

// ── Analyse des champs manquants ─────────────────────────────────────────────

function buildChatMessage(data: ExtractedProjectData): {
  message: string;
  isComplete: boolean;
} {
  const missingFields: string[] = [];

  if (!data.title)    missingFields.push('le nom du projet');
  if (!data.date)     missingFields.push('la date de début');
  if (!data.location) missingFields.push('la localisation');

  // Description considérée absente si null OU trop courte (< 15 chars)
  const descOk = data.description && data.description.trim().length >= 15;
  if (!descOk) missingFields.push('plus de détails sur les travaux (description)');

  if (missingFields.length === 0) {
    return {
      message:    "✅ Parfait, j'ai toutes les informations !",
      isComplete: true,
    };
  }

  return {
    message: `J'ai rempli ce que j'ai pu, mais il me manque : ${missingFields.join(', ')}. Pouvez-vous compléter votre phrase ou remplir les champs manuellement ?`,
    isComplete: false,
  };
}

// ── ChatBubble ────────────────────────────────────────────────────────────────

function ChatBubble({ message, isComplete }: { message: string; isComplete: boolean }) {
  return (
    <div className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* Avatar IA */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
        style={{
          background: isComplete
            ? 'linear-gradient(135deg, #16a34a, #22c55e)'
            : 'linear-gradient(135deg, #1F3A8A, #3b82f6)',
        }}
      >
        {isComplete
          ? <CheckCircle2 size={15} className="text-white" />
          : <Bot size={15} className="text-white" />
        }
      </div>

      {/* Bulle */}
      <div
        className="flex-1 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-sm"
        style={{
          backgroundColor: isComplete ? '#f0fdf4' : '#f0f9ff',
          border: `1px solid ${isComplete ? '#bbf7d0' : '#bae6fd'}`,
          color:  isComplete ? '#15803d' : '#0c4a6e',
        }}
      >
        {/* Icône inline si champs manquants */}
        {!isComplete && (
          <span className="inline-flex items-center gap-1 font-semibold mr-1" style={{ color: '#0369a1' }}>
            <AlertCircle size={13} style={{ display: 'inline', flexShrink: 0 }} />
          </span>
        )}
        {message}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function SmartAIInput({
  onDataExtracted,
  placeholder = DEFAULT_PLACEHOLDER,
  disabled     = false,
  className,
}: SmartAIInputProps) {
  const [text,        setText]        = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [chatMessage, setChatMessage] = useState<{ message: string; isComplete: boolean } | null>(null);

  const charCount = text.trim().length;
  const canSubmit = charCount >= MIN_CHARS && !isLoading && !disabled;

  // ── Appel API ───────────────────────────────────────────────────────────────

  const handleAutofill = async () => {
    if (!canSubmit) return;

    setIsLoading(true);
    setChatMessage(null);

    try {
      const { data } = await axios.post<ExtractedProjectData>(
        `${API_URL}/ai/project-autofill`,
        { text: text.trim() },
        {
          headers: { Authorization: `Bearer ${getToken()}` },
          timeout: 60_000,
        }
      );

      // Transmettre les données au formulaire parent
      onDataExtracted(data);

      // Analyser les champs manquants et construire le message chatbot
      const result = buildChatMessage(data);
      setChatMessage(result);

      // Toast léger en complément de la bulle
      if (result.isComplete) {
        toast.success('Formulaire rempli par l\'IA !');
      } else {
        const filledCount = [data.title, data.location, data.description, data.date].filter(Boolean).length;
        if (filledCount > 0) {
          toast.success(`${filledCount} champ${filledCount > 1 ? 's' : ''} rempli${filledCount > 1 ? 's' : ''} automatiquement.`);
        } else {
          toast.warning('L\'IA n\'a pas pu extraire d\'informations. Essayez un texte plus détaillé.');
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message || err.message;
        if (err.code === 'ECONNABORTED') {
          toast.error('Le modèle IA met plus de temps que prévu. Réessayez dans quelques secondes.');
        } else if (err.response?.status === 401) {
          toast.error('Session expirée. Veuillez vous reconnecter.');
        } else {
          toast.error(`Erreur IA : ${msg}`);
        }
      } else {
        toast.error('Une erreur inattendue est survenue.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAutofill();
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <div className={cn('space-y-3', className)}>

      {/* En-tête */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #1F3A8A, #3b82f6)' }}
        >
          <Wand2 size={14} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-tight">
            Auto-remplissage par IA
          </p>
          <p className="text-[11px] text-muted-foreground">
            Décrivez votre projet et l'IA remplira les champs automatiquement
          </p>
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setChatMessage(null); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={5}
          className={cn(
            'w-full resize-none rounded-2xl border px-4 py-3 text-sm',
            'bg-background text-foreground placeholder:text-muted-foreground',
            'transition-all duration-200 outline-none',
            'focus:ring-2 focus:ring-offset-1',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'leading-relaxed'
          )}
          style={{
            borderColor: text.length > 0 ? '#1F3A8A40' : undefined,
            // @ts-ignore CSS custom property
            '--tw-ring-color': '#1F3A8A',
          }}
        />

        {/* Compteur de caractères */}
        <span
          className="absolute bottom-3 right-3 text-[10px] font-medium select-none"
          style={{ color: charCount < MIN_CHARS ? '#94a3b8' : '#1F3A8A' }}
        >
          {charCount} car.
        </span>
      </div>

      {/* Exemples */}
      {text.length === 0 && !chatMessage && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Exemples
          </p>
          <div className="flex flex-col gap-1.5">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setText(ex)}
                disabled={disabled || isLoading}
                className="text-left text-xs px-3 py-2 rounded-xl border border-dashed border-border
                           text-muted-foreground hover:text-foreground hover:border-blue-300
                           hover:bg-blue-50/50 dark:hover:bg-blue-950/20
                           transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="mr-1.5 opacity-50">→</span>{ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bouton Auto-fill */}
      <button
        type="button"
        onClick={handleAutofill}
        disabled={!canSubmit}
        className="w-full rounded-2xl font-bold text-white flex items-center justify-center gap-2.5 transition-all duration-200"
        style={{
          height:    48,
          fontSize:  14,
          background: !canSubmit
            ? '#94a3b8'
            : 'linear-gradient(135deg, #1F3A8A, #2563eb)',
          cursor:    !canSubmit ? 'not-allowed' : 'pointer',
          opacity:   !canSubmit ? 0.7 : 1,
          boxShadow: canSubmit ? '0 4px 14px #1F3A8A30' : 'none',
        }}
        onMouseEnter={(e) => {
          if (canSubmit)
            e.currentTarget.style.background = 'linear-gradient(135deg, #172c6e, #1d4ed8)';
        }}
        onMouseLeave={(e) => {
          if (canSubmit)
            e.currentTarget.style.background = 'linear-gradient(135deg, #1F3A8A, #2563eb)';
        }}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Analyse en cours…
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Auto-fill Project
          </>
        )}
      </button>

      {/* Info raccourci clavier */}
      {!isLoading && !chatMessage && charCount >= MIN_CHARS && (
        <p className="text-center text-[11px] text-muted-foreground">
          Ou appuyez sur{' '}
          <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">
            Ctrl
          </kbd>
          {' + '}
          <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">
            Entrée
          </kbd>
        </p>
      )}

      {/* ── Bulle de chatbot ──────────────────────────────────────────────── */}
      {chatMessage && (
        <ChatBubble
          message={chatMessage.message}
          isComplete={chatMessage.isComplete}
        />
      )}

      {/* Mention modèle */}
      <p className="text-center text-[10px] text-muted-foreground/60 select-none">
        Propulsé par DistilBERT · traitement 100 % local · aucune donnée envoyée à l'extérieur
      </p>
    </div>
  );
}
