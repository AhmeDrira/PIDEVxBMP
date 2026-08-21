import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, X, Mail, MapPin, Clock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  _id: string;
  title: string;
  type: 'projet' | 'rdv' | 'disponibilite' | 'conge' | 'rappel';
  startDate: string;
  endDate: string;
  description?: string;
  location?: string;
  color?: string;
}

const TYPE_COLORS: Record<string, string> = {
  projet:        '#3b82f6',
  disponibilite: '#10b981',
  conge:         '#ef4444',
};

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:5000';
const API_URL = `${API_BASE}/api`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const days: Date[] = [];
  for (let i = startDow - 1; i >= 0; i--) days.push(new Date(year, month, -i));
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) days.push(new Date(year, month + 1, d));
  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
  return events.filter(e => {
    const s = new Date(e.startDate);
    const en = new Date(e.endDate);
    return s <= dayEnd && en >= dayStart;
  });
}

function fmtDate(d: Date, language: string) {
  const locale = language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : 'en-GB';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── ReadOnlyCalendar ─────────────────────────────────────────────────────────

interface ReadOnlyCalendarProps {
  artisanId: string;
  onContact?: () => void;
}

export default function ReadOnlyCalendar({ artisanId, onContact }: ReadOnlyCalendarProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    if (!artisanId) return;
    setLoading(true);
    axios
      .get(`${API_URL}/calendar/public/${artisanId}`)
      .then(res => setEvents(Array.isArray(res.data) ? res.data : []))
      .catch(err => console.error('Failed to load public calendar', err))
      .finally(() => setLoading(false));
  }, [artisanId]);

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const MONTHS = language === 'ar' ? MONTHS_AR : language === 'fr' ? MONTHS_FR : MONTHS_EN;

  const DOW_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const DOW_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const DOW_AR = ['إث','ثل','أر','خم','جم','سب','أح'];
  const DOW = language === 'ar' ? DOW_AR : language === 'fr' ? DOW_FR : DOW_EN;

  const today = new Date();
  const days = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());

  const visibleEvents = events.filter(e => ['disponibilite', 'conge', 'projet'].includes(e.type));
  const hasAvailability = visibleEvents.some(
    e => e.type === 'disponibilite' &&
      new Date(e.startDate).getMonth() === currentDate.getMonth() &&
      new Date(e.startDate).getFullYear() === currentDate.getFullYear()
  );

  const typeLabel = (type: string) => {
    if (type === 'disponibilite') return tr('Availability', 'Disponibilité', 'توفر');
    if (type === 'projet') return tr('Project', 'Projet', 'مشروع');
    return tr('Day Off', 'Congé', 'إجازة');
  };

  return (
    <div className="space-y-3">
      {/* ── Header ── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-border hover:bg-muted transition-colors text-foreground"
            >
              {tr('Today', "Aujourd'hui", 'اليوم')}
            </button>
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }}
                className="p-1.5 hover:bg-muted transition-colors border-r border-border"
                aria-label="previous month"
              >
                <ChevronLeft size={15} className="text-foreground" />
              </button>
              <button
                onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }}
                className="p-1.5 hover:bg-muted transition-colors"
                aria-label="next month"
              >
                <ChevronRight size={15} className="text-foreground" />
              </button>
            </div>
            <h3 className="text-base font-bold text-foreground">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
          </div>
          {loading && (
            <span className="text-xs text-muted-foreground animate-pulse">
              {tr('Loading...', 'Chargement...', 'جاري التحميل...')}
            </span>
          )}
        </div>
      </div>

      {/* ── Availability Banner ── */}
      <div className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${
        hasAvailability
          ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
          : 'bg-muted/30 border-border'
      }`}>
        <p className={`text-sm font-medium ${hasAvailability ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`}>
          {hasAvailability
            ? tr('✅ This artisan has availability this month', '✅ Cet artisan a des créneaux disponibles ce mois', '✅ هذا الحرفي لديه أوقات متاحة هذا الشهر')
            : tr('ℹ️ No availability shown for this month', 'ℹ️ Aucun créneau disponible ce mois', 'ℹ️ لا توجد أوقات متاحة هذا الشهر')}
        </p>
        {hasAvailability && onContact && (
          <Button
            onClick={onContact}
            size="sm"
            className="flex items-center gap-1.5 rounded-xl text-white flex-shrink-0 text-xs h-8 px-3"
          >
            <Mail size={13} />
            {tr('Contact', 'Contacter', 'تواصل')}
          </Button>
        )}
      </div>

      {/* ── Calendar Grid ── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* DOW header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {DOW.map(d => (
            <div key={d} className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {days.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = isSameDay(day, today);
            const dayEvents = eventsOnDay(visibleEvents, day);
            return (
              <div
                key={idx}
                className={`min-h-[100px] p-1.5 border-r border-b border-border ${!isCurrentMonth ? 'bg-muted/10' : 'bg-card'}`}
              >
                <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1 ${
                  isToday
                    ? 'bg-primary text-white shadow-sm'
                    : isCurrentMonth
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}>
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 2).map(ev => {
                    const color = ev.color || TYPE_COLORS[ev.type] || '#94a3b8';
                    return (
                      <button
                        key={ev._id}
                        onClick={() => setSelectedEvent(ev)}
                        className="w-full text-left text-xs px-1.5 py-0.5 rounded-md truncate text-white font-medium leading-5 hover:brightness-110 transition-all"
                        style={{ backgroundColor: color }}
                      >
                        {ev.title}
                      </button>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <p className="text-xs text-muted-foreground pl-1 font-medium">
                      +{dayEvents.length - 2} {language === 'fr' ? 'autre(s)' : language === 'ar' ? 'أخرى' : 'more'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-4 px-1">
        {[
          { type: 'disponibilite', label: tr('Available', 'Disponible', 'متاح') },
          { type: 'projet',        label: tr('In Progress', 'En cours', 'قيد التنفيذ') },
          { type: 'conge',         label: tr('Unavailable', 'Absent', 'غير متاح') },
        ].map(item => (
          <div key={item.type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[item.type] }} />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Event Detail Popup ── */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-border">
              <div>
                <span
                  className="inline-block text-xs text-white font-medium px-2.5 py-1 rounded-full mb-2"
                  style={{ backgroundColor: selectedEvent.color || TYPE_COLORS[selectedEvent.type] || '#94a3b8' }}
                >
                  {typeLabel(selectedEvent.type)}
                </span>
                <h3 className="text-lg font-bold text-foreground leading-tight">{selectedEvent.title}</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0 ml-3"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Clock size={15} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p>{fmtDate(new Date(selectedEvent.startDate), language)}</p>
                  {!isSameDay(new Date(selectedEvent.startDate), new Date(selectedEvent.endDate)) && (
                    <p className="text-xs">→ {fmtDate(new Date(selectedEvent.endDate), language)}</p>
                  )}
                </div>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin size={15} className="flex-shrink-0" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.description && (
                <p className="text-sm text-foreground leading-relaxed">{selectedEvent.description}</p>
              )}
            </div>

            {/* Footer */}
            {selectedEvent.type === 'disponibilite' && onContact && (
              <div className="px-5 pb-5">
                <Button
                  onClick={() => { setSelectedEvent(null); onContact(); }}
                  className="w-full rounded-xl text-white flex items-center gap-2"
                >
                  <Mail size={15} />
                  {tr('Contact for this slot', 'Contacter pour ce créneau', 'تواصل لهذا الوقت')}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
