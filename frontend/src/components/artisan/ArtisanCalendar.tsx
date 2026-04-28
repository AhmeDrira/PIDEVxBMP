import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Calendar, MapPin, Clock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  _id: string;
  artisanId: string;
  title: string;
  type: 'projet' | 'rdv' | 'disponibilite' | 'conge' | 'rappel';
  startDate: string;
  endDate: string;
  description?: string;
  location?: string;
  color?: string;
  projectId?: string | null;
  isPublic: boolean;
}

type ViewMode = 'month' | 'week' | 'day';

interface EventFormData {
  title: string;
  type: CalendarEvent['type'];
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  description: string;
  location: string;
  color: string;
  isPublic: boolean;
}

interface TooltipState {
  event: CalendarEvent;
  x: number;
  y: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<CalendarEvent['type'], string> = {
  projet:       '#3b82f6',
  rdv:          '#f59e0b',
  disponibilite:'#10b981',
  conge:        '#ef4444',
  rappel:       '#f97316',
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => {
  const t = localStorage.getItem('token');
  if (t) return t;
  try { return JSON.parse(localStorage.getItem('user') || '{}').token || ''; }
  catch { return ''; }
};

const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

const fmt = (d: Date, locale = 'fr-FR') => d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime = (d: Date) => d.toTimeString().slice(0, 5);

const toDateString = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

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

function getWeekDays(date: Date): Date[] {
  const dow = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
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

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ─── Event Tooltip ────────────────────────────────────────────────────────────

function EventTooltip({ tooltip, language }: { tooltip: TooltipState; language: string }) {
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const ev = tooltip.event;
  const color = ev.color || TYPE_COLORS[ev.type];
  const typeLabel: Record<CalendarEvent['type'], string> = {
    projet: tr('Project', 'Projet', 'مشروع'),
    rdv: tr('Meeting', 'RDV', 'موعد'),
    disponibilite: tr('Availability', 'Disponibilité', 'توفر'),
    conge: tr('Day Off', 'Congé', 'إجازة'),
    rappel: tr('Reminder', 'Rappel', 'تذكير'),
  };

  // Position tooltip: prefer above the cursor, shift left if near right edge
  const x = Math.min(tooltip.x - 8, window.innerWidth - 260);
  const y = tooltip.y - 8;

  return (
    <div
      style={{ position: 'fixed', left: x, top: y, zIndex: 9999, transform: 'translateY(-100%)' }}
      className="w-56 bg-card border border-border rounded-xl shadow-2xl p-3 pointer-events-none"
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-xs text-white font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: color }}
        >
          {typeLabel[ev.type]}
        </span>
      </div>
      <p className="font-semibold text-sm text-foreground truncate mb-1">{ev.title}</p>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock size={11} />
        {fmtTime(new Date(ev.startDate))} – {fmtTime(new Date(ev.endDate))}
      </p>
      {ev.location && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <MapPin size={11} />
          {ev.location}
        </p>
      )}
      {ev.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ev.description}</p>
      )}
    </div>
  );
}

// ─── Event Pill ───────────────────────────────────────────────────────────────

function EventPill({
  event,
  onClick,
  onHover,
  onHoverEnd,
}: {
  event: CalendarEvent;
  onClick: () => void;
  onHover?: (ev: CalendarEvent, x: number, y: number) => void;
  onHoverEnd?: () => void;
}) {
  const color = event.color || TYPE_COLORS[event.type];
  const startTime = fmtTime(new Date(event.startDate));
  const showTime = startTime !== '00:00';
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      onMouseEnter={e => onHover?.(event, e.clientX, e.clientY)}
      onMouseLeave={() => onHoverEnd?.()}
      className="w-full text-left text-xs px-1.5 py-0.5 rounded-md text-white font-medium leading-5 hover:brightness-110 transition-all overflow-hidden"
      style={{ backgroundColor: color }}
    >
      <span className="flex items-center gap-1 min-w-0">
        {showTime && <span className="opacity-90 flex-shrink-0 text-[10px] font-normal">{startTime}</span>}
        <span className="truncate">{event.title}</span>
      </span>
    </button>
  );
}

// ─── Event Modal ──────────────────────────────────────────────────────────────

interface EventModalProps {
  event: CalendarEvent | null;
  initialDate: Date | null;
  onClose: () => void;
  onSave: (data: Partial<EventFormData>, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  language: string;
}

function EventModal({ event, initialDate, onClose, onSave, onDelete, language }: EventModalProps) {
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const isProject = Boolean(event?.projectId);
  const isNew = !event;

  const initDate = initialDate || new Date();
  const initEnd = new Date(initDate);
  initEnd.setHours(initDate.getHours() + 1);

  const [form, setForm] = useState<EventFormData>({
    title: event?.title || '',
    type: event?.type || 'rdv',
    startDate: event ? toDateString(new Date(event.startDate)) : toDateString(initDate),
    startTime: event ? fmtTime(new Date(event.startDate)) : fmtTime(initDate),
    endDate: event ? toDateString(new Date(event.endDate)) : toDateString(initEnd),
    endTime: event ? fmtTime(new Date(event.endDate)) : fmtTime(initEnd),
    description: event?.description || '',
    location: event?.location || '',
    color: event?.color || '',
    isPublic: event ? event.isPublic : false,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError(tr('Title is required', 'Le titre est obligatoire', 'العنوان مطلوب')); return; }
    const startDT = new Date(`${form.startDate}T${form.startTime}`);
    const endDT = new Date(`${form.endDate}T${form.endTime}`);
    if (endDT <= startDT) { setError(tr('End must be after start', 'La fin doit être après le début', 'يجب أن تكون النهاية بعد البداية')); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, startDate: startDT.toISOString(), endDate: endDT.toISOString() } as any, event?._id);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || tr('Error saving event', 'Erreur lors de la sauvegarde', 'خطأ في الحفظ'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setDeleting(true);
    try {
      await onDelete(event._id);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || tr('Error deleting event', 'Erreur lors de la suppression', 'خطأ في الحذف'));
    } finally {
      setDeleting(false);
    }
  };

  const typeOptions: { value: CalendarEvent['type']; label: string }[] = [
    { value: 'rdv',          label: tr('Client Meeting', 'Rendez-vous client', 'موعد عميل') },
    { value: 'disponibilite',label: tr('Availability', 'Disponibilité', 'توفر') },
    { value: 'conge',        label: tr('Day Off / Absence', 'Congé / Absence', 'إجازة / غياب') },
    { value: 'rappel',       label: tr('Reminder', 'Rappel', 'تذكير') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            {isProject
              ? tr('Project Event', 'Événement Projet', 'حدث المشروع')
              : isNew
              ? tr('Add Event', 'Ajouter un événement', 'إضافة حدث')
              : tr('Edit Event', 'Modifier l\'événement', 'تعديل الحدث')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isProject && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
              {tr('This event is linked to a project. Edit dates from the Projects section.', 'Cet événement est lié à un projet. Modifiez les dates depuis la section Projets.', 'هذا الحدث مرتبط بمشروع. عدّل التواريخ من قسم المشاريع.')}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('Title', 'Titre', 'العنوان')} *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              disabled={isProject}
              placeholder={tr('Event title...', 'Titre de l\'événement...', 'عنوان الحدث...')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            />
          </div>

          {/* Type */}
          {!isProject && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{tr('Type', 'Type', 'النوع')} *</label>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, type: o.value }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-all ${
                      form.type === o.value
                        ? 'border-transparent text-white font-medium'
                        : 'border-border text-foreground hover:bg-muted'
                    }`}
                    style={form.type === o.value ? { backgroundColor: TYPE_COLORS[o.value] } : {}}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: TYPE_COLORS[o.value] }}
                    />
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{tr('Start Date', 'Début', 'تاريخ البدء')} *</label>
              <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} disabled={isProject}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{tr('Start Time', 'Heure début', 'وقت البدء')}</label>
              <input type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} disabled={isProject}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{tr('End Date', 'Fin', 'تاريخ النهاية')} *</label>
              <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} disabled={isProject}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{tr('End Time', 'Heure fin', 'وقت النهاية')}</label>
              <input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} disabled={isProject}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('Description', 'Description', 'الوصف')}</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              disabled={isProject}
              rows={2}
              placeholder={tr('Optional notes...', 'Notes optionnelles...', 'ملاحظات اختيارية...')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 resize-none"
            />
          </div>

          {/* Location + Color */}
          {!isProject && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{tr('Location', 'Lieu', 'الموقع')}</label>
                <input type="text" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                  placeholder={tr('Address...', 'Adresse...', 'العنوان...')}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{tr('Color', 'Couleur', 'اللون')}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.color || TYPE_COLORS[form.type]} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                    className="h-9 w-12 rounded-lg border border-border cursor-pointer bg-background" />
                  <span className="text-xs text-muted-foreground">{tr('Custom', 'Personnalisée', 'مخصص')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Public toggle */}
          {!isProject && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={e => setForm(p => ({ ...p, isPublic: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-foreground">
                {tr('Visible to experts (public)', 'Visible par les experts (public)', 'مرئي للخبراء (عام)')}
              </span>
            </label>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              {!isNew && !isProject && !confirmDelete && (
                <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
                  <Trash2 size={15} />
                  {tr('Delete', 'Supprimer', 'حذف')}
                </button>
              )}
              {confirmDelete && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-500">{tr('Confirm?', 'Confirmer?', 'تأكيد؟')}</span>
                  <button type="button" onClick={handleDelete} disabled={deleting}
                    className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50">
                    {deleting ? tr('Deleting...', 'Suppression...', 'جاري الحذف...') : tr('Yes', 'Oui', 'نعم')}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-sm text-muted-foreground hover:underline">
                    {tr('No', 'Non', 'لا')}
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                {tr('Cancel', 'Annuler', 'إلغاء')}
              </Button>
              {!isProject && (
                <Button type="submit" disabled={saving} className="rounded-xl text-white">
                  {saving ? tr('Saving...', 'Sauvegarde...', 'جاري الحفظ...') : tr('Save', 'Enregistrer', 'حفظ')}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
  onEventHover,
  onEventHoverEnd,
  language,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
  onEventHover: (ev: CalendarEvent, x: number, y: number) => void;
  onEventHoverEnd: () => void;
  language: string;
}) {
  const days = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
  const today = new Date();
  const DOW_LABELS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const DOW_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DOW_LABELS_AR = ['إث', 'ثل', 'أر', 'خم', 'جم', 'سب', 'أح'];
  const labels = language === 'ar' ? DOW_LABELS_AR : language === 'fr' ? DOW_LABELS_FR : DOW_LABELS_EN;

  return (
    <div className="flex-1 overflow-auto">
      {/* Day of week header */}
      <div className="grid grid-cols-7 border-b border-border" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {labels.map((l, i) => {
          const isWeekendCol = i === 5 || i === 6;
          return (
            <div key={l} className={`py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isWeekendCol ? 'text-muted-foreground/60 bg-muted/20' : 'text-muted-foreground bg-muted/30'}`}>
              {l}
            </div>
          );
        })}
      </div>
      {/* Days grid */}
      <div className="grid grid-cols-7" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {days.map((day, idx) => {
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = isSameDay(day, today);
          const dayEvents = eventsOnDay(events, day);
          const dow = day.getDay(); // 0=Sun, 6=Sat
          const isWeekend = dow === 0 || dow === 6;
          return (
            <div
              key={idx}
              onClick={() => onDayClick(day)}
              className={`min-h-[120px] p-1.5 border-r border-b border-border cursor-pointer transition-colors group ${
                !isCurrentMonth
                  ? 'bg-muted/20'
                  : isWeekend
                  ? 'bg-muted/10 hover:bg-muted/20'
                  : 'bg-card hover:bg-muted/20'
              }`}
            >
              <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1 transition-colors ${
                isToday
                  ? 'bg-primary text-white shadow-sm'
                  : isCurrentMonth
                  ? isWeekend ? 'text-muted-foreground' : 'text-foreground'
                  : 'text-muted-foreground opacity-40'
              }`}>
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(ev => (
                  <EventPill
                    key={ev._id}
                    event={ev}
                    onClick={() => onEventClick(ev)}
                    onHover={onEventHover}
                    onHoverEnd={onEventHoverEnd}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <button
                    onClick={e => { e.stopPropagation(); onEventClick(dayEvents[3]); }}
                    className="text-xs text-primary font-medium pl-1 hover:underline"
                  >
                    +{dayEvents.length - 3} {language === 'fr' ? 'autre(s)' : language === 'ar' ? 'أخرى' : 'more'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({
  currentDate,
  events,
  onSlotClick,
  onEventClick,
  onEventHover,
  onEventHoverEnd,
  language,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSlotClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
  onEventHover: (ev: CalendarEvent, x: number, y: number) => void;
  onEventHoverEnd: () => void;
  language: string;
}) {
  const weekDays = getWeekDays(currentDate);
  const today = new Date();
  const HOUR_HEIGHT = 60;
  const containerRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const nowTop = (now.getHours() * 60 + now.getMinutes()) * (HOUR_HEIGHT / 60);

  const eventStyle = (ev: CalendarEvent, dayStart: Date) => {
    const start = new Date(ev.startDate);
    const end = new Date(ev.endDate);
    const dayEnd = new Date(dayStart); dayEnd.setHours(23, 59, 59, 999);
    const clampedStart = start < dayStart ? dayStart : start;
    const clampedEnd = end > dayEnd ? dayEnd : end;
    const topMin = clampedStart.getHours() * 60 + clampedStart.getMinutes();
    const durationMin = Math.max(30, (clampedEnd.getTime() - clampedStart.getTime()) / 60000);
    return {
      top: topMin * (HOUR_HEIGHT / 60),
      height: Math.min(durationMin * (HOUR_HEIGHT / 60), 24 * HOUR_HEIGHT - topMin * (HOUR_HEIGHT / 60)),
    };
  };

  const MONTH_NAMES_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const MONTH_NAMES_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const months = language === 'fr' ? MONTH_NAMES_FR : MONTH_NAMES_EN;
  const DOW_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const DOW_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dowLabels = language === 'fr' ? DOW_FR : DOW_EN;

  return (
    <div className="flex-1 overflow-auto" ref={containerRef}>
      {/* Day headers */}
      <div className="grid grid-cols-week border-b border-border sticky top-0 bg-card z-10 shadow-sm" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
        <div />
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} className={`py-2 text-center border-l border-border ${isToday ? 'bg-primary/5' : ''}`}>
              <p className="text-xs font-medium text-muted-foreground">{dowLabels[i]}</p>
              <div className={`mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold mt-0.5 ${isToday ? 'bg-primary text-white shadow-sm' : 'text-foreground'}`}>
                {d.getDate()}
              </div>
              <p className="text-xs text-muted-foreground">{months[d.getMonth()]}</p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-week" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
        {/* Time column */}
        <div>
          {HOURS.map(h => (
            <div key={h} style={{ height: HOUR_HEIGHT }} className="border-b border-border flex items-start justify-end pr-2 pt-1">
              <span className="text-[11px] text-muted-foreground tabular-nums">{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((day, di) => {
          const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
          const dayEvents = eventsOnDay(events, day);
          const isToday = isSameDay(day, today);
          return (
            <div key={di} className={`relative border-l border-border ${isToday ? 'bg-primary/5' : ''}`}
              style={{ height: 24 * HOUR_HEIGHT }}>
              {/* Hour lines */}
              {HOURS.map(h => (
                <div
                  key={h}
                  style={{ height: HOUR_HEIGHT, top: h * HOUR_HEIGHT }}
                  className="absolute w-full border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => {
                    const d = new Date(day);
                    d.setHours(h, 0, 0, 0);
                    onSlotClick(d);
                  }}
                />
              ))}
              {/* Current time indicator */}
              {isToday && (
                <div style={{ top: nowTop, position: 'absolute', left: 0, right: 0, zIndex: 6, pointerEvents: 'none' }}>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                    <div className="flex-1 h-px bg-red-500" />
                  </div>
                </div>
              )}
              {/* Events */}
              {dayEvents.map(ev => {
                const { top, height } = eventStyle(ev, dayStart);
                const color = ev.color || TYPE_COLORS[ev.type];
                return (
                  <button
                    key={ev._id}
                    onMouseEnter={e => onEventHover(ev, e.clientX, e.clientY)}
                    onMouseLeave={() => onEventHoverEnd()}
                    onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                    style={{
                      top, height, position: 'absolute', left: 3, right: 3, zIndex: 5,
                      borderLeft: `4px solid ${color}`,
                      backgroundColor: `${color}22`,
                    }}
                    className="rounded-lg px-2 py-1 overflow-hidden text-left transition-all hover:brightness-95"
                  >
                    <p className="font-semibold text-xs truncate" style={{ color }}>{ev.title}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtTime(new Date(ev.startDate))}</p>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({
  currentDate,
  events,
  onSlotClick,
  onEventClick,
  onEventHover,
  onEventHoverEnd,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSlotClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
  onEventHover: (ev: CalendarEvent, x: number, y: number) => void;
  onEventHoverEnd: () => void;
}) {
  const HOUR_HEIGHT = 64;
  const dayStart = new Date(currentDate); dayStart.setHours(0, 0, 0, 0);
  const dayEvents = eventsOnDay(events, currentDate);
  const today = new Date();
  const isToday = isSameDay(currentDate, today);
  const now = new Date();
  const nowTop = (now.getHours() * 60 + now.getMinutes()) * (HOUR_HEIGHT / 60);

  const eventStyle = (ev: CalendarEvent) => {
    const start = new Date(ev.startDate);
    const end = new Date(ev.endDate);
    const dayEnd = new Date(currentDate); dayEnd.setHours(23, 59, 59, 999);
    const clampedStart = start < dayStart ? dayStart : start;
    const clampedEnd = end > dayEnd ? dayEnd : end;
    const topMin = clampedStart.getHours() * 60 + clampedStart.getMinutes();
    const durationMin = Math.max(30, (clampedEnd.getTime() - clampedStart.getTime()) / 60000);
    return {
      top: topMin * (HOUR_HEIGHT / 60),
      height: Math.min(durationMin * (HOUR_HEIGHT / 60), 24 * HOUR_HEIGHT - topMin * (HOUR_HEIGHT / 60)),
    };
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-day" style={{ gridTemplateColumns: '64px minmax(0, 1fr)' }}>
        {/* Time column */}
        <div>
          {HOURS.map(h => (
            <div key={h} style={{ height: HOUR_HEIGHT }} className="border-b border-border flex items-start justify-end pr-2 pt-1">
              <span className="text-[11px] text-muted-foreground tabular-nums">{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        {/* Events column */}
        <div className={`relative border-l border-border ${isToday ? 'bg-primary/5' : ''}`} style={{ height: 24 * HOUR_HEIGHT }}>
          {HOURS.map(h => (
            <div
              key={h}
              style={{ height: HOUR_HEIGHT, top: h * HOUR_HEIGHT }}
              className="absolute w-full border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
              onClick={() => {
                const d = new Date(currentDate);
                d.setHours(h, 0, 0, 0);
                onSlotClick(d);
              }}
            />
          ))}
          {/* Current time indicator */}
          {isToday && (
            <div style={{ top: nowTop, position: 'absolute', left: 0, right: 0, zIndex: 6, pointerEvents: 'none' }}>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0" />
                <div className="flex-1 h-px bg-red-500" />
              </div>
            </div>
          )}
          {dayEvents.map(ev => {
            const { top, height } = eventStyle(ev);
            const color = ev.color || TYPE_COLORS[ev.type];
            return (
              <button
                key={ev._id}
                onMouseEnter={e => onEventHover(ev, e.clientX, e.clientY)}
                onMouseLeave={() => onEventHoverEnd()}
                onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                style={{
                  top, height, position: 'absolute', left: 6, right: 6, zIndex: 5,
                  borderLeft: `4px solid ${color}`,
                  backgroundColor: `${color}22`,
                }}
                className="rounded-xl px-3 py-1.5 overflow-hidden text-left hover:brightness-95 transition-all"
              >
                <p className="font-semibold text-sm truncate" style={{ color }}>{ev.title}</p>
                <p className="text-xs text-muted-foreground">{fmtTime(new Date(ev.startDate))} – {fmtTime(new Date(ev.endDate))}</p>
                {ev.location && <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><MapPin size={10} />{ev.location}</p>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({ language }: { language: string }) {
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const items = [
    { type: 'projet' as const,        label: tr('Project', 'Projet', 'مشروع') },
    { type: 'rdv' as const,           label: tr('Client Meeting', 'RDV Client', 'موعد') },
    { type: 'disponibilite' as const, label: tr('Availability', 'Disponibilité', 'توفر') },
    { type: 'conge' as const,         label: tr('Day Off', 'Congé', 'إجازة') },
    { type: 'rappel' as const,        label: tr('Reminder', 'Rappel', 'تذكير') },
  ];

  return (
    <div className="flex flex-wrap gap-4 px-4 py-3 border-t border-border bg-muted/20">
      {items.map(item => (
        <div key={item.type} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[item.type] }} />
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ArtisanCalendar() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<Date | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── API ──────────────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/calendar`, { headers: authHeaders() });
      setEvents(res.data);
    } catch (err) {
      console.error('Failed to fetch calendar events', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleSave = async (data: Partial<EventFormData> & { startDate: string; endDate: string }, id?: string) => {
    if (id) {
      const res = await axios.put(`${API_URL}/calendar/${id}`, data, { headers: authHeaders() });
      setEvents(prev => prev.map(e => e._id === id ? res.data : e));
    } else {
      const res = await axios.post(`${API_URL}/calendar`, data, { headers: authHeaders() });
      setEvents(prev => [...prev, res.data]);
    }
  };

  const handleDelete = async (id: string) => {
    await axios.delete(`${API_URL}/calendar/${id}`, { headers: authHeaders() });
    setEvents(prev => prev.filter(e => e._id !== id));
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const goToPrev = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const goToNext = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const months = language === 'ar' ? MONTHS_AR : language === 'fr' ? MONTHS_FR : MONTHS_EN;

  const headerLabel = () => {
    if (view === 'month') return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (view === 'week') {
      const week = getWeekDays(currentDate);
      return `${fmt(week[0])} – ${fmt(week[6])}`;
    }
    return `${currentDate.getDate()} ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  const openCreateModal = (date: Date) => {
    const d = new Date(date);
    if (d.getHours() === 0) d.setHours(9, 0, 0, 0);
    setEditingEvent(null);
    setModalInitialDate(d);
    setIsModalOpen(true);
  };

  const openDetailPopup = (event: CalendarEvent) => {
    setTooltip(null);
    setConfirmingDelete(false);
    setDetailEvent(event);
  };

  const openEditModal = (event: CalendarEvent) => {
    setDetailEvent(null);
    setEditingEvent(event);
    setModalInitialDate(null);
    setIsModalOpen(true);
  };

  const handleDeleteFromDetail = async () => {
    if (!detailEvent) return;
    setDeleting(true);
    try {
      await handleDelete(detailEvent._id);
      setDetailEvent(null);
      setConfirmingDelete(false);
    } catch { /* errors handled in handleDelete */ }
    finally { setDeleting(false); }
  };

  return (
    <div className="flex flex-col h-full min-h-[600px] bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-wrap gap-2 bg-card">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-sm font-medium rounded-xl border border-border hover:bg-muted transition-colors text-foreground"
          >
            {tr('Today', "Aujourd'hui", 'اليوم')}
          </button>
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button onClick={goToPrev} className="p-1.5 hover:bg-muted transition-colors border-r border-border" aria-label="prev">
              <ChevronLeft size={16} className="text-foreground" />
            </button>
            <button onClick={goToNext} className="p-1.5 hover:bg-muted transition-colors" aria-label="next">
              <ChevronRight size={16} className="text-foreground" />
            </button>
          </div>
          <h2 className="text-base font-bold text-foreground">{headerLabel()}</h2>
          {loading && <span className="text-xs text-muted-foreground animate-pulse">{tr('Loading...', 'Chargement...', 'جاري التحميل...')}</span>}
        </div>

        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex rounded-xl border border-border overflow-hidden bg-muted/30">
            {(['month', 'week', 'day'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === v
                    ? 'bg-primary text-white shadow-sm'
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                {v === 'month' ? tr('Month', 'Mois', 'شهر') : v === 'week' ? tr('Week', 'Semaine', 'أسبوع') : tr('Day', 'Jour', 'يوم')}
              </button>
            ))}
          </div>

          {/* Add event button */}
          <Button
            onClick={() => openCreateModal(currentDate)}
            className="flex items-center gap-1.5 rounded-xl text-white h-9 px-4 text-sm"
          >
            <Plus size={15} />
            {tr('Add', 'Ajouter', 'إضافة')}
          </Button>
        </div>
      </div>

      {/* ── Calendar body ── */}
      <div className="flex-1 overflow-auto flex flex-col">
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            events={events}
            onDayClick={openCreateModal}
            onEventClick={openDetailPopup}
            onEventHover={(ev, x, y) => setTooltip({ event: ev, x, y })}
            onEventHoverEnd={() => setTooltip(null)}
            language={language}
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            events={events}
            onSlotClick={openCreateModal}
            onEventClick={openDetailPopup}
            onEventHover={(ev, x, y) => setTooltip({ event: ev, x, y })}
            onEventHoverEnd={() => setTooltip(null)}
            language={language}
          />
        )}
        {view === 'day' && (
          <DayView
            currentDate={currentDate}
            events={events}
            onSlotClick={openCreateModal}
            onEventClick={openDetailPopup}
            onEventHover={(ev, x, y) => setTooltip({ event: ev, x, y })}
            onEventHoverEnd={() => setTooltip(null)}
          />
        )}
      </div>

      {/* ── Legend ── */}
      <Legend language={language} />

      {/* ── Tooltip ── */}
      {tooltip && <EventTooltip tooltip={tooltip} language={language} />}

      {/* ── Event Detail Popup ── */}
      {detailEvent && (() => {
        const ev = detailEvent;
        const color = ev.color || TYPE_COLORS[ev.type];
        const isProject = Boolean(ev.projectId);
        const typeLabel: Record<CalendarEvent['type'], string> = {
          projet: tr('Project', 'Projet', 'مشروع'),
          rdv: tr('Meeting', 'RDV', 'موعد'),
          disponibilite: tr('Availability', 'Disponibilité', 'توفر'),
          conge: tr('Day Off', 'Congé', 'إجازة'),
          rappel: tr('Reminder', 'Rappel', 'تذكير'),
        };
        const start = new Date(ev.startDate);
        const end = new Date(ev.endDate);
        const sameDay = isSameDay(start, end);
        const locale = language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-SA' : 'en-GB';
        const dateStr = sameDay
          ? `${start.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })} · ${fmtTime(start)} – ${fmtTime(end)}`
          : `${start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} → ${end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => { setDetailEvent(null); setConfirmingDelete(false); }}
          >
            <div
              className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Color accent bar */}
              <div className="h-1.5" style={{ backgroundColor: color }} />

              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-4 pb-2">
                <div className="flex-1 min-w-0 pr-3">
                  <span
                    className="inline-block text-xs text-white font-medium px-2.5 py-0.5 rounded-full mb-2"
                    style={{ backgroundColor: color }}
                  >
                    {typeLabel[ev.type]}
                  </span>
                  <h3 className="text-lg font-bold text-foreground leading-tight truncate">{ev.title}</h3>
                </div>
                <button
                  onClick={() => { setDetailEvent(null); setConfirmingDelete(false); }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 pb-4 space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock size={14} className="flex-shrink-0" />
                  {dateStr}
                </p>
                {ev.location && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin size={14} className="flex-shrink-0" />
                    {ev.location}
                  </p>
                )}
                {ev.description && (
                  <p className="text-sm text-foreground leading-relaxed pt-1">{ev.description}</p>
                )}
                {isProject && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    {tr('Linked to a project', 'Lié à un projet', 'مرتبط بمشروع')}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 flex items-center gap-2 border-t border-border pt-4">
                {!isProject && !confirmingDelete && (
                  <>
                    <Button
                      onClick={() => openEditModal(ev)}
                      variant="outline"
                      className="flex-1 rounded-xl text-sm h-9"
                    >
                      {tr('Edit', 'Modifier', 'تعديل')}
                    </Button>
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="flex-1 h-9 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium transition-colors"
                    >
                      {tr('Delete', 'Supprimer', 'حذف')}
                    </button>
                  </>
                )}
                {confirmingDelete && (
                  <div className="flex-1 flex items-center gap-2">
                    <p className="text-sm text-red-500 flex-1">{tr('Confirm delete?', 'Confirmer la suppression?', 'تأكيد الحذف؟')}</p>
                    <button
                      onClick={handleDeleteFromDetail}
                      disabled={deleting}
                      className="h-9 px-4 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                    >
                      {deleting ? '...' : tr('Yes', 'Oui', 'نعم')}
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="h-9 px-4 rounded-xl border border-border text-sm hover:bg-muted"
                    >
                      {tr('No', 'Non', 'لا')}
                    </button>
                  </div>
                )}
                {isProject && (
                  <p className="text-xs text-muted-foreground w-full text-center">
                    {tr('Manage this event from Projects.', 'Gérez cet événement depuis Projets.', 'أدّر هذا الحدث من المشاريع.')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Edit / Create Modal ── */}
      {isModalOpen && (
        <EventModal
          event={editingEvent}
          initialDate={modalInitialDate}
          onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
          onSave={handleSave as any}
          onDelete={handleDelete}
          language={language}
        />
      )}
    </div>
  );
}
