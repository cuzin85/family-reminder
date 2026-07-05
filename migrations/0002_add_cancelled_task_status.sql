PRAGMA foreign_keys = OFF;

CREATE TABLE task_instances_new (
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

INSERT INTO task_instances_new (
  id,
  reminder_rule_id,
  created_by_user_id,
  title,
  description,
  period_label,
  period_start,
  period_end,
  available_from,
  due_at,
  next_remind_at,
  status,
  closed_by_user_id,
  closed_at,
  created_at,
  updated_at
)
SELECT
  id,
  reminder_rule_id,
  created_by_user_id,
  title,
  description,
  period_label,
  period_start,
  period_end,
  available_from,
  due_at,
  next_remind_at,
  status,
  closed_by_user_id,
  closed_at,
  created_at,
  updated_at
FROM task_instances;

DROP TABLE task_instances;
ALTER TABLE task_instances_new RENAME TO task_instances;

CREATE INDEX idx_task_instances_status ON task_instances (status);
CREATE INDEX idx_task_instances_available_from ON task_instances (available_from);
CREATE INDEX idx_task_instances_due_at ON task_instances (due_at);
CREATE INDEX idx_task_instances_next_remind_at ON task_instances (next_remind_at);
CREATE INDEX idx_task_instances_reminder_rule_id ON task_instances (reminder_rule_id);
CREATE INDEX idx_task_instances_status_next_remind_at ON task_instances (status, next_remind_at);

CREATE TABLE completion_log_new (
  id INTEGER PRIMARY KEY,
  task_instance_id INTEGER NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('done', 'done_late', 'missed', 'cancelled')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_instance_id) REFERENCES task_instances (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

INSERT INTO completion_log_new (
  id,
  task_instance_id,
  user_id,
  action,
  created_at
)
SELECT
  id,
  task_instance_id,
  user_id,
  action,
  created_at
FROM completion_log;

DROP TABLE completion_log;
ALTER TABLE completion_log_new RENAME TO completion_log;

CREATE INDEX idx_completion_log_user_id ON completion_log (user_id);
CREATE INDEX idx_completion_log_action ON completion_log (action);
CREATE INDEX idx_completion_log_created_at ON completion_log (created_at);

PRAGMA foreign_keys = ON;
