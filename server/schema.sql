-- Skyrise online rankings (Cloudflare D1). Create the tables once with:
--   npx wrangler d1 execute skyrise --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  created INTEGER NOT NULL,
  last_run INTEGER NOT NULL DEFAULT 0
);

-- One best score per player per board and period:
--   daily: period = Daily tower number    week: period = week number    all: period = 0
CREATE TABLE IF NOT EXISTS scores (
  board TEXT NOT NULL,
  period INTEGER NOT NULL,
  player TEXT NOT NULL,
  score INTEGER NOT NULL,
  meters INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (board, period, player)
);

CREATE INDEX IF NOT EXISTS scores_rank ON scores (board, period, score DESC);
