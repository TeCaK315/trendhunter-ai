-- ================================================================
-- TrendHunter AI · credit_transactions.type CHECK constraint
-- Старый constraint разрешал только (spend, earn, bonus, refund).
-- В коде используются также: purchase (LS webhook), roadmap_unlock, block_unlock.
-- Все эти INSERT'ы молча падали → транзакции не записывались в audit-trail.
-- Расширяем constraint чтобы все используемые типы были разрешены.
-- ================================================================

ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (type = ANY (ARRAY[
    'spend',           -- generic списание
    'earn',            -- generic начисление
    'bonus',           -- бонусы / промо
    'refund',          -- возврат
    'purchase',        -- покупка пакета монет (Lemon Squeezy)
    'roadmap_unlock',  -- разблокировка роадмапа
    'block_unlock'     -- разблокировка блока (Evidence/Strategy)
  ]));
