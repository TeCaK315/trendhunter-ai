-- ================================================================
-- TrendHunter AI · Roadmap Pro · SAFE migration patch
--
-- Источник: C:\Users\belou\OneDrive\Рабочий стол\ROADMAP_FINAL\supabase\roadmap_migrations.sql
--
-- Цель: добавить новые колонки в существующие roadmap_sessions
-- и roadmap_chat_messages БЕЗ потери данных, плюс создать 10
-- новых таблиц + 5 функций + 2 индекса + RLS политики.
--
-- БЕЗОПАСНО: все ALTER используют ADD COLUMN IF NOT EXISTS,
-- все CREATE TABLE используют IF NOT EXISTS, все CREATE POLICY
-- обёрнуты в DROP POLICY IF EXISTS чтобы не дублироваться.
-- Запускать в Supabase SQL Editor одним прогоном.
-- ================================================================


-- ================================================================
-- БЛОК 1: Новые колонки в roadmap_sessions
-- ================================================================

ALTER TABLE roadmap_sessions ADD COLUMN IF NOT EXISTS niche TEXT;
ALTER TABLE roadmap_sessions ADD COLUMN IF NOT EXISTS strategy_summary TEXT;
ALTER TABLE roadmap_sessions ADD COLUMN IF NOT EXISTS kill_switch_metric TEXT;
ALTER TABLE roadmap_sessions ADD COLUMN IF NOT EXISTS channel_type TEXT;
ALTER TABLE roadmap_sessions ADD COLUMN IF NOT EXISTS active_role TEXT DEFAULT 'max';
ALTER TABLE roadmap_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'trial';
ALTER TABLE roadmap_sessions ADD COLUMN IF NOT EXISTS day_number INTEGER DEFAULT 1;
ALTER TABLE roadmap_sessions ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE roadmap_sessions ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
ALTER TABLE roadmap_sessions ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ;
ALTER TABLE roadmap_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE roadmap_sessions ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;


-- ================================================================
-- БЛОК 2: roadmap_chat_messages — алиасы roadmap_id и доп. поля
-- ================================================================

ALTER TABLE roadmap_chat_messages ADD COLUMN IF NOT EXISTS roadmap_id UUID;
ALTER TABLE roadmap_chat_messages ADD COLUMN IF NOT EXISTS ai_role TEXT;
ALTER TABLE roadmap_chat_messages ADD COLUMN IF NOT EXISTS tokens_input INTEGER DEFAULT 0;
ALTER TABLE roadmap_chat_messages ADD COLUMN IF NOT EXISTS tokens_output INTEGER DEFAULT 0;
ALTER TABLE roadmap_chat_messages ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10,6) DEFAULT 0;

-- Если хочешь заполнить roadmap_id из session_id для существующих записей —
-- раскомментируй (предполагается что session_id ссылается на roadmap_sessions.id):
-- UPDATE roadmap_chat_messages SET roadmap_id = session_id WHERE roadmap_id IS NULL;


-- ================================================================
-- БЛОК 3: 10 новых таблиц (IF NOT EXISTS — безопасно)
-- ================================================================

-- ── 4. CONVERSATIONS TRACKER ────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmap_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES roadmap_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  lead_name TEXT NOT NULL,
  lead_handle TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('reddit', 'linkedin', 'email', 'twitter', 'other')),
  channel_other TEXT,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('hot', 'active', 'stalled', 'won', 'lost')),
  trajectory TEXT CHECK (trajectory IN ('warming', 'stable', 'cooling')),

  first_contact_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  last_user_action_at TIMESTAMPTZ,

  next_action TEXT,
  next_action_due DATE,
  next_action_done BOOLEAN DEFAULT FALSE,

  message_history JSONB DEFAULT '[]',
  notes TEXT,

  outcome_reason TEXT CHECK (outcome_reason IN (
    'wrong_icp', 'no_budget', 'wrong_timing', 'weak_pain',
    'competitor', 'ghosting', 'price', 'product_gap',
    'self_solution', 'other'
  )),
  outcome_reason_detail TEXT,

  related_experiment_ids UUID[] DEFAULT '{}',
  used_templates UUID[] DEFAULT '{}',

  promoted_to_personal BOOLEAN DEFAULT FALSE,
  pre_adjust BOOLEAN DEFAULT FALSE,
  post_adjust BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_roadmap
  ON roadmap_conversations(roadmap_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_user
  ON roadmap_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_next_action
  ON roadmap_conversations(next_action_due)
  WHERE next_action_done = FALSE AND next_action_due IS NOT NULL;


-- ── 5. EXPERIMENTS TRACKER ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmap_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES roadmap_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  hypothesis TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'channel', 'message', 'price', 'positioning', 'product', 'other'
  )),

  metric TEXT NOT NULL CHECK (metric IN (
    'open_rate', 'reply_rate', 'conversion_to_meeting',
    'conversion_to_paying', 'time_to_close', 'objection_rate',
    'channel_response_rate', 'custom'
  )),
  metric_custom TEXT,
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  min_sample_size INTEGER DEFAULT 20,

  cost_hours_estimated NUMERIC,
  cost_hours_actual NUMERIC,
  cost_money_estimated NUMERIC,
  cost_money_actual NUMERIC,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'validated', 'rejected', 'paused')),
  confidence TEXT DEFAULT 'weak_signal'
    CHECK (confidence IN ('weak_signal', 'emerging', 'probable', 'validated')),

  started_at TIMESTAMPTZ DEFAULT NOW(),
  duration_days INTEGER DEFAULT 14,
  ends_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  evidence_snapshots JSONB DEFAULT '[]',

  result_summary TEXT,
  why_validated TEXT,
  why_rejected TEXT,
  lesson TEXT,

  related_conversation_ids UUID[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiments_roadmap
  ON roadmap_experiments(roadmap_id, status);
CREATE INDEX IF NOT EXISTS idx_experiments_user
  ON roadmap_experiments(user_id);


-- ── 6. DAILY LOG ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmap_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES roadmap_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,

  what_done TEXT,
  what_learned TEXT,
  what_blocking TEXT,

  energy SMALLINT CHECK (energy BETWEEN 1 AND 5),

  blocking_to_discuss_with_max BOOLEAN DEFAULT FALSE,
  has_significant_decision BOOLEAN DEFAULT FALSE,
  small_win TEXT,

  decision JSONB,

  promoted_to_knowledge BOOLEAN DEFAULT FALSE,
  knowledge_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, roadmap_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_roadmap_date
  ON roadmap_daily_logs(roadmap_id, date DESC);


-- ── 7. TEMPLATES & ASSETS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmap_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES roadmap_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  type TEXT NOT NULL CHECK (type IN ('template', 'asset_url')),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'cold_outreach', 'follow_up', 'objection_handling', 'closing',
    'reactivation', 'asset_landing', 'asset_demo', 'asset_doc', 'other'
  )),
  tags TEXT[] DEFAULT '{}',

  template_data JSONB,
  asset_data JSONB,

  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  used_in_conversations UUID[] DEFAULT '{}',
  performance JSONB,

  version INTEGER DEFAULT 1,
  previous_versions JSONB DEFAULT '[]',
  parent_id UUID,

  created_with_marcus BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_roadmap
  ON roadmap_templates(roadmap_id, category);


-- ── 8. USER MEMORY ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmap_user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES roadmap_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  fears JSONB DEFAULT '[]',
  resolved_fears JSONB DEFAULT '[]',
  open_questions JSONB DEFAULT '[]',

  milestones JSONB DEFAULT '[]',
  actions_taken JSONB DEFAULT '[]',
  decisions_made JSONB DEFAULT '[]',
  hypotheses_tested JSONB DEFAULT '[]',

  leo_calculations JSONB DEFAULT '[]',

  emotional_context JSONB DEFAULT '{"last_distress_signal_at": null, "distress_signal_count_7d": 0}',

  last_updated TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(roadmap_id, user_id)
);


-- ── 9. TRIGGER LOCKS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmap_trigger_locks (
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'inactivity', 'execution', 'progress', 'pattern',
    'kill_switch_review', 'crisis_mode', 'adjust_experiment'
  )),
  locked_until TIMESTAMPTZ NOT NULL,
  triggered_by TEXT,
  PRIMARY KEY (user_id, category)
);


-- ── 10. TRIGGER HISTORY ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmap_trigger_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  roadmap_id UUID REFERENCES roadmap_sessions(id),
  trigger_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMPTZ,
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMPTZ,
  replied BOOLEAN DEFAULT FALSE,
  replied_at TIMESTAMPTZ,
  ignored BOOLEAN DEFAULT FALSE,
  content TEXT,
  confidence TEXT
);

CREATE INDEX IF NOT EXISTS idx_trigger_history_user
  ON roadmap_trigger_history(user_id, sent_at DESC);


-- ── 11. USER STATES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmap_user_states (
  user_id TEXT PRIMARY KEY,
  state TEXT DEFAULT 'active' CHECK (state IN ('active', 'at_risk', 'dormant')),
  state_changed_at TIMESTAMPTZ DEFAULT NOW(),
  consecutive_ignores INTEGER DEFAULT 0,
  suspended_until TIMESTAMPTZ,
  opted_out BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMPTZ
);


-- ── 12. WEEKLY SNAPSHOTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmap_weekly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES roadmap_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  snapshot_data JSONB NOT NULL,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(roadmap_id, week_number)
);


-- ── 13. KILL SWITCH HISTORY ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmap_kill_switch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES roadmap_sessions(id),
  user_id TEXT NOT NULL,
  review_date TIMESTAMPTZ DEFAULT NOW(),
  review_iteration INTEGER DEFAULT 1,
  scenario TEXT,
  decision TEXT CHECK (decision IN ('continue', 'adjust', 'stop')),
  metrics_snapshot JSONB,
  trajectory_data JSONB,
  pipeline_data JSONB,
  decision_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ================================================================
-- БЛОК 3.1: RLS на новые таблицы + политики
-- ================================================================

ALTER TABLE roadmap_conversations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_experiments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_daily_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_templates               ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_user_memory             ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_trigger_locks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_trigger_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_user_states             ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_weekly_snapshots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_kill_switch_history     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_conversations" ON roadmap_conversations;
CREATE POLICY "users_own_conversations" ON roadmap_conversations
  FOR ALL USING (user_id = current_setting('app.user_id', TRUE));

DROP POLICY IF EXISTS "users_own_experiments" ON roadmap_experiments;
CREATE POLICY "users_own_experiments" ON roadmap_experiments
  FOR ALL USING (user_id = current_setting('app.user_id', TRUE));

DROP POLICY IF EXISTS "users_own_daily_logs" ON roadmap_daily_logs;
CREATE POLICY "users_own_daily_logs" ON roadmap_daily_logs
  FOR ALL USING (user_id = current_setting('app.user_id', TRUE));

DROP POLICY IF EXISTS "users_own_templates" ON roadmap_templates;
CREATE POLICY "users_own_templates" ON roadmap_templates
  FOR ALL USING (user_id = current_setting('app.user_id', TRUE));

DROP POLICY IF EXISTS "users_own_memory" ON roadmap_user_memory;
CREATE POLICY "users_own_memory" ON roadmap_user_memory
  FOR ALL USING (user_id = current_setting('app.user_id', TRUE));


-- ================================================================
-- БЛОК 4: PATCH MIGRATIONS v2 (дословно из исходного файла)
-- ================================================================

-- ── marcus_state в roadmap_user_memory ──────────────────────────
ALTER TABLE roadmap_user_memory
  ADD COLUMN IF NOT EXISTS marcus_state JSONB DEFAULT '{"channel": null, "attempt_count": 0, "hypotheses": [], "deviation_count": 0}';


-- ── ФУНКЦИЯ: атомарный аппенд расчёта Leo ───────────────────────
CREATE OR REPLACE FUNCTION append_leo_calculation(
  p_roadmap_id UUID,
  p_user_id TEXT,
  p_calculation JSONB
)
RETURNS VOID AS $$
DECLARE
  current_calcs JSONB;
BEGIN
  SELECT leo_calculations INTO current_calcs
  FROM roadmap_user_memory
  WHERE roadmap_id = p_roadmap_id AND user_id = p_user_id;

  IF current_calcs IS NULL THEN
    current_calcs := '[]'::jsonb;
  END IF;

  UPDATE roadmap_user_memory
  SET
    leo_calculations = (
      CASE
        WHEN jsonb_array_length(current_calcs) >= 10
        THEN (current_calcs - 0) || p_calculation
        ELSE current_calcs || p_calculation
      END
    ),
    last_updated = NOW()
  WHERE roadmap_id = p_roadmap_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── ФУНКЦИЯ: обновление actual_outcome расчёта Leo ──────────────
CREATE OR REPLACE FUNCTION update_leo_calculation_outcome(
  p_roadmap_id UUID,
  p_user_id TEXT,
  p_calc_id TEXT,
  p_actual_outcome TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE roadmap_user_memory
  SET
    leo_calculations = (
      SELECT jsonb_agg(
        CASE
          WHEN elem->>'id' = p_calc_id
          THEN elem || jsonb_build_object(
            'actual_outcome', p_actual_outcome,
            'outcome_recorded_at', NOW()::text
          )
          ELSE elem
        END
      )
      FROM jsonb_array_elements(leo_calculations) AS elem
    ),
    last_updated = NOW()
  WHERE roadmap_id = p_roadmap_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── ФУНКЦИЯ: инкремент distress сигнала ────────────────────────
CREATE OR REPLACE FUNCTION increment_distress_context(
  p_roadmap_id UUID,
  p_user_id TEXT
)
RETURNS VOID AS $$
DECLARE
  current_ctx JSONB;
  current_count INTEGER;
BEGIN
  SELECT emotional_context INTO current_ctx
  FROM roadmap_user_memory
  WHERE roadmap_id = p_roadmap_id AND user_id = p_user_id;

  current_count := COALESCE((current_ctx->>'distress_signal_count_7d')::int, 0);

  UPDATE roadmap_user_memory
  SET
    emotional_context = jsonb_build_object(
      'last_distress_signal_at', NOW(),
      'distress_signal_count_7d', current_count + 1
    ),
    last_updated = NOW()
  WHERE roadmap_id = p_roadmap_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── ФУНКЦИЯ: инкремент счётчика сообщений ──────────────────────
CREATE OR REPLACE FUNCTION increment_message_count(
  p_roadmap_id UUID,
  p_user_id TEXT
)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE roadmap_sessions
  SET
    message_count = message_count + 1,
    updated_at = NOW()
  WHERE id = p_roadmap_id AND user_id = p_user_id
  RETURNING message_count INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── ФУНКЦИЯ: обновление marcus_state ───────────────────────────
CREATE OR REPLACE FUNCTION update_marcus_state(
  p_roadmap_id UUID,
  p_user_id TEXT,
  p_state JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE roadmap_user_memory
  SET
    marcus_state = p_state,
    last_updated = NOW()
  WHERE roadmap_id = p_roadmap_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── Индекс для быстрого поиска по message_count ─────────────────
CREATE INDEX IF NOT EXISTS idx_roadmap_sessions_message_count
  ON roadmap_sessions(id, message_count);


-- ================================================================
-- ПРОВЕРКА: выполнить отдельно после применения патча
-- ================================================================

-- Список всех roadmap_* таблиц
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'roadmap_%'
-- ORDER BY table_name;

-- Новые колонки в roadmap_sessions
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'roadmap_sessions'
--   AND column_name IN ('niche','active_role','status','day_number','message_count','marcus_state')
-- ORDER BY column_name;

-- Функции
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'append_leo_calculation','update_leo_calculation_outcome',
--     'increment_distress_context','increment_message_count','update_marcus_state'
--   )
-- ORDER BY routine_name;
