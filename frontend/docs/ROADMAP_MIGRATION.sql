-- =============================================================
-- TrendHunter AI · Роадмап Pro · SQL миграции
-- Выполнить в Supabase SQL Editor по порядку (4 шага)
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- МИГРАЦИЯ 1 · kill_switch_date в strategy_sessions
-- ─────────────────────────────────────────────────────────────

ALTER TABLE strategy_sessions
ADD COLUMN IF NOT EXISTS kill_switch_date DATE;

-- Заполнить существующие записи из translated_output блока S5
UPDATE strategy_sessions ss
SET kill_switch_date = (
  SELECT (bd.translated_output->>'specific')::jsonb->>'kill_switch_date'
  FROM block_decisions bd
  WHERE bd.session_id = ss.id
    AND bd.block_id = 'S5'
    AND bd.translated_output IS NOT NULL
  LIMIT 1
)::DATE
WHERE ss.kill_switch_date IS NULL;


-- ─────────────────────────────────────────────────────────────
-- МИГРАЦИЯ 2 · Основные таблицы Роадмапа
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roadmap_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trend_id TEXT NOT NULL,
  strategy_session_id UUID NOT NULL REFERENCES strategy_sessions(id),

  trial_started_at TIMESTAMPTZ,
  trial_expires_at TIMESTAMPTZ,
  discount_window_until TIMESTAMPTZ,
  paid_until TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'discount_window', 'paid', 'expired', 'churned')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, trend_id)
);

CREATE INDEX IF NOT EXISTS idx_roadmap_access_user
  ON roadmap_access(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_access_status
  ON roadmap_access(status, paid_until);


CREATE TABLE IF NOT EXISTS roadmap_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trend_id TEXT NOT NULL,
  access_id UUID REFERENCES roadmap_access(id),

  kill_switch_date DATE NOT NULL,
  first_action_completed BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_sessions_user_trend
  ON roadmap_sessions(user_id, trend_id);


CREATE TABLE IF NOT EXISTS roadmap_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES roadmap_sessions(id) ON DELETE CASCADE,

  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  ai_role TEXT CHECK (ai_role IN ('strategist', 'builder', 'director')),
  content TEXT NOT NULL,

  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd NUMERIC(10, 6),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_session_created
  ON roadmap_chat_messages(session_id, created_at);


CREATE TABLE IF NOT EXISTS roadmap_chat_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES roadmap_sessions(id) ON DELETE CASCADE,

  covers_from_message_id UUID NOT NULL,
  covers_to_message_id UUID NOT NULL,
  summary_content TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS roadmap_user_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES roadmap_sessions(id) ON DELETE CASCADE,

  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,

  updated_via TEXT CHECK (updated_via IN ('ai_dialog', 'manual')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(session_id, metric_name)
);


CREATE TABLE IF NOT EXISTS roadmap_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES roadmap_sessions(id) ON DELETE CASCADE,

  trigger_type TEXT NOT NULL,
  source_url TEXT,
  raw_content TEXT,

  actionable_text TEXT NOT NULL,
  suggested_action TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),

  seen_by_user BOOLEAN DEFAULT FALSE,
  acted_upon BOOLEAN DEFAULT FALSE
);


CREATE TABLE IF NOT EXISTS roadmap_email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id UUID REFERENCES roadmap_sessions(id),

  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'trial_ending', 'discount_open', 'discount_ending'
  )),

  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_user
  ON roadmap_email_notifications(user_id, sent_at DESC);


CREATE TABLE IF NOT EXISTS roadmap_in_app_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES roadmap_sessions(id) ON DELETE CASCADE,

  banner_type TEXT NOT NULL CHECK (banner_type IN (
    'kill_switch_30', 'kill_switch_14', 'kill_switch_7',
    'new_trigger', 'milestone_30', 'milestone_90',
    'proactive_return', 'weekly_summary', 'trial_welcome'
  )),
  content TEXT NOT NULL,

  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS roadmap_daily_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES roadmap_sessions(id) ON DELETE CASCADE,

  date DATE NOT NULL,
  action_text TEXT NOT NULL,
  generated_by_role TEXT DEFAULT 'strategist',
  context JSONB,

  generated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(session_id, date)
);


-- ─────────────────────────────────────────────────────────────
-- МИГРАЦИЯ 3 · RLS политики
-- ─────────────────────────────────────────────────────────────

ALTER TABLE roadmap_access              ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_chat_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_chat_summaries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_user_metrics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_triggers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_in_app_banners      ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_daily_actions       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own roadmap_access" ON roadmap_access;
CREATE POLICY "Users see own roadmap_access"
  ON roadmap_access FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS "Users see own roadmap_sessions" ON roadmap_sessions;
CREATE POLICY "Users see own roadmap_sessions"
  ON roadmap_sessions FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS "Users see own chat messages" ON roadmap_chat_messages;
CREATE POLICY "Users see own chat messages"
  ON roadmap_chat_messages FOR ALL
  USING (
    session_id IN (
      SELECT id FROM roadmap_sessions
      WHERE user_id = current_setting('app.current_user_id', true)
    )
  );

DROP POLICY IF EXISTS "Users see own summaries" ON roadmap_chat_summaries;
CREATE POLICY "Users see own summaries"
  ON roadmap_chat_summaries FOR ALL
  USING (
    session_id IN (
      SELECT id FROM roadmap_sessions
      WHERE user_id = current_setting('app.current_user_id', true)
    )
  );

DROP POLICY IF EXISTS "Users see own metrics" ON roadmap_user_metrics;
CREATE POLICY "Users see own metrics"
  ON roadmap_user_metrics FOR ALL
  USING (
    session_id IN (
      SELECT id FROM roadmap_sessions
      WHERE user_id = current_setting('app.current_user_id', true)
    )
  );

DROP POLICY IF EXISTS "Users see own triggers" ON roadmap_triggers;
CREATE POLICY "Users see own triggers"
  ON roadmap_triggers FOR ALL
  USING (
    session_id IN (
      SELECT id FROM roadmap_sessions
      WHERE user_id = current_setting('app.current_user_id', true)
    )
  );

DROP POLICY IF EXISTS "Users see own email notifications" ON roadmap_email_notifications;
CREATE POLICY "Users see own email notifications"
  ON roadmap_email_notifications FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS "Users see own banners" ON roadmap_in_app_banners;
CREATE POLICY "Users see own banners"
  ON roadmap_in_app_banners FOR ALL
  USING (
    session_id IN (
      SELECT id FROM roadmap_sessions
      WHERE user_id = current_setting('app.current_user_id', true)
    )
  );

DROP POLICY IF EXISTS "Users see own daily actions" ON roadmap_daily_actions;
CREATE POLICY "Users see own daily actions"
  ON roadmap_daily_actions FOR ALL
  USING (
    session_id IN (
      SELECT id FROM roadmap_sessions
      WHERE user_id = current_setting('app.current_user_id', true)
    )
  );


-- ─────────────────────────────────────────────────────────────
-- МИГРАЦИЯ 4 · Trigger для updated_at
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_roadmap_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_roadmap_access_updated_at ON roadmap_access;
CREATE TRIGGER trigger_roadmap_access_updated_at
  BEFORE UPDATE ON roadmap_access
  FOR EACH ROW EXECUTE FUNCTION update_roadmap_access_updated_at();


-- ─────────────────────────────────────────────────────────────
-- ПРОВЕРКА (выполнить отдельно после всех миграций)
-- ─────────────────────────────────────────────────────────────

-- Проверка 9 таблиц
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'roadmap_access',
    'roadmap_sessions',
    'roadmap_chat_messages',
    'roadmap_chat_summaries',
    'roadmap_user_metrics',
    'roadmap_triggers',
    'roadmap_email_notifications',
    'roadmap_in_app_banners',
    'roadmap_daily_actions'
  )
ORDER BY table_name;

-- Проверка нового поля
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'strategy_sessions'
  AND column_name = 'kill_switch_date';
