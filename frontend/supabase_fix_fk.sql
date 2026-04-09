-- ============================================================
-- FIX: Адаптация таблиц под NextAuth (вместо Supabase Auth)
-- Порядок: 1) drop policies  2) drop FK  3) alter type  4) create policies
-- ============================================================

-- ШАГ 1: Удаляем ВСЕ policies со всех таблиц
-- (нельзя менять тип колонки пока policy ссылается на неё)

DROP POLICY IF EXISTS "Users can read own block results" ON block_results;
DROP POLICY IF EXISTS "Users can insert own block results" ON block_results;
DROP POLICY IF EXISTS "Users can update own block results" ON block_results;
DROP POLICY IF EXISTS "Service role full access block_results" ON block_results;
DROP POLICY IF EXISTS "Allow all for service role" ON block_results;

DROP POLICY IF EXISTS "Users can read own unlocks" ON blind_spot_unlocks;
DROP POLICY IF EXISTS "Users can insert own unlocks" ON blind_spot_unlocks;
DROP POLICY IF EXISTS "Users can update own unlocks" ON blind_spot_unlocks;
DROP POLICY IF EXISTS "Service role full access blind_spot_unlocks" ON blind_spot_unlocks;
DROP POLICY IF EXISTS "Allow all for service role" ON blind_spot_unlocks;

DROP POLICY IF EXISTS "Users can read own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can insert own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON user_credits;
DROP POLICY IF EXISTS "Service role full access user_credits" ON user_credits;
DROP POLICY IF EXISTS "Allow all for service role" ON user_credits;

DROP POLICY IF EXISTS "Users can read own transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Service role full access credit_transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Allow all for service role" ON credit_transactions;

DROP POLICY IF EXISTS "Users can read own synthesis" ON synthesis_results;
DROP POLICY IF EXISTS "Users can insert own synthesis" ON synthesis_results;
DROP POLICY IF EXISTS "Users can update own synthesis" ON synthesis_results;
DROP POLICY IF EXISTS "Service role full access synthesis_results" ON synthesis_results;
DROP POLICY IF EXISTS "Allow all for service role" ON synthesis_results;

-- ШАГ 2: Удаляем foreign keys на auth.users

ALTER TABLE block_results DROP CONSTRAINT IF EXISTS block_results_user_id_fkey;
ALTER TABLE blind_spot_unlocks DROP CONSTRAINT IF EXISTS blind_spot_unlocks_user_id_fkey;
ALTER TABLE user_credits DROP CONSTRAINT IF EXISTS user_credits_user_id_fkey;
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_user_id_fkey;
ALTER TABLE synthesis_results DROP CONSTRAINT IF EXISTS synthesis_results_user_id_fkey;

-- ШАГ 3: Меняем тип user_id с uuid на text

ALTER TABLE block_results ALTER COLUMN user_id TYPE text;
ALTER TABLE blind_spot_unlocks ALTER COLUMN user_id TYPE text;
ALTER TABLE user_credits ALTER COLUMN user_id TYPE text;
ALTER TABLE credit_transactions ALTER COLUMN user_id TYPE text;
ALTER TABLE synthesis_results ALTER COLUMN user_id TYPE text;

-- ШАГ 4: Убираем триггер auto-create credits (привязан к auth.users)

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;

-- ШАГ 5: Создаём простые policies (service_role key обходит RLS,
-- но на всякий случай разрешаем всё)

CREATE POLICY "Allow all" ON block_results FOR ALL USING (true);
CREATE POLICY "Allow all" ON blind_spot_unlocks FOR ALL USING (true);
CREATE POLICY "Allow all" ON user_credits FOR ALL USING (true);
CREATE POLICY "Allow all" ON credit_transactions FOR ALL USING (true);
CREATE POLICY "Allow all" ON synthesis_results FOR ALL USING (true);

-- ============================================================
-- ГОТОВО! Если видишь "Success. No rows returned" — всё ОК.
-- ============================================================
