-- Добавляет колонки для Strategic Delta + Sales Architect в synthesis_results.
-- См. /api/synthesis/route.ts шаг 9.5/10.

ALTER TABLE synthesis_results
  ADD COLUMN IF NOT EXISTS strategic_delta jsonb,
  ADD COLUMN IF NOT EXISTS sales_text      text DEFAULT '',
  ADD COLUMN IF NOT EXISTS bridge_text     text DEFAULT '';

-- UNIQUE для onConflict: 'trend_id,user_id' в upsert
CREATE UNIQUE INDEX IF NOT EXISTS synthesis_results_trend_user_uniq
  ON synthesis_results (trend_id, user_id);
