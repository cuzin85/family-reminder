ALTER TABLE users
  ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users (is_admin);
