import type { Env } from "./env";

export const CREATE_ONE_TIME_TASK_SCENARIO = "create_one_time_task";
export const ADMIN_ADD_USER_SCENARIO = "admin_add_user";
export const EDIT_TASK_SCENARIO = "edit_task";
export const AI_CREATE_TASK_SCENARIO = "ai_create_task";

export interface UserSession {
  id: number;
  user_id: number;
  scenario: string;
  step: string;
  data_json: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOneTimeTaskSessionData {
  taskType?: "one_time" | "one_time_window" | "weekly" | "monthly";
  assigneeMode?: "self" | "all" | "selected";
  assigneeUserIds?: number[];
  title?: string;
  availableFrom?: string;
  dueAt?: string;
  dueDateDisplay?: string;
  windowDisplay?: string;
  hour?: number;
  minute?: number;
  weekday?: number;
  monthlyMode?: "fixed" | "end_plus_start" | "last_days";
  startDay?: number;
  endDay?: number;
  lastDays?: number;
  firstDays?: number;
}

export interface EditTaskSessionData {
  taskId: number;
  field?: "title" | "due_at" | "reminder_time" | "assignees" | "weekday" | "time" | "monthly_window";
  editMessageId?: number;
  assigneeUserIds?: number[];
  monthlyScheduleType?: "monthly_fixed_window" | "monthly_end_plus_start_window";
  startDay?: number;
  endDay?: number;
  lastDays?: number;
  firstDays?: number;
  availableFrom?: string;
  dueAt?: string;
  dueDateDisplay?: string;
  weekday?: number;
  hour?: number;
  minute?: number;
}

export type AiCreateTaskMissingField = "title" | "date" | "start_date" | "end_date" | "assignee_mode" | "reminder_time";

export interface AiCreateTaskSessionData {
  taskType?: "one_time" | "one_time_window";
  title?: string;
  assigneeMode?: "self" | "all" | "selected";
  assigneeUserIds?: number[];
  assigneeSelectionRequired?: boolean;
  date?: string;
  startDate?: string;
  endDate?: string;
  reminderTime?: string;
}

export function getSessionData<T extends object>(session: UserSession): T {
  return JSON.parse(session.data_json) as T;
}

export async function getActiveUserSession(env: Env, userId: number, now: string): Promise<UserSession | null> {
  return env.DB.prepare(
    `
      SELECT id, user_id, scenario, step, data_json, expires_at, created_at, updated_at
      FROM user_sessions
      WHERE user_id = ?
        AND expires_at > ?
      ORDER BY updated_at DESC
      LIMIT 1
    `
  )
    .bind(userId, now)
    .first<UserSession>();
}

export async function startCreateTaskSession(env: Env, userId: number, now: string): Promise<void> {
  const expiresAt = new Date(Date.parse(now) + 30 * 60_000).toISOString();

  await env.DB.prepare(
    `
      INSERT INTO user_sessions (user_id, scenario, step, data_json, expires_at, created_at, updated_at)
      VALUES (?, ?, 'task_type', '{}', ?, ?, ?)
      ON CONFLICT(user_id, scenario) DO UPDATE SET
        step = excluded.step,
        data_json = excluded.data_json,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `
  )
    .bind(userId, CREATE_ONE_TIME_TASK_SCENARIO, expiresAt, now, now)
    .run();
}

export async function startAdminAddUserSession(env: Env, userId: number, now: string): Promise<void> {
  const expiresAt = new Date(Date.parse(now) + 10 * 60_000).toISOString();

  await env.DB.prepare(
    `
      INSERT INTO user_sessions (user_id, scenario, step, data_json, expires_at, created_at, updated_at)
      VALUES (?, ?, 'telegram_id', '{}', ?, ?, ?)
      ON CONFLICT(user_id, scenario) DO UPDATE SET
        step = excluded.step,
        data_json = excluded.data_json,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `
  )
    .bind(userId, ADMIN_ADD_USER_SCENARIO, expiresAt, now, now)
    .run();
}

export async function startEditTaskSession(
  env: Env,
  userId: number,
  taskId: number,
  now: string,
  editMessageId?: number
): Promise<void> {
  const expiresAt = new Date(Date.parse(now) + 30 * 60_000).toISOString();

  await env.DB.prepare(
    `
      INSERT INTO user_sessions (user_id, scenario, step, data_json, expires_at, created_at, updated_at)
      VALUES (?, ?, 'field', ?, ?, ?, ?)
      ON CONFLICT(user_id, scenario) DO UPDATE SET
        step = excluded.step,
        data_json = excluded.data_json,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `
  )
    .bind(userId, EDIT_TASK_SCENARIO, JSON.stringify({ taskId, editMessageId }), expiresAt, now, now)
    .run();
}

export async function startAiCreateTaskSession(
  env: Env,
  userId: number,
  data: AiCreateTaskSessionData,
  now: string,
  step = "confirm"
): Promise<void> {
  const expiresAt = new Date(Date.parse(now) + 30 * 60_000).toISOString();

  await env.DB.prepare(
    `
      INSERT INTO user_sessions (user_id, scenario, step, data_json, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, scenario) DO UPDATE SET
        step = excluded.step,
        data_json = excluded.data_json,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `
  )
    .bind(userId, AI_CREATE_TASK_SCENARIO, step, JSON.stringify(data), expiresAt, now, now)
    .run();
}

export async function updateUserSession(
  env: Env,
  userId: number,
  scenario: string,
  step: string,
  data: object,
  now: string
): Promise<void> {
  const expiresAt = new Date(Date.parse(now) + 30 * 60_000).toISOString();

  await env.DB.prepare(
    `
      UPDATE user_sessions
      SET step = ?,
        data_json = ?,
        expires_at = ?,
        updated_at = ?
      WHERE user_id = ?
        AND scenario = ?
    `
  )
    .bind(step, JSON.stringify(data), expiresAt, now, userId, scenario)
    .run();
}

export async function clearUserSession(env: Env, userId: number, scenario: string): Promise<void> {
  await env.DB.prepare(
    `
      DELETE FROM user_sessions
      WHERE user_id = ?
        AND scenario = ?
    `
  )
    .bind(userId, scenario)
    .run();
}
