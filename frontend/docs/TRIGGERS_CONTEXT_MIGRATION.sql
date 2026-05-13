-- =============================================================
-- TrendHunter AI · Roadmap triggers context column
-- Выполнить в Supabase SQL Editor
-- =============================================================

ALTER TABLE roadmap_triggers
ADD COLUMN IF NOT EXISTS context JSONB;

-- Проверка
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'roadmap_triggers'
  AND column_name = 'context';
