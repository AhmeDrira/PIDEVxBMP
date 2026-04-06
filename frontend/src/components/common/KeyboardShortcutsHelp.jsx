import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import {
  BriefcaseBusiness,
  CircleHelp,
  Compass,
  FileDown,
  FileText,
  Home,
  Keyboard,
  Moon,
  Receipt,
  ScanLine,
  Search,
  SearchX,
  Settings2,
  ShoppingBag,
  Store,
  X,
} from 'lucide-react';

const CATEGORY_META = {
  navigation: {
    label: 'Navigation',
    description: 'Aller vite vers vos pages principales',
    icon: Compass,
  },
  b2b: {
    label: 'Actions B2B',
    description: 'Declencher des actions metier',
    icon: BriefcaseBusiness,
  },
  interface: {
    label: 'Interface',
    description: 'Piloter le comportement de l UI',
    icon: Settings2,
  },
};

const CATEGORY_ORDER = ['navigation', 'b2b', 'interface'];

const SHORTCUTS = [
  {
    id: 'nav-home',
    keys: ['G', 'H'],
    action: 'Accueil',
    description: 'Acceder au tableau de bord principal',
    category: 'navigation',
    icon: Home,
  },
  {
    id: 'nav-marketplace',
    keys: ['G', 'M'],
    action: 'Marketplace',
    description: 'Acceder au catalogue de materiaux',
    category: 'navigation',
    icon: Store,
  },
  {
    id: 'nav-quotes',
    keys: ['G', 'Q'],
    action: 'Mes Devis',
    description: 'Ouvrir la liste des devis',
    category: 'navigation',
    icon: FileText,
  },
  {
    id: 'nav-invoices',
    keys: ['G', 'B'],
    action: 'Factures',
    description: 'Afficher les factures clients',
    category: 'navigation',
    icon: Receipt,
  },
  {
    id: 'b2b-new-order',
    keys: ['N'],
    action: 'Nouvelle Commande',
    description: 'Creer une nouvelle commande rapidement',
    category: 'b2b',
    icon: ShoppingBag,
  },
  {
    id: 'b2b-scan-materials',
    keys: ['S'],
    action: 'Scanner de Materiaux',
    description: 'Basculer vers la recherche de materiaux',
    category: 'b2b',
    icon: ScanLine,
  },
  {
    id: 'b2b-export-pdf',
    keys: ['Cmd', 'P'],
    action: 'Export PDF',
    description: 'Exporter le contexte actuel en PDF',
    category: 'b2b',
    icon: FileDown,
  },
  {
    id: 'ui-dark-mode',
    keys: ['D'],
    action: 'Mode Sombre',
    description: 'Activer ou desactiver le theme sombre',
    category: 'interface',
    icon: Moon,
  },
  {
    id: 'ui-open-palette',
    keys: ['G', 'F'],
    action: 'Ouvrir la popup',
    description: 'Afficher la popup Commander des raccourcis',
    category: 'interface',
    icon: Keyboard,
  },
  {
    id: 'ui-help',
    keys: ['?'],
    action: 'Aide',
    description: 'Afficher la palette de raccourcis',
    category: 'interface',
    icon: CircleHelp,
  },
  {
    id: 'ui-close',
    keys: ['Esc'],
    action: 'Fermeture',
    description: 'Fermer la palette de raccourcis',
    category: 'interface',
    icon: X,
  },
];

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

const SCROLLBAR_STYLE = `
  .bmp-shortcuts-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #CBD5E1 #F1F5F9;
  }

  .bmp-shortcuts-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .bmp-shortcuts-scrollbar::-webkit-scrollbar-track {
    background: #F1F5F9;
    border-radius: 9999px;
  }

  .bmp-shortcuts-scrollbar::-webkit-scrollbar-thumb {
    background: #CBD5E1;
    border-radius: 9999px;
  }

  .bmp-shortcuts-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94A3B8;
  }
`;

const normalizeKey = (value) => (value?.length === 1 ? value.toLowerCase() : value.toLowerCase());

const isTypingTarget = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();

  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  if (target.closest('[contenteditable="true"]')) return true;
  if (target.getAttribute('role') === 'textbox') return true;
  if (target.closest('[role="textbox"]')) return true;

  return false;
};

function useSequenceDetection(sequence, onMatch, options = {}) {
  const { timeout = 500, enabled = true } = options;
  const progressRef = useRef(0);
  const timeoutRef = useRef(null);
  const onMatchRef = useRef(onMatch);
  const sequenceRef = useRef(sequence.map((step) => normalizeKey(step)));

  useEffect(() => {
    onMatchRef.current = onMatch;
  }, [onMatch]);

  useEffect(() => {
    sequenceRef.current = sequence.map((step) => normalizeKey(step));
  }, [sequence]);

  useEffect(() => {
    if (!enabled || sequenceRef.current.length === 0) {
      return undefined;
    }

    const clearState = () => {
      progressRef.current = 0;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const armTimeout = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(clearState, timeout);
    };

    const onKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) {
        clearState();
        return;
      }
      if (isTypingTarget(event.target)) return;

      const key = normalizeKey(event.key);
      if (!key) return;

      const activeSequence = sequenceRef.current;
      const expectedKey = activeSequence[progressRef.current];
      const firstKey = activeSequence[0];

      if (key === expectedKey) {
        progressRef.current += 1;

        if (progressRef.current === activeSequence.length) {
          onMatchRef.current(event);
          clearState();
          return;
        }

        armTimeout();
        return;
      }

      if (key === firstKey) {
        progressRef.current = 1;
        armTimeout();
        return;
      }

      clearState();
    };

    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      clearState();
    };
  }, [enabled, timeout]);
}

function Header({ titleId, onClose, onDragStart }) {
  return (
    <header
      className="flex cursor-grab items-center justify-between rounded-t-2xl border-b border-[#E2E8F0] bg-[#FFFFFF] px-6 py-4 active:cursor-grabbing"
      onPointerDown={onDragStart}
    >
      <h2 id={titleId} className="text-base font-semibold tracking-wide text-[#1E293B]">
        ⌨️ RACCOURCIS CLAVIER
      </h2>

      <button
        type="button"
        aria-label="Fermer"
        className="rounded-lg p-2 text-[#64748B] transition-colors duration-150 hover:bg-gray-100 hover:text-[#1E293B]"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onClose}
      >
        <X size={16} />
      </button>
    </header>
  );
}

function SearchBar({ value, onChange, inputRef }) {
  return (
    <label className="relative block" htmlFor="keyboard-shortcuts-search">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={16} />
      <input
        id="keyboard-shortcuts-search"
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Rechercher un raccourci..."
        className="w-full rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] py-3 pl-10 pr-3 text-sm text-[#1E293B] outline-none transition-colors duration-150 placeholder:text-[#94A3B8] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
      />
    </label>
  );
}

function ShortcutItem({ shortcut }) {
  const Icon = shortcut.icon;

  return (
    <li className="mb-2 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3 transition-colors duration-150 hover:border-[#CBD5E1] hover:bg-gray-50">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Icon className="h-6 w-6 shrink-0 text-[#475569]" />
            <p className="truncate text-sm font-semibold text-[#1E293B]">{shortcut.action}</p>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">{shortcut.description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {shortcut.keys.map((key) => (
            <kbd
              key={`${shortcut.id}-${key}`}
              className="inline-flex min-w-8 items-center justify-center rounded-lg bg-[#F1F5F9] px-2 py-1 text-xs font-mono font-semibold text-[#334155]"
            >
              {key}
            </kbd>
          ))}
        </div>
      </div>
    </li>
  );
}

function ShortcutList({ groupedShortcuts }) {
  if (groupedShortcuts.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] bg-[#FFFFFF] p-10 text-center">
        <div>
          <SearchX className="mx-auto mb-3 h-7 w-7 text-[#94A3B8]" />
          <p className="text-sm font-semibold text-[#1E293B]">Aucun raccourci trouve</p>
          <p className="mt-1 text-xs text-[#64748B]">Essayez un autre mot-cle comme navigation, PDF ou aide.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bmp-shortcuts-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
      {groupedShortcuts.map((group) => {
        const GroupIcon = group.icon;

        return (
          <section key={group.id} className="mt-6 first:mt-0">
            <div className="mb-3 flex items-center gap-2">
              <GroupIcon className="h-4 w-4 text-[#64748B]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">{group.label}</h3>
            </div>

            <p className="mb-3 text-xs text-[#64748B]">{group.description}</p>

            <ul>
              {group.shortcuts.map((shortcut) => (
                <ShortcutItem key={shortcut.id} shortcut={shortcut} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#E2E8F0] bg-[#F8F9FA] px-6 py-3">
      <p className="text-xs text-[#64748B]">💡 Appuyez sur ESC pour fermer</p>
    </footer>
  );
}

function KeyboardHelpModal({
  isOpen,
  onClose,
  query,
  onQueryChange,
  groupedShortcuts,
  titleId,
  dialogRef,
  searchInputRef,
  dragControls,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(0,0,0,0.4)] p-4 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <style>{SCROLLBAR_STYLE}</style>

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-[0_24px_60px_rgba(2,6,23,0.28)]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0.08}
            dragConstraints={{ left: -320, right: 320, top: -180, bottom: 180 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Header titleId={titleId} onClose={onClose} onDragStart={(event) => dragControls.start(event)} />

            <div className="flex min-h-0 flex-1 flex-col gap-4 bg-[#F8F9FA] px-6 py-5">
              <SearchBar value={query} onChange={onQueryChange} inputRef={searchInputRef} />
              <ShortcutList groupedShortcuts={groupedShortcuts} />
            </div>

            <Footer />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const triggerElementRef = useRef(null);
  const dialogRef = useRef(null);
  const searchInputRef = useRef(null);
  const dragControls = useDragControls();

  const openModal = useCallback((triggerElement) => {
    if (triggerElement instanceof HTMLElement) {
      triggerElementRef.current = triggerElement;
    } else if (document.activeElement instanceof HTMLElement) {
      triggerElementRef.current = document.activeElement;
    }
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleModal = useCallback(
    (triggerElement) => {
      if (isOpen) {
        closeModal();
        return;
      }
      openModal(triggerElement);
    },
    [closeModal, isOpen, openModal],
  );

  const dispatchShortcut = useCallback(
    (shortcutId) => {
      switch (shortcutId) {
        case 'nav-home':
          window.dispatchEvent(new CustomEvent('bmp-shortcut:navigate', { detail: { view: 'home' } }));
          break;
        case 'nav-marketplace':
          window.dispatchEvent(new CustomEvent('bmp-shortcut:navigate', { detail: { view: 'marketplace' } }));
          break;
        case 'nav-quotes':
          window.dispatchEvent(new CustomEvent('bmp-shortcut:navigate', { detail: { view: 'quotes' } }));
          break;
        case 'nav-invoices':
          window.dispatchEvent(new CustomEvent('bmp-shortcut:navigate', { detail: { view: 'invoices' } }));
          break;
        case 'b2b-new-order':
          window.dispatchEvent(new Event('bmp-shortcut:new-order'));
          window.dispatchEvent(new Event('artisan-shortcut:new-project'));
          break;
        case 'b2b-scan-materials':
          window.dispatchEvent(new Event('bmp-shortcut:scan-materials'));
          window.dispatchEvent(new CustomEvent('bmp-shortcut:navigate', { detail: { view: 'marketplace' } }));
          break;
        case 'b2b-export-pdf':
          window.dispatchEvent(new Event('bmp-shortcut:export-pdf'));
          window.print();
          break;
        case 'ui-dark-mode': {
          const root = document.documentElement;
          const nowDark = !root.classList.contains('dark');
          root.classList.toggle('dark', nowDark);
          window.dispatchEvent(new CustomEvent('bmp-shortcut:dark-mode', { detail: { enabled: nowDark } }));
          break;
        }
        case 'ui-open-palette':
          openModal(document.activeElement);
          break;
        default:
          break;
      }
    },
    [openModal],
  );

  useSequenceDetection(
    ['g', 'h'],
    (event) => {
      event.preventDefault();
      dispatchShortcut('nav-home');
    },
    { timeout: 500, enabled: !isOpen },
  );

  useSequenceDetection(
    ['g', 'm'],
    (event) => {
      event.preventDefault();
      dispatchShortcut('nav-marketplace');
    },
    { timeout: 500, enabled: !isOpen },
  );

  useSequenceDetection(
    ['g', 'q'],
    (event) => {
      event.preventDefault();
      dispatchShortcut('nav-quotes');
    },
    { timeout: 500, enabled: !isOpen },
  );

  useSequenceDetection(
    ['g', 'f'],
    (event) => {
      event.preventDefault();
      dispatchShortcut('ui-open-palette');
    },
    { timeout: 500, enabled: !isOpen },
  );

  useSequenceDetection(
    ['g', 'b'],
    (event) => {
      event.preventDefault();
      dispatchShortcut('nav-invoices');
    },
    { timeout: 500, enabled: !isOpen },
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented) return;

      const key = normalizeKey(event.key);

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        closeModal();
        return;
      }

      if ((event.key === '?' || (event.key === '/' && event.shiftKey)) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        toggleModal(document.activeElement);
        return;
      }

      if (isOpen) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === 'p') {
        event.preventDefault();
        dispatchShortcut('b2b-export-pdf');
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return;
      }

      if (key === 'n') {
        event.preventDefault();
        dispatchShortcut('b2b-new-order');
        return;
      }

      if (key === 's') {
        event.preventDefault();
        dispatchShortcut('b2b-scan-materials');
        return;
      }

      if (key === 'd') {
        event.preventDefault();
        dispatchShortcut('ui-dark-mode');
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [closeModal, dispatchShortcut, isOpen, toggleModal]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const returnTarget =
      triggerElementRef.current instanceof HTMLElement ? triggerElementRef.current : document.activeElement;

    const ensureFocusInside = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        return;
      }

      const container = dialogRef.current;
      if (!container) return;

      const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    };

    const trapFocus = (event) => {
      if (event.key !== 'Tab') return;

      const container = dialogRef.current;
      if (!container) return;

      const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => {
        if (!(element instanceof HTMLElement)) return false;
        return !element.hasAttribute('disabled') && element.tabIndex !== -1;
      });

      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.requestAnimationFrame(ensureFocusInside);
    document.addEventListener('keydown', trapFocus, true);

    return () => {
      document.removeEventListener('keydown', trapFocus, true);
      if (returnTarget instanceof HTMLElement && document.contains(returnTarget)) {
        returnTarget.focus();
      }
    };
  }, [isOpen]);

  const groupedShortcuts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = SHORTCUTS.filter((shortcut) => {
      if (!query) return true;
      const categoryLabel = CATEGORY_META[shortcut.category]?.label || shortcut.category;
      const searchableText = `${shortcut.action} ${shortcut.description} ${shortcut.category} ${categoryLabel} ${shortcut.keys.join(' ')}`.toLowerCase();
      return searchableText.includes(query);
    });

    return CATEGORY_ORDER.map((categoryKey) => {
      const shortcutsInCategory = filtered.filter((shortcut) => shortcut.category === categoryKey);
      if (shortcutsInCategory.length === 0) return null;

      return {
        id: categoryKey,
        label: CATEGORY_META[categoryKey].label,
        description: CATEGORY_META[categoryKey].description,
        icon: CATEGORY_META[categoryKey].icon,
        shortcuts: shortcutsInCategory,
      };
    }).filter(Boolean);
  }, [searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const titleId = 'keyboard-shortcuts-help-title';

  return (
    <>
      <button
        type="button"
        aria-label="Ouvrir l aide clavier"
        onClick={(event) => openModal(event.currentTarget)}
        className="fixed bottom-6 right-6 z-[95] inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:bg-gray-50"
      >
        <Keyboard size={18} />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <KeyboardHelpModal
            isOpen={isOpen}
            onClose={closeModal}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            groupedShortcuts={groupedShortcuts}
            titleId={titleId}
            dialogRef={dialogRef}
            searchInputRef={searchInputRef}
            dragControls={dragControls}
          />,
          document.body,
        )}
    </>
  );
}
