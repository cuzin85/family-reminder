SELECT
  reminder_rules.id AS rule_id,
  reminder_rules.schedule_type,
  reminder_rules.is_active,
  task_instances.id AS task_id,
  task_instances.status,
  task_instances.period_label,
  task_instances.available_from,
  task_instances.due_at,
  task_instances.next_remind_at,
  task_instances.closed_at
FROM reminder_rules
LEFT JOIN task_instances
  ON task_instances.reminder_rule_id = reminder_rules.id
WHERE reminder_rules.created_by_user_id = -900001
  OR reminder_rules.title LIKE '[TEST] recurring:%'
ORDER BY
  reminder_rules.id,
  task_instances.period_start;

SELECT
  completion_log.task_instance_id,
  completion_log.action,
  completion_log.created_at
FROM completion_log
INNER JOIN task_instances
  ON task_instances.id = completion_log.task_instance_id
WHERE completion_log.user_id = -900001
  OR task_instances.title LIKE '[TEST] recurring:%'
ORDER BY completion_log.created_at;
