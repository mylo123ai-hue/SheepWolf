CREATE TABLE investigation_runs (
  experiment_id TEXT PRIMARY KEY REFERENCES experiments(id) ON DELETE CASCADE,
  scenario_version TEXT NOT NULL,
  case_json TEXT NOT NULL,
  correct_conclusion_id TEXT NOT NULL,
  wolf_target_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('discussion', 'voting', 'completed', 'incomplete')),
  finalization_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE investigation_opinions (
  experiment_id TEXT NOT NULL REFERENCES investigation_runs(experiment_id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id),
  initial_conclusion_id TEXT NOT NULL,
  current_conclusion_id TEXT NOT NULL,
  final_conclusion_id TEXT,
  PRIMARY KEY (experiment_id, character_id)
);

CREATE TABLE investigation_opinion_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id TEXT NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id),
  sequence INTEGER NOT NULL,
  from_conclusion_id TEXT NOT NULL,
  to_conclusion_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (experiment_id, sequence),
  FOREIGN KEY (experiment_id, character_id) REFERENCES investigation_opinions(experiment_id, character_id) ON DELETE CASCADE
);

CREATE TABLE investigation_votes (
  experiment_id TEXT NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id),
  conclusion_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (experiment_id, character_id),
  FOREIGN KEY (experiment_id, character_id) REFERENCES investigation_opinions(experiment_id, character_id) ON DELETE CASCADE
);

CREATE INDEX idx_investigation_changes_run ON investigation_opinion_changes(experiment_id, sequence);
CREATE INDEX idx_investigation_votes_run ON investigation_votes(experiment_id, conclusion_id);
