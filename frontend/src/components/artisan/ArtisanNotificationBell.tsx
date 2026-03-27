import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, Clock3, Truck, CreditCard } from 'lucide-react';
import axios from 'axios';

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  icon?: string;
}

const getToken = () => {
  const s = localStorage.getItem('user');
  if (s) {
    try { return JSON.parse(s).token; } catch { /* */ }
  }
  return localStorage.getItem('token') || null;
};

const getTimeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const renderNotificationIcon = (icon?: string) => {
  if (icon === 'Clock3') return <Clock3 size={18} />;
  if (icon === 'Truck') return <Truck size={18} />;
  if (icon === 'CreditCard') return <CreditCard size={18} />;
  return <Bell size={18} />;
};

export default function ArtisanNotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const fetchNotifications = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore silently in header bell
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    const refresh = () => fetchNotifications();
    window.addEventListener('artisan-invoice-payment-success', refresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('artisan-invoice-payment-success', refresh);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const token = getToken();
    if (!token) return;
    try {
      await axios.put(`${API_URL}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    const token = getToken();
    if (!token) return;
    try {
      await axios.put(`${API_URL}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`p-3 rounded-xl relative overflow-visible transition-colors ${open ? 'bg-gray-100' : 'hover:bg-gray-100'}`}
        aria-label="Notifications"
      >
        <Bell size={20} className={`transition-colors ${open ? 'text-foreground' : 'text-muted-foreground'}`} />
        {unreadCount > 0 && (
          <span
            className="absolute top-0 right-0 z-20 inline-flex h-5 min-w-5 -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none shadow-sm"
            style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-4 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
            <div>
              <h3 className="font-bold text-foreground text-lg tracking-tight">Notifications</h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                You have <span className="text-destructive font-bold">{unreadCount}</span> unread messages
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-bold flex items-center gap-1.5"
                title="Mark all as read"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto bg-white">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center text-muted-foreground">
                <Bell size={24} className="mb-3 text-gray-300" />
                No notifications yet.
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {notifications.map((n) => (
                  <div
                    key={n._id}
                    onClick={() => !n.read && markRead(n._id)}
                    className={`group relative flex items-start gap-3 p-4 rounded-2xl transition-all duration-300 border ${
                      !n.read
                        ? 'bg-white border-blue-100 shadow-sm cursor-pointer hover:shadow-md'
                        : 'bg-white/50 border-transparent hover:bg-white hover:border-gray-100'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${!n.read ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                      {renderNotificationIcon(n.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className={`text-sm font-bold ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {n.title}
                        </h4>
                        <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap">
                          {getTimeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-gray-500">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-100 bg-gray-50/80 text-center">
            <button
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors py-1 px-3 rounded-lg hover:bg-primary/5"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
