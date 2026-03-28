import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Calendar,
  Star,
  MessageSquare,
  Phone,
  Mail,
  FolderOpen,
  Send,
  ImageIcon,
} from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface ViewArtisanProfileProps {
  artisanId: string;
  onBack: () => void;
  onContact: () => void;
}

interface ArtisanProfile {
  firstName: string;
  lastName: string;
  domain: string;
  location: string;
  yearsExperience: number;
  bio: string;
  phone: string;
  email: string;
  profileImage: string;
  portfolioCount: number;
}

interface Review {
  _id: string;
  expertName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_ORIGIN = API_URL.replace(/\/api\/?$/, '');

const getToken = () => {
  const direct = localStorage.getItem('token');
  if (direct) return direct;
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user).token : null;
  } catch {
    return null;
  }
};

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={28}
          className={`cursor-pointer transition-colors ${
            star <= (hovered || value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
          }`}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
        />
      ))}
    </div>
  );
}

export default function ViewArtisanProfile({ artisanId, onBack, onContact }: ViewArtisanProfileProps) {
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  const fetchReviews = async () => {
    try {
      setLoadingReviews(true);
      const res = await axios.get(`${API_URL}/artisans/${artisanId}/reviews`);
      setReviews(res.data.reviews || []);
      setAverageRating(res.data.averageRating || 0);
    } catch {
      setReviews([]);
      setAverageRating(0);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoadingProfile(true);
        setProfileError(null);
        const res = await axios.get(`${API_URL}/artisans/${artisanId}`);
        const data = res.data;
        setArtisan({
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          domain: data.domain ?? '',
          location: data.location ?? '',
          yearsExperience: data.yearsExperience ?? 0,
          bio: data.bio ?? '',
          phone: data.phone ?? '',
          email: data.email ?? '',
          profileImage: data.profilePhoto
            ? data.profilePhoto.startsWith('http')
              ? data.profilePhoto
              : `${BACKEND_ORIGIN}/${data.profilePhoto.replace(/^\/+/, '')}`
            : '',
          portfolioCount: Array.isArray(data.portfolio) ? data.portfolio.length : 0,
        });
      } catch (err: any) {
        setProfileError(err?.response?.data?.message || 'Failed to load artisan profile.');
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
    fetchReviews();
  }, [artisanId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError('');
    setReviewSuccess('');
    if (!reviewRating) {
      setReviewError('Please select a rating.');
      return;
    }
    if (!reviewComment.trim()) {
      setReviewError('Please write a comment.');
      return;
    }
    const token = getToken();
    if (!token) {
      setReviewError('You must be logged in to leave a review.');
      return;
    }
    try {
      setSubmittingReview(true);
      await axios.post(
        `${API_URL}/artisans/${artisanId}/reviews`,
        { rating: reviewRating, comment: reviewComment.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReviewSuccess('Your review has been submitted!');
      setReviewRating(0);
      setReviewComment('');
      await fetchReviews();
    } catch (err: any) {
      setReviewError(err?.response?.data?.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
          <ArrowLeft size={20} className="mr-2" />
          Back to Artisan Directory
        </Button>
        <p className="text-sm text-muted-foreground">Loading artisan profile...</p>
      </div>
    );
  }

  if (profileError || !artisan) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
          <ArrowLeft size={20} className="mr-2" />
          Back to Artisan Directory
        </Button>
        <p className="text-sm text-red-500">{profileError || 'Artisan not found.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
        <ArrowLeft size={20} className="mr-2" />
        Back to Artisan Directory
      </Button>

      {/* Profile Header */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: '3px solid #f3f4f6',
              }}
            >
              <ImageWithFallback
                src={artisan.profileImage}
                alt={`${artisan.firstName} ${artisan.lastName}`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {artisan.firstName} {artisan.lastName}
                </h1>
                {artisan.domain && (
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase size={18} className="text-primary" />
                    <span className="text-lg font-medium text-muted-foreground">{artisan.domain}</span>
                  </div>
                )}
                {artisan.location && (
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={18} className="text-muted-foreground" />
                    <span className="text-muted-foreground">{artisan.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-muted-foreground" />
                  <span className="text-muted-foreground">{artisan.yearsExperience} years of experience</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap shrink-0">
                <Button
                  variant="outline"
                  className="h-12 px-6 rounded-xl border-2"
                  onClick={() => window.location.assign(`/portfolio/artisan/${artisanId}`)}
                >
                  <FolderOpen size={18} className="mr-2" />
                  View Portfolio
                </Button>
                <Button
                  className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
                  onClick={onContact}
                >
                  <MessageSquare size={18} className="mr-2" />
                  Contact Artisan
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star size={18} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-2xl font-bold text-foreground">
                    {averageRating > 0 ? averageRating.toFixed(1) : '—'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{reviews.length} Review{reviews.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-accent/5 to-accent/10 text-center">
                <p className="text-2xl font-bold text-foreground mb-1">{artisan.portfolioCount}</p>
                <p className="text-xs text-muted-foreground">Portfolio Items</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/5 to-secondary/10 text-center">
                <p className="text-2xl font-bold text-foreground mb-1">{artisan.yearsExperience}</p>
                <p className="text-xs text-muted-foreground">Years Exp.</p>
              </div>
            </div>

            {artisan.bio && (
              <p className="text-muted-foreground leading-relaxed">{artisan.bio}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Contact Info */}
      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <h2 className="text-xl font-bold text-foreground mb-4">Contact Information</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {artisan.phone && (
            <div className="flex items-start gap-3">
              <Phone size={18} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                <p className="font-medium text-foreground text-sm">{artisan.phone}</p>
              </div>
            </div>
          )}
          {artisan.email && (
            <div className="flex items-start gap-3">
              <Mail size={18} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                <p className="font-medium text-foreground text-sm break-all">{artisan.email}</p>
              </div>
            </div>
          )}
          {artisan.location && (
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Location</p>
                <p className="font-medium text-foreground text-sm">{artisan.location}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Domain */}
      {artisan.domain && (
        <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
          <h2 className="text-xl font-bold text-foreground mb-4">Specialization</h2>
          <Badge className="bg-primary/10 text-primary border-0 px-4 py-2 text-sm font-medium">
            {artisan.domain}
          </Badge>
        </Card>
      )}

      {/* Reviews */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          Reviews
          {reviews.length > 0 && (
            <span className="text-base font-normal text-muted-foreground flex items-center gap-1">
              {reviews.length} avis ·
              <Star size={16} className="text-yellow-400 fill-yellow-400" />
              {averageRating.toFixed(1)}
            </span>
          )}
        </h2>

        {/* Leave a Review form */}
        <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
          <h3 className="text-lg font-bold text-foreground mb-4">Leave a Review</h3>
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Your rating</p>
              <StarRating value={reviewRating} onChange={setReviewRating} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Your comment</p>
              <Textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience working with this artisan..."
                className="rounded-xl"
              />
            </div>
            {reviewError && <p className="text-sm text-red-500">{reviewError}</p>}
            {reviewSuccess && <p className="text-sm text-green-600">{reviewSuccess}</p>}
            <Button
              type="submit"
              disabled={submittingReview}
              className="h-11 px-6 rounded-xl bg-primary text-white hover:bg-primary/90"
            >
              <Send size={16} className="mr-2" />
              {submittingReview ? 'Submitting...' : 'Submit Review'}
            </Button>
          </form>
        </Card>

        {/* Review list */}
        {loadingReviews ? (
          <p className="text-sm text-muted-foreground">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg text-center">
            <ImageIcon size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-muted-foreground">No reviews yet. Be the first!</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review._id} className="p-5 bg-white rounded-2xl border-0 shadow-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-foreground">{review.expertName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={15}
                        className={
                          star <= review.rating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-200 fill-gray-200'
                        }
                      />
                    ))}
                  </div>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{review.comment}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
