-- ============================================================
-- Intelligence Layer: добавляем поля для кэша Sonnet-анализа
-- ============================================================
-- Выполни в Supabase Dashboard → SQL Editor → Run
--
-- Эти поля хранят результат Intelligence Layer (Sonnet промпт)
-- для каждого блока. Кэшируется чтобы не вызывать Sonnet повторно.

ALTER TABLE block_results
  ADD COLUMN IF NOT EXISTS intelligence_output jsonb,
  ADD COLUMN IF NOT EXISTS intelligence_updated_at timestamptz;

-- Готово! После выполнения перезапусти анализ тренда чтобы
-- block_context заполнился новыми полями.
