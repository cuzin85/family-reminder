CREATE TABLE IF NOT EXISTS telegram_message_refs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  chat_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('task_list')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE (chat_id, message_id, purpose)
);

CREATE INDEX IF NOT EXISTS idx_telegram_message_refs_user_purpose
  ON telegram_message_refs (user_id, purpose);

CREATE INDEX IF NOT EXISTS idx_telegram_message_refs_chat_purpose
  ON telegram_message_refs (chat_id, purpose);
