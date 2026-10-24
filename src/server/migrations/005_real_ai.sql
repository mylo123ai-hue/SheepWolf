ALTER TABLE experiments ADD COLUMN control_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE provider_settings (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  provider TEXT NOT NULL CHECK (provider = 'deepseek'),
  model_id TEXT NOT NULL,
  real_mode_enabled INTEGER NOT NULL DEFAULT 0 CHECK (real_mode_enabled IN (0, 1)),
  max_requests INTEGER NOT NULL DEFAULT 20 CHECK (max_requests BETWEEN 1 AND 500),
  max_input_tokens INTEGER NOT NULL DEFAULT 100000 CHECK (max_input_tokens BETWEEN 1 AND 10000000),
  max_output_tokens INTEGER NOT NULL DEFAULT 6400 CHECK (max_output_tokens BETWEEN 1 AND 1000000),
  max_output_tokens_per_request INTEGER NOT NULL DEFAULT 256 CHECK (max_output_tokens_per_request BETWEEN 1 AND 8192),
  max_estimated_usd REAL NOT NULL DEFAULT 0.25 CHECK (max_estimated_usd > 0 AND max_estimated_usd <= 100),
  updated_at TEXT NOT NULL
);

INSERT INTO provider_settings (id, provider, model_id, updated_at)
VALUES ('default', 'deepseek', 'deepseek-flash', datetime('now'));

CREATE TABLE provider_requests (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'succeeded', 'failed', 'budget_rejected')),
  estimated_input_tokens INTEGER NOT NULL,
  reserved_output_tokens INTEGER NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  reserved_cost_usd REAL NOT NULL,
  actual_cost_usd REAL,
  provider_request_id TEXT,
  elapsed_ms INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX idx_provider_requests_experiment ON provider_requests(experiment_id, created_at, id);
