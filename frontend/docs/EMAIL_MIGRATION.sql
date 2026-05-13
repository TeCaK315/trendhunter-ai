-- =============================================================
-- TrendHunter AI · Email integration · SQL миграция
-- Выполнить в Supabase SQL Editor
-- =============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  unsubscribed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own profile" ON user_profiles;
CREATE POLICY "Users see own profile" ON user_profiles
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS "Users see own unsubscribe" ON email_unsubscribes;
CREATE POLICY "Users see own unsubscribe" ON email_unsubscribes
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));

-- Проверка
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_profiles', 'email_unsubscribes')
ORDER BY table_name;
