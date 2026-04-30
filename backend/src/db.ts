import Database from "better-sqlite3";

const db = new Database("database.db");

// USERS
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT UNIQUE,
    display_name TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// REVIEWS
db.prepare(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reviewer_wallet TEXT,
    reviewed_wallet TEXT,
    listing_id INTEGER,
    rating INTEGER,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  DROP INDEX IF EXISTS idx_unique_review_per_listing
`).run();

db.prepare(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_review_per_listing
  ON reviews (LOWER(reviewer_wallet), LOWER(reviewed_wallet), listing_id)
`).run();

export default db;