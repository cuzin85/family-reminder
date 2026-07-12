import {
  getNextMonthlyEndPlusStartWindow,
  getNextMonthlyFixedWindow,
  getOneTimeTaskReminderAt,
  getNextWindowReminderOrNow,
  getNextWeeklyTaskWindow,
  getNextWeeklyTaskWindowAfter,
  type MonthlyTaskWindow
} from "./dates";
import type { Env } from "./env";

export interface CreateOneTimeTaskInput {
  userId: number;
  assigneeUserIds: number[];
  title: string;
  availableFrom?: string;
  dueAt: string;
  reminderHour: number;
  reminderMinute: number;
  timezone: string;
  now: string;
}

export interface CreateWeeklyTaskInput {
  userId: number;
  assigneeUserIds: number[];
  title: string;
  weekday: number;
  hour: number;
  minute: number;
  timezone: string;
  now: string;
}

export interface CreateMonthlyFixedTaskInput {
  userId: number;
  assigneeUserIds: number[];
  title: string;
  startDay: number;
  endDay: number;
  hour: number;
  minute: number;
  timezone: string;
  now: string;
}

export interface CreateMonthlyEndPlusStartTaskInput {
  userId: number;
  assigneeUserIds: number[];
  title: string;
  lastDays: number;
  firstDays: number;
  hour: number;
  minute: number;
  timezone: string;
  now: string;
}

export interface TaskListItem {
  id: number;
  title: string;
  period_label: string | null;
  schedule_type: string | null;
  schedule_params_json: string | null;
  rule_timezone: string | null;
  status: "pending" | "overdue" | "done" | "done_late" | "missed" | "cancelled";
  available_from: string;
  due_at: string;
  assignee_names: string | null;
  assignee_ids: string | null;
  can_act: number;
}

export interface TaskHistoryItem {
  id: number;
  title: string;
  period_label: string | null;
  schedule_type: string | null;
  schedule_params_json: string | null;
  rule_timezone: string | null;
  status: TaskHistoryStatus;
  available_from: string;
  due_at: string;
  closed_at: string | null;
  closed_by_name: string | null;
  assignee_names: string | null;
}

export type TaskHistoryStatus = "done" | "done_late" | "missed" | "cancelled";

export interface TaskDeletePreview {
  status: "found" | "not_found_or_closed";
  title?: string;
  isRecurring?: boolean;
}

export interface EditableTask {
  id: number;
  title: string;
  reminder_rule_id: number | null;
  created_by_user_id: number;
  period_label: string | null;
  schedule_type: string | null;
  schedule_params_json: string | null;
  timezone: string | null;
  available_from: string;
  due_at: string;
}

export interface UpdateOneTimeTaskResult {
  status: "updated" | "not_found_or_not_editable";
  title?: string;
}

export interface UpdateWeeklyTaskResult {
  status: "updated" | "not_found_or_not_editable" | "invalid_schedule";
  title?: string;
  newTaskCreated?: boolean;
  newTaskId?: number;
}

export interface UpdateMonthlyTaskResult {
  status: "updated" | "not_found_or_not_editable" | "invalid_schedule";
  title?: string;
  newTaskCreated?: boolean;
  newTaskId?: number;
}

export interface CompleteTaskResult {
  status: "done" | "done_late" | "not_found_or_closed";
  title?: string;
}

export interface MissTaskResult {
  status: "missed" | "not_found_or_closed";
  title?: string;
}

export interface CancelTaskResult {
  status: "cancelled" | "not_found_or_closed";
  title?: string;
}

export interface DeleteTaskResult {
  status: "deleted_instance" | "deleted_rule" | "not_found_or_closed";
  title?: string;
}

export interface SnoozeTaskResult {
  status: "snoozed" | "not_found_or_closed";
  title?: string;
  nextRemindAt?: string;
}

interface WeeklyReminderRule {
  id: number;
  created_by_user_id: number;
  title: string;
  schedule_params_json: string;
  timezone: string;
}

interface MonthlyReminderRule {
  id: number;
  created_by_user_id: number;
  title: string;
  schedule_type: "monthly_fixed_window" | "monthly_end_plus_start_window";
  schedule_params_json: string;
  timezone: string;
}

interface ActiveWeeklyTask {
  id: number;
  created_by_user_id: number;
  period_start: string;
  due_at: string;
}

function normalizeAssigneeUserIds(userId: number, assigneeUserIds: number[]): number[] {
  const normalized = Array.from(new Set(assigneeUserIds.filter((id) => Number.isSafeInteger(id) && id > 0)));

  return normalized.length > 0 ? normalized : [userId];
}

function getEffectiveOneTimeReminderAt(plannedReminderAt: string | null, dueAt: string, now: string): string | null {
  if (!plannedReminderAt) {
    return null;
  }

  const plannedReminderMs = Date.parse(plannedReminderAt);
  const dueMs = Date.parse(dueAt);
  const nowMs = Date.parse(now);

  if (Number.isNaN(plannedReminderMs) || Number.isNaN(dueMs) || Number.isNaN(nowMs)) {
    return null;
  }

  if (plannedReminderMs <= nowMs && dueMs > nowMs) {
    return now;
  }

  return plannedReminderAt;
}

async function createReminderRuleAssignees(
  env: Env,
  reminderRuleId: number,
  assigneeUserIds: number[],
  now: string
): Promise<void> {
  for (const assigneeUserId of assigneeUserIds) {
    await env.DB.prepare(
      `
        INSERT OR IGNORE INTO reminder_rule_assignees (reminder_rule_id, user_id, created_at)
        VALUES (?, ?, ?)
      `
    )
      .bind(reminderRuleId, assigneeUserId, now)
      .run();
  }
}

async function createTaskInstance(
  env: Env,
  input: {
    reminderRuleId: number;
    createdByUserId: number;
    title: string;
    periodLabel: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    availableFrom: string;
    dueAt: string;
    nextRemindAt: string;
    assigneeUserIds: number[];
    now: string;
  }
): Promise<number | null> {
  const task = await env.DB.prepare(
    `
      INSERT OR IGNORE INTO task_instances (
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
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      RETURNING id
    `
  )
    .bind(
      input.reminderRuleId,
      input.createdByUserId,
      input.title,
      input.periodLabel,
      input.periodStart,
      input.periodEnd,
      input.availableFrom,
      input.dueAt,
      input.nextRemindAt,
      input.now,
      input.now
    )
    .first<{ id: number }>();

  if (!task) {
    return null;
  }

  for (const assigneeUserId of input.assigneeUserIds) {
    await env.DB.prepare(
      `
        INSERT OR IGNORE INTO task_assignees (task_instance_id, user_id, created_at)
        VALUES (?, ?, ?)
      `
    )
      .bind(task.id, assigneeUserId, input.now)
      .run();
  }

  return task.id;
}

export async function getActiveTasksForUser(env: Env, userId: number): Promise<TaskListItem[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        task_instances.id,
        task_instances.title,
        task_instances.period_label,
        reminder_rules.schedule_type,
        reminder_rules.schedule_params_json,
        reminder_rules.timezone AS rule_timezone,
        task_instances.status,
        task_instances.available_from,
        task_instances.due_at,
        NULL AS assignee_names,
        (
          SELECT GROUP_CONCAT(task_assignees_all.user_id, ',')
          FROM task_assignees task_assignees_all
          WHERE task_assignees_all.task_instance_id = task_instances.id
        ) AS assignee_ids,
        1 AS can_act
      FROM task_instances
      LEFT JOIN reminder_rules
        ON reminder_rules.id = task_instances.reminder_rule_id
      INNER JOIN task_assignees
        ON task_assignees.task_instance_id = task_instances.id
      WHERE task_assignees.user_id = ?
        AND task_instances.status IN ('pending', 'overdue')
      ORDER BY
        CASE task_instances.status
          WHEN 'overdue' THEN 0
          ELSE 1
        END,
        task_instances.due_at ASC,
        task_instances.available_from ASC
      LIMIT 20
    `
  )
    .bind(userId)
    .all<TaskListItem>();

  return result.results ?? [];
}

export async function getActiveFamilyTasks(env: Env, userId: number): Promise<TaskListItem[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        task_instances.id,
        task_instances.title,
        task_instances.period_label,
        reminder_rules.schedule_type,
        reminder_rules.schedule_params_json,
        reminder_rules.timezone AS rule_timezone,
        task_instances.status,
        task_instances.available_from,
        task_instances.due_at,
        GROUP_CONCAT(
          COALESCE(NULLIF(users.first_name, ''), NULLIF(users.username, ''), 'ID ' || users.telegram_user_id),
          ', '
        ) AS assignee_names,
        GROUP_CONCAT(task_assignees.user_id, ',') AS assignee_ids,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM task_assignees current_user_assignees
            WHERE current_user_assignees.task_instance_id = task_instances.id
              AND current_user_assignees.user_id = ?
          ) THEN 1
          ELSE 0
        END AS can_act
      FROM task_instances
      LEFT JOIN reminder_rules
        ON reminder_rules.id = task_instances.reminder_rule_id
      LEFT JOIN task_assignees
        ON task_assignees.task_instance_id = task_instances.id
      LEFT JOIN users
        ON users.id = task_assignees.user_id
      WHERE task_instances.status IN ('pending', 'overdue')
      GROUP BY
        task_instances.id,
        task_instances.title,
        task_instances.period_label,
        reminder_rules.schedule_type,
        reminder_rules.schedule_params_json,
        reminder_rules.timezone,
        task_instances.status,
        task_instances.available_from,
        task_instances.due_at
      ORDER BY
        CASE task_instances.status
          WHEN 'overdue' THEN 0
          ELSE 1
        END,
        task_instances.due_at ASC,
        task_instances.available_from ASC
      LIMIT 30
    `
  )
    .bind(userId)
    .all<TaskListItem>();

  return result.results ?? [];
}

export async function getTaskHistoryForUser(
  env: Env,
  userId: number,
  isAdmin: boolean,
  limit = 30,
  offset = 0,
  status: TaskHistoryStatus | null = null
): Promise<TaskHistoryItem[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        task_instances.id,
        task_instances.title,
        task_instances.period_label,
        reminder_rules.schedule_type,
        reminder_rules.schedule_params_json,
        reminder_rules.timezone AS rule_timezone,
        task_instances.status,
        task_instances.available_from,
        task_instances.due_at,
        task_instances.closed_at,
        COALESCE(
          NULLIF(closed_by_user.first_name, ''),
          NULLIF(closed_by_user.username, ''),
          CASE
            WHEN closed_by_user.telegram_user_id IS NOT NULL THEN 'ID ' || closed_by_user.telegram_user_id
            ELSE NULL
          END
        ) AS closed_by_name,
        GROUP_CONCAT(
          COALESCE(NULLIF(assignee_users.first_name, ''), NULLIF(assignee_users.username, ''), 'ID ' || assignee_users.telegram_user_id),
          ', '
        ) AS assignee_names
      FROM task_instances
      LEFT JOIN reminder_rules
        ON reminder_rules.id = task_instances.reminder_rule_id
      LEFT JOIN users closed_by_user
        ON closed_by_user.id = task_instances.closed_by_user_id
      LEFT JOIN task_assignees
        ON task_assignees.task_instance_id = task_instances.id
      LEFT JOIN users assignee_users
        ON assignee_users.id = task_assignees.user_id
      WHERE task_instances.status IN ('done', 'done_late', 'missed', 'cancelled')
        AND (? IS NULL OR task_instances.status = ?)
        AND (
          ? = 1
          OR task_instances.closed_by_user_id = ?
          OR EXISTS (
            SELECT 1
            FROM task_assignees visible_assignees
            WHERE visible_assignees.task_instance_id = task_instances.id
              AND visible_assignees.user_id = ?
          )
        )
        AND NOT (
          task_instances.status = 'cancelled'
          AND EXISTS (
            SELECT 1
            FROM audit_log audit
            WHERE audit.entity_type = 'task'
              AND audit.action = 'task.updated'
              AND json_extract(audit.metadata_json, '$.previousTaskId') = task_instances.id
          )
        )
      GROUP BY
        task_instances.id,
        task_instances.title,
        task_instances.period_label,
        reminder_rules.schedule_type,
        reminder_rules.schedule_params_json,
        reminder_rules.timezone,
        task_instances.status,
        task_instances.available_from,
        task_instances.due_at,
        task_instances.closed_at,
        closed_by_user.first_name,
        closed_by_user.username,
        closed_by_user.telegram_user_id
      ORDER BY
        COALESCE(task_instances.closed_at, task_instances.updated_at) DESC,
        task_instances.id DESC
      LIMIT ?
      OFFSET ?
    `
  )
    .bind(status, status, isAdmin ? 1 : 0, userId, userId, limit, offset)
    .all<TaskHistoryItem>();

  return result.results ?? [];
}

export async function countTaskHistoryForUser(
  env: Env,
  userId: number,
  isAdmin: boolean,
  status: TaskHistoryStatus | null = null
): Promise<number> {
  const result = await env.DB.prepare(
    `
      SELECT COUNT(*) AS total
      FROM task_instances
      WHERE task_instances.status IN ('done', 'done_late', 'missed', 'cancelled')
        AND (? IS NULL OR task_instances.status = ?)
        AND (
          ? = 1
          OR task_instances.closed_by_user_id = ?
          OR EXISTS (
            SELECT 1
            FROM task_assignees visible_assignees
            WHERE visible_assignees.task_instance_id = task_instances.id
              AND visible_assignees.user_id = ?
          )
        )
        AND NOT (
          task_instances.status = 'cancelled'
          AND EXISTS (
            SELECT 1
            FROM audit_log audit
            WHERE audit.entity_type = 'task'
              AND audit.action = 'task.updated'
              AND json_extract(audit.metadata_json, '$.previousTaskId') = task_instances.id
          )
        )
    `
  )
    .bind(status, status, isAdmin ? 1 : 0, userId, userId)
    .first<{ total: number }>();

  return result?.total ?? 0;
}

export async function getActiveTaskForUser(
  env: Env,
  taskId: number,
  userId: number
): Promise<TaskListItem | null> {
  const task = await env.DB.prepare(
    `
      SELECT
        task_instances.id,
        task_instances.title,
        task_instances.period_label,
        reminder_rules.schedule_type,
        reminder_rules.schedule_params_json,
        reminder_rules.timezone AS rule_timezone,
        task_instances.status,
        task_instances.available_from,
        task_instances.due_at,
        NULL AS assignee_names,
        (
          SELECT GROUP_CONCAT(task_assignees_all.user_id, ',')
          FROM task_assignees task_assignees_all
          WHERE task_assignees_all.task_instance_id = task_instances.id
        ) AS assignee_ids,
        1 AS can_act
      FROM task_instances
      LEFT JOIN reminder_rules
        ON reminder_rules.id = task_instances.reminder_rule_id
      INNER JOIN task_assignees
        ON task_assignees.task_instance_id = task_instances.id
      WHERE task_instances.id = ?
        AND task_assignees.user_id = ?
        AND task_instances.status IN ('pending', 'overdue')
      LIMIT 1
    `
  )
    .bind(taskId, userId)
    .first<TaskListItem>();

  return task ?? null;
}

export async function getActiveTaskForViewer(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean
): Promise<TaskListItem | null> {
  const task = await env.DB.prepare(
    `
      SELECT
        task_instances.id,
        task_instances.title,
        task_instances.period_label,
        reminder_rules.schedule_type,
        reminder_rules.schedule_params_json,
        reminder_rules.timezone AS rule_timezone,
        task_instances.status,
        task_instances.available_from,
        task_instances.due_at,
        GROUP_CONCAT(
          COALESCE(NULLIF(users.first_name, ''), NULLIF(users.username, ''), 'ID ' || users.telegram_user_id),
          ', '
        ) AS assignee_names,
        GROUP_CONCAT(task_assignees.user_id, ',') AS assignee_ids,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM task_assignees current_user_assignees
            WHERE current_user_assignees.task_instance_id = task_instances.id
              AND current_user_assignees.user_id = ?
          ) THEN 1
          ELSE 0
        END AS can_act
      FROM task_instances
      LEFT JOIN reminder_rules
        ON reminder_rules.id = task_instances.reminder_rule_id
      LEFT JOIN task_assignees
        ON task_assignees.task_instance_id = task_instances.id
      LEFT JOIN users
        ON users.id = task_assignees.user_id
      WHERE task_instances.id = ?
        AND task_instances.status IN ('pending', 'overdue')
        AND (
          ? = 1
          OR EXISTS (
            SELECT 1
            FROM task_assignees viewer_assignees
            WHERE viewer_assignees.task_instance_id = task_instances.id
              AND viewer_assignees.user_id = ?
          )
        )
      GROUP BY
        task_instances.id,
        task_instances.title,
        task_instances.period_label,
        reminder_rules.schedule_type,
        reminder_rules.schedule_params_json,
        reminder_rules.timezone,
        task_instances.status,
        task_instances.available_from,
        task_instances.due_at
      LIMIT 1
    `
  )
    .bind(userId, taskId, isAdmin ? 1 : 0, userId)
    .first<TaskListItem>();

  return task ?? null;
}

export async function getTaskDeletePreview(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean
): Promise<TaskDeletePreview> {
  const task = await env.DB.prepare(
    `
      SELECT
        task_instances.title,
        reminder_rules.schedule_type
      FROM task_instances
      LEFT JOIN reminder_rules
        ON reminder_rules.id = task_instances.reminder_rule_id
      WHERE task_instances.id = ?
        AND task_instances.status IN ('pending', 'overdue')
        AND (
          ? = 1
          OR EXISTS (
            SELECT 1
            FROM task_assignees
            WHERE task_assignees.task_instance_id = task_instances.id
              AND task_assignees.user_id = ?
          )
        )
      LIMIT 1
    `
  )
    .bind(taskId, isAdmin ? 1 : 0, userId)
    .first<{ title: string; schedule_type: string | null }>();

  if (!task) {
    return {
      status: "not_found_or_closed"
    };
  }

  return {
    status: "found",
    title: task.title,
    isRecurring: task.schedule_type !== null && task.schedule_type !== "one_time"
  };
}

export async function getEditableTaskForUser(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean
): Promise<EditableTask | null> {
  const task = await env.DB.prepare(
    `
      SELECT
        task_instances.id,
        task_instances.title,
        task_instances.reminder_rule_id,
        task_instances.created_by_user_id,
        task_instances.period_label,
        reminder_rules.schedule_type,
        reminder_rules.schedule_params_json,
        reminder_rules.timezone,
        task_instances.available_from,
        task_instances.due_at
      FROM task_instances
      LEFT JOIN reminder_rules
        ON reminder_rules.id = task_instances.reminder_rule_id
      WHERE task_instances.id = ?
        AND task_instances.status IN ('pending', 'overdue')
        AND (
          ? = 1
          OR EXISTS (
            SELECT 1
            FROM task_assignees
            WHERE task_assignees.task_instance_id = task_instances.id
              AND task_assignees.user_id = ?
          )
        )
      LIMIT 1
    `
  )
    .bind(taskId, isAdmin ? 1 : 0, userId)
    .first<EditableTask>();

  return task ?? null;
}

export async function getTaskAssigneeUserIds(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean
): Promise<number[] | null> {
  const task = await getEditableTaskForUser(env, taskId, userId, isAdmin);

  if (!task || (task.schedule_type !== "one_time" && task.schedule_type !== "weekly" && !isMonthlyScheduleType(task.schedule_type))) {
    return null;
  }

  const result = await env.DB.prepare(
    `
      SELECT user_id
      FROM task_assignees
      WHERE task_instance_id = ?
      ORDER BY user_id ASC
    `
  )
    .bind(taskId)
    .all<{ user_id: number }>();

  return (result.results ?? []).map((assignee) => assignee.user_id);
}

export async function updateOneTimeTaskTitle(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  title: string,
  now: string
): Promise<UpdateOneTimeTaskResult> {
  const task = await getEditableTaskForUser(env, taskId, userId, isAdmin);

  if (!task || task.schedule_type !== "one_time") {
    return {
      status: "not_found_or_not_editable"
    };
  }

  const updatedTask = await env.DB.prepare(
    `
      UPDATE task_instances
      SET title = ?,
        updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'overdue')
      RETURNING id, title, reminder_rule_id
    `
  )
    .bind(title, now, taskId)
    .first<{ id: number; title: string; reminder_rule_id: number | null }>();

  if (!updatedTask) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  if (updatedTask.reminder_rule_id !== null) {
    await env.DB.prepare(
      `
        UPDATE reminder_rules
        SET title = ?,
          updated_at = ?
        WHERE id = ?
          AND schedule_type = 'one_time'
      `
    )
      .bind(title, now, updatedTask.reminder_rule_id)
      .run();
  }

  return {
    status: "updated",
    title: updatedTask.title
  };
}

export async function updateOneTimeTaskDueAt(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  dueAt: string,
  reminderHour: number,
  reminderMinute: number,
  timezone: string,
  now: string
): Promise<UpdateOneTimeTaskResult> {
  const task = await getEditableTaskForUser(env, taskId, userId, isAdmin);

  if (!task || task.schedule_type !== "one_time") {
    return {
      status: "not_found_or_not_editable"
    };
  }

  const plannedReminderAt = getOneTimeTaskReminderAt(dueAt, reminderHour, reminderMinute, timezone);
  const nextRemindAt = getEffectiveOneTimeReminderAt(plannedReminderAt, dueAt, now);

  if (!nextRemindAt) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  const updatedTask = await env.DB.prepare(
    `
      UPDATE task_instances
      SET due_at = ?,
        next_remind_at = ?,
        status = 'pending',
        updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'overdue')
      RETURNING id, title, reminder_rule_id
    `
  )
    .bind(dueAt, nextRemindAt, now, taskId)
    .first<{ id: number; title: string; reminder_rule_id: number | null }>();

  if (!updatedTask) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  if (updatedTask.reminder_rule_id !== null) {
    await env.DB.prepare(
      `
        UPDATE reminder_rules
        SET schedule_params_json = ?,
          updated_at = ?
        WHERE id = ?
          AND schedule_type = 'one_time'
      `
    )
      .bind(
        JSON.stringify({
          due_at: dueAt,
          hour: reminderHour,
          minute: reminderMinute
        }),
        now,
        updatedTask.reminder_rule_id
      )
      .run();
  }

  return {
    status: "updated",
    title: updatedTask.title
  };
}

export async function updateOneTimeTaskWindow(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  input: {
    availableFrom: string;
    dueAt: string;
    hour: number;
    minute: number;
    timezone: string;
  },
  now: string
): Promise<UpdateOneTimeTaskResult> {
  const task = await getEditableTaskForUser(env, taskId, userId, isAdmin);

  if (!task || task.schedule_type !== "one_time") {
    return {
      status: "not_found_or_not_editable"
    };
  }

  const nextRemindAt = getNextWindowReminderOrNow(
    now,
    input.availableFrom,
    input.dueAt,
    input.hour,
    input.minute,
    input.timezone
  );

  if (!nextRemindAt) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  const updatedTask = await env.DB.prepare(
    `
      UPDATE task_instances
      SET period_label = 'разовое окно',
        period_start = ?,
        period_end = ?,
        available_from = ?,
        due_at = ?,
        next_remind_at = ?,
        status = 'pending',
        updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'overdue')
      RETURNING id, title, reminder_rule_id
    `
  )
    .bind(input.availableFrom, input.dueAt, input.availableFrom, input.dueAt, nextRemindAt, now, taskId)
    .first<{ id: number; title: string; reminder_rule_id: number | null }>();

  if (!updatedTask) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  if (updatedTask.reminder_rule_id !== null) {
    await env.DB.prepare(
      `
        UPDATE reminder_rules
        SET schedule_params_json = ?,
          updated_at = ?
        WHERE id = ?
          AND schedule_type = 'one_time'
      `
    )
      .bind(
        JSON.stringify({
          available_from: input.availableFrom,
          due_at: input.dueAt,
          hour: input.hour,
          minute: input.minute
        }),
        now,
        updatedTask.reminder_rule_id
      )
      .run();
  }

  return {
    status: "updated",
    title: updatedTask.title
  };
}

export async function updateOneTimeTaskAssignees(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  assigneeUserIds: number[],
  now: string
): Promise<UpdateOneTimeTaskResult> {
  const task = await env.DB.prepare(
    `
      SELECT
        task_instances.id,
        task_instances.title,
        task_instances.reminder_rule_id,
        reminder_rules.schedule_type
      FROM task_instances
      LEFT JOIN reminder_rules
        ON reminder_rules.id = task_instances.reminder_rule_id
      WHERE task_instances.id = ?
        AND task_instances.status IN ('pending', 'overdue')
        AND (
          ? = 1
          OR EXISTS (
            SELECT 1
            FROM task_assignees
            WHERE task_assignees.task_instance_id = task_instances.id
              AND task_assignees.user_id = ?
          )
        )
      LIMIT 1
    `
  )
    .bind(taskId, isAdmin ? 1 : 0, userId)
    .first<{
      id: number;
      title: string;
      reminder_rule_id: number | null;
      schedule_type: string | null;
    }>();

  if (!task || task.schedule_type !== "one_time" || assigneeUserIds.length === 0) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  await env.DB.prepare(
    `
      DELETE FROM task_assignees
      WHERE task_instance_id = ?
    `
  )
    .bind(taskId)
    .run();

  if (task.reminder_rule_id !== null) {
    await env.DB.prepare(
      `
        DELETE FROM reminder_rule_assignees
        WHERE reminder_rule_id = ?
      `
    )
      .bind(task.reminder_rule_id)
      .run();
  }

  for (const assigneeUserId of assigneeUserIds) {
    await env.DB.prepare(
      `
        INSERT OR IGNORE INTO task_assignees (task_instance_id, user_id, created_at)
        VALUES (?, ?, ?)
      `
    )
      .bind(taskId, assigneeUserId, now)
      .run();

    if (task.reminder_rule_id !== null) {
      await env.DB.prepare(
        `
          INSERT OR IGNORE INTO reminder_rule_assignees (reminder_rule_id, user_id, created_at)
          VALUES (?, ?, ?)
        `
      )
        .bind(task.reminder_rule_id, assigneeUserId, now)
        .run();
    }
  }

  await env.DB.prepare(
    `
      UPDATE task_instances
      SET updated_at = ?
      WHERE id = ?
    `
  )
    .bind(now, taskId)
    .run();

  if (task.reminder_rule_id !== null) {
    await env.DB.prepare(
      `
        UPDATE reminder_rules
        SET updated_at = ?
        WHERE id = ?
      `
    )
      .bind(now, task.reminder_rule_id)
      .run();
  }

  return {
    status: "updated",
    title: task.title
  };
}

function parseWeeklyScheduleParams(value: string | null): { weekday: number; hour: number; minute: number } | null {
  if (!value) {
    return null;
  }

  const params = JSON.parse(value) as {
    weekday?: number;
    hour?: number;
    minute?: number;
  };

  if (
    typeof params.weekday !== "number" ||
    typeof params.hour !== "number" ||
    typeof params.minute !== "number"
  ) {
    return null;
  }

  return {
    weekday: params.weekday,
    hour: params.hour,
    minute: params.minute
  };
}

function isMonthlyScheduleType(value: string | null): value is MonthlyReminderRule["schedule_type"] {
  return value === "monthly_fixed_window" || value === "monthly_end_plus_start_window";
}

export async function updateWeeklyTaskTitle(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  title: string,
  now: string
): Promise<UpdateWeeklyTaskResult> {
  const task = await getEditableTaskForUser(env, taskId, userId, isAdmin);

  if (!task || task.schedule_type !== "weekly" || task.reminder_rule_id === null) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  await env.DB.prepare(
    `
      UPDATE reminder_rules
      SET title = ?,
        updated_at = ?
      WHERE id = ?
        AND schedule_type = 'weekly'
    `
  )
    .bind(title, now, task.reminder_rule_id)
    .run();

  const updatedTask = await env.DB.prepare(
    `
      UPDATE task_instances
      SET title = ?,
        updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'overdue')
      RETURNING title
    `
  )
    .bind(title, now, taskId)
    .first<{ title: string }>();

  if (!updatedTask) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  return {
    status: "updated",
    title: updatedTask.title
  };
}

export async function updateMonthlyTaskTitle(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  title: string,
  now: string
): Promise<UpdateMonthlyTaskResult> {
  const task = await getEditableTaskForUser(env, taskId, userId, isAdmin);

  if (!task || !isMonthlyScheduleType(task.schedule_type) || task.reminder_rule_id === null) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  await env.DB.prepare(
    `
      UPDATE reminder_rules
      SET title = ?,
        updated_at = ?
      WHERE id = ?
        AND schedule_type IN ('monthly_fixed_window', 'monthly_end_plus_start_window')
    `
  )
    .bind(title, now, task.reminder_rule_id)
    .run();

  const updatedTask = await env.DB.prepare(
    `
      UPDATE task_instances
      SET title = ?,
        updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'overdue')
      RETURNING title
    `
  )
    .bind(title, now, taskId)
    .first<{ title: string }>();

  if (!updatedTask) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  return {
    status: "updated",
    title: updatedTask.title
  };
}

export async function updateWeeklyTaskAssignees(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  assigneeUserIds: number[],
  applyToCurrent: boolean,
  now: string
): Promise<UpdateWeeklyTaskResult> {
  const task = await getEditableTaskForUser(env, taskId, userId, isAdmin);

  if (!task || task.schedule_type !== "weekly" || task.reminder_rule_id === null || assigneeUserIds.length === 0) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  await env.DB.prepare(
    `
      DELETE FROM reminder_rule_assignees
      WHERE reminder_rule_id = ?
    `
  )
    .bind(task.reminder_rule_id)
    .run();

  await createReminderRuleAssignees(env, task.reminder_rule_id, assigneeUserIds, now);

  if (applyToCurrent) {
    await env.DB.prepare(
      `
        DELETE FROM task_assignees
        WHERE task_instance_id = ?
      `
    )
      .bind(taskId)
      .run();

    for (const assigneeUserId of assigneeUserIds) {
      await env.DB.prepare(
        `
          INSERT OR IGNORE INTO task_assignees (task_instance_id, user_id, created_at)
          VALUES (?, ?, ?)
        `
      )
        .bind(taskId, assigneeUserId, now)
        .run();
    }
  }

  await env.DB.prepare(
    `
      UPDATE reminder_rules
      SET updated_at = ?
      WHERE id = ?
    `
  )
    .bind(now, task.reminder_rule_id)
    .run();

  await env.DB.prepare(
    `
      UPDATE task_instances
      SET updated_at = ?
      WHERE id = ?
    `
  )
    .bind(now, taskId)
    .run();

  return {
    status: "updated",
    title: task.title
  };
}

export async function updateMonthlyTaskAssignees(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  assigneeUserIds: number[],
  applyToCurrent: boolean,
  now: string
): Promise<UpdateMonthlyTaskResult> {
  const task = await getEditableTaskForUser(env, taskId, userId, isAdmin);

  if (!task || !isMonthlyScheduleType(task.schedule_type) || task.reminder_rule_id === null || assigneeUserIds.length === 0) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  await env.DB.prepare(
    `
      DELETE FROM reminder_rule_assignees
      WHERE reminder_rule_id = ?
    `
  )
    .bind(task.reminder_rule_id)
    .run();

  await createReminderRuleAssignees(env, task.reminder_rule_id, assigneeUserIds, now);

  if (applyToCurrent) {
    await env.DB.prepare(
      `
        DELETE FROM task_assignees
        WHERE task_instance_id = ?
      `
    )
      .bind(taskId)
      .run();

    for (const assigneeUserId of assigneeUserIds) {
      await env.DB.prepare(
        `
          INSERT OR IGNORE INTO task_assignees (task_instance_id, user_id, created_at)
          VALUES (?, ?, ?)
        `
      )
        .bind(taskId, assigneeUserId, now)
        .run();
    }
  }

  await env.DB.prepare(
    `
      UPDATE reminder_rules
      SET updated_at = ?
      WHERE id = ?
    `
  )
    .bind(now, task.reminder_rule_id)
    .run();

  await env.DB.prepare(
    `
      UPDATE task_instances
      SET updated_at = ?
      WHERE id = ?
    `
  )
    .bind(now, taskId)
    .run();

  return {
    status: "updated",
    title: task.title
  };
}

export async function updateWeeklyTaskSchedule(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  weekday: number,
  hour: number,
  minute: number,
  now: string,
  nextAssigneeUserIds?: number[]
): Promise<UpdateWeeklyTaskResult> {
  const task = await getEditableTaskForUser(env, taskId, userId, isAdmin);

  if (
    !task ||
    task.schedule_type !== "weekly" ||
    task.reminder_rule_id === null ||
    !task.timezone
  ) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  const window = getNextWeeklyTaskWindow(now, weekday, hour, minute, task.timezone);

  if (!window) {
    return {
      status: "invalid_schedule"
    };
  }

  const currentAssignees = nextAssigneeUserIds
    ? null
    : await env.DB.prepare(
      `
        SELECT user_id
        FROM reminder_rule_assignees
        WHERE reminder_rule_id = ?
      `
    )
      .bind(task.reminder_rule_id)
      .all<{ user_id: number }>();
  const assigneeUserIds = nextAssigneeUserIds
    ? Array.from(new Set(nextAssigneeUserIds))
    : (currentAssignees?.results ?? []).map((assignee) => assignee.user_id);

  if (assigneeUserIds.length === 0) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  if (nextAssigneeUserIds) {
    await env.DB.prepare(
      `
        DELETE FROM reminder_rule_assignees
        WHERE reminder_rule_id = ?
      `
    )
      .bind(task.reminder_rule_id)
      .run();

    await createReminderRuleAssignees(env, task.reminder_rule_id, assigneeUserIds, now);
  }

  await env.DB.prepare(
    `
      UPDATE reminder_rules
      SET schedule_params_json = ?,
        updated_at = ?
      WHERE id = ?
        AND schedule_type = 'weekly'
    `
  )
    .bind(JSON.stringify({ weekday, hour, minute }), now, task.reminder_rule_id)
    .run();

  await env.DB.prepare(
    `
      UPDATE task_instances
      SET status = 'cancelled',
        reminder_rule_id = NULL,
        closed_by_user_id = ?,
        closed_at = ?,
        updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'overdue')
    `
  )
    .bind(userId, now, now, taskId)
    .run();

  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO completion_log (task_instance_id, user_id, action, created_at)
      VALUES (?, ?, 'cancelled', ?)
    `
  )
    .bind(taskId, userId, now)
    .run();

  const newTaskId = await createTaskInstance(env, {
    reminderRuleId: task.reminder_rule_id,
    createdByUserId: task.created_by_user_id,
    title: task.title,
    periodLabel: "еженедельно",
    periodStart: window.availableFrom,
    periodEnd: window.dueAt,
    availableFrom: window.availableFrom,
    dueAt: window.dueAt,
    nextRemindAt: window.remindAt,
    assigneeUserIds,
    now
  });

  return {
    status: "updated",
    title: task.title,
    newTaskCreated: newTaskId !== null,
    newTaskId: newTaskId ?? undefined
  };
}

export async function updateMonthlyTaskSchedule(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  input:
    | { scheduleType: "monthly_fixed_window"; startDay: number; endDay: number; hour: number; minute: number }
    | { scheduleType: "monthly_end_plus_start_window"; lastDays: number; firstDays: number; hour: number; minute: number },
  now: string,
  nextAssigneeUserIds?: number[]
): Promise<UpdateMonthlyTaskResult> {
  const task = await getEditableTaskForUser(env, taskId, userId, isAdmin);

  if (
    !task ||
    !isMonthlyScheduleType(task.schedule_type) ||
    task.schedule_type !== input.scheduleType ||
    task.reminder_rule_id === null ||
    !task.timezone
  ) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  const window = input.scheduleType === "monthly_fixed_window"
    ? getNextMonthlyFixedWindow(now, input.startDay, input.endDay, input.hour, input.minute, task.timezone)
    : getNextMonthlyEndPlusStartWindow(now, input.lastDays, input.firstDays, input.hour, input.minute, task.timezone);

  if (!window) {
    return {
      status: "invalid_schedule"
    };
  }

  const currentAssignees = nextAssigneeUserIds
    ? null
    : await env.DB.prepare(
      `
        SELECT user_id
        FROM reminder_rule_assignees
        WHERE reminder_rule_id = ?
      `
    )
      .bind(task.reminder_rule_id)
      .all<{ user_id: number }>();
  const assigneeUserIds = nextAssigneeUserIds
    ? Array.from(new Set(nextAssigneeUserIds))
    : (currentAssignees?.results ?? []).map((assignee) => assignee.user_id);

  if (assigneeUserIds.length === 0) {
    return {
      status: "not_found_or_not_editable"
    };
  }

  const scheduleParams = input.scheduleType === "monthly_fixed_window"
    ? {
        start_day: input.startDay,
        end_day: input.endDay,
        hour: input.hour,
        minute: input.minute
      }
    : {
        last_days: input.lastDays,
        first_days: input.firstDays,
        hour: input.hour,
        minute: input.minute
      };

  if (nextAssigneeUserIds) {
    await env.DB.prepare(
      `
        DELETE FROM reminder_rule_assignees
        WHERE reminder_rule_id = ?
      `
    )
      .bind(task.reminder_rule_id)
      .run();

    await createReminderRuleAssignees(env, task.reminder_rule_id, assigneeUserIds, now);
  }

  await env.DB.prepare(
    `
      UPDATE reminder_rules
      SET schedule_params_json = ?,
        updated_at = ?
      WHERE id = ?
        AND schedule_type = ?
    `
  )
    .bind(JSON.stringify(scheduleParams), now, task.reminder_rule_id, input.scheduleType)
    .run();

  await env.DB.prepare(
    `
      UPDATE task_instances
      SET status = 'cancelled',
        reminder_rule_id = NULL,
        closed_by_user_id = ?,
        closed_at = ?,
        updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'overdue')
    `
  )
    .bind(userId, now, now, taskId)
    .run();

  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO completion_log (task_instance_id, user_id, action, created_at)
      VALUES (?, ?, 'cancelled', ?)
    `
  )
    .bind(taskId, userId, now)
    .run();

  const newTaskId = await createTaskInstance(env, {
    reminderRuleId: task.reminder_rule_id,
    createdByUserId: task.created_by_user_id,
    title: task.title,
    periodLabel: window.periodLabel,
    periodStart: window.availableFrom,
    periodEnd: window.dueAt,
    availableFrom: window.availableFrom,
    dueAt: window.dueAt,
    nextRemindAt: window.remindAt,
    assigneeUserIds,
    now
  });

  return {
    status: "updated",
    title: task.title,
    newTaskCreated: newTaskId !== null,
    newTaskId: newTaskId ?? undefined
  };
}

export async function createOneTimeTask(env: Env, input: CreateOneTimeTaskInput): Promise<number> {
  const assigneeUserIds = normalizeAssigneeUserIds(input.userId, input.assigneeUserIds);
  const availableFrom = input.availableFrom ?? input.now;
  const isWindow = Boolean(input.availableFrom);
  const reminderParams =
    typeof input.reminderHour === "number" &&
    typeof input.reminderMinute === "number"
    ? {
      hour: input.reminderHour,
      minute: input.reminderMinute
    }
    : null;

  if (!reminderParams) {
    throw new Error("Failed to calculate one-time task reminder");
  }

  const firstReminderAt = isWindow
    ? getNextWindowReminderOrNow(
      input.now,
      availableFrom,
      input.dueAt,
      reminderParams.hour,
      reminderParams.minute,
      input.timezone
    )
    : getOneTimeTaskReminderAt(input.dueAt, reminderParams.hour, reminderParams.minute, input.timezone);
  const nextRemindAt = isWindow
    ? firstReminderAt
    : getEffectiveOneTimeReminderAt(firstReminderAt, input.dueAt, input.now);

  if (!nextRemindAt) {
    throw new Error("Failed to calculate one-time task reminder");
  }

  const rule = await env.DB.prepare(
    `
      INSERT INTO reminder_rules (
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
      VALUES (?, ?, NULL, 'one_time', ?, ?, 0, ?, ?)
      RETURNING id
    `
  )
    .bind(
      input.userId,
      input.title,
      JSON.stringify({
        ...(isWindow ? { available_from: availableFrom } : {}),
        due_at: input.dueAt,
        hour: reminderParams.hour,
        minute: reminderParams.minute
      }),
      input.timezone,
      input.now,
      input.now
    )
    .first<{ id: number }>();

  if (!rule) {
    throw new Error("Failed to create reminder rule");
  }

  await createReminderRuleAssignees(env, rule.id, assigneeUserIds, input.now);

  const taskId = await createTaskInstance(env, {
    reminderRuleId: rule.id,
    createdByUserId: input.userId,
    title: input.title,
    periodLabel: isWindow ? "разовое окно" : null,
    periodStart: isWindow ? availableFrom : null,
    periodEnd: isWindow ? input.dueAt : null,
    availableFrom,
    dueAt: input.dueAt,
    nextRemindAt,
    assigneeUserIds,
    now: input.now
  });

  if (!taskId) {
    throw new Error("Failed to create task instance");
  }

  return taskId;
}

export async function createWeeklyTask(env: Env, input: CreateWeeklyTaskInput): Promise<number> {
  const assigneeUserIds = normalizeAssigneeUserIds(input.userId, input.assigneeUserIds);
  const window = getNextWeeklyTaskWindow(input.now, input.weekday, input.hour, input.minute, input.timezone);

  if (!window) {
    throw new Error("Failed to calculate next weekly task window");
  }

  const rule = await env.DB.prepare(
    `
      INSERT INTO reminder_rules (
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
      VALUES (?, ?, NULL, 'weekly', ?, ?, 1, ?, ?)
      RETURNING id
    `
  )
    .bind(
      input.userId,
      input.title,
      JSON.stringify({
        weekday: input.weekday,
        hour: input.hour,
        minute: input.minute
      }),
      input.timezone,
      input.now,
      input.now
    )
    .first<{ id: number }>();

  if (!rule) {
    throw new Error("Failed to create weekly reminder rule");
  }

  await createReminderRuleAssignees(env, rule.id, assigneeUserIds, input.now);

  const taskId = await createTaskInstance(env, {
    reminderRuleId: rule.id,
    createdByUserId: input.userId,
    title: input.title,
    periodLabel: "еженедельно",
    periodStart: window.availableFrom,
    periodEnd: window.dueAt,
    availableFrom: window.availableFrom,
    dueAt: window.dueAt,
    nextRemindAt: window.remindAt,
    assigneeUserIds,
    now: input.now
  });

  if (!taskId) {
    throw new Error("Failed to create weekly task instance");
  }

  return taskId;
}

export async function createMonthlyFixedTask(env: Env, input: CreateMonthlyFixedTaskInput): Promise<number> {
  const assigneeUserIds = normalizeAssigneeUserIds(input.userId, input.assigneeUserIds);
  const window = getNextMonthlyFixedWindow(
    input.now,
    input.startDay,
    input.endDay,
    input.hour,
    input.minute,
    input.timezone
  );

  if (!window) {
    throw new Error("Failed to calculate next monthly fixed task window");
  }

  const rule = await env.DB.prepare(
    `
      INSERT INTO reminder_rules (
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
      VALUES (?, ?, NULL, 'monthly_fixed_window', ?, ?, 1, ?, ?)
      RETURNING id
    `
  )
    .bind(
      input.userId,
      input.title,
      JSON.stringify({
        start_day: input.startDay,
        end_day: input.endDay,
        hour: input.hour,
        minute: input.minute
      }),
      input.timezone,
      input.now,
      input.now
    )
    .first<{ id: number }>();

  if (!rule) {
    throw new Error("Failed to create monthly fixed reminder rule");
  }

  await createReminderRuleAssignees(env, rule.id, assigneeUserIds, input.now);

  const taskId = await createTaskInstance(env, {
    reminderRuleId: rule.id,
    createdByUserId: input.userId,
    title: input.title,
    periodLabel: window.periodLabel,
    periodStart: window.availableFrom,
    periodEnd: window.dueAt,
    availableFrom: window.availableFrom,
    dueAt: window.dueAt,
    nextRemindAt: window.remindAt,
    assigneeUserIds,
    now: input.now
  });

  if (!taskId) {
    throw new Error("Failed to create monthly fixed task instance");
  }

  return taskId;
}

export async function createMonthlyEndPlusStartTask(
  env: Env,
  input: CreateMonthlyEndPlusStartTaskInput
): Promise<number> {
  const assigneeUserIds = normalizeAssigneeUserIds(input.userId, input.assigneeUserIds);
  const window = getNextMonthlyEndPlusStartWindow(
    input.now,
    input.lastDays,
    input.firstDays,
    input.hour,
    input.minute,
    input.timezone
  );

  if (!window) {
    throw new Error("Failed to calculate next monthly end plus start task window");
  }

  const rule = await env.DB.prepare(
    `
      INSERT INTO reminder_rules (
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
      VALUES (?, ?, NULL, 'monthly_end_plus_start_window', ?, ?, 1, ?, ?)
      RETURNING id
    `
  )
    .bind(
      input.userId,
      input.title,
      JSON.stringify({
        last_days: input.lastDays,
        first_days: input.firstDays,
        hour: input.hour,
        minute: input.minute
      }),
      input.timezone,
      input.now,
      input.now
    )
    .first<{ id: number }>();

  if (!rule) {
    throw new Error("Failed to create monthly end plus start reminder rule");
  }

  await createReminderRuleAssignees(env, rule.id, assigneeUserIds, input.now);

  const taskId = await createTaskInstance(env, {
    reminderRuleId: rule.id,
    createdByUserId: input.userId,
    title: input.title,
    periodLabel: window.periodLabel,
    periodStart: window.availableFrom,
    periodEnd: window.dueAt,
    availableFrom: window.availableFrom,
    dueAt: window.dueAt,
    nextRemindAt: window.remindAt,
    assigneeUserIds,
    now: input.now
  });

  if (!taskId) {
    throw new Error("Failed to create monthly end plus start task instance");
  }

  return taskId;
}

export async function markOverdueTasks(env: Env, now: string): Promise<number> {
  const result = await env.DB.prepare(
    `
      UPDATE task_instances
      SET status = 'overdue',
        updated_at = ?
      WHERE status = 'pending'
        AND due_at <= ?
    `
  )
    .bind(now, now)
    .run();

  return result.meta.changes ?? 0;
}

export async function completeTaskForUser(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  now: string
): Promise<CompleteTaskResult> {
  const task = await env.DB.prepare(
    `
      UPDATE task_instances
      SET status = CASE
          WHEN due_at < ? THEN 'done_late'
          ELSE 'done'
        END,
        closed_by_user_id = ?,
        closed_at = ?,
        updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'overdue')
        AND (
          ? = 1
          OR EXISTS (
            SELECT 1
            FROM task_assignees
            WHERE task_assignees.task_instance_id = task_instances.id
              AND task_assignees.user_id = ?
          )
        )
      RETURNING id, title, status
    `
  )
    .bind(now, userId, now, now, taskId, isAdmin ? 1 : 0, userId)
    .first<{ id: number; title: string; status: "done" | "done_late" }>();

  if (!task) {
    return {
      status: "not_found_or_closed"
    };
  }

  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO completion_log (task_instance_id, user_id, action, created_at)
      VALUES (?, ?, ?, ?)
    `
  )
    .bind(task.id, userId, task.status, now)
    .run();

  return {
    status: task.status,
    title: task.title
  };
}

export async function missTaskForUser(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  now: string
): Promise<MissTaskResult> {
  const task = await env.DB.prepare(
    `
      UPDATE task_instances
      SET status = 'missed',
        closed_by_user_id = ?,
        closed_at = ?,
        updated_at = ?
      WHERE id = ?
        AND status = 'overdue'
        AND (
          ? = 1
          OR EXISTS (
            SELECT 1
            FROM task_assignees
            WHERE task_assignees.task_instance_id = task_instances.id
              AND task_assignees.user_id = ?
          )
        )
      RETURNING id, title
    `
  )
    .bind(userId, now, now, taskId, isAdmin ? 1 : 0, userId)
    .first<{ id: number; title: string }>();

  if (!task) {
    return {
      status: "not_found_or_closed"
    };
  }

  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO completion_log (task_instance_id, user_id, action, created_at)
      VALUES (?, ?, 'missed', ?)
    `
  )
    .bind(task.id, userId, now)
    .run();

  return {
    status: "missed",
    title: task.title
  };
}

export async function cancelTaskForUser(
  env: Env,
  taskId: number,
  userId: number,
  now: string
): Promise<CancelTaskResult> {
  const task = await env.DB.prepare(
    `
      UPDATE task_instances
      SET status = 'cancelled',
        closed_by_user_id = ?,
        closed_at = ?,
        updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'overdue')
        AND EXISTS (
          SELECT 1
          FROM task_assignees
          WHERE task_assignees.task_instance_id = task_instances.id
            AND task_assignees.user_id = ?
        )
      RETURNING id, title
    `
  )
    .bind(userId, now, now, taskId, userId)
    .first<{ id: number; title: string }>();

  if (!task) {
    return {
      status: "not_found_or_closed"
    };
  }

  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO completion_log (task_instance_id, user_id, action, created_at)
      VALUES (?, ?, 'cancelled', ?)
    `
  )
    .bind(task.id, userId, now)
    .run();

  return {
    status: "cancelled",
    title: task.title
  };
}

export async function deleteTaskForUser(
  env: Env,
  taskId: number,
  userId: number,
  isAdmin: boolean,
  now: string
): Promise<DeleteTaskResult> {
  const task = await env.DB.prepare(
    `
      SELECT
        task_instances.id,
        task_instances.title,
        task_instances.reminder_rule_id,
        reminder_rules.schedule_type
      FROM task_instances
      LEFT JOIN reminder_rules
        ON reminder_rules.id = task_instances.reminder_rule_id
      WHERE task_instances.id = ?
        AND task_instances.status IN ('pending', 'overdue')
        AND (
          ? = 1
          OR EXISTS (
            SELECT 1
            FROM task_assignees
            WHERE task_assignees.task_instance_id = task_instances.id
              AND task_assignees.user_id = ?
          )
        )
      LIMIT 1
    `
  )
    .bind(taskId, isAdmin ? 1 : 0, userId)
    .first<{
      id: number;
      title: string;
      reminder_rule_id: number | null;
      schedule_type: string | null;
    }>();

  if (!task) {
    return {
      status: "not_found_or_closed"
    };
  }

  const isRecurring = task.schedule_type !== null && task.schedule_type !== "one_time";

  const closedTask = await env.DB.prepare(
    `
      UPDATE task_instances
      SET status = 'cancelled',
        closed_by_user_id = ?,
        closed_at = ?,
        updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'overdue')
      RETURNING id
    `
  )
    .bind(userId, now, now, task.id)
    .first<{ id: number }>();

  if (!closedTask) {
    return {
      status: "not_found_or_closed"
    };
  }

  if (isRecurring && task.reminder_rule_id !== null) {
    await env.DB.prepare(
      `
        UPDATE reminder_rules
        SET is_active = 0,
          updated_at = ?
        WHERE id = ?
          AND (
            ? = 1
            OR EXISTS (
              SELECT 1
              FROM reminder_rule_assignees
              WHERE reminder_rule_assignees.reminder_rule_id = reminder_rules.id
                AND reminder_rule_assignees.user_id = ?
            )
          )
      `
    )
      .bind(now, task.reminder_rule_id, isAdmin ? 1 : 0, userId)
      .run();
  }

  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO completion_log (task_instance_id, user_id, action, created_at)
      VALUES (?, ?, 'cancelled', ?)
    `
  )
    .bind(task.id, userId, now)
    .run();

  return {
    status: isRecurring ? "deleted_rule" : "deleted_instance",
    title: task.title
  };
}

export async function snoozeTaskForUser(
  env: Env,
  taskId: number,
  userId: number,
  now: string,
  snoozeMinutes: number
): Promise<SnoozeTaskResult> {
  const nextRemindAt = new Date(Date.parse(now) + snoozeMinutes * 60_000).toISOString();
  const task = await env.DB.prepare(
    `
      UPDATE task_instances
      SET next_remind_at = ?,
        updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'overdue')
        AND EXISTS (
          SELECT 1
          FROM task_assignees
          WHERE task_assignees.task_instance_id = task_instances.id
            AND task_assignees.user_id = ?
        )
      RETURNING id, title
    `
  )
    .bind(nextRemindAt, now, taskId, userId)
    .first<{ id: number; title: string }>();

  if (!task) {
    return {
      status: "not_found_or_closed"
    };
  }

  return {
    status: "snoozed",
    title: task.title,
    nextRemindAt
  };
}

async function markTaskMissed(env: Env, task: ActiveWeeklyTask, now: string): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE task_instances
      SET status = 'missed',
        closed_by_user_id = ?,
        closed_at = ?,
        updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'overdue')
    `
  )
    .bind(task.created_by_user_id, now, now, task.id)
    .run();

  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO completion_log (task_instance_id, user_id, action, created_at)
      VALUES (?, ?, 'missed', ?)
    `
  )
    .bind(task.id, task.created_by_user_id, now)
    .run();
}

function getMonthlyWindowForRule(rule: MonthlyReminderRule, now: string): MonthlyTaskWindow | null {
  const params = JSON.parse(rule.schedule_params_json) as {
    start_day?: number;
    end_day?: number;
    last_days?: number;
    first_days?: number;
    hour?: number;
    minute?: number;
  };

  if (typeof params.hour !== "number" || typeof params.minute !== "number") {
    return null;
  }

  if (
    rule.schedule_type === "monthly_fixed_window" &&
    typeof params.start_day === "number" &&
    typeof params.end_day === "number"
  ) {
    return getNextMonthlyFixedWindow(
      now,
      params.start_day,
      params.end_day,
      params.hour,
      params.minute,
      rule.timezone
    );
  }

  if (
    rule.schedule_type === "monthly_end_plus_start_window" &&
    typeof params.last_days === "number" &&
    typeof params.first_days === "number"
  ) {
    return getNextMonthlyEndPlusStartWindow(
      now,
      params.last_days,
      params.first_days,
      params.hour,
      params.minute,
      rule.timezone
    );
  }

  return null;
}

export async function generateWeeklyTaskInstances(env: Env, now: string): Promise<number> {
  const result = await env.DB.prepare(
    `
      SELECT
        id,
        created_by_user_id,
        title,
        schedule_params_json,
        timezone
      FROM reminder_rules
      WHERE schedule_type = 'weekly'
        AND is_active = 1
      LIMIT 20
    `
  )
    .all<WeeklyReminderRule>();

  let createdCount = 0;

  for (const rule of result.results ?? []) {
    const params = JSON.parse(rule.schedule_params_json) as {
      weekday?: number;
      hour?: number;
      minute?: number;
    };

    if (
      typeof params.weekday !== "number" ||
      typeof params.hour !== "number" ||
      typeof params.minute !== "number"
    ) {
      continue;
    }

    const assignees = await env.DB.prepare(
      `
        SELECT user_id
        FROM reminder_rule_assignees
        WHERE reminder_rule_id = ?
      `
    )
      .bind(rule.id)
      .all<{ user_id: number }>();
    const assigneeUserIds = (assignees.results ?? []).map((assignee) => assignee.user_id);

    if (assigneeUserIds.length === 0) {
      continue;
    }

    const activeTask = await env.DB.prepare(
      `
        SELECT id, created_by_user_id, period_start, due_at
        FROM task_instances
        WHERE reminder_rule_id = ?
          AND status IN ('pending', 'overdue')
        ORDER BY due_at DESC
        LIMIT 1
      `
    )
      .bind(rule.id)
      .first<ActiveWeeklyTask>();
    let window = getNextWeeklyTaskWindow(now, params.weekday, params.hour, params.minute, rule.timezone);

    if (activeTask) {
      const nextWindow = getNextWeeklyTaskWindowAfter(
        activeTask.period_start,
        params.weekday,
        params.hour,
        params.minute,
        rule.timezone
      );

      if (!nextWindow || Date.parse(nextWindow.availableFrom) > Date.parse(now)) {
        continue;
      }

      await markTaskMissed(env, activeTask, now);
      window = nextWindow;
    }

    if (!window) {
      continue;
    }

    const taskId = await createTaskInstance(env, {
      reminderRuleId: rule.id,
      createdByUserId: rule.created_by_user_id,
      title: rule.title,
      periodLabel: "еженедельно",
      periodStart: window.availableFrom,
      periodEnd: window.dueAt,
      availableFrom: window.availableFrom,
      dueAt: window.dueAt,
      nextRemindAt: window.remindAt,
      assigneeUserIds,
      now
    });

    if (taskId !== null) {
      createdCount += 1;
    }
  }

  return createdCount;
}

export async function generateMonthlyTaskInstances(env: Env, now: string): Promise<number> {
  const result = await env.DB.prepare(
    `
      SELECT
        id,
        created_by_user_id,
        title,
        schedule_type,
        schedule_params_json,
        timezone
      FROM reminder_rules
      WHERE schedule_type IN ('monthly_fixed_window', 'monthly_end_plus_start_window')
        AND is_active = 1
      LIMIT 20
    `
  )
    .all<MonthlyReminderRule>();

  let createdCount = 0;

  for (const rule of result.results ?? []) {
    const assignees = await env.DB.prepare(
      `
        SELECT user_id
        FROM reminder_rule_assignees
        WHERE reminder_rule_id = ?
      `
    )
      .bind(rule.id)
      .all<{ user_id: number }>();
    const assigneeUserIds = (assignees.results ?? []).map((assignee) => assignee.user_id);

    if (assigneeUserIds.length === 0) {
      continue;
    }

    const activeTask = await env.DB.prepare(
      `
        SELECT id, created_by_user_id, period_start, due_at
        FROM task_instances
        WHERE reminder_rule_id = ?
          AND status IN ('pending', 'overdue')
        ORDER BY due_at DESC
        LIMIT 1
      `
    )
      .bind(rule.id)
      .first<ActiveWeeklyTask>();
    let window = getMonthlyWindowForRule(rule, now);

    if (activeTask) {
      const afterActiveDueAt = new Date(Date.parse(activeTask.due_at) + 60_000).toISOString();
      const nextWindow = getMonthlyWindowForRule(rule, afterActiveDueAt);

      if (!nextWindow || Date.parse(nextWindow.availableFrom) > Date.parse(now)) {
        continue;
      }

      await markTaskMissed(env, activeTask, now);
      window = nextWindow;
    }

    if (!window) {
      continue;
    }

    const taskId = await createTaskInstance(env, {
      reminderRuleId: rule.id,
      createdByUserId: rule.created_by_user_id,
      title: rule.title,
      periodLabel: window.periodLabel,
      periodStart: window.availableFrom,
      periodEnd: window.dueAt,
      availableFrom: window.availableFrom,
      dueAt: window.dueAt,
      nextRemindAt: window.remindAt,
      assigneeUserIds,
      now
    });

    if (taskId !== null) {
      createdCount += 1;
    }
  }

  return createdCount;
}
