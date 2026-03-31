import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Star, ArrowLeft, MessageSquare, TrendingUp, Award } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import axios from 'axios';

interface ProfileReviewsProps {
  onBack?: () => void;
}

interface ReviewItem {
  id: string;
  expertName: string;
  expertRole: string;
  expertAvatar: string;
  rating: number;
  comment: string;
  date: string;
  projectName: string;
}

export default function ProfileReviews({ onBack }: ProfileReviewsProps) {
  const [sortBy, setSortBy] = useState<'newest' | 'highest'>('newest');
  const [filterStars, setFilterStars] = useState<number | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get artisan ID from localStorage
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          setLoading(false);
          return;
        }
        const user = JSON.parse(userStr);
        const artisanId = user._id || user.id;
        if (!artisanId) {
          setLoading(false);
          return;
        }

        const token = localStorage.getItem('token') || user.token;
        const res = await axios.get(`/api/artisans/${artisanId}/reviews`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const raw: any[] = Array.isArray(res.data) ? res.data : [];
        const mapped: ReviewItem[] = raw.map((r: any) => {
          const expert = r.expert || {};
          const firstName = expert.firstName || '';
          const lastName = expert.lastName || '';
          const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Expert';
          const role = expert.domain || expert.specialization || expert.role || 'Expert';
          const avatar = expert.profilePhoto || '';
          return {
            id: r._id || String(Math.random()),
            expertName: fullName,
            expertRole: role,
            expertAvatar: avatar,
            rating: r.rating || 0,
            comment: r.comment || '',
            date: r.createdAt || r.updatedAt || new Date().toISOString(),
            projectName: r.projectName || '',
          };
        });

        setReviews(mapped);
      } catch (err: any) {
        console.error('Failed to fetch reviews:', err);
        setError('Failed to load reviews. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, []);


  // Calculate statistics
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
    : 0;
  const recommendationRate = totalReviews > 0
    ? Math.round((reviews.filter(r => r.rating >= 4).length / totalReviews) * 100)
    : 0;

  // Rating breakdown
  const ratingBreakdown = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: reviews.filter(r => r.rating === stars).length,
    percentage: totalReviews > 0
      ? (reviews.filter(r => r.rating === stars).length / totalReviews) * 100
      : 0,
  }));

  // Filter and sort reviews
  const filteredReviews = reviews
    .filter(review => filterStars === null || review.rating === filterStars)
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        return b.rating - a.rating;
      }
    });

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={star <= rating ? 'fill-secondary text-secondary' : 'text-gray-300'}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="rounded-xl border-2 mb-4">
            <ArrowLeft size={20} className="mr-2" />
            Back to Profile
          </Button>
        )}
        <Card className="p-12 bg-card rounded-2xl border border-border shadow-lg text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <MessageSquare size={32} className="text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Could not load reviews</h3>
            <p className="text-muted-foreground max-w-md">{error}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        {onBack && (
          <Button 
            variant="outline" 
            onClick={onBack} 
            className="rounded-xl border-2 mb-4"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Profile
          </Button>
        )}
        <h1 className="text-3xl font-bold text-foreground mb-2">Profile Reviews</h1>
        <p className="text-lg text-muted-foreground">See what experts think about your work</p>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Average Rating */}
        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/30 flex items-center justify-center">
              <Star size={24} className="text-secondary fill-secondary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Rating</p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-foreground">{averageRating.toFixed(1)}</p>
                <Star size={20} className="text-secondary fill-secondary mt-1" />
              </div>
            </div>
          </div>
          <div className="flex gap-1 mt-2">
            {renderStars(Math.round(averageRating))}
          </div>
        </Card>

        {/* Total Reviews */}
        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/30 flex items-center justify-center">
              <MessageSquare size={24} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Reviews</p>
              <p className="text-3xl font-bold text-foreground">{totalReviews}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">From verified experts</p>
        </Card>

        {/* Recommendation Rate */}
        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/30 flex items-center justify-center">
              <TrendingUp size={24} className="text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Would Recommend</p>
              <p className="text-3xl font-bold text-foreground">{recommendationRate}%</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Based on 4-5 star ratings</p>
        </Card>
      </div>

      {/* Rating Breakdown */}
      <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
        <h2 className="text-xl font-bold text-foreground mb-6">Rating Breakdown</h2>
        <div className="space-y-4">
          {ratingBreakdown.map(({ stars, count, percentage }) => (
            <div key={stars} className="flex items-center gap-4">
              <div className="flex items-center gap-2 w-24">
                <span className="text-sm font-medium text-foreground">{stars}</span>
                <Star size={16} className="text-secondary fill-secondary" />
              </div>
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-secondary to-secondary/80 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-sm font-medium text-muted-foreground w-12 text-right">
                {count}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Filters and Sort */}
      <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Filter by rating</p>
            <div className="flex gap-2">
              <Button
                variant={filterStars === null ? "default" : "outline"}
                onClick={() => setFilterStars(null)}
                className="h-9 px-4 rounded-lg"
              >
                All
              </Button>
              {[5, 4, 3, 2, 1].map(stars => (
                <Button
                  key={stars}
                  variant={filterStars === stars ? "default" : "outline"}
                  onClick={() => setFilterStars(stars)}
                  className="h-9 px-3 rounded-lg"
                >
                  {stars}★
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Sort by</p>
            <div className="flex gap-2">
              <Button
                variant={sortBy === 'newest' ? "default" : "outline"}
                onClick={() => setSortBy('newest')}
                className="h-9 px-4 rounded-lg"
              >
                Newest
              </Button>
              <Button
                variant={sortBy === 'highest' ? "default" : "outline"}
                onClick={() => setSortBy('highest')}
                className="h-9 px-4 rounded-lg"
              >
                Highest Rating
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Reviews List */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-6">Expert Reviews ({filteredReviews.length})</h2>
        
        {filteredReviews.length === 0 ? (
          // Empty State
          <Card className="p-12 bg-card rounded-2xl border border-border shadow-lg text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare size={32} className="text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No reviews yet</h3>
              <p className="text-muted-foreground max-w-md">
                Experts will leave feedback on your profile after working with you on projects.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((review, idx) => (
              <Card key={review.id || idx} className="p-6 bg-card rounded-2xl border border-border shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-start gap-4">
                  {/* Expert Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-gray-100">
                      <ImageWithFallback
                        src={review.expertAvatar}
                        alt={review.expertName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Review Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-bold text-foreground">{review.expertName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Award size={14} className="text-primary" />
                          <p className="text-sm text-muted-foreground">{review.expertRole}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-2">
                        {renderStars(review.rating)}
                        <p className="text-sm text-muted-foreground">
                          {new Date(review.date).toLocaleDateString('en-GB', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Project Name */}
                    {review.projectName && (
                      <div className="mb-3">
                        <span className="inline-block px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                          {review.projectName}
                        </span>
                      </div>
                    )}

                    {/* Comment */}
                    {review.comment && (
                      <p className="text-muted-foreground leading-relaxed">
                        {review.comment}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}