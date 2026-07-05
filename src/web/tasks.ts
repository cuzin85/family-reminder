import {
  completeTaskForUser,
  createMonthlyEndPlusStartTask,
  createMonthlyFixedTask,
  createOneTimeTask,
  createWeeklyTask,
  deleteTaskForUser,
  getActiveFamilyTasks,
  getActiveTasksForUser,
  getTaskHistoryForUser,
  getTaskDeletePreview,
  missTaskForUser,
  updateMonthlyTaskAssignees,
  updateMonthlyTaskSchedule,
  updateMonthlyTaskTitle,
  updateWeeklyTaskAssignees,
  updateWeeklyTaskSchedule,
  updateWeeklyTaskTitle,
  updateOneTimeTaskAssignees,
  updateOneTimeTaskDueAt,
  updateOneTimeTaskTitle,
  updateOneTimeTaskWindow,
  type CompleteTaskResult,
  type DeleteTaskResult,
  type MissTaskResult,
  type TaskDeletePreview,
  type TaskHistoryItem,
  type TaskListItem
} from "../tasks";
import { recordAuditEvent } from "../audit";
import { parseLocalDateTime, parseLocalTime } from "../dates";
import type { AuthenticatedWebUser } from "./auth";
import type { Env } from "../env";
import { apiErrorResponse, jsonResponse } from "../http";
import { getActiveUsers } from "../users";

type WebTaskStatus = TaskListItem["status"];
type HistoryScope = "family" | "my";
const HISTORY_DEFAULT_LIMIT = 10;
const HISTORY_MAX_LIMIT = 50;
const AUDIT_CHAIN_MAX_DEPTH = 20;
const AUDIT_MAX_EVENTS = 50;

interface WebTaskListItem {
  id: number;
  title: string;
  status: WebTaskStatus;
  scheduleType: string | null;
  periodLabel: string | null;
  ruleTimezone: string | null;
  isOneTimeWindow: boolean;
  availableFrom: string;
  dueAt: string;
  assigneeNames: string | null;
  assigneeIds: number[];
  reminderTime: string | null;
  weekday: number | null;
  monthlyStartDay: number | null;
  monthlyEndDay: number | null;
  monthlyLastDays: number | null;
  monthlyFirstDays: number | null;
  canAct: boolean;
}

interface WebTaskHistoryItem {
  id: number;
  title: string;
  status: TaskHistoryItem["status"];
  scheduleType: string | null;
  periodLabel: string | null;
  ruleTimezone: string | null;
  availableFrom: string;
  dueAt: string;
  closedAt: string | null;
  closedByName: string | null;
  assigneeNames: string | null;
}

interface WebTaskAuditItem {
  id: number;
  action: string;
  actorName: string | null;
  actorTelegramUserId: number | null;
  entityId: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface OneTimeTaskUpdateInput {
  title?: unknown;
  availableFrom?: unknown;
  dueAt?: unknown;
  reminderTime?: unknown;
  assigneeUserIds?: unknown;
}

interface OneTimeTaskCreateInput {
  title?: unknown;
  availableFrom?: unknown;
  dueAt?: unknown;
  reminderTime?: unknown;
  weekday?: unknown;
  startDay?: unknown;
  endDay?: unknown;
  lastDays?: unknown;
  firstDays?: unknown;
  assigneeUserIds?: unknown;
}

interface WeeklyTaskUpdateInput {
  title?: unknown;
  weekday?: unknown;
  reminderTime?: unknown;
  assigneeUserIds?: unknown;
  applyAssigneesToCurrent?: unknown;
}

interface MonthlyTaskUpdateInput {
  title?: unknown;
  scheduleType?: unknown;
  startDay?: unknown;
  endDay?: unknown;
  lastDays?: unknown;
  firstDays?: unknown;
  reminderTime?: unknown;
  assigneeUserIds?: unknown;
  applyAssigneesToCurrent?: unknown;
}

function toWebTask(task: TaskListItem): WebTaskListItem {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    scheduleType: task.schedule_type,
    periodLabel: task.period_label,
    ruleTimezone: task.rule_timezone,
    isOneTimeWindow: isOneTimeWindowTask(task),
    availableFrom: task.available_from,
    dueAt: task.due_at,
    assigneeNames: task.assignee_names,
    assigneeIds: parseAssigneeIds(task.assignee_ids),
    reminderTime: getReminderTime(task.schedule_params_json),
    weekday: getWeekday(task.schedule_params_json),
    monthlyStartDay: getNumberScheduleParam(task.schedule_params_json, "start_day"),
    monthlyEndDay: getNumberScheduleParam(task.schedule_params_json, "end_day"),
    monthlyLastDays: getNumberScheduleParam(task.schedule_params_json, "last_days"),
    monthlyFirstDays: getNumberScheduleParam(task.schedule_params_json, "first_days"),
    canAct: task.can_act === 1
  };
}

function isOneTimeWindowTask(task: TaskListItem): boolean {
  if (task.schedule_type !== "one_time") {
    return false;
  }

  const params = parseScheduleParams(task.schedule_params_json);

  return typeof params?.available_from === "string";
}

function parseScheduleParams(
  scheduleParamsJson: string | null
): {
  available_from?: unknown;
  due_at?: unknown;
  hour?: unknown;
  minute?: unknown;
  weekday?: unknown;
  start_day?: unknown;
  end_day?: unknown;
  last_days?: unknown;
  first_days?: unknown;
} | null {
  if (!scheduleParamsJson) {
    return null;
  }

  try {
    return JSON.parse(scheduleParamsJson) as {
      available_from?: unknown;
      due_at?: unknown;
      hour?: unknown;
      minute?: unknown;
      weekday?: unknown;
      start_day?: unknown;
      end_day?: unknown;
      last_days?: unknown;
      first_days?: unknown;
    };
  } catch {
    return null;
  }
}

function getReminderTime(scheduleParamsJson: string | null): string | null {
  const params = parseScheduleParams(scheduleParamsJson);

  if (
    !params ||
    typeof params.hour !== "number" ||
    typeof params.minute !== "number" ||
    params.hour < 0 ||
    params.hour > 23 ||
    params.minute < 0 ||
    params.minute > 59
  ) {
    return null;
  }

  return `${String(params.hour).padStart(2, "0")}:${String(params.minute).padStart(2, "0")}`;
}

function getWeekday(scheduleParamsJson: string | null): number | null {
  const params = parseScheduleParams(scheduleParamsJson);

  if (!params || typeof params.weekday !== "number" || params.weekday < 1 || params.weekday > 7) {
    return null;
  }

  return params.weekday;
}

function getNumberScheduleParam(
  scheduleParamsJson: string | null,
  key: "start_day" | "end_day" | "last_days" | "first_days"
): number | null {
  const params = parseScheduleParams(scheduleParamsJson);
  const value = params?.[key];

  return typeof value === "number" ? value : null;
}

function parseAssigneeIds(value: string | null): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => Number(item))
    .filter((item) => Number.isSafeInteger(item) && item > 0);
}

function toWebHistoryItem(task: TaskHistoryItem): WebTaskHistoryItem {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    scheduleType: task.schedule_type,
    periodLabel: task.period_label,
    ruleTimezone: task.rule_timezone,
    availableFrom: task.available_from,
    dueAt: task.due_at,
    closedAt: task.closed_at,
    closedByName: task.closed_by_name,
    assigneeNames: task.assignee_names
  };
}

function parseAuditMetadata(value: string): Record<string, unknown> {
  try {
    const metadata = JSON.parse(value) as unknown;

    return metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function getPreviousTaskIdFromEvents(events: WebTaskAuditItem[]): number | null {
  for (const event of events) {
    const previousTaskId = event.metadata.previousTaskId;

    if (typeof previousTaskId === "number" && Number.isSafeInteger(previousTaskId) && previousTaskId > 0) {
      return previousTaskId;
    }
  }

  return null;
}

async function getTaskScheduleParams(env: Env, taskId: number): Promise<ReturnType<typeof parseScheduleParams>> {
  const task = await env.DB.prepare(
    `
      SELECT rule.schedule_params_json
      FROM task_instances task
      LEFT JOIN reminder_rules rule ON rule.id = task.reminder_rule_id
      WHERE task.id = ?
      LIMIT 1
    `
  )
    .bind(taskId)
    .first<{ schedule_params_json: string | null }>();

  return parseScheduleParams(task?.schedule_params_json ?? null);
}

async function canViewTaskAudit(env: Env, user: AuthenticatedWebUser, taskId: number): Promise<boolean> {
  const result = await env.DB.prepare(
    `
      SELECT 1
      FROM task_instances task
      WHERE task.id = ?
        AND (
          ? = 1
          OR task.created_by_user_id = ?
          OR EXISTS (
            SELECT 1
            FROM task_assignees assignee
            WHERE assignee.task_instance_id = task.id
              AND assignee.user_id = ?
          )
        )
      LIMIT 1
    `
  )
    .bind(taskId, user.isAdmin ? 1 : 0, user.id, user.id)
    .first<{ "1": number }>();

  return Boolean(result);
}

export async function handleGetMyTasks(_env: Env, user: AuthenticatedWebUser): Promise<Response> {
  const tasks = await getActiveTasksForUser(_env, user.id);

  return jsonResponse({
    ok: true,
    tasks: tasks.map(toWebTask)
  });
}

export async function handleGetFamilyTasks(env: Env, user: AuthenticatedWebUser): Promise<Response> {
  const tasks = await getActiveFamilyTasks(env, user.id);

  return jsonResponse({
    ok: true,
    tasks: tasks.map(toWebTask)
  });
}

export async function handleGetTaskAudit(env: Env, user: AuthenticatedWebUser, taskId: number): Promise<Response> {
  const canView = await canViewTaskAudit(env, user, taskId);

  if (!canView) {
    return apiErrorResponse("not_found_or_forbidden", 404);
  }

  const events: WebTaskAuditItem[] = [];
  const visitedTaskIds = new Set<number>();
  let currentTaskId: number | null = taskId;

  for (let depth = 0; depth < AUDIT_CHAIN_MAX_DEPTH && currentTaskId && events.length < AUDIT_MAX_EVENTS; depth += 1) {
    if (visitedTaskIds.has(currentTaskId)) {
      break;
    }

    visitedTaskIds.add(currentTaskId);

    const result = await env.DB.prepare(
      `
        SELECT
          audit.id,
          audit.action,
          audit.entity_id,
          audit.metadata_json,
          audit.created_at,
          actor.telegram_user_id AS actor_telegram_user_id,
          COALESCE(actor.first_name, actor.username) AS actor_name
        FROM audit_log audit
        LEFT JOIN users actor ON actor.id = audit.actor_user_id
        WHERE audit.entity_type = 'task'
          AND audit.entity_id = ?
        ORDER BY audit.created_at DESC, audit.id DESC
        LIMIT ?
      `
    )
      .bind(currentTaskId, AUDIT_MAX_EVENTS - events.length)
      .all<{
        id: number;
        action: string;
        entity_id: number | null;
        metadata_json: string;
        created_at: string;
        actor_telegram_user_id: number | null;
        actor_name: string | null;
      }>();

    const currentEvents: WebTaskAuditItem[] = (result.results ?? []).map((item) => ({
      id: item.id,
      action: item.action,
      actorName: item.actor_name,
      actorTelegramUserId: item.actor_telegram_user_id,
      entityId: item.entity_id,
      metadata: parseAuditMetadata(item.metadata_json),
      createdAt: item.created_at
    }));

    events.push(...currentEvents);
    currentTaskId = getPreviousTaskIdFromEvents(currentEvents);
  }

  events.sort((left, right) => {
    const byDate = Date.parse(right.createdAt) - Date.parse(left.createdAt);

    return byDate === 0 ? right.id - left.id : byDate;
  });

  return jsonResponse({
    ok: true,
    events: events.slice(0, AUDIT_MAX_EVENTS)
  });
}

export async function handleGetTaskHistory(
  env: Env,
  user: AuthenticatedWebUser,
  scope: HistoryScope,
  input: { limit?: number; offset?: number } = {}
): Promise<Response> {
  const effectiveScope: HistoryScope = user.isAdmin ? scope : "my";
  const rawLimit = input.limit;
  const rawOffset = input.offset;
  const limit = typeof rawLimit === "number" && Number.isSafeInteger(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, HISTORY_MAX_LIMIT)
    : HISTORY_DEFAULT_LIMIT;
  const offset = typeof rawOffset === "number" && Number.isSafeInteger(rawOffset) && rawOffset > 0
    ? rawOffset
    : 0;
  const tasks = await getTaskHistoryForUser(env, user.id, effectiveScope === "family", limit + 1, offset);
  const visibleTasks = tasks.slice(0, limit);

  return jsonResponse({
    hasMore: tasks.length > limit,
    limit,
    offset,
    ok: true,
    scope: effectiveScope,
    tasks: visibleTasks.map(toWebHistoryItem)
  });
}

function getActionStatus(result: CompleteTaskResult | DeleteTaskResult | MissTaskResult): number {
  return result.status === "not_found_or_closed" ? 404 : 200;
}

export async function handleGetTaskDeletePreview(
  env: Env,
  user: AuthenticatedWebUser,
  taskId: number
): Promise<Response> {
  const preview: TaskDeletePreview = await getTaskDeletePreview(env, taskId, user.id, user.isAdmin);

  if (
    preview.status === "not_found_or_closed" ||
    typeof preview.title !== "string" ||
    typeof preview.isRecurring !== "boolean"
  ) {
    return apiErrorResponse("not_found_or_closed", 404);
  }

  return jsonResponse({
    ok: true,
    preview: {
      title: preview.title,
      isRecurring: preview.isRecurring
    }
  });
}

export async function handleCompleteTask(env: Env, user: AuthenticatedWebUser, taskId: number): Promise<Response> {
  const now = new Date().toISOString();
  const result = await completeTaskForUser(env, taskId, user.id, user.isAdmin, now);

  if (result.status !== "not_found_or_closed") {
    await recordAuditEvent(env, {
      actorUserId: user.id,
      action: "task.completed",
      entityType: "task",
      entityId: taskId,
      metadata: {
        source: "web",
        resultStatus: result.status
      },
      now
    });
  }

  return jsonResponse(
    {
      ok: result.status !== "not_found_or_closed",
      result
    },
    { status: getActionStatus(result) }
  );
}

export async function handleMissTask(env: Env, user: AuthenticatedWebUser, taskId: number): Promise<Response> {
  const now = new Date().toISOString();
  const result = await missTaskForUser(env, taskId, user.id, user.isAdmin, now);

  if (result.status !== "not_found_or_closed") {
    await recordAuditEvent(env, {
      actorUserId: user.id,
      action: "task.missed",
      entityType: "task",
      entityId: taskId,
      metadata: {
        source: "web"
      },
      now
    });
  }

  return jsonResponse(
    {
      ok: result.status !== "not_found_or_closed",
      result
    },
    { status: getActionStatus(result) }
  );
}

export async function handleDeleteTask(env: Env, user: AuthenticatedWebUser, taskId: number): Promise<Response> {
  const now = new Date().toISOString();
  const result = await deleteTaskForUser(env, taskId, user.id, user.isAdmin, now);

  if (result.status !== "not_found_or_closed") {
    await recordAuditEvent(env, {
      actorUserId: user.id,
      action: "task.deleted",
      entityType: "task",
      entityId: taskId,
      metadata: {
        source: "web",
        resultStatus: result.status
      },
      now
    });
  }

  return jsonResponse(
    {
      ok: result.status !== "not_found_or_closed",
      result
    },
    { status: getActionStatus(result) }
  );
}

function isValidTitle(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 120;
}

function parseAssigneeInput(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const ids = Array.from(new Set(value));

  if (
    ids.length === 0 ||
    ids.some((item) => typeof item !== "number" || !Number.isSafeInteger(item) || item <= 0)
  ) {
    return null;
  }

  return ids;
}

function parseReminderTime(value: unknown): { hour: number; minute: number } | null {
  if (typeof value !== "string") {
    return null;
  }

  const time = parseLocalTime(value);

  return time ? { hour: time.hour, minute: time.minute } : null;
}

function parseDayNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    return null;
  }

  return value;
}

function parseApplyAssigneesToCurrent(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
}

async function filterActiveAssigneeIds(env: Env, ids: number[]): Promise<number[]> {
  const activeUsers = await getActiveUsers(env);
  const activeUserIds = new Set(activeUsers.map((activeUser) => activeUser.id));

  return ids.filter((id) => activeUserIds.has(id));
}

export async function handleUpdateOneTimeTask(
  request: Request,
  env: Env,
  user: AuthenticatedWebUser,
  taskId: number
): Promise<Response> {
  const input = (await request.json()) as OneTimeTaskUpdateInput;
  const now = new Date().toISOString();
  let updated = false;
  const changedFields: string[] = [];

  if ("title" in input) {
    if (!isValidTitle(input.title)) {
      return apiErrorResponse("invalid_title", 400);
    }

    const result = await updateOneTimeTaskTitle(env, taskId, user.id, user.isAdmin, input.title.trim(), now);

    if (result.status !== "updated") {
      return apiErrorResponse("not_found_or_not_editable", 404);
    }

    updated = true;
    changedFields.push("title");
  }

  if ("dueAt" in input || "availableFrom" in input || "reminderTime" in input) {
    if (typeof input.dueAt !== "string") {
      return apiErrorResponse("invalid_due_at", 400);
    }

    if ("availableFrom" in input) {
      if (typeof input.availableFrom !== "string") {
        return apiErrorResponse("invalid_available_from", 400);
      }

      const currentScheduleParams = await getTaskScheduleParams(env, taskId);
      const availableFrom = parseLocalDateTime(`${input.availableFrom} 00:00`, user.timezone);
      const dueAt = parseLocalDateTime(`${input.dueAt} 23:59`, user.timezone);
      const reminderTime = parseReminderTime(input.reminderTime);

      if (!availableFrom || !dueAt || !reminderTime || Date.parse(availableFrom.iso) > Date.parse(dueAt.iso)) {
        return apiErrorResponse("invalid_window", 400);
      }

      if (Date.parse(dueAt.iso) <= Date.parse(now)) {
        return apiErrorResponse("due_at_in_past", 400);
      }

      const result = await updateOneTimeTaskWindow(
        env,
        taskId,
        user.id,
        user.isAdmin,
        {
          availableFrom: availableFrom.iso,
          dueAt: dueAt.iso,
          hour: reminderTime.hour,
          minute: reminderTime.minute,
          timezone: user.timezone
        },
        now
      );

      if (result.status !== "updated") {
        return apiErrorResponse("not_found_or_not_editable", 404);
      }

      updated = true;
      if (
        currentScheduleParams?.available_from !== availableFrom.iso ||
        currentScheduleParams?.due_at !== dueAt.iso
      ) {
        changedFields.push("window");
      }
      if (currentScheduleParams?.hour !== reminderTime.hour || currentScheduleParams?.minute !== reminderTime.minute) {
        changedFields.push("reminder_time");
      }
    } else {
      const dueAt = parseLocalDateTime(`${input.dueAt} 23:59`, user.timezone);
      const reminderTime = parseReminderTime(input.reminderTime);

      if (!dueAt || !reminderTime) {
        return apiErrorResponse("invalid_due_at", 400);
      }

      if (Date.parse(dueAt.iso) <= Date.parse(now)) {
        return apiErrorResponse("due_at_in_past", 400);
      }

      const currentScheduleParams = await getTaskScheduleParams(env, taskId);
      const result = await updateOneTimeTaskDueAt(
        env,
        taskId,
        user.id,
        user.isAdmin,
        dueAt.iso,
        reminderTime.hour,
        reminderTime.minute,
        user.timezone,
        now
      );

      if (result.status !== "updated") {
        return apiErrorResponse("not_found_or_not_editable", 404);
      }

      updated = true;
      if (currentScheduleParams?.due_at !== dueAt.iso) {
        changedFields.push("due_at");
      }
      if (currentScheduleParams?.hour !== reminderTime.hour || currentScheduleParams?.minute !== reminderTime.minute) {
        changedFields.push("reminder_time");
      }
    }
  }

  if ("assigneeUserIds" in input) {
    const assigneeUserIds = parseAssigneeInput(input.assigneeUserIds);

    if (!assigneeUserIds) {
      return apiErrorResponse("invalid_assignees", 400);
    }

    const activeAssigneeUserIds = await filterActiveAssigneeIds(env, assigneeUserIds);

    if (activeAssigneeUserIds.length === 0) {
      return apiErrorResponse("invalid_assignees", 400);
    }

    const result = await updateOneTimeTaskAssignees(env, taskId, user.id, user.isAdmin, activeAssigneeUserIds, now);

    if (result.status !== "updated") {
      return apiErrorResponse("not_found_or_not_editable", 404);
    }

    updated = true;
    changedFields.push("assignees");
  }

  if (!updated) {
    return apiErrorResponse("empty_update", 400);
  }

  await recordAuditEvent(env, {
    actorUserId: user.id,
    action: "task.updated",
    entityType: "task",
    entityId: taskId,
    metadata: {
      source: "web",
      taskType: "one_time",
      changedFields
    },
    now
  });

  return jsonResponse({ ok: true });
}

export async function handleCreateOneTimeTask(
  request: Request,
  env: Env,
  user: AuthenticatedWebUser
): Promise<Response> {
  const input = (await request.json()) as OneTimeTaskCreateInput;
  const now = new Date().toISOString();

  if (!isValidTitle(input.title)) {
    return apiErrorResponse("invalid_title", 400);
  }

  if (typeof input.dueAt !== "string") {
    return apiErrorResponse("invalid_due_at", 400);
  }

  const isWindow = "availableFrom" in input;
  const dueAt = parseLocalDateTime(`${input.dueAt} 23:59`, user.timezone);
  const reminderTime = parseReminderTime(input.reminderTime);

  if (!dueAt || !reminderTime) {
    return apiErrorResponse("invalid_due_at", 400);
  }

  if (Date.parse(dueAt.iso) <= Date.parse(now)) {
    return apiErrorResponse("due_at_in_past", 400);
  }

  let availableFromIso: string | undefined;

  if (isWindow) {
    if (typeof input.availableFrom !== "string") {
      return apiErrorResponse("invalid_available_from", 400);
    }

    const availableFrom = parseLocalDateTime(`${input.availableFrom} 00:00`, user.timezone);

    if (!availableFrom || !reminderTime || Date.parse(availableFrom.iso) > Date.parse(dueAt.iso)) {
      return apiErrorResponse("invalid_window", 400);
    }

    availableFromIso = availableFrom.iso;
  }

  const assigneeUserIds = parseAssigneeInput(input.assigneeUserIds);

  if (!assigneeUserIds) {
    return apiErrorResponse("invalid_assignees", 400);
  }

  const activeAssigneeUserIds = await filterActiveAssigneeIds(env, assigneeUserIds);

  if (activeAssigneeUserIds.length === 0) {
    return apiErrorResponse("invalid_assignees", 400);
  }

  const taskId = await createOneTimeTask(env, {
    userId: user.id,
    assigneeUserIds: activeAssigneeUserIds,
    title: input.title.trim(),
    availableFrom: availableFromIso,
    dueAt: dueAt.iso,
    reminderHour: reminderTime.hour,
    reminderMinute: reminderTime.minute,
    timezone: user.timezone,
    now
  });

  await recordAuditEvent(env, {
    actorUserId: user.id,
    action: "task.created",
    entityType: "task",
    entityId: taskId,
    metadata: {
      source: "web",
      taskType: isWindow ? "one_time_window" : "one_time",
      assigneeCount: activeAssigneeUserIds.length
    },
    now
  });

  return jsonResponse({ ok: true, taskId }, { status: 201 });
}

export async function handleCreateWeeklyTask(
  request: Request,
  env: Env,
  user: AuthenticatedWebUser
): Promise<Response> {
  const input = (await request.json()) as OneTimeTaskCreateInput;
  const now = new Date().toISOString();

  if (!isValidTitle(input.title)) {
    return apiErrorResponse("invalid_title", 400);
  }

  const reminderTime = parseReminderTime(input.reminderTime);

  if (
    typeof input.weekday !== "number" ||
    !Number.isSafeInteger(input.weekday) ||
    input.weekday < 1 ||
    input.weekday > 7 ||
    !reminderTime
  ) {
    return apiErrorResponse("invalid_schedule", 400);
  }

  const assigneeUserIds = parseAssigneeInput(input.assigneeUserIds);

  if (!assigneeUserIds) {
    return apiErrorResponse("invalid_assignees", 400);
  }

  const activeAssigneeUserIds = await filterActiveAssigneeIds(env, assigneeUserIds);

  if (activeAssigneeUserIds.length === 0) {
    return apiErrorResponse("invalid_assignees", 400);
  }

  const taskId = await createWeeklyTask(env, {
    userId: user.id,
    assigneeUserIds: activeAssigneeUserIds,
    title: input.title.trim(),
    weekday: input.weekday,
    hour: reminderTime.hour,
    minute: reminderTime.minute,
    timezone: user.timezone,
    now
  });

  await recordAuditEvent(env, {
    actorUserId: user.id,
    action: "task.created",
    entityType: "task",
    entityId: taskId,
    metadata: {
      source: "web",
      taskType: "weekly",
      assigneeCount: activeAssigneeUserIds.length
    },
    now
  });

  return jsonResponse({ ok: true, taskId }, { status: 201 });
}

export async function handleCreateMonthlyTask(
  request: Request,
  env: Env,
  user: AuthenticatedWebUser
): Promise<Response> {
  const input = (await request.json()) as OneTimeTaskCreateInput;
  const now = new Date().toISOString();

  if (!isValidTitle(input.title)) {
    return apiErrorResponse("invalid_title", 400);
  }

  const reminderTime = parseReminderTime(input.reminderTime);

  if (!reminderTime) {
    return apiErrorResponse("invalid_schedule", 400);
  }

  const assigneeUserIds = parseAssigneeInput(input.assigneeUserIds);

  if (!assigneeUserIds) {
    return apiErrorResponse("invalid_assignees", 400);
  }

  const activeAssigneeUserIds = await filterActiveAssigneeIds(env, assigneeUserIds);

  if (activeAssigneeUserIds.length === 0) {
    return apiErrorResponse("invalid_assignees", 400);
  }

  if ("startDay" in input || "endDay" in input) {
    const startDay = parseDayNumber(input.startDay, 1, 31);
    const endDay = parseDayNumber(input.endDay, 1, 31);

    if (startDay === null || endDay === null || startDay > endDay) {
      return apiErrorResponse("invalid_schedule", 400);
    }

    const taskId = await createMonthlyFixedTask(env, {
      userId: user.id,
      assigneeUserIds: activeAssigneeUserIds,
      title: input.title.trim(),
      startDay,
      endDay,
      hour: reminderTime.hour,
      minute: reminderTime.minute,
      timezone: user.timezone,
      now
    });

    await recordAuditEvent(env, {
      actorUserId: user.id,
      action: "task.created",
      entityType: "task",
      entityId: taskId,
      metadata: {
        source: "web",
        taskType: "monthly_fixed_window",
        assigneeCount: activeAssigneeUserIds.length
      },
      now
    });

    return jsonResponse({ ok: true, taskId }, { status: 201 });
  }

  const lastDays = parseDayNumber(input.lastDays, 1, 31);
  const firstDays = parseDayNumber(input.firstDays, 0, 31);

  if (lastDays === null || firstDays === null) {
    return apiErrorResponse("invalid_schedule", 400);
  }

  const taskId = await createMonthlyEndPlusStartTask(env, {
    userId: user.id,
    assigneeUserIds: activeAssigneeUserIds,
    title: input.title.trim(),
    lastDays,
    firstDays,
    hour: reminderTime.hour,
    minute: reminderTime.minute,
    timezone: user.timezone,
    now
  });

  await recordAuditEvent(env, {
    actorUserId: user.id,
    action: "task.created",
    entityType: "task",
    entityId: taskId,
    metadata: {
      source: "web",
      taskType: "monthly_end_plus_start_window",
      assigneeCount: activeAssigneeUserIds.length
    },
    now
  });

  return jsonResponse({ ok: true, taskId }, { status: 201 });
}

export async function handleUpdateWeeklyTask(
  request: Request,
  env: Env,
  user: AuthenticatedWebUser,
  taskId: number
): Promise<Response> {
  const input = (await request.json()) as WeeklyTaskUpdateInput;
  const now = new Date().toISOString();
  const hasScheduleUpdate = "weekday" in input || "reminderTime" in input;
  let auditTaskId = taskId;
  let previousTaskId: number | null = null;
  let updated = false;
  const changedFields: string[] = [];

  if ("title" in input) {
    if (!isValidTitle(input.title)) {
      return apiErrorResponse("invalid_title", 400);
    }

    const result = await updateWeeklyTaskTitle(env, taskId, user.id, user.isAdmin, input.title.trim(), now);

    if (result.status !== "updated") {
      return apiErrorResponse("not_found_or_not_editable", 404);
    }

    updated = true;
    changedFields.push("title");
  }

  if ("assigneeUserIds" in input && !hasScheduleUpdate) {
    const assigneeUserIds = parseAssigneeInput(input.assigneeUserIds);

    if (!assigneeUserIds) {
      return apiErrorResponse("invalid_assignees", 400);
    }

    const activeAssigneeUserIds = await filterActiveAssigneeIds(env, assigneeUserIds);

    if (activeAssigneeUserIds.length === 0) {
      return apiErrorResponse("invalid_assignees", 400);
    }

    const result = await updateWeeklyTaskAssignees(
      env,
      taskId,
      user.id,
      user.isAdmin,
      activeAssigneeUserIds,
      parseApplyAssigneesToCurrent(input.applyAssigneesToCurrent),
      now
    );

    if (result.status !== "updated") {
      return apiErrorResponse("not_found_or_not_editable", 404);
    }

    updated = true;
    changedFields.push("assignees");
  }

  if (hasScheduleUpdate) {
    const reminderTime = parseReminderTime(input.reminderTime);
    const currentScheduleParams = await getTaskScheduleParams(env, taskId);

    if (
      typeof input.weekday !== "number" ||
      !Number.isSafeInteger(input.weekday) ||
      input.weekday < 1 ||
      input.weekday > 7 ||
      !reminderTime
    ) {
      return apiErrorResponse("invalid_schedule", 400);
    }

    let activeAssigneeUserIds: number[] | undefined;

    if ("assigneeUserIds" in input) {
      const assigneeUserIds = parseAssigneeInput(input.assigneeUserIds);

      if (!assigneeUserIds) {
        return apiErrorResponse("invalid_assignees", 400);
      }

      activeAssigneeUserIds = await filterActiveAssigneeIds(env, assigneeUserIds);

      if (activeAssigneeUserIds.length === 0) {
        return apiErrorResponse("invalid_assignees", 400);
      }
    }

    const result = await updateWeeklyTaskSchedule(
      env,
      taskId,
      user.id,
      user.isAdmin,
      input.weekday,
      reminderTime.hour,
      reminderTime.minute,
      now,
      activeAssigneeUserIds
    );

    if (result.status !== "updated") {
      return result.status === "invalid_schedule"
        ? apiErrorResponse("invalid_schedule", 400)
        : apiErrorResponse("not_found_or_not_editable", 404);
    }

    updated = true;
    if (currentScheduleParams?.weekday !== input.weekday) {
      changedFields.push("weekday");
    }
    if (currentScheduleParams?.hour !== reminderTime.hour || currentScheduleParams?.minute !== reminderTime.minute) {
      changedFields.push("reminder_time");
    }
    if (result.newTaskId) {
      previousTaskId = taskId;
      auditTaskId = result.newTaskId;
    }
    if (activeAssigneeUserIds) {
      changedFields.push("assignees");
    }
  }

  if (!updated) {
    return apiErrorResponse("empty_update", 400);
  }

  await recordAuditEvent(env, {
    actorUserId: user.id,
    action: "task.updated",
    entityType: "task",
    entityId: auditTaskId,
    metadata: {
      source: "web",
      taskType: "weekly",
      changedFields,
      previousTaskId
    },
    now
  });

  return jsonResponse({ ok: true });
}

export async function handleUpdateMonthlyTask(
  request: Request,
  env: Env,
  user: AuthenticatedWebUser,
  taskId: number
): Promise<Response> {
  const input = (await request.json()) as MonthlyTaskUpdateInput;
  const now = new Date().toISOString();
  const hasScheduleUpdate = "scheduleType" in input || "reminderTime" in input;
  let auditTaskId = taskId;
  let previousTaskId: number | null = null;
  let updated = false;
  const changedFields: string[] = [];

  if ("title" in input) {
    if (!isValidTitle(input.title)) {
      return apiErrorResponse("invalid_title", 400);
    }

    const result = await updateMonthlyTaskTitle(env, taskId, user.id, user.isAdmin, input.title.trim(), now);

    if (result.status !== "updated") {
      return apiErrorResponse("not_found_or_not_editable", 404);
    }

    updated = true;
    changedFields.push("title");
  }

  if ("assigneeUserIds" in input && !hasScheduleUpdate) {
    const assigneeUserIds = parseAssigneeInput(input.assigneeUserIds);

    if (!assigneeUserIds) {
      return apiErrorResponse("invalid_assignees", 400);
    }

    const activeAssigneeUserIds = await filterActiveAssigneeIds(env, assigneeUserIds);

    if (activeAssigneeUserIds.length === 0) {
      return apiErrorResponse("invalid_assignees", 400);
    }

    const result = await updateMonthlyTaskAssignees(
      env,
      taskId,
      user.id,
      user.isAdmin,
      activeAssigneeUserIds,
      parseApplyAssigneesToCurrent(input.applyAssigneesToCurrent),
      now
    );

    if (result.status !== "updated") {
      return apiErrorResponse("not_found_or_not_editable", 404);
    }

    updated = true;
    changedFields.push("assignees");
  }

  if (hasScheduleUpdate) {
    const reminderTime = parseReminderTime(input.reminderTime);
    const currentScheduleParams = await getTaskScheduleParams(env, taskId);

    if (
      (input.scheduleType !== "monthly_fixed_window" && input.scheduleType !== "monthly_end_plus_start_window") ||
      !reminderTime
    ) {
      return apiErrorResponse("invalid_schedule", 400);
    }

    let activeAssigneeUserIds: number[] | undefined;

    if ("assigneeUserIds" in input) {
      const assigneeUserIds = parseAssigneeInput(input.assigneeUserIds);

      if (!assigneeUserIds) {
        return apiErrorResponse("invalid_assignees", 400);
      }

      activeAssigneeUserIds = await filterActiveAssigneeIds(env, assigneeUserIds);

      if (activeAssigneeUserIds.length === 0) {
        return apiErrorResponse("invalid_assignees", 400);
      }
    }

    const result = input.scheduleType === "monthly_fixed_window"
      ? await (async () => {
        const startDay = parseDayNumber(input.startDay, 1, 31);
        const endDay = parseDayNumber(input.endDay, 1, 31);

        if (startDay === null || endDay === null || startDay > endDay) {
          return { status: "invalid_schedule" as const };
        }

        return updateMonthlyTaskSchedule(
          env,
          taskId,
          user.id,
          user.isAdmin,
          {
            scheduleType: "monthly_fixed_window",
            startDay,
            endDay,
            hour: reminderTime.hour,
            minute: reminderTime.minute
          },
          now,
          activeAssigneeUserIds
        );
      })()
      : await (async () => {
        const lastDays = parseDayNumber(input.lastDays, 1, 31);
        const firstDays = parseDayNumber(input.firstDays, 0, 31);

        if (lastDays === null || firstDays === null) {
          return { status: "invalid_schedule" as const };
        }

        return updateMonthlyTaskSchedule(
          env,
          taskId,
          user.id,
          user.isAdmin,
          {
            scheduleType: "monthly_end_plus_start_window",
            lastDays,
            firstDays,
            hour: reminderTime.hour,
            minute: reminderTime.minute
          },
          now,
          activeAssigneeUserIds
        );
      })();

    if (result.status !== "updated") {
      return result.status === "invalid_schedule"
        ? apiErrorResponse("invalid_schedule", 400)
        : apiErrorResponse("not_found_or_not_editable", 404);
    }

    updated = true;
    if (
      input.scheduleType === "monthly_fixed_window" &&
      (
        currentScheduleParams?.start_day !== input.startDay ||
        currentScheduleParams?.end_day !== input.endDay
      )
    ) {
      changedFields.push("window");
    }
    if (
      input.scheduleType === "monthly_end_plus_start_window" &&
      (
        currentScheduleParams?.last_days !== input.lastDays ||
        currentScheduleParams?.first_days !== input.firstDays
      )
    ) {
      changedFields.push("window");
    }
    if (currentScheduleParams?.hour !== reminderTime.hour || currentScheduleParams?.minute !== reminderTime.minute) {
      changedFields.push("reminder_time");
    }
    if (result.newTaskId) {
      previousTaskId = taskId;
      auditTaskId = result.newTaskId;
    }
    if (activeAssigneeUserIds) {
      changedFields.push("assignees");
    }
  }

  if (!updated) {
    return apiErrorResponse("empty_update", 400);
  }

  await recordAuditEvent(env, {
    actorUserId: user.id,
    action: "task.updated",
    entityType: "task",
    entityId: auditTaskId,
    metadata: {
      source: "web",
      taskType: "monthly",
      changedFields,
      previousTaskId
    },
    now
  });

  return jsonResponse({ ok: true });
}
