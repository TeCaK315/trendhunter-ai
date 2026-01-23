-- =====================================================
-- TrendHunter AI - User Tracking & Admin Tables
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Users table - stores all registered users
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  github_username TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_github ON users(github_username);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);

-- =====================================================
-- User usage table - daily usage tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS user_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  ideas_generated INTEGER DEFAULT 0,
  projects_created INTEGER DEFAULT 0,
  analyses_run INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per user per day
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_usage_user ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_date ON user_usage(date);

-- =====================================================
-- Ideas table - all generated ideas
-- =====================================================
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trend_id TEXT,
  title TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ideas_user ON ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);
CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at DESC);

-- =====================================================
-- Projects table - user projects
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idea_id UUID REFERENCES ideas(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- =====================================================
-- Analytics events (optional, for detailed tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);

-- =====================================================
-- RLS Policies (Row Level Security)
-- =====================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data (except admins via service role)
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can view own usage" ON user_usage
  FOR SELECT USING (auth.uid()::text = user_id::text OR
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND is_admin = true));

CREATE POLICY "Users can view own ideas" ON ideas
  FOR SELECT USING (auth.uid()::text = user_id::text OR
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND is_admin = true));

CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid()::text = user_id::text OR
    EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND is_admin = true));

-- Service role bypass for all tables (for API routes)
CREATE POLICY "Service role full access users" ON users
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access usage" ON user_usage
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access ideas" ON ideas
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access projects" ON projects
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access analytics" ON analytics_events
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- Helper functions
-- =====================================================

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id UUID,
  p_field TEXT,
  p_amount INTEGER DEFAULT 1
) RETURNS void AS $$
BEGIN
  INSERT INTO user_usage (user_id, date, ideas_generated, projects_created, analyses_run)
  VALUES (p_user_id, CURRENT_DATE,
    CASE WHEN p_field = 'ideas_generated' THEN p_amount ELSE 0 END,
    CASE WHEN p_field = 'projects_created' THEN p_amount ELSE 0 END,
    CASE WHEN p_field = 'analyses_run' THEN p_amount ELSE 0 END
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    ideas_generated = user_usage.ideas_generated +
      CASE WHEN p_field = 'ideas_generated' THEN p_amount ELSE 0 END,
    projects_created = user_usage.projects_created +
      CASE WHEN p_field = 'projects_created' THEN p_amount ELSE 0 END,
    analyses_run = user_usage.analyses_run +
      CASE WHEN p_field = 'analyses_run' THEN p_amount ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get user stats
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE(
  total_ideas BIGINT,
  total_projects BIGINT,
  total_analyses BIGINT,
  ideas_today INTEGER,
  days_active BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM ideas WHERE user_id = p_user_id) as total_ideas,
    (SELECT COUNT(*) FROM projects WHERE user_id = p_user_id) as total_projects,
    (SELECT COALESCE(SUM(analyses_run), 0) FROM user_usage WHERE user_id = p_user_id) as total_analyses,
    (SELECT COALESCE(ideas_generated, 0) FROM user_usage WHERE user_id = p_user_id AND date = CURRENT_DATE) as ideas_today,
    (SELECT COUNT(DISTINCT date) FROM user_usage WHERE user_id = p_user_id) as days_active;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Admin views for dashboard
-- =====================================================

-- View: User statistics summary
CREATE OR REPLACE VIEW admin_user_stats AS
SELECT
  u.id,
  u.email,
  u.github_username,
  u.name,
  u.avatar_url,
  u.provider,
  u.created_at,
  u.last_login_at,
  u.is_admin,
  COALESCE(SUM(uu.ideas_generated), 0) as total_ideas,
  COALESCE(SUM(uu.projects_created), 0) as total_projects,
  COALESCE(SUM(uu.analyses_run), 0) as total_analyses,
  COUNT(DISTINCT uu.date) as days_active
FROM users u
LEFT JOIN user_usage uu ON u.id = uu.user_id
GROUP BY u.id;

-- View: Daily platform stats
CREATE OR REPLACE VIEW admin_daily_stats AS
SELECT
  date,
  COUNT(DISTINCT user_id) as active_users,
  SUM(ideas_generated) as total_ideas,
  SUM(projects_created) as total_projects,
  SUM(analyses_run) as total_analyses
FROM user_usage
GROUP BY date
ORDER BY date DESC;

-- =====================================================
-- Set your admin users
-- Replace with your actual email/github username
-- =====================================================

-- This will be done via API when user first logs in
-- UPDATE users SET is_admin = true WHERE email = 'belousevgeniy315@gmail.com';
-- UPDATE users SET is_admin = true WHERE github_username = 'TeCaK315';
