-- Блок 0 — Market Context Engine
-- Выполнить в Supabase SQL Editor

CREATE TABLE IF NOT EXISTS context_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_hash VARCHAR(64) UNIQUE NOT NULL,
  niche_input TEXT NOT NULL,
  niche_canonical TEXT NOT NULL,
  context_object JSONB NOT NULL,
  confidence_score FLOAT,
  prompt_version VARCHAR(10) NOT NULL DEFAULT '1.0',
  created_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_niche_hash ON context_objects(niche_hash);
CREATE INDEX IF NOT EXISTS idx_expires_at ON context_objects(expires_at);
