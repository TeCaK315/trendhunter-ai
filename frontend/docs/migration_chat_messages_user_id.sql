-- ================================================================
-- TrendHunter AI · roadmap_chat_messages user_id column
-- Добавляет колонку user_id (была пропущена в первой миграции)
-- Безопасно: IF NOT EXISTS, данные не трогаются
-- ================================================================

ALTER TABLE roadmap_chat_messages
  ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Индекс для быстрого поиска истории чата по (roadmap_id, user_id, created_at)
CREATE INDEX IF NOT EXISTS idx_roadmap_chat_messages_lookup
  ON roadmap_chat_messages (roadmap_id, user_id, created_at DESC);
