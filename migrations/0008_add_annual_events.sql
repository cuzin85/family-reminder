PRAGMA foreign_keys = ON;

CREATE TABLE annual_events (
  id INTEGER PRIMARY KEY,
  created_by_user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_month INTEGER NOT NULL CHECK (event_month BETWEEN 1 AND 12),
  event_day INTEGER NOT NULL CHECK (event_day BETWEEN 1 AND 31),
  event_year INTEGER CHECK (event_year IS NULL OR event_year BETWEEN 1 AND 9999),
  reminder_hour INTEGER NOT NULL CHECK (reminder_hour BETWEEN 0 AND 23),
  reminder_minute INTEGER NOT NULL CHECK (reminder_minute BETWEEN 0 AND 59),
  timezone TEXT NOT NULL DEFAULT 'Europe/Kyiv',
  notification_days_json TEXT NOT NULL,
  next_notification_at TEXT,
  next_notification_event_date TEXT,
  next_notification_offset_days INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users (id)
);

CREATE INDEX idx_annual_events_created_by_user_id ON annual_events (created_by_user_id);
CREATE INDEX idx_annual_events_is_active ON annual_events (is_active);
CREATE INDEX idx_annual_events_next_notification_at ON annual_events (next_notification_at);
CREATE INDEX idx_annual_events_is_active_next_notification_at
  ON annual_events (is_active, next_notification_at);
CREATE INDEX idx_annual_events_is_active_notification_days_json
  ON annual_events (is_active, notification_days_json);

CREATE TABLE annual_event_recipients (
  id INTEGER PRIMARY KEY,
  annual_event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (annual_event_id) REFERENCES annual_events (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE (annual_event_id, user_id)
);

CREATE INDEX idx_annual_event_recipients_event_id
  ON annual_event_recipients (annual_event_id);
CREATE INDEX idx_annual_event_recipients_user_id
  ON annual_event_recipients (user_id);

CREATE TABLE annual_event_notification_log (
  id INTEGER PRIMARY KEY,
  annual_event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  event_date TEXT NOT NULL,
  offset_days INTEGER NOT NULL,
  scheduled_for TEXT NOT NULL,
  sent_at TEXT,
  telegram_message_id INTEGER,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (annual_event_id) REFERENCES annual_events (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE (annual_event_id, user_id, event_date, offset_days)
);

CREATE INDEX idx_annual_event_notification_log_event_id
  ON annual_event_notification_log (annual_event_id);
CREATE INDEX idx_annual_event_notification_log_user_id
  ON annual_event_notification_log (user_id);
CREATE INDEX idx_annual_event_notification_log_scheduled_for
  ON annual_event_notification_log (scheduled_for);
CREATE INDEX idx_annual_event_notification_log_status
  ON annual_event_notification_log (status);
CREATE INDEX idx_annual_event_notification_log_created_at
  ON annual_event_notification_log (created_at);
