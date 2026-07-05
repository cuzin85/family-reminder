import { getAppLabels, type AppLabels } from "../../src/i18n";

export interface CurrentUser {
  id: number;
  telegramUserId: number;
  displayName: string;
  timezone: string;
  isAdmin: boolean;
}

export interface AppConfig {
  appLocale: "en" | "ru";
  telegramBotUsername: string;
}

export interface TaskListItem {
  id: number;
  title: string;
  status: "pending" | "overdue" | "done" | "done_late" | "missed" | "cancelled";
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

export interface TaskHistoryItem {
  id: number;
  title: string;
  status: "done" | "done_late" | "missed" | "cancelled";
  scheduleType: string | null;
  periodLabel: string | null;
  ruleTimezone: string | null;
  availableFrom: string;
  dueAt: string;
  closedAt: string | null;
  closedByName: string | null;
  assigneeNames: string | null;
}

export type HistoryScope = "family" | "my";

export interface TaskDeletePreview {
  title: string;
  isRecurring: boolean;
}

export interface TaskAuditItem {
  id: number;
  action: string;
  actorName: string | null;
  actorTelegramUserId: number | null;
  entityId: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TaskHistoryPage {
  hasMore: boolean;
  limit: number;
  offset: number;
  tasks: TaskHistoryItem[];
}

export interface UserListItem {
  id: number;
  telegramUserId: number;
  telegramChatId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  timezone: string;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceCleanupPreview {
  notificationLog: {
    count: number;
    cutoff: string;
    retentionDays: number;
  };
  telegramMessageRefs: {
    count: number;
    cutoff: string;
    retentionDays: number;
  };
}

export interface MaintenanceCleanupResult {
  notificationLog: {
    cutoff: string;
    deleted: number;
    retentionDays: number;
  };
  telegramMessageRefs: {
    cutoff: string;
    deleted: number;
    retentionDays: number;
  };
}

export interface OneTimeTaskUpdate {
  title?: string;
  availableFrom?: string;
  dueAt?: string;
  reminderTime?: string;
  assigneeUserIds?: number[];
}

export interface TaskCreateInput {
  title: string;
  taskType?: "monthly" | "one_time" | "weekly";
  availableFrom?: string;
  dueAt: string;
  reminderTime?: string;
  weekday?: number;
  startDay?: number;
  endDay?: number;
  lastDays?: number;
  firstDays?: number;
  assigneeUserIds: number[];
}

export interface WeeklyTaskUpdate {
  title?: string;
  weekday?: number;
  reminderTime?: string;
  assigneeUserIds?: number[];
  applyAssigneesToCurrent?: boolean;
}

export interface MonthlyTaskUpdate {
  title?: string;
  scheduleType?: "monthly_fixed_window" | "monthly_end_plus_start_window";
  startDay?: number;
  endDay?: number;
  lastDays?: number;
  firstDays?: number;
  reminderTime?: string;
  assigneeUserIds?: number[];
  applyAssigneesToCurrent?: boolean;
}

let apiLabels = getAppLabels("ru");

export function setApiLabels(labels: AppLabels): void {
  apiLabels = labels;
}

async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };

    if (typeof payload.error === "string") {
      return apiLabels.api.errors[payload.error] ?? fallback;
    }
  } catch {
    // Fall through to fallback for non-JSON responses.
  }

  return fallback;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const response = await fetch("/api/me", {
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.getCurrentUserFailed);
  }

  const payload = (await response.json()) as { ok: boolean; user?: CurrentUser };

  if (!payload.ok || !payload.user) {
    throw new Error(apiLabels.api.fallbacks.badResponse);
  }

  return payload.user;
}

export async function getAppConfig(): Promise<AppConfig> {
  const response = await fetch("/api/config", {
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.configFailed);
  }

  const payload = (await response.json()) as { config?: AppConfig; ok: boolean };

  if (!payload.ok || !payload.config?.telegramBotUsername) {
    throw new Error(apiLabels.api.fallbacks.badResponse);
  }

  return payload.config;
}

export async function updateCurrentUserTimezone(timezone: string): Promise<CurrentUser> {
  const response = await fetch("/api/me/timezone", {
    method: "PATCH",
    credentials: "include",
    headers: {
      "accept": "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({ timezone })
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, apiLabels.api.fallbacks.updateTimezoneFailed));
  }

  const payload = (await response.json()) as { ok: boolean; user?: CurrentUser };

  if (!payload.ok || !payload.user) {
    throw new Error(apiLabels.api.fallbacks.badResponse);
  }

  return payload.user;
}

async function getTasks(path: string): Promise<TaskListItem[]> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.getTasksFailed);
  }

  const payload = (await response.json()) as { ok: boolean; tasks?: TaskListItem[] };

  if (!payload.ok || !payload.tasks) {
    throw new Error(apiLabels.api.fallbacks.badResponse);
  }

  return payload.tasks;
}

export function getMyTasks(): Promise<TaskListItem[]> {
  return getTasks("/api/tasks/my");
}

export function getFamilyTasks(): Promise<TaskListItem[]> {
  return getTasks("/api/tasks/family");
}

export async function getTaskAudit(taskId: number): Promise<TaskAuditItem[]> {
  const response = await fetch(`/api/tasks/${taskId}/audit`, {
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.getAuditFailed);
  }

  const payload = (await response.json()) as { events?: TaskAuditItem[]; ok: boolean };

  if (!payload.ok || !payload.events) {
    throw new Error(apiLabels.api.fallbacks.badResponse);
  }

  return payload.events;
}

export async function getTaskHistory(scope: HistoryScope, limit: number, offset: number): Promise<TaskHistoryPage> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    scope
  });
  const response = await fetch(`/api/tasks/history?${params.toString()}`, {
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.getHistoryFailed);
  }

  const payload = (await response.json()) as {
    hasMore?: boolean;
    limit?: number;
    offset?: number;
    ok: boolean;
    tasks?: TaskHistoryItem[];
  };

  if (
    !payload.ok ||
    !payload.tasks ||
    typeof payload.hasMore !== "boolean" ||
    typeof payload.limit !== "number" ||
    typeof payload.offset !== "number"
  ) {
    throw new Error(apiLabels.api.fallbacks.badResponse);
  }

  return {
    hasMore: payload.hasMore,
    limit: payload.limit,
    offset: payload.offset,
    tasks: payload.tasks
  };
}

export async function getUsers(): Promise<UserListItem[]> {
  const response = await fetch("/api/users", {
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.getUsersFailed);
  }

  const payload = (await response.json()) as { ok: boolean; users?: UserListItem[] };

  if (!payload.ok || !payload.users) {
    throw new Error(apiLabels.api.fallbacks.badResponse);
  }

  return payload.users;
}

export async function addUser(telegramUserId: number): Promise<void> {
  const response = await fetch("/api/users", {
    method: "POST",
    credentials: "include",
    headers: {
      "accept": "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({ telegramUserId })
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.addUserFailed);
  }
}

export async function deactivateUser(userId: number): Promise<void> {
  const response = await fetch(`/api/users/${userId}/deactivate`, {
    method: "POST",
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.deactivateUserFailed);
  }
}

function getAttachmentFilename(disposition: string | null): string | null {
  if (!disposition) {
    return null;
  }

  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);

  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1].replaceAll("\"", ""));
  }

  const match = /filename="?([^";]+)"?/i.exec(disposition);

  return match?.[1] ?? null;
}

export async function downloadAdminExport(): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch("/api/admin/export", {
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.exportFailed);
  }

  return {
    blob: await response.blob(),
    filename: getAttachmentFilename(response.headers.get("content-disposition")) ?? "family-reminder-export.json"
  };
}

export async function getMaintenanceCleanupPreview(): Promise<MaintenanceCleanupPreview> {
  const response = await fetch("/api/admin/maintenance/cleanup-preview", {
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.cleanupPreviewFailed);
  }

  const payload = (await response.json()) as { ok: boolean; preview?: MaintenanceCleanupPreview };

  if (!payload.ok || !payload.preview) {
    throw new Error(apiLabels.api.fallbacks.badResponse);
  }

  return payload.preview;
}

export async function runMaintenanceCleanup(): Promise<MaintenanceCleanupResult> {
  const response = await fetch("/api/admin/maintenance/cleanup", {
    method: "POST",
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.runCleanupFailed);
  }

  const payload = (await response.json()) as { ok: boolean; result?: MaintenanceCleanupResult };

  if (!payload.ok || !payload.result) {
    throw new Error(apiLabels.api.fallbacks.badResponse);
  }

  return payload.result;
}

export async function getAssignees(): Promise<UserListItem[]> {
  const response = await fetch("/api/assignees", {
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.getAssigneesFailed);
  }

  const payload = (await response.json()) as { ok: boolean; users?: UserListItem[] };

  if (!payload.ok || !payload.users) {
    throw new Error(apiLabels.api.fallbacks.badResponse);
  }

  return payload.users;
}

export async function updateOneTimeTask(taskId: number, input: OneTimeTaskUpdate): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/one-time`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "accept": "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, apiLabels.api.fallbacks.updateTaskFailed));
  }
}

export async function createTask(input: TaskCreateInput): Promise<void> {
  const path = input.taskType === "weekly"
    ? "/api/tasks/weekly"
    : input.taskType === "monthly"
      ? "/api/tasks/monthly"
      : "/api/tasks/one-time";
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      "accept": "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, apiLabels.api.fallbacks.createTaskFailed));
  }
}

export async function updateWeeklyTask(taskId: number, input: WeeklyTaskUpdate): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/weekly`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "accept": "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.weeklyUpdateFailed);
  }
}

export async function updateMonthlyTask(taskId: number, input: MonthlyTaskUpdate): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/monthly`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "accept": "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.monthlyUpdateFailed);
  }
}

export async function getTaskDeletePreview(taskId: number): Promise<TaskDeletePreview> {
  const response = await fetch(`/api/tasks/${taskId}/delete-preview`, {
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.deletePreviewFailed);
  }

  const payload = (await response.json()) as { ok: boolean; preview?: TaskDeletePreview };

  if (!payload.ok || !payload.preview) {
    throw new Error(apiLabels.api.fallbacks.badResponse);
  }

  return payload.preview;
}

export async function deleteTask(taskId: number): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.deleteTaskFailed);
  }
}

async function postTaskAction(taskId: number, action: "complete" | "miss"): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/${action}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(apiLabels.api.fallbacks.actionFailed);
  }
}

export function completeTask(taskId: number): Promise<void> {
  return postTaskAction(taskId, "complete");
}

export function missTask(taskId: number): Promise<void> {
  return postTaskAction(taskId, "miss");
}
