-- ================================================================
-- TrendHunter AI · roadmap_chat_summaries NOT NULL patch
-- Снимает NOT NULL со старых колонок которые новый код не заполняет
-- Данные не трогаются
-- ================================================================

ALTER TABLE roadmap_chat_summaries ALTER COLUMN covers_from_message_id DROP NOT NULL;
ALTER TABLE roadmap_chat_summaries ALTER COLUMN covers_to_message_id   DROP NOT NULL;
ALTER TABLE roadmap_chat_summaries ALTER COLUMN session_id             DROP NOT NULL;
