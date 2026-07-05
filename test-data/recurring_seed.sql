PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

DELETE FROM notification_log
WHERE user_id = -900001
  OR task_instance_id IN (
    SELECT id
    FROM task_instances
    WHERE created_by_user_id = -900001
      OR title LIKE '[TEST] recurring:%'
  );

DELETE FROM completion_log
WHERE user_id = -900001
  OR task_instance_id IN (
    SELECT id
    FROM task_instances
    WHERE created_by_user_id = -900001
      OR title LIKE '[TEST] recurring:%'
  );

DELETE FROM task_assignees
WHERE user_id = -900001
  OR task_instance_id IN (
    SELECT id
    FROM task_instances
    WHERE created_by_user_id = -900001
      OR title LIKE '[TEST] recurring:%'
  );

DELETE FROM task_instances
WHERE created_by_user_id = -900001
  OR title LIKE '[TEST] recurring:%'
  OR reminder_rule_id IN (
    SELECT id
    FROM reminder_rules
    WHERE created_by_user_id = -900001
      OR title LIKE '[TEST] recurring:%'
  );

DELETE FROM reminder_rule_assignees
WHERE user_id = -900001
  OR reminder_rule_id IN (
    SELECT id
    FROM reminder_rules
    WHERE created_by_user_id = -900001
      OR title LIKE '[TEST] recurring:%'
  );

DELETE FROM reminder_rules
WHERE created_by_user_id = -900001
  OR title LIKE '[TEST] recurring:%';

DELETE FROM telegram_message_refs
WHERE user_id = -900001;

DELETE FROM user_sessions
WHERE user_id = -900001;

DELETE FROM users
WHERE id = -900001
  OR telegram_user_id = 900000000001;

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
  -900001,
  900000000001,
  900000000001,
  'test_recurring',
  'TEST Recurring',
  NULL,
  'Europe/Kyiv',
  0,
  0,
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
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
VALUES
  (
    -900101,
    -900001,
    '[TEST] recurring: weekly rollover',
    'Local D1 recurring test fixture',
    'weekly',
    '{"weekday":1,"hour":9,"minute":0}',
    'Europe/Kyiv',
    1,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    -900102,
    -900001,
    '[TEST] recurring: monthly fixed rollover',
    'Local D1 recurring test fixture',
    'monthly_fixed_window',
    '{"start_day":1,"end_day":5,"hour":9,"minute":0}',
    'Europe/Kyiv',
    1,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    -900103,
    -900001,
    '[TEST] recurring: monthly end plus start rollover',
    'Local D1 recurring test fixture',
    'monthly_end_plus_start_window',
    '{"last_days":3,"first_days":2,"hour":9,"minute":0}',
    'Europe/Kyiv',
    1,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  );

INSERT INTO reminder_rule_assignees (
  id,
  reminder_rule_id,
  user_id,
  created_at
)
VALUES
  (-900201, -900101, -900001, '2026-01-01T00:00:00.000Z'),
  (-900202, -900102, -900001, '2026-01-01T00:00:00.000Z'),
  (-900203, -900103, -900001, '2026-01-01T00:00:00.000Z');

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
VALUES
  (
    -900301,
    -900101,
    -900001,
    '[TEST] recurring: weekly rollover',
    'Old active weekly instance that should become missed',
    'weekly',
    '2026-06-01T06:00:00.000Z',
    '2026-06-01T20:59:00.000Z',
    '2026-06-01T06:00:00.000Z',
    '2026-06-01T20:59:00.000Z',
    NULL,
    'overdue',
    NULL,
    NULL,
    '2026-06-01T06:00:00.000Z',
    '2026-06-01T06:00:00.000Z'
  ),
  (
    -900302,
    -900102,
    -900001,
    '[TEST] recurring: monthly fixed rollover',
    'Old active monthly fixed instance that should become missed',
    'May 2026',
    '2026-04-30T21:00:00.000Z',
    '2026-05-05T20:59:00.000Z',
    '2026-04-30T21:00:00.000Z',
    '2026-05-05T20:59:00.000Z',
    NULL,
    'overdue',
    NULL,
    NULL,
    '2026-04-30T21:00:00.000Z',
    '2026-04-30T21:00:00.000Z'
  ),
  (
    -900303,
    -900103,
    -900001,
    '[TEST] recurring: monthly end plus start rollover',
    'Old active monthly end-plus-start instance that should become missed',
    'April 2026',
    '2026-04-28T06:00:00.000Z',
    '2026-05-02T20:59:00.000Z',
    '2026-04-28T06:00:00.000Z',
    '2026-05-02T20:59:00.000Z',
    NULL,
    'overdue',
    NULL,
    NULL,
    '2026-04-28T06:00:00.000Z',
    '2026-04-28T06:00:00.000Z'
  );

INSERT INTO task_assignees (
  id,
  task_instance_id,
  user_id,
  created_at
)
VALUES
  (-900401, -900301, -900001, '2026-01-01T00:00:00.000Z'),
  (-900402, -900302, -900001, '2026-01-01T00:00:00.000Z'),
  (-900403, -900303, -900001, '2026-01-01T00:00:00.000Z');

COMMIT;
