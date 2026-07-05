SELECT
  task_instances.id AS task_id,
  reminder_rules.schedule_type,
  task_instances.status,
  task_instances.available_from,
  task_instances.due_at,
  task_instances.next_remind_at,
  task_instances.updated_at
FROM task_instances
INNER JOIN reminder_rules
  ON reminder_rules.id = task_instances.reminder_rule_id
WHERE task_instances.created_by_user_id = -910001
  OR task_instances.title LIKE '[TEST] monthly daily:%'
ORDER BY task_instances.id;

SELECT
  notification_log.task_instance_id,
  notification_log.user_id,
  notification_log.scheduled_for,
  notification_log.sent_at,
  notification_log.status,
  notification_log.error_message,
  notification_log.created_at
FROM notification_log
INNER JOIN task_instances
  ON task_instances.id = notification_log.task_instance_id
WHERE notification_log.user_id = -910001
  OR task_instances.title LIKE '[TEST] monthly daily:%'
ORDER BY notification_log.created_at;
