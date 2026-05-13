-- Interpretation Layer — слой "человекочитаемых" интерпретаций для каждого блока.
-- Генерируется фоном после основного pipeline блока, кэшируется на 24ч.
-- Один блок (block_id) на один тренд (trend_id) — UNIQUE.

CREATE TABLE IF NOT EXISTS block_interpretations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trend_id text NOT NULL,
  block_id text NOT NULL,
  headline text NOT NULL,
  main_insight text NOT NULL,
  key_facts jsonb NOT NULL DEFAULT '[]',
  decision_impact text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  model_used text,
  data_sufficiency text CHECK (data_sufficiency IN ('sufficient', 'limited')),
  UNIQUE(trend_id, block_id)
);

CREATE INDEX IF NOT EXISTS idx_block_interpretations_trend
  ON block_interpretations(trend_id);
