import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, Factory } from 'lucide-react';
import axios from 'axios';

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await axios.get('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silently fail — admin may not be logged in yet
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
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

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await axios.put(`/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch { /* */ }
  };

  const markAllRead = async () => {
    const token = getToken();
    if (!token) return;
    try {
      await axios.put('/api/notifications/read-all', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* */ }
  };

  const clearAll = async () => {
    const token = getToken();
    if (!token) return;
    try {
      await axios.delete('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications([]);
    } catch { /* */ }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => {
          const opening = !open;
          setOpen(opening);
          if (opening && unreadCount > 0) markAllRead();
        }}
        className="p-3 rounded-xl hover:bg-gray-100 relative transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground text-base">Notifications</h3>
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <CheckCheck size={14} />
                  Clear all
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="py-14 text-center">
                <Bell size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-muted-foreground font-medium text-sm">No notifications yet</p>
                <p className="text-xs text-muted-foreground mt-1">New manufacturer requests will appear here</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n._id}
                  onClick={() => !n.read && markRead(n._id)}
                  className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                    !n.read
                      ? 'bg-blue-50/70 hover:bg-blue-100/60 cursor-pointer'
                      : 'bg-white hover:bg-gray-50 cursor-default'
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      !n.read ? 'bg-primary' : 'bg-gray-100'
                    }`}
                  >
                    <Factory size={16} className={!n.read ? 'text-white' : 'text-gray-400'} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-snug ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {getTimeAgo(n.createdAt)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
