import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowRight, MapPin, Briefcase, Calendar, Star, MessageSquare, Phone, Mail, Award, Image, ArrowLeft, Send, FileText, X, CheckCircle } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { useLanguage } from '../../context/LanguageContext';
import ReadOnlyCalendar from './ReadOnlyCalendar';

interface ViewArtisanProfileProps {
  artisanId?: string;
  onBack?: () => void;
  onContact?: () => void;
  onViewPortfolio?: () => void;
}

interface ArtisanProfile {
  firstName: string;
  lastName: string;
  domain: string;
  location: string;
  yearsExperience: number;
  rating: number;
  reviewCount: number;
  completedProjects: number;
  profileImage: string;
  bio: string;
  phone: string;
  email: string;
  skills: string[];
  certifications: string[];
}

interface Review {
  _id: string;
  rating: number;
  comment: string;
  createdAt: string;
  expert: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePhoto?: string;
  };
}

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:5000';

const API_URL = `${API_BASE}/api`;

const getToken = () => {
  const direct = localStorage.getItem('token');
  if (direct) return direct;
  try {
    const parsed = JSON.parse(localStorage.getItem('user') || '{}');
    return parsed?.token || '';
  } catch {
    return '';
  }
};

export default function ViewArtisanProfile({ artisanId, onBack, onContact, onViewPortfolio }: ViewArtisanProfileProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'profile' | 'availability'>('profile');

  // ── Proposition de projet ──────────────────────────────────────────────────
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    description: '',
    localisation: '',
    proposedPrice: '',
    startDate: '',
  });
  const [proposalSubmitting, setProposalSubmitting] = useState(false);
  const [proposalError, setProposalError]   = useState('');
  const [proposalSuccess, setProposalSuccess] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    if (!artisanId) {
      setError(tr('Artisan not found', 'Artisan introuvable', 'Artisan not found'));
      setLoading(false);
      return;
    }

    const fetchArtisan = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(`${API_URL}/artisans/${artisanId}`);
        const data = response.data;

        setArtisan({
          firstName: data.firstName,
          lastName: data.lastName,
          domain: data.domain,
          location: data.location,
          yearsExperience: data.yearsExperience ?? 0,
          bio: data.bio,
          phone: data.phone,
          email: data.email,
          rating: data.rating ?? 0,
          reviewCount: data.reviewCount ?? 0,
          completedProjects: data.portfolioCount ?? data.completedProjects ?? 0,
          skills: Array.isArray(data.skills) ? data.skills : [],
          certifications: Array.isArray(data.certifications) ? data.certifications : [],
          profileImage: data.profilePhoto
            ? (data.profilePhoto.startsWith('http') || data.profilePhoto.startsWith('data:')
                ? data.profilePhoto
                : `${API_BASE}/${data.profilePhoto.replace(/^\/+/, '')}`)
            : '',
        });
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || tr('Failed to load artisan', 'Echec du chargement de l\'artisan'));
      } finally {
        setLoading(false);
      }
    };

    const fetchReviews = async () => {
      try {
        setLoadingReviews(true);
        const response = await axios.get(`${API_URL}/artisans/${artisanId}/reviews`);
        setReviews(response.data || []);
      } catch {
        setReviews([]);
      } finally {
        setLoadingReviews(false);
      }
    };

    fetchArtisan();
    fetchReviews();
  }, [artisanId]);

  const handleSubmitReview = async () => {
    if (!newRating) { setReviewError(tr('Please select a rating', 'Veuillez selectionner une note', 'Please select a rating')); return; }
    setReviewError('');
    try {
      setSubmittingReview(true);
      const token = getToken();
      if (!token) { setReviewError(tr('Please login to submit a review', 'Veuillez vous connecter pour soumettre un avis', 'Please login to submit a review')); return; }

      const response = await axios.post(
        `${API_URL}/artisans/${artisanId}/reviews`,
        { rating: newRating, comment: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setReviews(prev => {
        const existing = prev.findIndex(r => r.expert._id === response.data.expert._id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = response.data;
          return updated;
        }
        return [response.data, ...prev];
      });

      // Update displayed rating
      setArtisan(prev => {
        if (!prev) return prev;
        const allRatings = reviews.map(r => r.rating);
        const existingIdx = reviews.findIndex(r => r.expert?._id === response.data.expert?._id);
        if (existingIdx >= 0) allRatings[existingIdx] = newRating;
        else allRatings.push(newRating);
        const avg = allRatings.length > 0
          ? Math.round((allRatings.reduce((s, r) => s + r, 0) / allRatings.length) * 10) / 10
          : 0;
        return { ...prev, rating: avg, reviewCount: allRatings.length };
      });

      setNewRating(0);
      setNewComment('');
    } catch (err: any) {
      setReviewError(err?.response?.data?.message || tr('Failed to submit review', 'Echec de l\'envoi de l\'avis'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setProposalError('');

    const { description, localisation, proposedPrice, startDate } = proposalForm;
    if (!description.trim() || !localisation.trim() || !proposedPrice || !startDate) {
      setProposalError(tr('Please fill in all required fields.', 'Veuillez remplir tous les champs obligatoires.', 'يرجى ملء جميع الحقول المطلوبة.'));
      return;
    }

    setProposalSubmitting(true);
    try {
      const token = getToken();
      await axios.post(
        `${API_URL}/proposals`,
        {
          artisanId,
          description: description.trim(),
          localisation: localisation.trim(),
          proposedPrice: Number(proposedPrice),
          startDate,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProposalSuccess(true);
      setProposalForm({ description: '', localisation: '', proposedPrice: '', startDate: '' });
      // Fermer automatiquement après 2 secondes
      setTimeout(() => {
        setIsProposalModalOpen(false);
        setProposalSuccess(false);
      }, 2000);
    } catch (err: any) {
      setProposalError(
        err?.response?.data?.message ||
        tr('Failed to send proposal. Please try again.', 'Échec de l\'envoi. Veuillez réessayer.', 'فشل الإرسال. يرجى المحاولة مجدداً.')
      );
    } finally {
      setProposalSubmitting(false);
    }
  };

  const closeProposalModal = () => {
    setIsProposalModalOpen(false);
    setProposalSuccess(false);
    setProposalError('');
    setProposalForm({ description: '', localisation: '', proposedPrice: '', startDate: '' });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
            <ArrowRight size={20} className="mr-2 rotate-180" />
            {tr('Back to Artisan Directory', 'Retour a l\'annuaire des artisans')}
          </Button>
        )}
        <p className="text-sm text-muted-foreground">{tr('Loading artisan profile...', 'Chargement du profil artisan...', 'Loading artisan profile...')}</p>
      </div>
    );
  }

  if (error || !artisan) {
    return (
      <div className="space-y-6">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
            <ArrowRight size={20} className="mr-2 rotate-180" />
            {tr('Back to Artisan Directory', 'Retour a l\'annuaire des artisans')}
          </Button>
        )}
        <p className="text-sm text-red-500">{error || tr('Artisan not found', 'Artisan introuvable', 'Artisan not found')}</p>
      </div>
    );
  }

  const avgRating = artisan.rating;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      {onBack && (
        <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
          <ArrowLeft size={20} className="mr-2" />
            {tr('Back to Artisan Directory', 'Retour a l\'annuaire des artisans', 'العودة إلى دليل الحرفيين')}
        </Button>
      )}

      {/* Profile Header */}
      <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-shrink-0">
            <div style={{ width: 96, height: 96, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '3px solid var(--muted)' }}>
              <ImageWithFallback
                src={artisan.profileImage}
                alt={`${artisan.firstName} ${artisan.lastName}`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="flex-1">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {artisan.firstName} {artisan.lastName}
                </h1>
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase size={18} className="text-primary" />
                  <span className="text-lg font-medium text-muted-foreground">{artisan.domain}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={18} className="text-muted-foreground" />
                  <span className="text-muted-foreground">{artisan.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-muted-foreground" />
                  <span className="text-muted-foreground">{artisan.yearsExperience} {tr('years of experience', 'ans d\'experience', 'سنوات من الخبرة')}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={onViewPortfolio}
                  variant="outline"
                  className="h-12 px-6 rounded-xl border-2"
                >
                  <Image size={18} className="mr-2" />
                  {tr('View Portfolio', 'Voir le portfolio', 'View Portfolio')}
                </Button>
                <Button
                  onClick={onContact}
                  variant="outline"
                  className="h-12 px-6 rounded-xl border-2"
                >
                  <MessageSquare size={20} className="mr-2" />
                  {tr('Contact', 'Contacter', 'تواصل')}
                </Button>
                <Button
                  onClick={() => setIsProposalModalOpen(true)}
                  className="h-12 px-8 text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg"
                >
                  <FileText size={20} className="mr-2" />
                  {tr('Propose a Project', 'Proposer un projet', 'اقتراح مشروع')}
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star size={20} className="text-secondary fill-secondary" />
                  <span className="text-2xl font-bold text-foreground">
                    {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{artisan.reviewCount} {tr('Reviews', 'Avis', 'Reviews')}</p>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-accent/5 to-accent/10 text-center">
                <p className="text-2xl font-bold text-foreground mb-1">{artisan.completedProjects}</p>
                <p className="text-sm text-muted-foreground">{tr('Projects Done', 'Projets realises', 'المشاريع المنجزة')}</p>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/5 to-secondary/10 text-center">
                <p className="text-2xl font-bold text-foreground mb-1">{artisan.yearsExperience}</p>
                <p className="text-sm text-muted-foreground">{tr('Years Experience', 'Annees d\'experience', 'سنوات الخبرة')}</p>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed">{artisan.bio}</p>
          </div>
        </div>
      </Card>

      {/* ── Tab navigation ── */}
      <div className="flex border-b border-border gap-1">
        {(['profile', 'availability'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-xl transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'profile'
              ? tr('Profile', 'Profil', 'الملف الشخصي')
              : `📅 ${tr('Availabilities', 'Disponibilités', 'التوافر')}`}
          </button>
        ))}
      </div>

      {/* ── Availability tab ── */}
      {activeTab === 'availability' && (
        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <h2 className="text-xl font-bold text-foreground mb-4">
            📅 {tr('Artisan Availability Calendar', 'Calendrier des disponibilités', 'تقويم توافر الحرفي')}
          </h2>
          <ReadOnlyCalendar artisanId={artisanId || ''} onContact={onContact} />
        </Card>
      )}

      {activeTab === 'profile' && <><div className="grid lg:grid-cols-3 gap-6">
        {/* Contact Information */}
        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg lg:col-span-1">
          <h2 className="text-xl font-bold text-foreground mb-6">{tr('Contact Information', 'Informations de contact', 'Contact Information')}</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Phone size={20} className="text-primary mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">{tr('Phone', 'Telephone', 'الهاتف')}</p>
                <p className="font-medium text-foreground">{artisan.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail size={20} className="text-primary mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">{tr('Email', 'Email', 'البريد الإلكتروني')}</p>
                <p className="font-medium text-foreground">{artisan.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin size={20} className="text-primary mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">{tr('Location', 'Localisation', 'الموقع')}</p>
                <p className="font-medium text-foreground">{artisan.location || '—'}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Skills & Certifications */}
        <div className="lg:col-span-2 space-y-6">
          {/* Skills */}
          <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
            <h2 className="text-xl font-bold text-foreground mb-4">{tr('Skills & Expertise', 'Competences et expertise', 'المهارات والخبرة')}</h2>
            {artisan.skills.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {artisan.skills.map((skill, idx) => (
                  <Badge key={idx} className="bg-primary/10 text-primary border-0 px-4 py-2 text-sm font-medium">
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{tr('No skills listed yet.', 'Aucune competence renseignee pour le moment.', 'لا توجد مهارات مدرجة حتى الآن.')}</p>
            )}
          </Card>

          {/* Certifications */}
          <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
            <h2 className="text-xl font-bold text-foreground mb-4">{tr('Certifications', 'Certifications', 'الشهادات')}</h2>
            {artisan.certifications.length > 0 ? (
              <div className="space-y-3">
                {artisan.certifications.map((cert, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-accent/5">
                    <Award size={20} className="text-accent" />
                    <span className="font-medium text-foreground">{cert}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{tr('No certifications listed yet.', 'Aucune certification renseignee pour le moment.', 'لا توجد شهادات مدرجة حتى الآن.')}</p>
            )}
          </Card>
        </div>
      </div>

      {/* Reviews & Ratings */}
      <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
        <h2 className="text-xl font-bold text-foreground mb-6">{tr('Reviews & Ratings', 'Avis et notes', 'التقييمات والآراء')}</h2>

        {/* Rating summary */}
        <div className="flex items-center gap-4 mb-8 p-4 rounded-xl bg-gradient-to-br from-secondary/5 to-secondary/10">
          <div className="text-center">
            <p className="text-5xl font-extrabold text-foreground">
              {avgRating > 0 ? avgRating.toFixed(1) : '—'}
            </p>
            <div className="flex justify-center gap-1 mt-1">
              {[1,2,3,4,5].map(s => (
                <Star
                  key={s}
                  size={16}
                  className={s <= Math.round(avgRating) ? 'text-secondary fill-secondary' : 'text-gray-300'}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{artisan.reviewCount} {artisan.reviewCount !== 1 ? tr('reviews', 'avis', 'تقييمات') : tr('review', 'avis', 'تقييم')}</p>
          </div>
        </div>

        {/* Submit review form */}
        <div className="mb-8 p-5 rounded-xl border-2 border-dashed border-border bg-muted/50">
          <h3 className="text-base font-semibold text-foreground mb-1">{tr('Leave a Review', 'Laisser un avis', 'اترك تقييماً')}</h3>
          <p className="text-xs text-muted-foreground mb-3">{tr('Select a rating - comment is optional', 'Selectionnez une note - le commentaire est optionnel', 'اختر التقييم - التعليق اختياري')}</p>
          <div className="flex gap-1 mb-3">
            {[1,2,3,4,5].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setNewRating(s)}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none"
              >
                <Star
                  size={32}
                  className={(hoverRating || newRating) >= s ? 'text-secondary fill-secondary' : 'text-gray-300'}
                />
              </button>
            ))}
            {newRating > 0 && (
              <span className="ml-2 self-center text-sm font-medium text-muted-foreground">
                {['', tr('Poor', 'Mauvais', 'ضعيف'), tr('Fair', 'Passable', 'متوسط'), tr('Good', 'Bon', 'جيد'), tr('Very Good', 'Tres bon', 'جيد جداً'), tr('Excellent', 'Excellent', 'ممتاز')][newRating]}
              </span>
            )}
          </div>
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder={tr('Share your experience (optional)...', 'Partagez votre experience (optionnel)...', 'شارك تجربتك (اختياري)...')}
            className="w-full border-2 border-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-primary"
            rows={3}
          />
          {reviewError && <p className="text-sm text-red-500 mt-2">{reviewError}</p>}
          <Button
            onClick={handleSubmitReview}
            disabled={submittingReview || !newRating}
            className="mt-8 h-11 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl disabled:opacity-50"
          >
            <Send size={16} className="mr-2" />
            {submittingReview ? tr('Submitting...', 'Envoi...', 'جاري الإرسال...') : tr('Submit Review', 'Envoyer l\'avis', 'إرسال التقييم')}
          </Button>
        </div>

        {/* Reviews list */}
        {loadingReviews ? (
          <p className="text-sm text-muted-foreground text-center py-6">{tr('Loading reviews...', 'Chargement des avis...', 'جاري تحميل التقييمات...')}</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{tr('No reviews yet. Be the first to review!', 'Aucun avis pour le moment. Soyez le premier a laisser un avis!', 'لا توجد تقييمات حتى الآن. كن الأول في ترك تقييم!')}</p>
        ) : (
          <div className="space-y-4">
            {reviews.filter(review => review.expert).map(review => (
              <div key={review._id} className="p-4 rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-start gap-3">
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="text-white text-sm font-bold">
                      {review.expert?.firstName?.[0]}{review.expert?.lastName?.[0]}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-foreground text-sm">
                        {review.expert?.firstName} {review.expert?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {[1,2,3,4,5].map(s => (
                        <Star
                          key={s}
                          size={14}
                          className={s <= review.rating ? 'text-secondary fill-secondary' : 'text-gray-300'}
                        />
                      ))}
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card></>}

      {/* ── Modal : Proposer un projet ── */}
      {isProposalModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={e => e.target === e.currentTarget && closeProposalModal()}
        >
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border">

            {/* Header du modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                {tr('Propose a Project', 'Proposer un projet', 'اقتراح مشروع')}
              </h2>
              <button
                onClick={closeProposalModal}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                aria-label="close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corps du modal */}
            <div className="p-6">
              {/* ─ Succès ─ */}
              {proposalSuccess ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <CheckCircle size={56} className="text-green-500" />
                  <p className="text-lg font-semibold text-foreground">
                    {tr('Proposal sent!', 'Demande envoyée à l\'artisan !', 'تم إرسال الطلب إلى الحرفي!')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tr(
                      'The artisan will review your proposal shortly.',
                      'L\'artisan examinera votre demande prochainement.',
                      'سيراجع الحرفي طلبك قريباً.'
                    )}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitProposal} className="space-y-4">
                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {tr('Project Description', 'Description du projet', 'وصف المشروع')} *
                    </label>
                    <textarea
                      value={proposalForm.description}
                      onChange={e => setProposalForm(p => ({ ...p, description: e.target.value }))}
                      rows={4}
                      placeholder={tr(
                        'Describe the work you need done in detail…',
                        'Décrivez les travaux souhaités en détail…',
                        'صف الأعمال المطلوبة بالتفصيل…'
                      )}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                      required
                    />
                  </div>

                  {/* Localisation */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {tr('Location / Site', 'Localisation / Chantier', 'الموقع / مكان العمل')} *
                    </label>
                    <input
                      type="text"
                      value={proposalForm.localisation}
                      onChange={e => setProposalForm(p => ({ ...p, localisation: e.target.value }))}
                      placeholder={tr('e.g. Tunis, Menzah 9', 'Ex : Tunis, Menzah 9', 'مثال: تونس، المنزه 9')}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      required
                    />
                  </div>

                  {/* Budget + Date côte à côte */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        {tr('Proposed Budget (TND)', 'Budget proposé (TND)', 'الميزانية المقترحة (TND)')} *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={proposalForm.proposedPrice}
                        onChange={e => setProposalForm(p => ({ ...p, proposedPrice: e.target.value }))}
                        placeholder="3 500"
                        className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        {tr('Desired Start Date', 'Date souhaitée', 'تاريخ البدء المقترح')} *
                      </label>
                      <input
                        type="date"
                        value={proposalForm.startDate}
                        onChange={e => setProposalForm(p => ({ ...p, startDate: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        required
                      />
                    </div>
                  </div>

                  {/* Message d'erreur */}
                  {proposalError && (
                    <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                      {proposalError}
                    </p>
                  )}

                  {/* Boutons */}
                  <div className="flex justify-end gap-3 pt-2 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeProposalModal}
                      className="rounded-xl"
                    >
                      {tr('Cancel', 'Annuler', 'إلغاء')}
                    </Button>
                    <Button
                      type="submit"
                      disabled={proposalSubmitting}
                      className="rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {proposalSubmitting
                        ? tr('Sending…', 'Envoi en cours…', 'جاري الإرسال…')
                        : tr('Send Proposal', 'Envoyer la demande', 'إرسال الطلب')}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
