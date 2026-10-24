ALTER TABLE experiment_events ADD COLUMN audience TEXT NOT NULL DEFAULT 'observer'
  CHECK (audience IN ('public', 'observer', 'selected'));
ALTER TABLE experiment_events ADD COLUMN visible_to_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE capture_flags (
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  flag_id TEXT NOT NULL,
  original_owner_id TEXT NOT NULL REFERENCES characters(id),
  custodian_id TEXT NOT NULL REFERENCES characters(id),
  status TEXT NOT NULL CHECK (status IN ('safe', 'captured')),
  captured_by TEXT REFERENCES characters(id),
  transferred_at TEXT,
  PRIMARY KEY (experiment_id, flag_id),
  CHECK ((status = 'safe' AND captured_by IS NULL) OR (status = 'captured' AND captured_by = custodian_id))
);

CREATE INDEX idx_capture_flags_run_status ON capture_flags(experiment_id, status);

CREATE TABLE flag_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id TEXT NOT NULL,
  flag_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  from_character_id TEXT NOT NULL REFERENCES characters(id),
  to_character_id TEXT NOT NULL REFERENCES characters(id),
  captured INTEGER NOT NULL CHECK (captured IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (experiment_id, sequence),
  FOREIGN KEY (experiment_id, flag_id) REFERENCES capture_flags(experiment_id, flag_id) ON DELETE CASCADE
);

CREATE INDEX idx_flag_transfers_run_time ON flag_transfers(experiment_id, id);

CREATE TRIGGER flag_transfers_immutable_update
BEFORE UPDATE ON flag_transfers
BEGIN
  SELECT RAISE(ABORT, 'flag transfer history is immutable');
END;

CREATE TRIGGER flag_transfers_immutable_delete
BEFORE DELETE ON flag_transfers
BEGIN
  SELECT RAISE(ABORT, 'flag transfer history is immutable');
END;
