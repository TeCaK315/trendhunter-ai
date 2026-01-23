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

// GET - Get admin statistics
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'Supabase not configured'
    }, { status: 503 });
  }

  // Check admin authorization
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

    // Get all users with stats
    const { data: users, error: usersError } = await supabase
      .from('admin_user_stats')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('Users fetch error:', usersError);
    }

    // Get total counts
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: totalIdeas } = await supabase
      .from('ideas')
      .select('*', { count: 'exact', head: true });

    const { count: totalProjects } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true });

    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    const { data: todayStats } = await supabase
      .from('user_usage')
      .select('ideas_generated, projects_created, analyses_run')
      .eq('date', today);

    const todayTotals = (todayStats || []).reduce((acc, row) => ({
      ideas: acc.ideas + (row.ideas_generated || 0),
      projects: acc.projects + (row.projects_created || 0),
      analyses: acc.analyses + (row.analyses_run || 0),
    }), { ideas: 0, projects: 0, analyses: 0 });

    // Get daily stats for last 7 days
    const { data: dailyStats } = await supabase
      .from('admin_daily_stats')
      .select('*')
      .limit(7);

    // Get recent activity
    const { data: recentEvents } = await supabase
      .from('analytics_events')
      .select(`
        *,
        users (email, github_username, name, avatar_url)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalUsers: totalUsers || 0,
          totalIdeas: totalIdeas || 0,
          totalProjects: totalProjects || 0,
          todayIdeas: todayTotals.ideas,
          todayProjects: todayTotals.projects,
          todayAnalyses: todayTotals.analyses,
        },
        users: users || [],
        dailyStats: dailyStats || [],
        recentActivity: recentEvents || [],
      }
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get admin stats'
    }, { status: 500 });
  }
}
