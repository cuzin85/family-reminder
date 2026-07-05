PRAGMA foreign_keys = OFF;

CREATE TABLE telegram_message_refs_new (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  chat_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('task_list', 'create_flow')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE (chat_id, message_id, purpose)
);

INSERT INTO telegram_message_refs_new (
  id,
  user_id,
  chat_id,
  message_id,
  purpose,
  created_at
)
SELECT
  id,
  user_id,
  chat_id,
  message_id,
  purpose,
  created_at
FROM telegram_message_refs;

DROP TABLE telegram_message_refs;

ALTER TABLE telegram_message_refs_new RENAME TO telegram_message_refs;

CREATE INDEX idx_telegram_message_refs_user_purpose
  ON telegram_message_refs (user_id, purpose);

CREATE INDEX idx_telegram_message_refs_chat_purpose
  ON telegram_message_refs (chat_id, purpose);

PRAGMA foreign_keys = ON;
