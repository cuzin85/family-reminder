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

COMMIT;
