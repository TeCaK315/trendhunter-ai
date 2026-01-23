import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, isSupabaseConfigured } from '@/lib/supabase';

// Admin users list
const ADMIN_USERS = [
  'belousevgeniy315@gmail.com',
  'TeCaK315',
];

function isAdmin(email: string | null, github: string | null): boolean {
  if (email && ADMIN_USERS.includes(email)) return true;
  if (github && ADMIN_USERS.includes(github)) return true;
  return false;
}

// GET - Get all ideas (admin only)
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'Supabase not configured'
    }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const adminEmail = searchParams.get('adminEmail');
  const adminGithub = searchParams.get('adminGithub');

  if (!isAdmin(adminEmail, adminGithub)) {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized. Admin access required.'
    }, { status: 403 });
  }

  try {
    const supabase = getServerSupabase();

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Filters
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // Build query
    let query = supabase
      .from('ideas')
      .select(`
        *,
        users (id, email, github_username, name, avatar_url)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data: ideas, count, error } = await query;

    if (error) throw error;

    // Get unique categories for filter
    const { data: categories } = await supabase
      .from('ideas')
      .select('category')
      .not('category', 'is', null);

    const uniqueCategories = [...new Set((categories || []).map(c => c.category))];

    return NextResponse.json({
      success: true,
      data: {
        ideas: ideas || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        categories: uniqueCategories
      }
    });

  } catch (error) {
    console.error('Admin ideas error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get ideas'
    }, { status: 500 });
  }
}
