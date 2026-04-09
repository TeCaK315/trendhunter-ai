-- ============================================================
-- FIX: Пересоздание policies (если таблицы уже созданы)
-- ============================================================

-- block_results
DROP POLICY IF EXISTS "Users can read own block results" ON block_results;
DROP POLICY IF EXISTS "Users can insert own block results" ON block_results;
DROP POLICY IF EXISTS "Users can update own block results" ON block_results;
DROP POLICY IF EXISTS "Service role full access block_results" ON block_results;

CREATE POLICY "Users can read own block results"
  ON block_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own block results"
  ON block_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own block results"
  ON block_results FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access block_results"
  ON block_results FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- blind_spot_unlocks
DROP POLICY IF EXISTS "Users can read own unlocks" ON blind_spot_unlocks;
DROP POLICY IF EXISTS "Users can insert own unlocks" ON blind_spot_unlocks;
DROP POLICY IF EXISTS "Users can update own unlocks" ON blind_spot_unlocks;
DROP POLICY IF EXISTS "Service role full access blind_spot_unlocks" ON blind_spot_unlocks;

CREATE POLICY "Users can read own unlocks"
  ON blind_spot_unlocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own unlocks"
  ON blind_spot_unlocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own unlocks"
  ON blind_spot_unlocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access blind_spot_unlocks"
  ON blind_spot_unlocks FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- user_credits
DROP POLICY IF EXISTS "Users can read own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can insert own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON user_credits;
DROP POLICY IF EXISTS "Service role full access user_credits" ON user_credits;

CREATE POLICY "Users can read own credits"
  ON user_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credits"
  ON user_credits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credits"
  ON user_credits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access user_credits"
  ON user_credits FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- credit_transactions
DROP POLICY IF EXISTS "Users can read own transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Service role full access credit_transactions" ON credit_transactions;

CREATE POLICY "Users can read own transactions"
  ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions"
  ON credit_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access credit_transactions"
  ON credit_transactions FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- synthesis_results
DROP POLICY IF EXISTS "Users can read own synthesis" ON synthesis_results;
DROP POLICY IF EXISTS "Users can insert own synthesis" ON synthesis_results;
DROP POLICY IF EXISTS "Users can update own synthesis" ON synthesis_results;
DROP POLICY IF EXISTS "Service role full access synthesis_results" ON synthesis_results;

CREATE POLICY "Users can read own synthesis"
  ON synthesis_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own synthesis"
  ON synthesis_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own synthesis"
  ON synthesis_results FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access synthesis_results"
  ON synthesis_results FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Триггер для автосоздания монет новым пользователям
CREATE OR REPLACE FUNCTION create_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_credits (user_id, balance)
  VALUES (NEW.id, 100)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_credits();

-- ============================================================
-- ГОТОВО! Если видишь "Success. No rows returned" — всё ОК.
-- ============================================================
