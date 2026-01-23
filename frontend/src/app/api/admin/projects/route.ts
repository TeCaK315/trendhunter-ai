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

// GET - Get all projects (admin only)
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
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Build query
    let query = supabase
      .from('projects')
      .select(`
        *,
        users (id, email, github_username, name, avatar_url),
        ideas (id, title, category)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: projects, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        projects: projects || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Admin projects error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get projects'
    }, { status: 500 });
  }
}
