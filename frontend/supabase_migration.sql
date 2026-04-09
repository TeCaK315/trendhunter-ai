-- ============================================================
-- TrendHunter AI: Research Section - Database Migration
-- ============================================================
-- Выполни этот SQL в Supabase Dashboard:
-- 1. Открой https://supabase.com/dashboard
-- 2. Выбери свой проект
-- 3. Слева нажми "SQL Editor"
-- 4. Вставь ВЕСЬ этот файл
-- 5. Нажми "Run" (зелёная кнопка)
-- ============================================================


-- ————————————————————————————————————————————————————————————
-- 1. BLOCK_RESULTS — результаты 6 аналитических блоков
-- ————————————————————————————————————————————————————————————
-- Каждый блок (problem, demand, sellability, competition,
-- revenue_sizing, blind_spots) сохраняет диагноз + данные.
-- upsert по (trend_id, user_id, block_number) — повторный
-- запуск перезаписывает результат.

CREATE TABLE IF NOT EXISTS block_results (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trend_id      text NOT NULL,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_number  smallint NOT NULL CHECK (block_number BETWEEN 1 AND 6),
  block_type    text NOT NULL,

  -- Диагноз блока
  diagnosis        text NOT NULL CHECK (diagnosis IN ('green', 'yellow', 'red')),
  score            smallint NOT NULL CHECK (score BETWEEN 0 AND 10),
  conflict_weight  smallint NOT NULL DEFAULT 0,

  -- Человекочитаемые данные
  key_factors   text[] DEFAULT '{}',
  key_metric    text,

  -- Контекст для Conflict Detection + Synthesis
  block_context jsonb DEFAULT '{}',

  -- Полные данные всех слоёв (Layer 1/2/3)
  raw_data      jsonb DEFAULT '{}',

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  -- Один результат на блок на пользователя на тренд
  UNIQUE (trend_id, user_id, block_number)
);

-- Индексы для быстрого чтения
CREATE INDEX IF NOT EXISTS idx_block_results_trend_user
  ON block_results (trend_id, user_id);

CREATE INDEX IF NOT EXISTS idx_block_results_lookup
  ON block_results (trend_id, user_id, block_number);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_results_updated_at ON block_results;
CREATE TRIGGER block_results_updated_at
  BEFORE UPDATE ON block_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ————————————————————————————————————————————————————————————
-- 2. BLIND_SPOT_UNLOCKS — разблокировка слепых пятен
-- ————————————————————————————————————————————————————————————
-- Блок 6 находит скрытые инсайты. Первый — бесплатно,
-- остальные — за монеты или ежедневный бонус.

CREATE TABLE IF NOT EXISTS blind_spot_unlocks (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trend_id      text NOT NULL,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_index    smallint NOT NULL DEFAULT 0,
  unlock_method text NOT NULL DEFAULT 'free'
    CHECK (unlock_method IN ('free', 'coins', 'daily_bonus')),
  unlocked_at   timestamptz DEFAULT now(),

  -- Один анлок на пятно на пользователя на тренд
  UNIQUE (trend_id, user_id, spot_index)
);


-- ————————————————————————————————————————————————————————————
-- 3. USER_CREDITS — баланс монет пользователя
-- ————————————————————————————————————————————————————————————
-- Монеты тратятся на: premium-слои блоков, разблокировку
-- слепых пятен, AI Синтез.

CREATE TABLE IF NOT EXISTS user_credits (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance    integer NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS user_credits_updated_at ON user_credits;
CREATE TRIGGER user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ————————————————————————————————————————————————————————————
-- 4. CREDIT_TRANSACTIONS — история списаний и начислений
-- ————————————————————————————————————————————————————————————

CREATE TABLE IF NOT EXISTS credit_transactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      integer NOT NULL,
  type        text NOT NULL CHECK (type IN ('spend', 'earn', 'bonus', 'refund')),
  description text,
  trend_id    text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user
  ON credit_transactions (user_id, created_at DESC);


-- ————————————————————————————————————————————————————————————
-- 5. SYNTHESIS_RESULTS — результат AI Синтеза (3 агента)
-- ————————————————————————————————————————————————————————————
-- Скептик + Оптимист + Арбитр. Сохраняется после завершения.

CREATE TABLE IF NOT EXISTS synthesis_results (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trend_id     text NOT NULL,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche        text,

  -- Результаты агентов (JSON)
  conflicts    jsonb DEFAULT '[]',
  skeptic      jsonb DEFAULT '{}',
  optimist     jsonb DEFAULT '{}',
  arbitrator   jsonb DEFAULT '{}',

  is_blind_spot boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),

  -- Один результат синтеза на тренд на пользователя
  UNIQUE (trend_id, user_id)
);


-- ————————————————————————————————————————————————————————————
-- 6. ROW LEVEL SECURITY (RLS)
-- ————————————————————————————————————————————————————————————
-- Каждый пользователь видит только свои данные.

ALTER TABLE block_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE blind_spot_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesis_results ENABLE ROW LEVEL SECURITY;

-- block_results
CREATE POLICY "Users can read own block results"
  ON block_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own block results"
  ON block_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own block results"
  ON block_results FOR UPDATE
  USING (auth.uid() = user_id);

-- blind_spot_unlocks
CREATE POLICY "Users can read own unlocks"
  ON blind_spot_unlocks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own unlocks"
  ON blind_spot_unlocks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own unlocks"
  ON blind_spot_unlocks FOR UPDATE
  USING (auth.uid() = user_id);

-- user_credits
CREATE POLICY "Users can read own credits"
  ON user_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credits"
  ON user_credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credits"
  ON user_credits FOR UPDATE
  USING (auth.uid() = user_id);

-- credit_transactions
CREATE POLICY "Users can read own transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON credit_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- synthesis_results
CREATE POLICY "Users can read own synthesis"
  ON synthesis_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own synthesis"
  ON synthesis_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own synthesis"
  ON synthesis_results FOR UPDATE
  USING (auth.uid() = user_id);


-- ————————————————————————————————————————————————————————————
-- 7. SERVICE ROLE BYPASS
-- ————————————————————————————————————————————————————————————
-- API роуты используют service_role ключ, поэтому RLS не
-- блокирует серверные операции. Но для дополнительной
-- безопасности добавим policy для service_role.

CREATE POLICY "Service role full access block_results"
  ON block_results FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access blind_spot_unlocks"
  ON blind_spot_unlocks FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access user_credits"
  ON user_credits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access credit_transactions"
  ON credit_transactions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access synthesis_results"
  ON synthesis_results FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');


-- ————————————————————————————————————————————————————————————
-- 8. AUTO-CREATE CREDITS FOR NEW USERS
-- ————————————————————————————————————————————————————————————
-- При регистрации нового пользователя автоматически
-- создаётся запись с 100 бонусными монетами.

CREATE OR REPLACE FUNCTION create_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_credits (user_id, balance)
  VALUES (NEW.id, 100)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер на auth.users (срабатывает при регистрации)
DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_credits();


-- ============================================================
-- ГОТОВО!
-- После выполнения этого SQL все таблицы будут созданы.
-- Новые пользователи автоматически получат 100 монет.
--
-- Для тестирования с существующим аккаунтом выполни:
--
-- INSERT INTO user_credits (user_id, balance)
-- VALUES ('ТВОЙ_USER_ID', 1000)
-- ON CONFLICT (user_id) DO UPDATE SET balance = 1000;
--
-- Свой user_id можно найти в Supabase:
-- Authentication → Users → скопировать UUID
-- ============================================================
