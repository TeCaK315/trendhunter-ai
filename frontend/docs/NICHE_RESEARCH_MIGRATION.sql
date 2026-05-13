-- =============================================================
-- TrendHunter AI · Niche Research persistence + custom trends
-- Выполнить в Supabase SQL Editor
-- =============================================================

-- 1. Таблица сырых результатов /niche-research
CREATE TABLE IF NOT EXISTS custom_niche_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  niche TEXT NOT NULL,
  description TEXT,
  analysis JSONB NOT NULL,
  sources JSONB,
  product_spec JSONB,
  trend_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_niche UNIQUE (user_id, niche)
);

CREATE INDEX IF NOT EXISTS idx_custom_niche_research_user
  ON custom_niche_research(user_id, created_at DESC);

ALTER TABLE custom_niche_research ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own niche research" ON custom_niche_research;
CREATE POLICY "Users see own niche research"
  ON custom_niche_research FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));


-- 2. Таблица мета-данных custom трендов (для совместимости с trends.json)
CREATE TABLE IF NOT EXISTS custom_trends (
  trend_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'Custom',
  description TEXT,
  score NUMERIC,
  source TEXT DEFAULT 'niche_research',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_trends_user
  ON custom_trends(user_id);

ALTER TABLE custom_trends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own custom trends" ON custom_trends;
CREATE POLICY "Users see own custom trends"
  ON custom_trends FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));


-- Проверка
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('custom_niche_research', 'custom_trends')
ORDER BY table_name;
