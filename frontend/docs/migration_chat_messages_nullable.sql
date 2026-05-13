-- ================================================================
-- TrendHunter AI · roadmap_chat_messages NOT NULL patch
-- Снимает NOT NULL со старых колонок которые новый код не заполняет
-- Данные не трогаются
-- ================================================================

ALTER TABLE roadmap_chat_messages ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE roadmap_chat_messages ALTER COLUMN content   DROP NOT NULL;
ALTER TABLE roadmap_chat_messages ALTER COLUMN role      DROP NOT NULL;
