-- =============================================================
-- Strategy Summary Card — SQL миграции (Шаг 3)
-- Выполнить в Supabase SQL Editor
-- =============================================================

-- Composite индексы для существующих таблиц
CREATE INDEX IF NOT EXISTS idx_strategy_sessions_user_trend
  ON strategy_sessions(user_id, trend_id);

CREATE INDEX IF NOT EXISTS idx_block_decisions_session_block
  ON block_decisions(session_id, block_id);

-- Новая таблица: summary cards
CREATE TABLE IF NOT EXISTS strategy_summary_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES strategy_sessions(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  trend_id      TEXT NOT NULL,
  card          JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_summary_cards_session_id
  ON strategy_summary_cards(session_id);

CREATE INDEX IF NOT EXISTS idx_summary_cards_user_trend
  ON strategy_summary_cards(user_id, trend_id);

ALTER TABLE strategy_summary_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own summary cards" ON strategy_summary_cards;
CREATE POLICY "Users see own summary cards" ON strategy_summary_cards
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));

-- Проверка
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'strategy_summary_cards';
