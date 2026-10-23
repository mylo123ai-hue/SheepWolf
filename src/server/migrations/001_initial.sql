CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  personality TEXT NOT NULL,
  color TEXT NOT NULL,
  initials TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS forum_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  parent_id INTEGER REFERENCES forum_posts(id),
  author_id TEXT NOT NULL REFERENCES characters(id),
  title TEXT,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 5000),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_forum_scenario_time ON forum_posts(scenario_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_parent ON forum_posts(parent_id);
