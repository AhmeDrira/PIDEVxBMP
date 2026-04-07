import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Home, FolderKanban, ShoppingCart, FileText, Receipt, MessageSquare, CreditCard, ShoppingBag, ClipboardList, Keyboard, Search } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import ArtisanHome from '../artisan/ArtisanHome';
import ArtisanProjects from '../artisan/ArtisanProjects';
import ArtisanMarketplace from '../artisan/ArtisanMarketplace';
import ArtisanQuotes from '../artisan/ArtisanQuotes';
import ArtisanInvoices from '../artisan/ArtisanInvoices';
import ArtisanMessages from '../artisan/ArtisanMessages';
import ArtisanSubscription from '../artisan/ArtisanSubscription';
import ArtisanProfile from '../artisan/ArtisanProfile';
import ArtisanPortfolio from '../artisan/ArtisanPortfolio';
import PortfolioGalleryPage from '../artisan/PortfolioGalleryPage';
import MyOrders from '../common/MyOrders';
import ArtisanNotificationBell from '../artisan/ArtisanNotificationBell';
import ArtisanProfileReviews from '../artisan/ArtisanProfileReviews';
import MyReports from '../common/MyReports';
import CopilotChatWidget from '../common/CopilotChatWidget';
import axios from 'axios';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

interface ArtisanDashboardProps {
  onLogout: () => void;
}

type CommandAction = {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  run: () => void;
};

export default function ArtisanDashboard({ onLogout }: ArtisanDashboardProps) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  const { t } = useLanguage();
  const[activeView, setActiveView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('artisanView');
    return fromQuery || 'home';
  });
  const [selectedPortfolioItemId, setSelectedPortfolioItemId] = useState<string | null>(null);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const goSequenceArmedRef = useRef(false);
  const goSequenceTimeoutRef = useRef<number | null>(null);

  const [currentUser, setCurrentUser] = useState(() => {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  });
  const [cartCount, setCartCount] = useState(0);
  // Check subscription status from backend and store in sessionStorage
  useEffect(() => {
    const checkSubscription = async () => {
      try {
        let token = localStorage.getItem('token');
        const userStorage = localStorage.getItem('user');
        if (!token && userStorage) token = JSON.parse(userStorage).token;
        if (!token) return;

        const res = await axios.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const isActive = res.data?.subscription?.status === 'active';
        sessionStorage.setItem('artisan-sub-active', isActive ? '1' : '0');
      } catch (err) {
        console.error('Subscription check failed:', err);
      }
    };
    checkSubscription();

    const onSubSuccess = () => checkSubscription();
    window.addEventListener('artisan-subscription-verified', onSubSuccess);
    return () => window.removeEventListener('artisan-subscription-verified', onSubSuccess);
  }, []);

  useEffect(() => {
    const handler = () => {
      const s = localStorage.getItem('user');
      setCurrentUser(s ? JSON.parse(s) : null);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('artisanView');
    if (fromQuery) {
      setActiveView(fromQuery);
      params.delete('artisanView');
      const cleaned = params.toString();
      window.history.replaceState({}, '', cleaned ? `/?${cleaned}` : '/');
    }
  }, []);

  useEffect(() => {
    const handler = () => setActiveView('messages');
    window.addEventListener('goto-messages-call', handler);
    return () => window.removeEventListener('goto-messages-call', handler);
  }, []);

  useEffect(() => {
    const getCartKey = () => {
      try {
        const u = localStorage.getItem('user');
        if (u) { const p = JSON.parse(u); if (p._id || p.id) return `artisan-marketplace-cart-${p._id || p.id}`; }
      } catch { /* ignore */ }
      return 'artisan-marketplace-cart';
    };
    const syncCartCount = () => {
      try {
        const raw = sessionStorage.getItem(getCartKey());
        if (!raw) {
          setCartCount(0);
          return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          setCartCount(0);
          return;
        }
        const totalQty = parsed.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0);
        setCartCount(totalQty);
      } catch {
        setCartCount(0);
      }
    };

    syncCartCount();
    window.addEventListener('storage', syncCartCount);
    window.addEventListener('artisan-cart-updated', syncCartCount as EventListener);
    window.addEventListener('focus', syncCartCount);
    return () => {
      window.removeEventListener('storage', syncCartCount);
      window.removeEventListener('artisan-cart-updated', syncCartCount as EventListener);
      window.removeEventListener('focus', syncCartCount);
    };
  }, []);

  const fullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Artisan';
  const role = currentUser?.role || 'artisan';
  const profilePhoto = currentUser?.profilePhoto || '';

  const menuItems = [
    { id: 'home', label: t('nav.home'), icon: <Home size={20} /> },
    { id: 'projects', label: t('nav.myProjects'), icon: <FolderKanban size={20} /> },
    { id: 'marketplace', label: t('nav.marketplace'), icon: <ShoppingCart size={20} /> },
    { id: 'quotes', label: t('nav.quotes'), icon: <FileText size={20} /> },
    { id: 'invoices', label: t('nav.invoices'), icon: <Receipt size={20} /> },
    { id: 'messages', label: t('nav.messages'), icon: <MessageSquare size={20} /> },
    { id: 'subscription', label: t('nav.subscription'), icon: <CreditCard size={20} /> },
    { id: 'orders', label: t('nav.myOrders'), icon: <ShoppingBag size={20} /> },
    { id: 'reports', label: t('nav.myReports'), icon: <ClipboardList size={20} /> },
  ];

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
    if (target.isContentEditable) return true;
    if (target.closest('[contenteditable="true"]')) return true;
    if (target.getAttribute('role') === 'textbox' || target.closest('[role="textbox"]')) return true;
    return false;
  };

  const clearGoSequence = useCallback(() => {
    goSequenceArmedRef.current = false;
    if (goSequenceTimeoutRef.current) {
      window.clearTimeout(goSequenceTimeoutRef.current);
      goSequenceTimeoutRef.current = null;
    }
  }, []);

  const armGoSequence = useCallback(() => {
    clearGoSequence();
    goSequenceArmedRef.current = true;
    goSequenceTimeoutRef.current = window.setTimeout(() => {
      goSequenceArmedRef.current = false;
      goSequenceTimeoutRef.current = null;
    }, 900);
  }, [clearGoSequence]);

  const focusSearchInActiveView = useCallback(() => {
    const root = document.querySelector<HTMLElement>(`[data-artisan-view="${activeView}"]`);
    if (!root) return false;

    const selectors = [
      '[data-artisan-search="true"]',
      'input[type="search"]',
      'input[placeholder*="Search" i]',
      'input[placeholder*="Rechercher" i]',
      'input[placeholder*="بحث" i]',
    ];

    for (const selector of selectors) {
      const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector));
      const target = candidates.find((el) => {
        if ((el as HTMLInputElement).disabled) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        return el.offsetParent !== null || window.getComputedStyle(el).position === 'fixed';
      });

      if (target) {
        target.focus();
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          target.select();
        }
        return true;
      }
    }

    return false;
  }, [activeView]);

  const triggerNewProject = useCallback(() => {
    if (activeView !== 'projects') {
      setActiveView('projects');
    }

    const fireShortcut = () => window.dispatchEvent(new Event('artisan-shortcut:new-project'));
    window.setTimeout(fireShortcut, 60);
    window.setTimeout(fireShortcut, 220);
  }, [activeView]);

  const hasOpenDialog = () =>
    Boolean(
      document.querySelector('[aria-modal="true"], [role="dialog"][data-state="open"], [data-slot="dialog-content"][data-state="open"]'),
    );

  const commandActions = useMemo<CommandAction[]>(
    () => [
      {
        id: 'home',
        label: tr('Go to Home', 'Aller a l accueil', 'اذهب إلى الرئيسية'),
        hint: 'G H',
        keywords: 'home accueil dashboard',
        run: () => setActiveView('home'),
      },
      {
        id: 'projects',
        label: tr('Go to Projects', 'Aller aux projets', 'اذهب إلى المشاريع'),
        hint: 'G P',
        keywords: 'projects projet',
        run: () => setActiveView('projects'),
      },
      {
        id: 'marketplace',
        label: tr('Go to Marketplace', 'Aller au marketplace', 'اذهب إلى السوق'),
        hint: 'G M',
        keywords: 'market marketplace materials',
        run: () => setActiveView('marketplace'),
      },
      {
        id: 'quotes',
        label: tr('Go to Quotes', 'Aller aux devis', 'اذهب إلى عروض الأسعار'),
        hint: 'G Q',
        keywords: 'quotes devis',
        run: () => setActiveView('quotes'),
      },
      {
        id: 'invoices',
        label: tr('Go to Invoices', 'Aller aux factures', 'اذهب إلى الفواتير'),
        hint: 'G I',
        keywords: 'invoices factures',
        run: () => setActiveView('invoices'),
      },
      {
        id: 'subscription',
        label: tr('Go to Subscription', 'Aller a l abonnement', 'اذهب إلى الاشتراك'),
        hint: 'G S',
        keywords: 'subscription abonnement',
        run: () => setActiveView('subscription'),
      },
      {
        id: 'messages',
        label: tr('Go to Messages', 'Aller aux messages', 'اذهب إلى الرسائل'),
        hint: 'G C',
        keywords: 'messages chat conversation',
        run: () => setActiveView('messages'),
      },
      {
        id: 'orders',
        label: tr('Go to Orders', 'Aller aux commandes', 'اذهب إلى الطلبات'),
        hint: 'G O',
        keywords: 'orders commandes',
        run: () => setActiveView('orders'),
      },
      {
        id: 'reports',
        label: tr('Go to Reports', 'Aller aux rapports', 'اذهب إلى البلاغات'),
        hint: 'G R',
        keywords: 'reports rapports',
        run: () => setActiveView('reports'),
      },
      {
        id: 'search',
        label: tr('Focus search in current view', 'Focus recherche dans la vue active', 'تركيز البحث في الصفحة الحالية'),
        hint: '/',
        keywords: 'search focus rechercher',
        run: () => {
          focusSearchInActiveView();
        },
      },
      {
        id: 'new-project',
        label: tr('Create new project', 'Creer un nouveau projet', 'إنشاء مشروع جديد'),
        hint: 'N',
        keywords: 'new project create',
        run: triggerNewProject,
      },
    ],
    [focusSearchInActiveView, triggerNewProject, tr],
  );

  const filteredCommandActions = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return commandActions;

    return commandActions.filter((action) =>
      `${action.label} ${action.keywords} ${action.hint}`.toLowerCase().includes(query),
    );
  }, [commandActions, commandQuery]);

  const runCommandAction = useCallback((action: CommandAction) => {
    action.run();
    setIsCommandPaletteOpen(false);
    setCommandQuery('');
  }, []);

  useEffect(() => {
    const goMap: Record<string, string> = {
      h: 'home',
      p: 'projects',
      m: 'marketplace',
      q: 'quotes',
      i: 'invoices',
      s: 'subscription',
      c: 'messages',
      o: 'orders',
      r: 'reports',
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const rawKey = event.key;
      const key = rawKey.toLowerCase();

      if (rawKey === 'Escape') {
        clearGoSequence();

        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
          event.preventDefault();
          return;
        }

        if (isShortcutHelpOpen) {
          setIsShortcutHelpOpen(false);
          event.preventDefault();
          return;
        }

        if (hasOpenDialog()) {
          return;
        }

        if (activeView !== 'home') {
          setActiveView('home');
          event.preventDefault();
        }
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        clearGoSequence();
        setCommandQuery('');
        setIsCommandPaletteOpen(true);
        window.dispatchEvent(new Event('artisan-open-command-palette'));
        event.preventDefault();
        return;
      }

      if (rawKey === '?' || (rawKey === '/' && event.shiftKey)) {
        clearGoSequence();
        setIsShortcutHelpOpen((prev) => !prev);
        event.preventDefault();
        return;
      }

      if (!event.shiftKey && rawKey === '/') {
        clearGoSequence();
        if (focusSearchInActiveView()) {
          event.preventDefault();
        }
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        clearGoSequence();
        return;
      }

      if (key === 'g') {
        armGoSequence();
        event.preventDefault();
        return;
      }

      if (goSequenceArmedRef.current) {
        const destination = goMap[key];
        clearGoSequence();
        if (destination) {
          setActiveView(destination);
          event.preventDefault();
        }
        return;
      }

      if (key === 'n') {
        triggerNewProject();
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearGoSequence();
    };
  }, [
    activeView,
    armGoSequence,
    clearGoSequence,
    focusSearchInActiveView,
    isCommandPaletteOpen,
    isShortcutHelpOpen,
    triggerNewProject,
  ]);

  const renderContent = () => {
    switch (activeView) {
      case 'home':
        return <ArtisanHome onNavigate={setActiveView} />;
      case 'projects':
        return <ArtisanProjects />;
      case 'marketplace':
        return <ArtisanMarketplace />;
      case 'quotes':
        return <ArtisanQuotes />;
      case 'invoices':
        return <ArtisanInvoices />;
      case 'messages':
        return <ArtisanMessages />;
      case 'subscription':
        return <ArtisanSubscription />;
      case 'profile':
        return <ArtisanProfile />;
      case 'portfolio':
        return <ArtisanPortfolio
          onViewReviews={() => setActiveView('reviews')}
          onViewGallery={(itemId) => { setSelectedPortfolioItemId(itemId); setActiveView('gallery'); }}
        />;
      case 'gallery':
        return selectedPortfolioItemId
          ? <PortfolioGalleryPage itemId={selectedPortfolioItemId} onBack={() => setActiveView('portfolio')} />
          : null;
      case 'reviews':
        return <ArtisanProfileReviews />;
      case 'orders':
        return <MyOrders />;
      case 'reports':
        return <MyReports role="artisan" userId={String(currentUser?._id || currentUser?.id || 'artisan')} />;
      default:
        return <ArtisanHome onNavigate={setActiveView} />;
    }
  };

  const handleViewProfile = () => {
    setActiveView('profile');
  };

  const handleEditProfile = () => {
    setActiveView('portfolio');
  };

  const handleViewReviews = () => {
    setActiveView('reviews');
  };

  const handleUpdatePassword = () => {
    setActiveView('update-password');
  };

  const openHeaderCart = () => {
    setActiveView('marketplace');
    window.history.pushState({}, '', '/?artisanView=marketplace&openCart=1');
    window.dispatchEvent(new Event('artisan-open-cart'));
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <ArtisanNotificationBell />
      <button
        className="p-3 rounded-xl hover:bg-muted relative overflow-visible transition-colors"
        type="button"
        aria-label="Open cart"
        onClick={openHeaderCart}
      >
        <ShoppingCart size={20} className="text-muted-foreground" />
        {cartCount > 0 && (
          <span
            className="absolute top-0 right-0 z-20 inline-flex h-5 min-w-5 -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none shadow-sm"
            style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
          >
            {cartCount > 99 ? '99+' : cartCount}
          </span>
        )}
      </button>
    </div>
  );

  return (
    <>
      <DashboardLayout
        menuItems={menuItems}
        activeItem={activeView}
        onMenuItemClick={setActiveView}
        onLogoClick={() => setActiveView('home')}
        onLogout={onLogout}
        onViewProfile={handleViewProfile}
        onEditProfile={handleEditProfile}
        editProfileLabel={t('profile.viewPortfolio')}
        onViewReviews={handleViewReviews}
        userRole={role}
        userName={fullName}
        profilePhoto={profilePhoto}
        bellComponent={headerActions}
      >
        <div data-artisan-view={activeView}>{renderContent()}</div>
      </DashboardLayout>

      <Dialog open={isShortcutHelpOpen} onOpenChange={setIsShortcutHelpOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard size={18} />
              {tr('Artisan Keyboard Shortcuts', 'Raccourcis clavier artisan', 'اختصارات لوحة مفاتيح الحرفي')}
            </DialogTitle>
            <DialogDescription>
              {tr(
                'Use G + key within 900ms to navigate quickly. Shortcuts are disabled while typing, except Escape.',
                'Utilisez G + touche sous 900 ms pour naviguer rapidement. Les raccourcis sont ignores en saisie, sauf Echap.',
                'استخدم G ثم المفتاح خلال 900 مللي ثانية للتنقل بسرعة. يتم تعطيل الاختصارات أثناء الكتابة ما عدا زر الهروب.',
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">G + H</span>
              <span>{tr('Home', 'Accueil', 'الرئيسية')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">G + P</span>
              <span>{tr('Projects', 'Projets', 'المشاريع')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">G + M</span>
              <span>{tr('Marketplace', 'Marketplace', 'السوق')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">G + Q</span>
              <span>{tr('Quotes', 'Devis', 'عروض الأسعار')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">G + I</span>
              <span>{tr('Invoices', 'Factures', 'الفواتير')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">G + S</span>
              <span>{tr('Subscription', 'Abonnement', 'الاشتراك')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">G + C</span>
              <span>{tr('Messages', 'Messages', 'الرسائل')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">G + O</span>
              <span>{tr('Orders', 'Commandes', 'الطلبات')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">G + R</span>
              <span>{tr('Reports', 'Rapports', 'البلاغات')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">/</span>
              <span>{tr('Focus main search field in the active view', 'Focus sur la recherche principale de la vue active', 'تركيز حقل البحث الرئيسي في الصفحة الحالية')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">N</span>
              <span>{tr('Create a new project', 'Creer un nouveau projet', 'إنشاء مشروع جديد')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">Ctrl/Cmd + K</span>
              <span>{tr('Open command palette', 'Ouvrir la palette de commandes', 'فتح لوحة الأوامر')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">Esc</span>
              <span>{tr('Close open dialog/panel, or return to Home', 'Fermer une modale/panneau ouvert, ou revenir a l accueil', 'إغلاق النافذة/اللوحة المفتوحة أو العودة للرئيسية')}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border p-3">
              <span className="font-mono text-primary">?</span>
              <span>{tr('Toggle this help', 'Afficher/Masquer cette aide', 'إظهار/إخفاء هذه المساعدة')}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCommandPaletteOpen}
        onOpenChange={(open) => {
          setIsCommandPaletteOpen(open);
          if (!open) setCommandQuery('');
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{tr('Command Palette', 'Palette de commandes', 'لوحة الأوامر')}</DialogTitle>
            <DialogDescription>
              {tr('Search and run dashboard actions.', 'Recherchez et executez des actions du dashboard.', 'ابحث ونفذ إجراءات لوحة التحكم.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder={tr('Type a command...', 'Tapez une commande...', 'اكتب أمراً...')}
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredCommandActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => runCommandAction(action)}
                  className="w-full rounded-lg border px-3 py-2 text-left hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">{action.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{action.hint}</span>
                  </div>
                </button>
              ))}

              {filteredCommandActions.length === 0 && (
                <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">
                  {tr('No command found.', 'Aucune commande trouvee.', 'لا يوجد أمر مطابق.')}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CopilotChatWidget
        role="artisan"
        activeView={activeView}
        isVisible={activeView === 'home'}
        onNavigate={setActiveView}
      />
    </>
  );
}
