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

  const markRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    <div className="relative z-50 flex items-center justify-center p-2" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className={`p-2.5 w-11 h-11 rounded-xl relative overflow-visible transition-all duration-300 flex items-center justify-center ${
          open 
            ? 'bg-destructive/10 text-destructive' 
            : 'hover:bg-gray-100 text-gray-500 hover:text-destructive'
        }`}
        aria-label="Notifications"
      >
        <Bell 
          size={24} 
          className={`transition-transform duration-300 stroke-[2.5px] ${open ? 'rotate-12 text-destructive' : 'text-gray-700'}`} 
          fill={open ? "currentColor" : "none"}
        />
        {unreadCount > 0 && (
          <span 
            className="absolute -top-2 right-0 translate-x-1/2 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-destructive text-[11px] font-extrabold text-white shadow-md"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-4 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden transform origin-top-right transition-all animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Header */}
          <div className="relative px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
            <div>
              <h3 className="font-bold text-foreground text-lg tracking-tight">Notifications</h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5 whitespace-nowrap">
                You have <span className="text-destructive font-bold">{unreadCount}</span> unread messages
              </p>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="p-2 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Clear all notifications"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent bg-white">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <Bell size={24} className="text-gray-300" />
                </div>
                <h4 className="font-bold text-gray-900 mb-2">All caught up!</h4>
                <p className="text-sm text-gray-500 max-w-[240px] leading-relaxed mx-auto">
                  When you get notifications, they'll show up here with all the details.
                </p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {notifications.map((n) => (
                  <div
                    key={n._id}
                    onClick={() => !n.read && markRead(n._id)}
                    className={`group relative flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 border ${
                      !n.read
                        ? 'bg-white border-blue-100 shadow-md shadow-blue-500/5 cursor-pointer hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5'
                        : 'bg-white/50 border-transparent hover:bg-white hover:border-gray-100 hover:shadow-sm'
                    }`}
                  >
                    {/* Unread Indicator Bar */}
                    {!n.read && (
                      <div className="absolute left-0 top-6 bottom-6 w-1 bg-primary rounded-r-full" />
                    )}

                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors shadow-sm ${
                      !n.read 
                        ? 'bg-gradient-to-br from-primary to-blue-600 text-white shadow-blue-200' 
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Factory size={20} className={!n.read ? 'animate-pulse' : ''} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className={`text-sm font-bold leading-tight ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {n.title}
                        </h4>
                        <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded-md">
                          {getTimeAgo(n.createdAt)}
                        </span>
                      </div>
                      
                      <p className={`text-xs leading-relaxed line-clamp-2 ${!n.read ? 'text-gray-600 font-medium' : 'text-gray-500'}`}>
                        {n.message}
                      </p>
                    </div>

                    {/* Unread Dot (if extremely fresh, maybe?) - removing for cleaner look, bar is enough */}
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-primary absolute top-4 right-4 ring-4 ring-blue-50 animate-pulse" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-3 border-t border-gray-100 bg-gray-50/80 text-center backdrop-blur-sm">
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
