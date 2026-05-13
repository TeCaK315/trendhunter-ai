-- ================================================================
-- TrendHunter AI · roadmap_chat_summaries schema patch
-- Добавляет колонки новой схемы к существующей таблице
-- Безопасно: IF NOT EXISTS, данные не трогаются
-- ================================================================

ALTER TABLE roadmap_chat_summaries
  ADD COLUMN IF NOT EXISTS roadmap_id UUID REFERENCES roadmap_sessions(id) ON DELETE CASCADE;

ALTER TABLE roadmap_chat_summaries
  ADD COLUMN IF NOT EXISTS user_id TEXT;

ALTER TABLE roadmap_chat_summaries
  ADD COLUMN IF NOT EXISTS covers_messages_count INTEGER;

ALTER TABLE roadmap_chat_summaries
  ADD COLUMN IF NOT EXISTS active_topic TEXT;

ALTER TABLE roadmap_chat_summaries
  ADD COLUMN IF NOT EXISTS no_new_facts BOOLEAN DEFAULT FALSE;
