import type { BlockContext, BlockResult } from '../../types';
import { createDesignTokens } from '../../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const name = ctx.safe.projectName;

  ctx.migrations.push(`
-- Listings table
CREATE TABLE IF NOT EXISTS listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  category TEXT,
  images TEXT[] DEFAULT '{}',
  location TEXT,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seller_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings"
  ON listings FOR SELECT
  USING (status = 'active');

CREATE POLICY "Sellers can manage own listings"
  ON listings FOR ALL
  USING (auth.uid() = seller_id);

CREATE INDEX idx_listings_category ON listings(category);
CREATE INDEX idx_listings_seller ON listings(seller_id);
CREATE INDEX idx_listings_created ON listings(created_at DESC);
`);

  return {
    // ─── Listings Grid Page ───
    'src/app/listings/page.tsx': `'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import ListingCard from '@/components/ListingCard';

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string | null;
  images: string[];
  location: string | null;
  seller_email: string | null;
  created_at: string;
}

const PAGE_SIZE = 12;

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchListings();
  }, [page, search]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
      });
      if (search) params.set('search', search);

      const res = await fetch(\`/api/listings?\${params}\`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setListings(data.listings);
      setTotalCount(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: '${t.bg}', color: '${t.text}' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold" style={{ fontFamily: '${t.headingFont}' }}>
            Marketplace
          </h1>
          <Link
            href="/listings/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-colors"
            style={{ background: '${t.primary}', color: 'white' }}
          >
            <Plus className="w-5 h-5" />
            Create Listing
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '${t.text50}' }} />
          <input
            type="text"
            placeholder="Search listings..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
            style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '${t.primary}' }} />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20" style={{ color: '${t.text50}' }}>
            <p className="text-lg mb-2">No listings found</p>
            <p className="text-sm">Be the first to create one!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-10">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border disabled:opacity-30 transition-colors hover:bg-white/5"
                  style={{ borderColor: '${t.primary40}' }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm" style={{ color: '${t.text70}' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border disabled:opacity-30 transition-colors hover:bg-white/5"
                  style={{ borderColor: '${t.primary40}' }}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
`,

    // ─── Listing Detail Page ───
    'src/app/listings/[id]/page.tsx': `import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, User, Calendar, Eye, MessageSquare } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .eq('status', 'active')
    .single();

  if (error || !listing) {
    notFound();
  }

  // Increment views
  await supabase
    .from('listings')
    .update({ views_count: (listing.views_count || 0) + 1 })
    .eq('id', id);

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: listing.currency || 'USD',
  }).format(listing.price);

  const formattedDate = new Date(listing.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: '${t.bg}', color: '${t.text}' }}>
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link
          href="/listings"
          className="inline-flex items-center gap-2 mb-6 text-sm hover:underline"
          style={{ color: '${t.primary}' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to listings
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Image */}
            {listing.images && listing.images.length > 0 ? (
              <div className="rounded-2xl overflow-hidden mb-6 aspect-video">
                <img
                  src={listing.images[0]}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="rounded-2xl mb-6 aspect-video flex items-center justify-center"
                style={{ background: '${t.primary10}' }}
              >
                <span className="text-4xl" style={{ color: '${t.primary40}' }}>No image</span>
              </div>
            )}

            <h1 className="text-3xl font-bold mb-4" style={{ fontFamily: '${t.headingFont}' }}>
              {listing.title}
            </h1>

            <div className="flex flex-wrap gap-4 mb-6 text-sm" style={{ color: '${t.text70}' }}>
              {listing.category && (
                <span className="px-3 py-1 rounded-full" style={{ background: '${t.primary20}', color: '${t.primary}' }}>
                  {listing.category}
                </span>
              )}
              {listing.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {listing.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" /> {formattedDate}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" /> {listing.views_count || 0} views
              </span>
            </div>

            <div className="prose prose-invert max-w-none">
              <p className="whitespace-pre-wrap leading-relaxed" style={{ color: '${t.text80}' }}>
                {listing.description}
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border p-6 sticky top-6" style={{ borderColor: '${t.primary20}' }}>
              <div className="text-3xl font-bold mb-4" style={{ color: '${t.primary}' }}>
                {formattedPrice}
              </div>

              <div className="flex items-center gap-3 mb-6 pb-6 border-b" style={{ borderColor: '${t.primary20}' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                     style={{ background: '${t.primary20}', color: '${t.primary}' }}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">{listing.seller_email || 'Seller'}</p>
                  <p className="text-xs" style={{ color: '${t.text50}' }}>Seller</p>
                </div>
              </div>

              <Link
                href={\`/dashboard/messages?to=\${listing.seller_id}&listing=\${listing.id}\`}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors"
                style={{ background: '${t.primary}', color: 'white' }}
              >
                <MessageSquare className="w-5 h-5" />
                Contact Seller
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`,

    // ─── Create Listing Page ───
    'src/app/listings/new/page.tsx': `'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Loader2, DollarSign } from 'lucide-react';

export default function NewListingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    location: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price) || 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create listing');
      }

      const data = await res.json();
      router.push(\`/listings/\${data.listing.id}\`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: '${t.bg}', color: '${t.text}' }}>
      <div className="max-w-2xl mx-auto">
        <Link
          href="/listings"
          className="inline-flex items-center gap-2 mb-6 text-sm hover:underline"
          style={{ color: '${t.primary}' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to listings
        </Link>

        <h1 className="text-2xl font-bold mb-8" style={{ fontFamily: '${t.headingFont}' }}>
          Create New Listing
        </h1>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="What are you selling?"
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
              style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe your item in detail..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none"
              style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
              required
            />
          </div>

          {/* Price + Category Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Price (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '${t.text50}' }} />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                  style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                placeholder="e.g. Electronics, Services..."
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder="City, Country"
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
              style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
            />
          </div>

          {/* Image Upload Placeholder */}
          <div>
            <label className="block text-sm font-medium mb-2">Images</label>
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-white/5 transition-colors"
              style={{ borderColor: '${t.primary40}' }}
            >
              <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: '${t.text50}' }} />
              <p className="text-sm" style={{ color: '${t.text50}' }}>
                Image upload coming soon
              </p>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
            style={{ background: '${t.primary}', color: 'white' }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Publish Listing'}
          </button>
        </form>
      </div>
    </div>
  );
}
`,

    // ─── Listings API ───
    'src/app/api/listings/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ─── GET: List listings with pagination + search ───

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50);
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'newest';
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');

  const offset = (page - 1) * limit;

  let query = supabase
    .from('listings')
    .select('*', { count: 'exact' })
    .eq('status', 'active');

  // Search
  if (search) {
    query = query.or(\`title.ilike.%\${search}%,description.ilike.%\${search}%\`);
  }

  // Category filter
  if (category) {
    query = query.eq('category', category);
  }

  // Price range
  if (minPrice) {
    query = query.gte('price', parseFloat(minPrice));
  }
  if (maxPrice) {
    query = query.lte('price', parseFloat(maxPrice));
  }

  // Sort
  switch (sort) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data: listings, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    listings: listings || [],
    total: count || 0,
    page,
    limit,
  });
}

// ─── POST: Create listing ───

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
  const { title, description, price, category, location, images } = body;

  if (!title || !description) {
    return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
  }

  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      title,
      description,
      price: price || 0,
      category: category || null,
      location: location || null,
      images: images || [],
      seller_id: user.id,
      seller_email: user.email,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ listing }, { status: 201 });
}
`,

    // ─── ListingCard Component ───
    'src/components/ListingCard.tsx': `import Link from 'next/link';
import { MapPin } from 'lucide-react';

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string | null;
  images: string[];
  location: string | null;
  seller_email: string | null;
  created_at: string;
}

interface ListingCardProps {
  listing: Listing;
}

export default function ListingCard({ listing }: ListingCardProps) {
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: listing.currency || 'USD',
  }).format(listing.price);

  return (
    <Link href={\`/listings/\${listing.id}\`}>
      <div
        className="rounded-2xl border overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer group"
        style={{ borderColor: '${t.primary20}', background: '${t.primary10}' }}
      >
        {/* Image */}
        {listing.images && listing.images.length > 0 ? (
          <div className="aspect-[4/3] overflow-hidden">
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div
            className="aspect-[4/3] flex items-center justify-center"
            style={{ background: '${t.primary20}' }}
          >
            <span className="text-2xl" style={{ color: '${t.primary40}' }}>No image</span>
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold line-clamp-1" style={{ color: '${t.text}' }}>
              {listing.title}
            </h3>
            <span className="text-lg font-bold whitespace-nowrap" style={{ color: '${t.primary}' }}>
              {formattedPrice}
            </span>
          </div>

          <p className="text-sm line-clamp-2 mb-3" style={{ color: '${t.text70}' }}>
            {listing.description}
          </p>

          <div className="flex items-center justify-between text-xs" style={{ color: '${t.text50}' }}>
            <span>{listing.seller_email || 'Seller'}</span>
            {listing.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {listing.location}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
`,
  };
}
