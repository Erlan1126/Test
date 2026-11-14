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

-- Cloud backup of each player's save, so a new phone or a reinstall gets it back.
CREATE TABLE IF NOT EXISTS saves (
  player TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated INTEGER NOT NULL
);

-- Recovery codes (stored hashed): typing one on another device restores that player.
CREATE TABLE IF NOT EXISTS recovery (
  code_hash TEXT PRIMARY KEY,
  player TEXT NOT NULL UNIQUE
);

-- Leaderboard names reported by other players. Three reports hide a name.
CREATE TABLE IF NOT EXISTS reports (
  reporter TEXT NOT NULL,
  target TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (reporter, target)
);

-- Anonymous crash and frame-rate reports from players' phones (no player id or name),
-- so problems on real devices can be found and fixed. Kept to the newest 20,000.
CREATE TABLE IF NOT EXISTS diag (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  v TEXT NOT NULL DEFAULT '',
  dev TEXT NOT NULL DEFAULT '',
  msg TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}'
);

-- Ghosts to race: when a player's best on a board improves, how fast that tower grew
-- (the game tick at which it reached each floor), worked out by the server's replay.
CREATE TABLE IF NOT EXISTS ghosts (
  board TEXT NOT NULL,
  period INTEGER NOT NULL,
  player TEXT NOT NULL,
  pace TEXT NOT NULL,
  PRIMARY KEY (board, period, player)
);

-- Anonymous play statistics (see src/stats.ts): a random id per install that is never
-- linked to a player, and for each item the day since that install first played, how
-- many towers it had built, and the tower's numbers. Kept to the newest 300,000.
CREATE TABLE IF NOT EXISTS stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  install TEXT NOT NULL,
  kind TEXT NOT NULL,
  day INTEGER NOT NULL DEFAULT 0,
  towers INTEGER NOT NULL DEFAULT 0,
  v TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS stats_kind ON stats (kind, at);

-- "Beat my tower" challenges: a shared tower's numbers and pace (for the ghost), and who
-- has tried it. Names are the leaderboard nicknames players chose; nothing else.
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL,
  meters INTEGER NOT NULL,
  floors INTEGER NOT NULL,
  pace TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS challenge_tries (
  challenge TEXT NOT NULL,
  at INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS challenge_tries_by ON challenge_tries (challenge, at);
