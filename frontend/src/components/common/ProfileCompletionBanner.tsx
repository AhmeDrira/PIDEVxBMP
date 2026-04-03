import React, { useEffect, useState } from 'react';
import {
  Camera, Phone, MapPin, User, Zap, CheckCircle, ChevronRight,
  Sparkles, Mail, Briefcase, Building2, Award, FileText, Clock, Star,
} from 'lucide-react';
import axios from 'axios';

import { useLanguage } from '../../context/LanguageContext';
// ─── Types ────────────────────────────────────────────────────────────────────

interface UserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  profilePhoto?: string;
  phone?: string;
  location?: string;
  // artisan
  bio?: string;
  domain?: string;
  yearsExperience?: string | number;
  skills?: string[];
  // expert
  specialization?: string;
  institution?: string;
  // manufacturer
  companyName?: string;
  description?: string;
  certificationNumber?: string;
  // meta
  role?: string;
  [key: string]: any;
}

interface Field {
  key: string;
  label: string;
  Icon: React.ElementType;
  weight: number;
  hint: string;
  check: (u: UserData) => boolean;
}

interface ProfileCompletionBannerProps {
  /** Pre-fetched user object (full API data). If omitted the banner fetches /api/auth/me itself. */
  user?: UserData | null;
  onNavigate?: (view: string) => void;
  profileView?: string;
}

// ─── Role → field definitions ─────────────────────────────────────────────────

const ARTISAN_FIELDS: Field[] = [
  { key: 'name',            label: 'Full Name',      Icon: User,       weight: 10, hint: 'Add your name',       check: u => !!(u.firstName?.trim() && u.lastName?.trim()) },
  { key: 'email',           label: 'Email',          Icon: Mail,       weight: 5,  hint: 'Add email',           check: u => !!u.email?.trim() },
  { key: 'profilePhoto',    label: 'Photo',          Icon: Camera,     weight: 15, hint: 'Add photo',           check: u => !!u.profilePhoto },
  { key: 'phone',           label: 'Phone',          Icon: Phone,      weight: 10, hint: 'Add phone',           check: u => !!u.phone?.trim() },
  { key: 'location',        label: 'Location',       Icon: MapPin,     weight: 15, hint: 'Add location',        check: u => !!u.location?.trim() },
  { key: 'bio',             label: 'Bio',            Icon: FileText,   weight: 15, hint: 'Write your bio',      check: u => !!u.bio?.trim() },
  { key: 'domain',          label: 'Specialization', Icon: Briefcase,  weight: 15, hint: 'Add specialization',  check: u => !!u.domain?.trim() },
  { key: 'yearsExperience', label: 'Experience',     Icon: Clock,      weight: 10, hint: 'Add experience',      check: u => !!(u.yearsExperience && Number(u.yearsExperience) > 0) },
  { key: 'skills',          label: 'Skills',         Icon: Star,       weight: 5,  hint: 'Add skills',          check: u => Array.isArray(u.skills) && u.skills.length > 0 },
];

const EXPERT_FIELDS: Field[] = [
  { key: 'name',           label: 'Full Name',      Icon: User,       weight: 10, hint: 'Add your name',       check: u => !!(u.firstName?.trim() && u.lastName?.trim()) },
  { key: 'email',          label: 'Email',          Icon: Mail,       weight: 5,  hint: 'Add email',           check: u => !!u.email?.trim() },
  { key: 'profilePhoto',   label: 'Photo',          Icon: Camera,     weight: 15, hint: 'Add photo',           check: u => !!u.profilePhoto },
  { key: 'phone',          label: 'Phone',          Icon: Phone,      weight: 10, hint: 'Add phone',           check: u => !!u.phone?.trim() },
  { key: 'location',       label: 'Location',       Icon: MapPin,     weight: 15, hint: 'Add location',        check: u => !!u.location?.trim() },
  { key: 'bio',            label: 'Bio',            Icon: FileText,   weight: 15, hint: 'Write your bio',      check: u => !!u.bio?.trim() },
  { key: 'specialization', label: 'Specialization', Icon: Briefcase,  weight: 15, hint: 'Add specialization',  check: u => !!(u.domain?.trim() || u.specialization?.trim()) },
  { key: 'institution',    label: 'Institution',    Icon: Building2,  weight: 15, hint: 'Add institution',     check: u => !!u.institution?.trim() },
];

const MANUFACTURER_FIELDS: Field[] = [
  { key: 'name',                label: 'Contact Name',    Icon: User,      weight: 10, hint: 'Add your name',        check: u => !!(u.firstName?.trim() && u.lastName?.trim()) },
  { key: 'email',               label: 'Email',           Icon: Mail,      weight: 5,  hint: 'Add email',            check: u => !!u.email?.trim() },
  { key: 'profilePhoto',        label: 'Company Logo',    Icon: Camera,    weight: 10, hint: 'Add company logo',     check: u => !!u.profilePhoto },
  { key: 'companyName',         label: 'Company Name',    Icon: Building2, weight: 15, hint: 'Add company name',     check: u => !!u.companyName?.trim() },
  { key: 'phone',               label: 'Phone',           Icon: Phone,     weight: 10, hint: 'Add phone',            check: u => !!u.phone?.trim() },
  { key: 'location',            label: 'Location',        Icon: MapPin,    weight: 15, hint: 'Add location',         check: u => !!u.location?.trim() },
  { key: 'description',         label: 'Description',     Icon: FileText,  weight: 20, hint: 'Describe your business', check: u => !!u.description?.trim() },
  { key: 'certificationNumber', label: 'Certification No.',Icon: Award,    weight: 15, hint: 'Add certification no.', check: u => !!u.certificationNumber?.trim() },
];

const ADMIN_FIELDS: Field[] = [
  { key: 'name',         label: 'Full Name', Icon: User,   weight: 25, hint: 'Add your name', check: u => !!(u.firstName?.trim() && u.lastName?.trim()) },
  { key: 'email',        label: 'Email',     Icon: Mail,   weight: 20, hint: 'Add email',     check: u => !!u.email?.trim() },
  { key: 'profilePhoto', label: 'Photo',     Icon: Camera, weight: 30, hint: 'Add photo',     check: u => !!u.profilePhoto },
  { key: 'phone',        label: 'Phone',     Icon: Phone,  weight: 25, hint: 'Add phone',     check: u => !!u.phone?.trim() },
];

const FIELDS_BY_ROLE: Record<string, Field[]> = {
  artisan:      ARTISAN_FIELDS,
  expert:       EXPERT_FIELDS,
  manufacturer: MANUFACTURER_FIELDS,
  admin:        ADMIN_FIELDS,
  'sub-admin':  ADMIN_FIELDS,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getToken(): string | null {
  const t = localStorage.getItem('token');
  if (t) return t;
  try { return JSON.parse(localStorage.getItem('user') || '{}').token ?? null; }
  catch { return null; }
}

function readLocalUser(): UserData {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); }
  catch { return {}; }
}

function getFieldsForRole(role?: string): Field[] {
  return FIELDS_BY_ROLE[role || ''] ?? ADMIN_FIELDS;
}

function computeCompletion(user: UserData, fields: Field[]) {
  const score   = fields.reduce((s, f) => s + (f.check(user) ? f.weight : 0), 0);
  const missing = fields.filter(f => !f.check(user));
  const done    = fields.filter(f =>  f.check(user));
  return { score, missing, done };
}

function palette(pct: number) {
  if (pct >= 100) return { bar: 'linear-gradient(90deg,#10b981,#34d399)', glow: 'rgba(16,185,129,0.22)', accent: '#10b981', bg: 'linear-gradient(135deg,rgba(5,150,105,0.1),#dcfce7)', border: '#bbf7d0' };
  if (pct >= 70)  return { bar: 'linear-gradient(90deg,#1e40af,#3b82f6)', glow: 'rgba(59,130,246,0.20)', accent: '#1e40af', bg: 'linear-gradient(135deg,rgba(37,99,235,0.1),rgba(37,99,235,0.2))', border: 'rgba(37,99,235,0.3)' };
  if (pct >= 40)  return { bar: 'linear-gradient(90deg,#d97706,#f59e0b)', glow: 'rgba(245,158,11,0.20)', accent: '#d97706', bg: 'linear-gradient(135deg,rgba(217,119,6,0.1),rgba(245,158,11,0.15))', border: 'rgba(245,158,11,0.3)' };
  return              { bar: 'linear-gradient(90deg,#ef4444,#f97316)',     glow: 'rgba(239,68,68,0.20)',  accent: '#ef4444', bg: 'linear-gradient(135deg,#fff7ed,#fee2e2)', border: '#fecaca' };
}

function motivation(pct: number, missing: Field[]): string {
  if (pct >= 100) return 'Your profile is 100% complete — you stand out to clients!';
  if (pct >= 80)  return 'Almost there! A complete profile gets 3× more visibility.';
  if (pct >= 60)  return `Add your ${missing[0]?.label.toLowerCase() ?? 'info'} to boost your credibility.`;
  if (pct >= 40)  return 'Good start! Fill in the remaining fields to increase trust.';
  return 'Complete your profile to unlock full platform credibility.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileCompletionBanner({
  user: userProp,
  onNavigate,
  profileView = 'profile',
}: ProfileCompletionBannerProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const [apiUser, setApiUser]       = useState<UserData | null>(null);
  const [localUser, setLocalUser]   = useState<UserData>(readLocalUser);
  const [animatedPct, setAnimatedPct] = useState(0);
  const [dismissed, setDismissed]   = useState(false);

  // Fetch full profile from API when no user prop is provided
  useEffect(() => {
    if (userProp !== undefined) return;
    const token = getToken();
    if (!token) return;
    axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setApiUser(res.data.user ?? res.data))
      .catch(() => {/* silently ignore */});
  }, [userProp]);

  // Re-read localStorage when profile is saved
  useEffect(() => {
    const sync = () => setLocalUser(readLocalUser());
    window.addEventListener('storage', sync);
    window.addEventListener('profile-updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('profile-updated', sync);
    };
  }, []);

  // Merge: API data is most complete, then prop, then localStorage
  const merged: UserData = { ...localUser, ...(apiUser ?? {}), ...(userProp ?? {}) };
  const role   = merged.role;
  const fields = getFieldsForRole(role);
  const { score, missing, done } = computeCompletion(merged, fields);
  const c = palette(score);

  // Animate bar
  useEffect(() => {
    setAnimatedPct(0);
    const t = setTimeout(() => setAnimatedPct(score), 100);
    return () => clearTimeout(t);
  }, [score]);

  if (dismissed) return null;

  const isComplete = score >= 100;

  return (
    <div style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 20, padding: '20px 24px', position: 'relative', overflow: 'hidden', boxShadow: `0 4px 24px ${c.glow}` }}>

      {/* Decorative blob */}
      <div style={{ position: 'absolute', right: -50, top: -50, width: 200, height: 200, borderRadius: '50%', background: c.glow, filter: 'blur(48px)', pointerEvents: 'none' }} />

      {/* Dismiss */}
      {!isComplete && (
        <button onClick={() => setDismissed(true)} aria-label="Dismiss"
          style={{ position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.07)', color: '#9ca3af', cursor: 'pointer', fontSize: 16, lineHeight: '24px', textAlign: 'center' }}>
          ×
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>

        {/* ── Circular progress ── */}
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r="29" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="7" />
            <circle cx="36" cy="36" r="29" fill="none" stroke={c.accent} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 29}`}
              strokeDashoffset={`${2 * Math.PI * 29 * (1 - animatedPct / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isComplete
              ? <CheckCircle size={22} style={{ color: c.accent }} />
              : <span style={{ fontSize: 15, fontWeight: 800, color: c.accent, lineHeight: 1 }}>{score}%</span>
            }
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {isComplete
              ? <Sparkles size={15} style={{ color: c.accent, flexShrink: 0 }} />
              : <Zap size={14} style={{ color: c.accent, flexShrink: 0 }} />
            }
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
              {isComplete ? 'Profile Complete!' : `Profile ${score}% complete`}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: c.accent, background: `${c.accent}18`, borderRadius: 20, padding: '2px 8px' }}>
              {done.length}/{fields.length} fields
            </span>
          </div>

          {/* Motivation text */}
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5 }}>
            {motivation(score, missing)}
          </p>

          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(0,0,0,0.07)', marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: c.bar, width: `${animatedPct}%`, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)', boxShadow: `0 0 8px ${c.glow}` }} />
          </div>

          {/* Missing field chips */}
          {!isComplete && missing.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
              {missing.map(f => {
                const Icon = f.Icon;
                return (
                  <button key={f.key} onClick={() => onNavigate?.(profileView)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, border: `1px dashed ${c.accent}55`, background: 'rgba(255,255,255,0.7)', color: c.accent, fontSize: 11, fontWeight: 600, cursor: onNavigate ? 'pointer' : 'default', transition: 'background 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${c.accent}15`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.7)'; }}
                  >
                    <span style={{ fontSize: 12 }}>+</span>
                    <Icon size={10} />
                    {f.hint}
                  </button>
                );
              })}
            </div>
          )}

          {/* CTA button */}
          {!isComplete && onNavigate && (
            <button onClick={() => onNavigate(profileView)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 12, border: 'none', background: c.bar, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 14px ${c.glow}`, transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
            >
              <Zap size={13} /> Complete My Profile <ChevronRight size={13} />
            </button>
          )}

          {/* 100% — completed fields */}
          {isComplete && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {done.map(f => {
                const Icon = f.Icon;
                return (
                  <span key={f.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: `${c.accent}18`, color: c.accent, fontSize: 11, fontWeight: 600 }}>
                    <Icon size={10} /> {f.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
