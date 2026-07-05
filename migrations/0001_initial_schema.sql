PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  telegram_user_id INTEGER NOT NULL UNIQUE,
  telegram_chat_id INTEGER NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Kyiv',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_users_telegram_chat_id ON users (telegram_chat_id);

CREATE TABLE reminder_rules (
  id INTEGER PRIMARY KEY,
  created_by_user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  schedule_type TEXT NOT NULL CHECK (
    schedule_type IN (
      'one_time',
      'weekly',
      'monthly_fixed_window',
      'monthly_end_plus_start_window'
    )
  ),
  schedule_params_json TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Kyiv',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users (id)
);

CREATE INDEX idx_reminder_rules_created_by_user_id ON reminder_rules (created_by_user_id);
CREATE INDEX idx_reminder_rules_is_active ON reminder_rules (is_active);
CREATE INDEX idx_reminder_rules_schedule_type ON reminder_rules (schedule_type);

CREATE TABLE reminder_rule_assignees (
  id INTEGER PRIMARY KEY,
  reminder_rule_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (reminder_rule_id) REFERENCES reminder_rules (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE (reminder_rule_id, user_id)
);

CREATE INDEX idx_reminder_rule_assignees_user_id ON reminder_rule_assignees (user_id);

CREATE TABLE task_instances (
  id INTEGER PRIMARY KEY,
  reminder_rule_id INTEGER,
  created_by_user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  period_label TEXT,
  period_start TEXT,
  period_end TEXT,
  available_from TEXT NOT NULL,
  due_at TEXT NOT NULL,
  next_remind_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'overdue', 'done', 'done_late', 'missed', 'cancelled')
  ),
  closed_by_user_id INTEGER,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (reminder_rule_id) REFERENCES reminder_rules (id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users (id),
  FOREIGN KEY (closed_by_user_id) REFERENCES users (id),
  UNIQUE (reminder_rule_id, period_start, period_end)
);

CREATE INDEX idx_task_instances_status ON task_instances (status);
CREATE INDEX idx_task_instances_available_from ON task_instances (available_from);
CREATE INDEX idx_task_instances_due_at ON task_instances (due_at);
CREATE INDEX idx_task_instances_next_remind_at ON task_instances (next_remind_at);
CREATE INDEX idx_task_instances_reminder_rule_id ON task_instances (reminder_rule_id);
CREATE INDEX idx_task_instances_status_next_remind_at ON task_instances (status, next_remind_at);

CREATE TABLE task_assignees (
  id INTEGER PRIMARY KEY,
  task_instance_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_instance_id) REFERENCES task_instances (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE (task_instance_id, user_id)
);

CREATE INDEX idx_task_assignees_task_instance_id ON task_assignees (task_instance_id);
CREATE INDEX idx_task_assignees_user_id ON task_assignees (user_id);

CREATE TABLE notification_log (
  id INTEGER PRIMARY KEY,
  task_instance_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  scheduled_for TEXT NOT NULL,
  sent_at TEXT,
  telegram_message_id INTEGER,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_instance_id) REFERENCES task_instances (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE (task_instance_id, user_id, scheduled_for)
);

CREATE INDEX idx_notification_log_task_instance_id ON notification_log (task_instance_id);
CREATE INDEX idx_notification_log_user_id ON notification_log (user_id);
CREATE INDEX idx_notification_log_scheduled_for ON notification_log (scheduled_for);
CREATE INDEX idx_notification_log_status ON notification_log (status);

CREATE TABLE completion_log (
  id INTEGER PRIMARY KEY,
  task_instance_id INTEGER NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('done', 'done_late', 'missed', 'cancelled')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_instance_id) REFERENCES task_instances (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_completion_log_user_id ON completion_log (user_id);
CREATE INDEX idx_completion_log_action ON completion_log (action);
CREATE INDEX idx_completion_log_created_at ON completion_log (created_at);

CREATE TABLE user_sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  scenario TEXT NOT NULL,
  step TEXT NOT NULL,
  data_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE (user_id, scenario)
);

CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);
