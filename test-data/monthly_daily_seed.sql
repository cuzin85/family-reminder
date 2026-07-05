PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

DELETE FROM notification_log
WHERE user_id = -910001
  OR task_instance_id IN (
    SELECT id
    FROM task_instances
    WHERE created_by_user_id = -910001
      OR title LIKE '[TEST] monthly daily:%'
  );

DELETE FROM completion_log
WHERE user_id = -910001
  OR task_instance_id IN (
    SELECT id
    FROM task_instances
    WHERE created_by_user_id = -910001
      OR title LIKE '[TEST] monthly daily:%'
  );

DELETE FROM task_assignees
WHERE user_id = -910001
  OR task_instance_id IN (
    SELECT id
    FROM task_instances
    WHERE created_by_user_id = -910001
      OR title LIKE '[TEST] monthly daily:%'
  );

DELETE FROM task_instances
WHERE created_by_user_id = -910001
  OR title LIKE '[TEST] monthly daily:%'
  OR reminder_rule_id IN (
    SELECT id
    FROM reminder_rules
    WHERE created_by_user_id = -910001
      OR title LIKE '[TEST] monthly daily:%'
  );

DELETE FROM reminder_rule_assignees
WHERE user_id = -910001
  OR reminder_rule_id IN (
    SELECT id
    FROM reminder_rules
    WHERE created_by_user_id = -910001
      OR title LIKE '[TEST] monthly daily:%'
  );

DELETE FROM reminder_rules
WHERE created_by_user_id = -910001
  OR title LIKE '[TEST] monthly daily:%';

DELETE FROM telegram_message_refs
WHERE user_id = -910001;

DELETE FROM user_sessions
WHERE user_id = -910001;

DELETE FROM users
WHERE id = -910001
  OR telegram_user_id = 910000000001;

INSERT INTO users (
  id,
  telegram_user_id,
  telegram_chat_id,
  username,
  first_name,
  last_name,
  timezone,
  is_active,
  is_admin,
  created_at,
  updated_at
)
VALUES (
  -910001,
  910000000001,
  910000000001,
  'test_monthly_daily',
  'TEST Monthly Daily',
  NULL,
  'Europe/Kyiv',
  1,
  0,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

INSERT INTO reminder_rules (
  id,
  created_by_user_id,
  title,
  description,
  schedule_type,
  schedule_params_json,
  timezone,
  is_active,
  created_at,
  updated_at
)
VALUES (
  -910101,
  -910001,
  '[TEST] monthly daily: next reminder',
  'Local D1 daily monthly reminder test fixture',
  'monthly_fixed_window',
  '{"start_day":1,"end_day":5,"hour":9,"minute":0}',
  'Europe/Kyiv',
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

INSERT INTO reminder_rule_assignees (
  id,
  reminder_rule_id,
  user_id,
  created_at
)
VALUES (
  -910201,
  -910101,
  -910001,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

INSERT INTO task_instances (
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
VALUES (
  -910301,
  -910101,
  -910001,
  '[TEST] monthly daily: next reminder',
  'Active monthly instance with due notification inside the execution window',
  'daily reminder fixture',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+3 days'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+3 days'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 minute'),
  'pending',
  NULL,
  NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

INSERT INTO task_assignees (
  id,
  task_instance_id,
  user_id,
  created_at
)
VALUES (
  -910401,
  -910301,
  -910001,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

COMMIT;
