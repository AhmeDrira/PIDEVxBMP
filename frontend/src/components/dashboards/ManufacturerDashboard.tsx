import React, { useState, useEffect, lazy, Suspense } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Home, Package, ShoppingBag, ClipboardList } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import ManufacturerHome from '../manufacturer/ManufacturerHome';
import NotificationBell from '../common/NotificationBell';
import axios from 'axios';

// ── Lazy-loaded views ────────────────────────────────────────────────────
const ManufacturerProducts    = lazy(() => import('../manufacturer/ManufacturerProducts'));
const ManufacturerOrders      = lazy(() => import('../manufacturer/ManufacturerOrders'));
const ManufacturerProfile     = lazy(() => import('../manufacturer/ManufacturerProfile'));
const MyReports               = lazy(() => import('../common/MyReports'));
const PersonalisationSettings = lazy(() => import('../common/PersonalisationSettings'));

const ViewFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
    <div style={{
      width: 32, height: 32,
      border: '3px solid #e5e7eb',
      borderTopColor: '#1e40af',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

interface ManufacturerDashboardProps {
  onLogout: () => void;
}

export default function ManufacturerDashboard({ onLogout }: ManufacturerDashboardProps) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  const { t } = useLanguage();
  const [activeView, setActiveView] = useState('home');
  const [unreadOrdersCount, setUnreadOrdersCount] = useState(0);

  // --- RÉCUPÉRATION DYNAMIQUE ---
  const [currentUser, setCurrentUser] = useState(() => {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  });

  const fetchUnreadCount = async () => {
    try {
      const s = localStorage.getItem('user');
      const token = s ? JSON.parse(s).token : localStorage.getItem('token');
      if (!token) return;
      
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filtrer les notifications non lues de type 'new_order'
      const notifications = Array.isArray(res.data) ? res.data : [];
      const unreadOrders = notifications.filter((n: any) => !n.read && n.type === 'new_order');
      setUnreadOrdersCount(unreadOrders.length);
    } catch (err) {
      console.error("Error fetching unread orders count:", err);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Rafraîchir toutes les 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = () => {
      const s = localStorage.getItem('user');
      setCurrentUser(s ? JSON.parse(s) : null);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Pour un manufacturer, on affiche le nom de l'entreprise. S'il n'y en a pas, on met le nom du gérant.
  const displayName = currentUser?.companyName || (currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Manufacturer');
  const role = currentUser?.role || 'manufacturer';
  const profilePhoto = currentUser?.profilePhoto || '';
  // ------------------------------

  const menuItems =[
    { id: 'home', label: t('home'), icon: <Home size={20} /> },
    { id: 'products', label: t('myProducts'), icon: <Package size={20} /> },
    { id: 'orders', label: t('orders'), icon: <ShoppingBag size={20} /> },
    { id: 'reports', label: t('myReports'), icon: <ClipboardList size={20} /> },
  ];

  const handleMenuItemClick = async (id: string) => {
    setActiveView(id);
    if (id === 'orders' && unreadOrdersCount > 0) {
      // Marquer les notifications de type 'new_order' comme lues
      try {
        const s = localStorage.getItem('user');
        const token = s ? JSON.parse(s).token : localStorage.getItem('token');
        if (!token) return;

        // On récupère toutes les notifications
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // On filtre celles qui sont de type 'new_order' et non lues
        const notifications = Array.isArray(res.data) ? res.data : [];
        const unreadOrders = notifications.filter((n: any) => !n.read && n.type === 'new_order');
        
        // On les marque comme lues
        for (const n of unreadOrders) {
          await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/notifications/${n._id}/read`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        
        setUnreadOrdersCount(0);
      } catch (err) {
        console.error("Error marking orders as read:", err);
      }
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'home':
        return <ManufacturerHome onNavigate={setActiveView} />;
      case 'products':
        return <ManufacturerProducts />;
      case 'orders':
        return <ManufacturerOrders />;
      case 'reports':
        return <MyReports role="manufacturer" userId={String(currentUser?._id || currentUser?.id || 'manufacturer')} />;
      case 'profile':
        return <ManufacturerProfile />;
      case 'personalisation':
        return <PersonalisationSettings />;
      default:
        return <ManufacturerHome onNavigate={setActiveView} />;
    }
  };

  return (
    <>
      <DashboardLayout
        menuItems={menuItems}
        activeItem={activeView}
        onMenuItemClick={handleMenuItemClick}
        onLogoClick={() => setActiveView('home')}
        onLogout={onLogout}
        onViewProfile={() => setActiveView('profile')}
        onEditProfile={() => setActiveView('profile')}
        onPersonalisation={() => setActiveView('personalisation')}
        userRole={role}
        userName={displayName}
        profilePhoto={profilePhoto}
        bellComponent={<NotificationBell />}
      >
        <Suspense fallback={<ViewFallback />}>{renderContent()}</Suspense>
      </DashboardLayout>
    </>
  );
}
