-- ================================================================
-- TrendHunter AI · roadmap_chat_messages.ai_role constraint patch
-- Старый CHECK разрешал только (strategist, builder, director).
-- Новый код коллеги использует (max, marcus, leo).
-- Заменяем CHECK на расширенный (старые + новые + NULL для user-сообщений).
-- Безопасно: только изменение метаданных constraint, данные не трогаются.
-- ================================================================

ALTER TABLE roadmap_chat_messages
  DROP CONSTRAINT IF EXISTS roadmap_chat_messages_ai_role_check;

ALTER TABLE roadmap_chat_messages
  ADD CONSTRAINT roadmap_chat_messages_ai_role_check
  CHECK (
    ai_role IS NULL
    OR ai_role = ANY (ARRAY['max', 'marcus', 'leo', 'strategist', 'builder', 'director'])
  );
