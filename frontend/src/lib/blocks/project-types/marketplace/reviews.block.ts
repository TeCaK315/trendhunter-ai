import type { BlockContext, BlockResult } from '../../types';
import { createDesignTokens } from '../../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  ctx.migrations.push(`
-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, user_id)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_reviews_listing ON reviews(listing_id);
`);

  return {
    // ─── ReviewForm Component ───
    'src/components/ReviewForm.tsx': `'use client';

import React, { useState } from 'react';
import { Star, Loader2, Send } from 'lucide-react';

interface ReviewFormProps {
  listingId: string;
  onReviewSubmitted?: () => void;
}

export default function ReviewForm({ listingId, onReviewSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, rating, comment }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit review');
      }

      setSubmitted(true);
      setComment('');
      setRating(0);
      onReviewSubmitted?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: '${t.primary10}', border: '1px solid ${t.primary20}' }}>
        <p className="font-medium" style={{ color: '${t.primary}' }}>Thank you for your review!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl p-6" style={{ background: '${t.primary10}', border: '1px solid ${t.primary20}' }}>
      <h3 className="font-semibold mb-4" style={{ color: '${t.text}', fontFamily: '${t.headingFont}' }}>
        Leave a Review
      </h3>

      {/* Star Rating */}
      <div className="flex items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className="w-7 h-7"
              fill={(hoverRating || rating) >= star ? '${t.accent}' : 'transparent'}
              stroke={(hoverRating || rating) >= star ? '${t.accent}' : '${t.text50}'}
              strokeWidth={1.5}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm" style={{ color: '${t.text70}' }}>
            {rating}/5
          </span>
        )}
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience..."
        rows={4}
        className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none mb-4"
        style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
        required
      />

      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
        style={{ background: '${t.primary}', color: 'white' }}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Send className="w-4 h-4" />
            Submit Review
          </>
        )}
      </button>
    </form>
  );
}
`,

    // ─── ReviewList Component ───
    'src/components/ReviewList.tsx': `'use client';

import { useState, useEffect } from 'react';
import { Star, Loader2, User } from 'lucide-react';

interface Review {
  id: string;
  user_email: string | null;
  rating: number;
  comment: string;
  created_at: string;
}

interface ReviewListProps {
  listingId: string;
  refreshKey?: number;
}

export default function ReviewList({ listingId, refreshKey }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    fetchReviews();
  }, [listingId, refreshKey]);

  const fetchReviews = async () => {
    try {
      const res = await fetch(\`/api/reviews?listing_id=\${listingId}\`);
      if (!res.ok) throw new Error('Failed to load reviews');
      const data = await res.json();
      setReviews(data.reviews);
      setAvgRating(data.average_rating || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, size: string = 'w-4 h-4') => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={size}
            fill={rating >= star ? '${t.accent}' : 'transparent'}
            stroke={rating >= star ? '${t.accent}' : '${t.text50}'}
            strokeWidth={1.5}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '${t.primary}' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Average Rating Header */}
      {reviews.length > 0 && (
        <div className="flex items-center gap-4 mb-6 pb-6 border-b" style={{ borderColor: '${t.primary20}' }}>
          <div className="text-4xl font-bold" style={{ color: '${t.text}' }}>
            {avgRating.toFixed(1)}
          </div>
          <div>
            {renderStars(Math.round(avgRating), 'w-5 h-5')}
            <p className="text-sm mt-1" style={{ color: '${t.text50}' }}>
              {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="rounded-xl p-5"
            style={{ background: '${t.primary10}', border: '1px solid ${t.primary20}' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: '${t.primary20}', color: '${t.primary}' }}
                >
                  {review.user_email ? review.user_email[0].toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div>
                  <p className="font-medium text-sm" style={{ color: '${t.text}' }}>
                    {review.user_email || 'Anonymous'}
                  </p>
                  <p className="text-xs" style={{ color: '${t.text50}' }}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {renderStars(review.rating)}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '${t.text80}' }}>
              {review.comment}
            </p>
          </div>
        ))}

        {reviews.length === 0 && (
          <div className="text-center py-8" style={{ color: '${t.text50}' }}>
            <Star className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No reviews yet. Be the first!</p>
          </div>
        )}
      </div>
    </div>
  );
}
`,

    // ─── Reviews API ───
    'src/app/api/reviews/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ─── GET: List reviews for a listing ───

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  const listingId = searchParams.get('listing_id');

  if (!listingId) {
    return NextResponse.json({ error: 'listing_id is required' }, { status: 400 });
  }

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('id, user_email, rating, comment, created_at')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate average rating
  const totalRating = (reviews || []).reduce((sum, r) => sum + r.rating, 0);
  const averageRating = reviews && reviews.length > 0 ? totalRating / reviews.length : 0;

  return NextResponse.json({
    reviews: reviews || [],
    average_rating: Math.round(averageRating * 10) / 10,
    total: reviews?.length || 0,
  });
}

// ─── POST: Create a review ───

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { listing_id, rating, comment } = body;

  if (!listing_id || !rating || !comment) {
    return NextResponse.json(
      { error: 'listing_id, rating, and comment are required' },
      { status: 400 }
    );
  }

  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
  }

  // Check if user already reviewed this listing
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('listing_id', listing_id)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    // Update existing review
    const { data: review, error } = await supabase
      .from('reviews')
      .update({ rating, comment })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ review, updated: true });
  }

  // Create new review
  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      listing_id,
      user_id: user.id,
      user_email: user.email,
      rating,
      comment,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ review }, { status: 201 });
}
`,
  };
}
