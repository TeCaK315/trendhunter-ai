-- Partnership Translator — добавление колонки translated_output
-- Выполнить в Supabase SQL Editor

ALTER TABLE block_decisions
ADD COLUMN IF NOT EXISTS translated_output JSONB;

-- Проверка
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'block_decisions'
  AND column_name = 'translated_output';
