CREATE TABLE experiments (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running','paused','completed','stopped','failed','incomplete_finalization')),
  config_json TEXT NOT NULL,
  role_seed TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT NOT NULL,
  resumed_at TEXT,
  ended_at TEXT,
  active_elapsed_ms INTEGER NOT NULL DEFAULT 0,
  decision_count INTEGER NOT NULL DEFAULT 0,
  ending_proposed_at TEXT,
  ending_proposed_by TEXT,
  outcome_json TEXT,
  stop_reason TEXT
);
CREATE INDEX idx_experiments_status_created ON experiments(status, created_at DESC);
CREATE TABLE experiment_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id),
  role TEXT NOT NULL CHECK(role IN ('sheep','wolf')),
  private_objective TEXT NOT NULL,
  memory_json TEXT NOT NULL DEFAULT '[]',
  action_opportunities INTEGER NOT NULL DEFAULT 0,
  ending_vote TEXT CHECK(ending_vote IN ('agree','disagree') OR ending_vote IS NULL),
  last_decision_at TEXT,
  recent_action TEXT,
  UNIQUE(experiment_id, character_id)
);
CREATE INDEX idx_experiment_participants_run ON experiment_participants(experiment_id, character_id);
CREATE TABLE agent_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id),
  action_type TEXT NOT NULL,
  input_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(experiment_id, sequence)
);
CREATE TABLE experiment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(experiment_id, sequence)
);
CREATE INDEX idx_experiment_events_run ON experiment_events(experiment_id, sequence);
ALTER TABLE forum_posts ADD COLUMN experiment_id TEXT REFERENCES experiments(id);
CREATE INDEX idx_forum_run_time ON forum_posts(experiment_id, created_at);
