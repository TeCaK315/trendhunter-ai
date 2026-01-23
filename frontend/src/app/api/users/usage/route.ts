import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, isSupabaseConfigured } from '@/lib/supabase';

// POST - Record usage (ideas generated, projects created, etc.)
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'Supabase not configured'
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { email, githubUsername, type, amount = 1, ideaData } = body;

    if (!email && !githubUsername) {
      return NextResponse.json({
        success: false,
        error: 'Email or GitHub username required'
      }, { status: 400 });
    }

    if (!type || !['ideas', 'projects', 'analyses'].includes(type)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid type. Must be: ideas, projects, or analyses'
      }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Find user
    let query = supabase.from('users').select('id, is_admin');
    if (email) {
      query = query.eq('email', email);
    } else {
      query = query.eq('github_username', githubUsername);
    }

    const { data: user, error: userError } = await query.single();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Map type to field name
    const fieldMap: Record<string, string> = {
      'ideas': 'ideas_generated',
      'projects': 'projects_created',
      'analyses': 'analyses_run'
    };

    // Increment usage counter
    const { error: usageError } = await supabase.rpc('increment_usage', {
      p_user_id: user.id,
      p_field: fieldMap[type],
      p_amount: amount
    });

    if (usageError) {
      console.error('Usage increment error:', usageError);
    }

    // If recording ideas, also save to ideas table
    if (type === 'ideas' && ideaData && Array.isArray(ideaData)) {
      const ideasToInsert = ideaData.map((idea: {
        id?: string;
        title: string;
        category?: string;
        [key: string]: unknown;
      }) => ({
        user_id: user.id,
        trend_id: idea.id || null,
        title: idea.title,
        category: idea.category || 'Unknown',
        data: idea
      }));

      const { error: ideasError } = await supabase
        .from('ideas')
        .insert(ideasToInsert);

      if (ideasError) {
        console.error('Ideas insert error:', ideasError);
      }
    }

    // Log analytics event
    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_type: `${type}_recorded`,
      event_data: { amount, ideaCount: ideaData?.length }
    });

    return NextResponse.json({
      success: true,
      message: `Recorded ${amount} ${type}`,
      isAdmin: user.is_admin
    });

  } catch (error) {
    console.error('Usage API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to record usage'
    }, { status: 500 });
  }
}

// GET - Get user's usage for today
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

    // Find user
    let userQuery = supabase.from('users').select('id, is_admin');
    if (email) {
      userQuery = userQuery.eq('email', email);
    } else {
      userQuery = userQuery.eq('github_username', githubUsername);
    }

    const { data: user, error: userError } = await userQuery.single();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const { data: usage } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    return NextResponse.json({
      success: true,
      usage: usage || {
        ideas_generated: 0,
        projects_created: 0,
        analyses_run: 0
      },
      isAdmin: user.is_admin
    });

  } catch (error) {
    console.error('Usage GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get usage'
    }, { status: 500 });
  }
}
