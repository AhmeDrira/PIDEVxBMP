import {
  Download, MapPin, Calendar, Banknote, FileText,
  CheckCircle, Clock, Shield, User, Mail, Pen,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Party {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePhoto?: string;
}

interface ProposalSummary {
  description?: string;
  localisation?: string;
  proposedPrice?: number;
  negotiatedPrice?: number | null;
  startDate?: string;
}

export interface ContractDocumentData {
  _id: string;
  artisanId: Party;
  expertId: Party;
  content: string;
  proposalId?: ProposalSummary | null;
  status: string;
  signedByExpertAt?: string | null;
  signatureDataExpert?: string | null;
  signedByArtisanAt?: string | null;
  signatureData?: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:5000';

function resolvePhoto(photo?: string) {
  if (!photo) return null;
  return photo.startsWith('http') ? photo : `${API_BASE}/${photo.replace(/^\/+/, '')}`;
}

// ─── Content Parser ───────────────────────────────────────────────────────────

interface ParsedArticle { title: string; body: string; }

function parseContractContent(content: string) {
  const lines = content.split('\n');
  const articles: ParsedArticle[] = [];
  let currentTitle = '';
  let currentBodyLines: string[] = [];
  let inArticle = false;

  for (const line of lines) {
    const isArticle = /^ARTICLE\s+\d+\s*[—–\-]/i.test(line.trim());
    if (isArticle) {
      if (inArticle && currentTitle) articles.push({ title: currentTitle, body: currentBodyLines.join('\n').trim() });
      inArticle = true;
      currentTitle = line.trim();
      currentBodyLines = [];
    } else if (inArticle) {
      if (/^Fait le/i.test(line.trim())) {
        articles.push({ title: currentTitle, body: currentBodyLines.join('\n').trim() });
        inArticle = false; currentTitle = ''; currentBodyLines = [];
      } else {
        currentBodyLines.push(line);
      }
    }
  }
  if (inArticle && currentTitle) articles.push({ title: currentTitle, body: currentBodyLines.join('\n').trim() });
  return articles;
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export function downloadContractPDF(contract: ContractDocumentData, lang: string) {
  const tr = (en: string, fr: string, ar: string = en) =>
    lang === 'ar' ? ar : lang === 'fr' ? fr : en;

  const { artisanId: artisan, expertId: expert, proposalId: proposal } = contract;
  const articles   = parseContractContent(contract.content);
  const finalPrice = proposal?.negotiatedPrice ?? proposal?.proposedPrice;

  const fmt = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const fmtDT = (d?: string | null) =>
    d ? new Date(d).toLocaleString('fr-FR') : '—';

  const expertPhoto  = resolvePhoto(expert.profilePhoto);
  const artisanPhoto = resolvePhoto(artisan.profilePhoto);
  const eI = `${expert.firstName[0]??''}${expert.lastName[0]??''}`.toUpperCase();
  const aI = `${artisan.firstName[0]??''}${artisan.lastName[0]??''}`.toUpperCase();

  const av = (initials: string, photo: string|null, color: string) =>
    photo
      ? `<img src="${photo}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:3px solid ${color}44;flex-shrink:0;"/>`
      : `<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,${color},${color}99);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px;flex-shrink:0;">${initials}</div>`;

  const sigCard = (title: string, person: Party, initials: string, photo: string|null, color: string, sigData?: string|null, sigDate?: string|null) => `
    <div style="flex:1;background:#fff;border:2px solid #e2e8f0;border-radius:20px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
      <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${color};margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid ${color}22;">${title}</div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
        ${av(initials, photo, color)}
        <div>
          <div style="font-size:17px;font-weight:700;color:#0f172a;margin-bottom:4px;">${person.firstName} ${person.lastName}</div>
          <div style="font-size:13px;color:#64748b;">${person.email}</div>
        </div>
      </div>
      ${sigData
        ? `<div style="border:2px solid #e2e8f0;border-radius:14px;background:#f8fafc;padding:16px;margin-bottom:16px;min-height:110px;display:flex;align-items:center;justify-content:center;">
             <img src="${sigData}" style="max-height:90px;max-width:100%;object-fit:contain;"/>
           </div>
           <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#16a34a;font-weight:700;">
             <span>✓</span> ${tr('Signed on','Signé le','وُقِّع في')} ${fmtDT(sigDate)}
           </div>`
        : `<div style="border:2px dashed #cbd5e1;border-radius:14px;background:#f8fafc;min-height:110px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;">
             <span style="font-size:14px;color:#94a3b8;">${tr('Awaiting signature','En attente de signature','بانتظار التوقيع')}</span>
           </div>
           <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#d97706;font-weight:700;">
             ⏳ ${tr('Not yet signed','Non signé','لم يُوقَّع بعد')}
           </div>`
      }
    </div>`;

  const statusColors: Record<string,string> = { signed:'#16a34a', completed:'#7c3aed', pending_expert_signature:'#d97706', pending_artisan_signature:'#ea580c', draft:'#6b7280' };
  const statusLabels: Record<string,string> = {
    pending_expert_signature: tr("Awaiting expert","En attente de l'expert","بانتظار الخبير"),
    pending_artisan_signature: tr("Awaiting artisan","En attente de l'artisan","بانتظار الحرفي"),
    signed: tr("Fully signed","Signé par les deux parties","موقّع"), completed: tr("Completed","Terminé","مكتمل"), draft: tr("Draft","Brouillon","مسودة"),
  };
  const sc = { label: statusLabels[contract.status]??contract.status, color: statusColors[contract.status]??'#6b7280' };

  const articlesHTML = articles.map((a, i) => `
    <div style="padding:24px 0;${i>0?'border-top:1px solid #f1f5f9;':''}">
      <div style="font-size:11px;font-weight:800;color:#1e40af;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">${a.title}</div>
      <div style="font-size:14px;color:#374151;line-height:1.9;white-space:pre-wrap;">${a.body}</div>
    </div>`).join('');

  const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"/>
<title>Contrat #${contract._id.slice(-8).toUpperCase()}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.page{width:210mm;min-height:297mm;margin:24px auto;background:#f8fafc;}
@media print{body{background:#f8fafc;}.page{margin:0;width:100%;}@page{margin:12mm;size:A4;}}</style></head>
<body><div class="page">

  <!-- HEADER CARD -->
  <div style="background:white;border-radius:0;padding:48px 56px 40px;border-bottom:4px solid #1e40af;margin-bottom:0;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <img src="${window.location.origin}/logo.png" alt="BMP Logo" style="width:52px;height:52px;border-radius:14px;object-fit:contain;border:1px solid #e2e8f0;"/>
        <div>
          <div style="font-size:22px;font-weight:900;color:#0f172a;">bmp.tn</div>
          <div style="font-size:12px;color:#64748b;">Plateforme Construction</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px;color:#64748b;margin-bottom:4px;">${tr('Contract N°','Contrat N°','عقد رقم')}</div>
        <div style="font-size:24px;font-weight:900;color:#1e40af;">#${contract._id.slice(-8).toUpperCase()}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">${fmt(contract.createdAt)}</div>
      </div>
    </div>
    <div style="text-align:center;padding:20px 0 0;">
      <div style="font-size:28px;font-weight:900;text-transform:uppercase;letter-spacing:3px;color:#0f172a;margin-bottom:8px;">
        ${tr('Service Contract','Contrat de Prestation de Services','عقد خدمات')}
      </div>
      <div style="font-size:13px;color:#94a3b8;font-style:italic;margin-bottom:16px;">
        ${tr('Electronic contract — dual digital signature','Contrat électronique — double signature numérique','عقد إلكتروني — توقيع رقمي مزدوج')}
      </div>
      <span style="background:${sc.color}18;color:${sc.color};padding:6px 20px;border-radius:99px;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">${sc.label}</span>
    </div>
  </div>

  <!-- PARTIES -->
  <div style="background:white;margin:20px 32px;border-radius:20px;padding:36px 40px;box-shadow:0 2px 16px rgba(0,0,0,.06);">
    <div style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:24px;display:flex;align-items:center;gap:10px;">
      <span style="width:36px;height:36px;background:#f0f9ff;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">👥</span>
      ${tr('Contracting Parties','Parties Prenantes','أطراف العقد')}
    </div>
    <div style="display:flex;gap:24px;">
      <div style="flex:1;background:linear-gradient(135deg,#f0f4ff,#e8eeff);border-radius:16px;padding:28px;border:2px solid #c7d2fe;">
        <div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#6366f1;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #6366f133;">⚡ ${tr('Expert','Expert','الخبير')}</div>
        <div style="display:flex;align-items:center;gap:16px;">
          ${av(eI, expertPhoto, '#6366f1')}
          <div>
            <div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:6px;">${expert.firstName} ${expert.lastName}</div>
            <div style="font-size:13px;color:#6366f1;">📧 ${expert.email}</div>
          </div>
        </div>
      </div>
      <div style="flex:1;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:16px;padding:28px;border:2px solid #bbf7d0;">
        <div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#10b981;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #10b98133;">🔨 ${tr('Artisan','Artisan','الحرفي')}</div>
        <div style="display:flex;align-items:center;gap:16px;">
          ${av(aI, artisanPhoto, '#10b981')}
          <div>
            <div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:6px;">${artisan.firstName} ${artisan.lastName}</div>
            <div style="font-size:13px;color:#10b981;">📧 ${artisan.email}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  ${proposal ? `
  <!-- SERVICE DETAILS -->
  <div style="background:white;margin:0 32px 20px;border-radius:20px;padding:36px 40px;box-shadow:0 2px 16px rgba(0,0,0,.06);">
    <div style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:24px;display:flex;align-items:center;gap:10px;">
      <span style="width:36px;height:36px;background:#f0fdf4;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">📋</span>
      ${tr('Service Details','Détails de la Prestation','تفاصيل الخدمة')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      ${proposal.description?`<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;padding:20px 24px;"><div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📄 ${tr('Object','Objet','الموضوع')}</div><div style="font-size:15px;font-weight:600;color:#0f172a;">${proposal.description}</div></div>`:''}
      ${proposal.localisation?`<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;padding:20px 24px;"><div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📍 ${tr('Location','Lieu','الموقع')}</div><div style="font-size:15px;font-weight:600;color:#0f172a;">${proposal.localisation}</div></div>`:''}
      ${proposal.startDate?`<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;padding:20px 24px;"><div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📅 ${tr('Start date','Date de début','تاريخ البداية')}</div><div style="font-size:15px;font-weight:600;color:#0f172a;">${fmt(proposal.startDate)}</div></div>`:''}
      ${finalPrice!=null&&finalPrice!==undefined?`<div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:14px;padding:20px 24px;"><div style="font-size:11px;color:#16a34a;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">💰 ${tr('Amount','Montant','المبلغ')}</div><div style="font-size:22px;font-weight:900;color:#16a34a;">${Number(finalPrice).toLocaleString('fr-TN')} TND</div></div>`:''}
    </div>
  </div>` : ''}

  <!-- CONTRACT TERMS -->
  <div style="background:white;margin:0 32px 20px;border-radius:20px;padding:36px 40px;box-shadow:0 2px 16px rgba(0,0,0,.06);">
    <div style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:24px;display:flex;align-items:center;gap:10px;">
      <span style="width:36px;height:36px;background:#f0f9ff;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">📝</span>
      ${tr('Contract Terms','Termes du Contrat','بنود العقد')}
    </div>
    <div style="border:1.5px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      ${articlesHTML || `<div style="padding:28px;font-size:14px;color:#374151;line-height:2;white-space:pre-wrap;">${contract.content}</div>`}
    </div>
  </div>

  <!-- SIGNATURES -->
  <div style="background:white;margin:0 32px 20px;border-radius:20px;padding:36px 40px;box-shadow:0 2px 16px rgba(0,0,0,.06);">
    <div style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:24px;display:flex;align-items:center;gap:10px;">
      <span style="width:36px;height:36px;background:#faf5ff;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">✍️</span>
      ${tr('Electronic Signatures','Signatures Électroniques','التوقيعات الإلكترونية')}
    </div>
    <div style="display:flex;gap:24px;">
      ${sigCard(`⚡ ${tr("Expert's Signature","Signature de l'Expert","توقيع الخبير")}`, expert, eI, expertPhoto, '#6366f1', contract.signatureDataExpert, contract.signedByExpertAt)}
      ${sigCard(`🔨 ${tr("Artisan's Signature","Signature de l'Artisan","توقيع الحرفي")}`, artisan, aI, artisanPhoto, '#10b981', contract.signatureData, contract.signedByArtisanAt)}
    </div>
  </div>

  <!-- LEGAL -->
  <div style="margin:0 32px 32px;border:1.5px solid #bfdbfe;border-radius:16px;padding:20px 28px;background:#eff6ff;display:flex;gap:14px;align-items:flex-start;">
    <span style="font-size:22px;flex-shrink:0;">🔒</span>
    <p style="font-size:12px;color:#1e40af;line-height:1.9;margin:0;">
      ${tr('This contract was generated and signed electronically via the BMP platform. Electronic signatures have the same legal value as handwritten signatures.',
        "Ce contrat a été généré et signé électroniquement via la plateforme BMP. Les signatures électroniques ont la même valeur légale que les signatures manuscrites.",
        'تم توقيع هذا العقد إلكترونياً عبر منصة BMP.')}
    </p>
  </div>

  <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
    BMP Platform · #${contract._id.slice(-8).toUpperCase()} · ${fmt(contract.createdAt)}
  </div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;

  const win = window.open('', '_blank', 'width=980,height=760');
  if (!win) return;
  win.document.open(); win.document.write(html); win.document.close();
}

// ─── Screen Component ─────────────────────────────────────────────────────────

interface ContractDocumentProps {
  contract: ContractDocumentData;
  showDownload?: boolean;
}

export default function ContractDocument({ contract, showDownload = true }: ContractDocumentProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const { artisanId: artisan, expertId: expert, proposalId: proposal } = contract;
  const articles   = parseContractContent(contract.content);
  const finalPrice = proposal?.negotiatedPrice ?? proposal?.proposedPrice;

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const fmtDT = (d?: string | null) =>
    d ? new Date(d).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB') : '—';

  const statusCfg: Record<string, { label: string; color: string; bg: string }> = {
    draft:                     { label: tr('Draft','Brouillon','مسودة'),                                        color:'text-gray-500',    bg:'bg-gray-100 dark:bg-gray-800' },
    pending_expert_signature:  { label: tr("Awaiting expert","En attente de l'expert","بانتظار الخبير"),        color:'text-amber-600',   bg:'bg-amber-50 dark:bg-amber-900/30' },
    pending_artisan_signature: { label: tr("Awaiting artisan","En attente de l'artisan","بانتظار الحرفي"),      color:'text-orange-600',  bg:'bg-orange-50 dark:bg-orange-900/30' },
    signed:                    { label: tr('Fully signed','Signé par les deux parties','موقّع'),                color:'text-green-700 dark:text-green-400',  bg:'bg-green-50 dark:bg-green-900/30' },
    completed:                 { label: tr('Completed','Terminé','مكتمل'),                                      color:'text-purple-700',  bg:'bg-purple-50 dark:bg-purple-900/30' },
  };
  const sc = statusCfg[contract.status] ?? statusCfg.draft;

  /* Avatar */
  function Avatar({ party, size = 14 }: { party: Party; size?: number }) {
    const photo    = resolvePhoto(party.profilePhoto);
    const initials = `${party.firstName[0]??''}${party.lastName[0]??''}`.toUpperCase();
    const cls = `w-${size} h-${size} rounded-full object-cover flex-shrink-0`;
    if (photo) return <img src={photo} alt={initials} className={cls} style={{ border: '2px solid var(--border)' }} />;
    return (
      <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-extrabold flex-shrink-0`}
        style={{ fontSize: size * 2.8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
        {initials}
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-white dark:bg-background rounded-2xl p-1">

      {/* ════════════════════════════════════════════════════ */}
      {/* CARD 1 — HEADER                                     */}
      {/* ════════════════════════════════════════════════════ */}
      <Card className="overflow-hidden rounded-2xl border border-border shadow-lg">
        {/* Blue top border */}
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#1e40af,#6366f1,#10b981)' }} />
        <div className="p-8">
          {/* Top row: logo + ref */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="BMP Logo"
                className="w-14 h-14 rounded-2xl object-contain"
                style={{ border: '1px solid var(--border)' }} />
              <div>
                <p className="text-lg font-extrabold text-foreground">bmp.tn</p>
                <p className="text-sm text-muted-foreground">Plateforme Construction</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">{tr('Contract N°','Contrat N°','عقد رقم')}</p>
              <p className="text-2xl font-black text-primary">#{contract._id.slice(-8).toUpperCase()}</p>
              <p className="text-sm text-muted-foreground mt-1">{fmtDate(contract.createdAt)}</p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center py-6 border-y border-border">
            <h1 className="text-3xl font-black uppercase tracking-widest text-foreground mb-2">
              {tr('Service Contract','Contrat de Prestation de Services','عقد خدمات')}
            </h1>
            <p className="text-sm text-muted-foreground italic">
              {tr('Electronic contract — dual digital signature','Contrat électronique — double signature numérique','عقد إلكتروني — توقيع رقمي مزدوج')}
            </p>
          </div>

          {/* Status + Download */}
          <div className="flex items-center justify-between mt-6">
            <span className={`inline-flex items-center px-5 py-2 rounded-full text-sm font-bold uppercase tracking-wide ${sc.bg} ${sc.color}`}>
              {sc.label}
            </span>
            {showDownload && (
              <Button
                onClick={() => downloadContractPDF(contract, language)}
                className="h-10 px-6 text-white rounded-xl shadow-md flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg,#1e40af,#6366f1)' }}
              >
                <Download size={16} />
                {tr('Download PDF','Télécharger PDF','تحميل PDF')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ════════════════════════════════════════════════════ */}
      {/* CARD 2 — PARTIES                                    */}
      {/* ════════════════════════════════════════════════════ */}
      <Card className="p-8 rounded-2xl border border-border shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-lg">👥</span>
          {tr('Contracting Parties','Parties Prenantes','أطراف العقد')}
        </h2>

        {/* Always 2 columns side by side */}
        <div style={{ display: 'flex', gap: '24px' }}>

          {/* Expert */}
          <div className="flex-1 min-w-0 rounded-2xl border-2 py-6"
            style={{ background: 'linear-gradient(135deg,#f0f4ff,#e8eeff)', borderColor: '#c7d2fe', paddingLeft: '3rem', paddingRight: '3rem' }}>
            <p className="text-xs font-extrabold uppercase tracking-widest text-indigo-500 mb-4 pb-3"
              style={{ borderBottom: '2px solid #6366f122' }}>
              ⚡ {tr('Expert','Expert','الخبير')}
            </p>
            <p className="text-lg font-bold text-foreground truncate">{expert.firstName} {expert.lastName}</p>
            <p className="text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-1">
              <Mail size={13} />{expert.email}
            </p>
          </div>

          {/* Artisan */}
          <div className="flex-1 min-w-0 rounded-2xl border-2 py-6"
            style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderColor: '#bbf7d0', paddingLeft: '3rem', paddingRight: '3rem' }}>
            <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-500 mb-4 pb-3"
              style={{ borderBottom: '2px solid #10b98122' }}>
              🔨 {tr('Artisan','Artisan','الحرفي')}
            </p>
            <p className="text-lg font-bold text-foreground truncate">{artisan.firstName} {artisan.lastName}</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
              <Mail size={13} />{artisan.email}
            </p>
          </div>

        </div>
      </Card>

      {/* ════════════════════════════════════════════════════ */}
      {/* CARD 3 — SERVICE DETAILS                            */}
      {/* ════════════════════════════════════════════════════ */}
      {proposal && (finalPrice !== undefined || proposal.description || proposal.localisation || proposal.startDate) && (
        <Card className="p-8 rounded-2xl border border-border shadow-lg">
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-lg">📋</span>
            {tr('Service Details','Détails de la Prestation','تفاصيل الخدمة')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {proposal.description && (
              <div className="flex items-start gap-4 p-5 rounded-xl bg-muted/40 border border-border">
                <FileText size={20} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{tr('Object','Objet','الموضوع')}</p>
                  <p className="font-semibold text-foreground leading-relaxed">{proposal.description}</p>
                </div>
              </div>
            )}
            {proposal.localisation && (
              <div className="flex items-start gap-4 p-5 rounded-xl bg-muted/40 border border-border">
                <MapPin size={20} className="text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{tr('Location','Lieu','الموقع')}</p>
                  <p className="font-semibold text-foreground">{proposal.localisation}</p>
                </div>
              </div>
            )}
            {proposal.startDate && (
              <div className="flex items-start gap-4 p-5 rounded-xl bg-muted/40 border border-border">
                <Calendar size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{tr('Start date','Date de début','تاريخ البداية')}</p>
                  <p className="font-semibold text-foreground">{fmtDate(proposal.startDate)}</p>
                </div>
              </div>
            )}
            {finalPrice !== undefined && finalPrice !== null && (
              <div className="flex items-start gap-4 p-5 rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 border-2 border-green-200 dark:border-green-800">
                <Banknote size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-green-600 mb-1.5">{tr('Amount','Montant','المبلغ')}</p>
                  <p className="text-2xl font-black text-green-600 dark:text-green-400">
                    {Number(finalPrice).toLocaleString('fr-TN')} TND
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* CARD 4 — CONTRACT TERMS                             */}
      {/* ════════════════════════════════════════════════════ */}
      <Card className="p-8 rounded-2xl border border-border shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-lg">📝</span>
          {tr('Contract Terms','Termes du Contrat','بنود العقد')}
        </h2>
        <div className="rounded-2xl border border-border overflow-hidden">
          {articles.length > 0
            ? articles.map((article, i) => (
                <div key={i} className={`px-8 py-6 ${i < articles.length - 1 ? 'border-b border-border' : ''} ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px]">{i + 1}</span>
                    {article.title.replace(/^ARTICLE\s+\d+\s*[—–\-]\s*/i, '')}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap pl-8">
                    {article.body}
                  </p>
                </div>
              ))
            : <div className="px-8 py-7 text-sm text-foreground leading-relaxed whitespace-pre-wrap">{contract.content}</div>
          }
        </div>
      </Card>

      {/* ════════════════════════════════════════════════════ */}
      {/* CARD 5 — SIGNATURES                                 */}
      {/* ════════════════════════════════════════════════════ */}
      <Card className="p-8 rounded-2xl border border-border shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-lg">✍️</span>
          {tr('Electronic Signatures','Signatures Électroniques','التوقيعات الإلكترونية')}
        </h2>

        {/* Always 2 columns side by side */}
        <div style={{ display: 'flex', gap: '32px' }}>

          {/* Expert sig */}
          <SigCard
            role={`⚡ ${tr("Expert's Signature","Signature de l'Expert","توقيع الخبير")}`}
            accent="#6366f1" accentBg="bg-indigo-50 dark:bg-indigo-900/20" accentBorder="border-indigo-200 dark:border-indigo-800"
            party={expert}
            sigData={contract.signatureDataExpert}
            sigDate={contract.signedByExpertAt}
            tr={tr}
            fmtDT={fmtDT}
          />

          {/* Artisan sig */}
          <SigCard
            role={`🔨 ${tr("Artisan's Signature","Signature de l'Artisan","توقيع الحرفي")}`}
            accent="#10b981" accentBg="bg-emerald-50 dark:bg-emerald-900/20" accentBorder="border-emerald-200 dark:border-emerald-800"
            party={artisan}
            sigData={contract.signatureData}
            sigDate={contract.signedByArtisanAt}
            tr={tr}
            fmtDT={fmtDT}
          />
        </div>
      </Card>

      {/* ════════════════════════════════════════════════════ */}
      {/* LEGAL NOTICE                                        */}
      {/* ════════════════════════════════════════════════════ */}
      <div className="flex items-start gap-4 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-6">
        <Shield size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
          {tr(
            'This contract was generated and signed electronically via the BMP platform. The electronic signatures have the same legal value as handwritten signatures in accordance with applicable legislation.',
            "Ce contrat a été généré et signé électroniquement via la plateforme BMP. Les signatures électroniques ont la même valeur légale que les signatures manuscrites conformément à la législation applicable.",
            'تم إنشاء هذا العقد وتوقيعه إلكترونياً عبر منصة BMP. التوقيعات الإلكترونية لها نفس القيمة القانونية للتوقيعات بخط اليد وفقاً للتشريعات المعمول بها.'
          )}
        </p>
      </div>

    </div>
  );
}

// ─── SigCard sub-component ────────────────────────────────────────────────────

function SigCard({ role, accent, accentBg, accentBorder, party, sigData, sigDate, tr, fmtDT }: {
  role: string; accent: string; accentBg: string; accentBorder: string;
  party: { firstName: string; lastName: string; email: string; profilePhoto?: string };
  sigData?: string | null; sigDate?: string | null;
  tr: (en: string, fr: string, ar?: string) => string;
  fmtDT: (d?: string | null) => string;
}) {
  return (
    <div className="flex-1 min-w-0">
      {/* Role label */}
      <p className="text-xs font-extrabold uppercase tracking-widest mb-4 pb-3 border-b border-border"
        style={{ color: accent }}>{role}</p>

      {/* User info — no avatar, no box */}
      <div className="mb-5">
        <p className="font-bold text-foreground">{party.firstName} {party.lastName}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <Mail size={12} />{party.email}
        </p>
      </div>

      {/* Signature rectangle only */}
      {sigData
        ? <>
            <div className="rounded-xl border-2 bg-white dark:bg-slate-900 p-4 mb-4 flex items-center justify-center shadow-sm"
              style={{ minHeight: 120, borderColor: `${accent}50` }}>
              <img src={sigData} alt="signature" className="max-h-28 max-w-full object-contain" />
            </div>
            <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: accent }}>
              <CheckCircle size={15} />
              {tr('Signed on','Signé le','وُقِّع في')} {fmtDT(sigDate)}
            </div>
          </>
        : <>
            <div className="rounded-xl border-2 border-dashed bg-muted/20 flex items-center justify-center mb-4"
              style={{ minHeight: 120, borderColor: `${accent}40` }}>
              <div className="text-center">
                <Pen size={22} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm text-muted-foreground">{tr('Awaiting signature','En attente de signature','بانتظار التوقيع')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
              <Clock size={15} />
              {tr('Not yet signed','Non signé','لم يُوقَّع بعد')}
            </div>
          </>
      }
    </div>
  );
}
