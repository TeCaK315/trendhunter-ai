import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, isSupabaseConfigured, DbUser } from '@/lib/supabase';

// Admin users list (same as in useIdeasLimit hook)
const ADMIN_USERS = [
  'belousevgeniy315@gmail.com',
  'TeCaK315',
];

function isAdminUser(email: string | null, githubUsername: string | null): boolean {
  if (email && ADMIN_USERS.includes(email)) return true;
  if (githubUsername && ADMIN_USERS.includes(githubUsername)) return true;
  return false;
}

// POST - Create or update user on login
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'Supabase not configured'
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { email, githubUsername, name, avatarUrl, provider } = body;

    if (!email && !githubUsername) {
      return NextResponse.json({
        success: false,
        error: 'Email or GitHub username required'
      }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const isAdmin = isAdminUser(email, githubUsername);

    // Check if user exists
    let existingUser: DbUser | null = null;

    if (email) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      existingUser = data;
    }

    if (!existingUser && githubUsername) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('github_username', githubUsername)
        .single();
      existingUser = data;
    }

    if (existingUser) {
      // Update existing user
      const { data, error } = await supabase
        .from('users')
        .update({
          name: name || existingUser.name,
          avatar_url: avatarUrl || existingUser.avatar_url,
          last_login_at: new Date().toISOString(),
          is_admin: isAdmin,
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        user: data,
        isNew: false
      });
    }

    // Create new user
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: email || null,
        github_username: githubUsername || null,
        name,
        avatar_url: avatarUrl,
        provider: provider || (email ? 'google' : 'github'),
        is_admin: isAdmin,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      user: data,
      isNew: true
    });

  } catch (error) {
    console.error('User API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create/update user'
    }, { status: 500 });
  }
}

// GET - Get current user info
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'Supabase not configured'
    }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const githubUsername = searchParams.get('github');

    if (!email && !githubUsername) {
      return NextResponse.json({
        success: false,
        error: 'Email or GitHub username required'
      }, { status: 400 });
    }

    const supabase = getServerSupabase();

    let query = supabase.from('users').select('*');

    if (email) {
      query = query.eq('email', email);
    } else if (githubUsername) {
      query = query.eq('github_username', githubUsername);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Get user stats
    const { data: stats } = await supabase
      .rpc('get_user_stats', { p_user_id: data.id });

    return NextResponse.json({
      success: true,
      user: data,
      stats: stats?.[0] || null
    });

  } catch (error) {
    console.error('User GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get user'
    }, { status: 500 });
  }
}
