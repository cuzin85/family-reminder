import { getAppConfig } from "../config";
import { recordAuditEvent } from "../audit";
import { getAppLabels, type AppLabels } from "../i18n";
import {
  formatDateInTimeZone,
  formatDateTimeInTimeZone,
  getNextWeeklyTaskWindow,
  getWeekdayName,
  normalizeIanaTimezone,
  parseLocalDateTime,
  parseLocalTime
} from "../dates";
import type { Env } from "../env";
import { jsonResponse } from "../http";
import {
  ADMIN_ADD_USER_SCENARIO,
  CREATE_ONE_TIME_TASK_SCENARIO,
  EDIT_TASK_SCENARIO,
  clearUserSession,
  getActiveUserSession,
  getSessionData,
  startAdminAddUserSession,
  startCreateTaskSession,
  startEditTaskSession,
  updateUserSession,
  type CreateOneTimeTaskSessionData,
  type EditTaskSessionData,
  type UserSession
} from "../sessions";
import {
  cancelTaskForUser,
  completeTaskForUser,
  createMonthlyEndPlusStartTask,
  createMonthlyFixedTask,
  createOneTimeTask,
  createWeeklyTask,
  deleteTaskForUser,
  getActiveTaskForViewer,
  getEditableTaskForUser,
  getActiveTaskForUser,
  getActiveFamilyTasks,
  getActiveTasksForUser,
  getTaskAssigneeUserIds,
  getTaskDeletePreview,
  missTaskForUser,
  snoozeTaskForUser,
  updateMonthlyTaskAssignees,
  updateMonthlyTaskSchedule,
  updateMonthlyTaskTitle,
  updateOneTimeTaskAssignees,
  updateOneTimeTaskDueAt,
  updateOneTimeTaskTitle,
  updateOneTimeTaskWindow,
  updateWeeklyTaskAssignees,
  updateWeeklyTaskSchedule,
  updateWeeklyTaskTitle
} from "../tasks";
import {
  addUserByTelegramId,
  deactivateUserById,
  getActiveUsers,
  getAllUsers,
  getUserByTelegramId,
  upsertTelegramUser
} from "../users";
import {
  answerCallbackQuery,
  deleteTelegramMessage,
  editTelegramMessageText,
  sendTelegramMessage
} from "./client";
import { ADMIN_MAIN_MENU_KEYBOARD, MAIN_MENU_KEYBOARD, buildAdminMainMenuKeyboard, buildMainMenuKeyboard } from "./menu";
import type { InlineKeyboardMarkup, TelegramUpdate } from "./types";
import { getTelegramCallbackData, getTelegramUpdateContext, getTelegramUpdateText } from "./update";

function validateTelegramWebhookSecret(request: Request, env: Env): boolean {
  return request.headers.get("x-telegram-bot-api-secret-token") === env.TELEGRAM_WEBHOOK_SECRET;
}

type TelegramTaskListItem = Awaited<ReturnType<typeof getActiveTasksForUser>>[number];

function buildAdminAddUserKeyboard(labels: AppLabels): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: labels.telegram.buttons.cancel, callback_data: "admin:users:add:cancel" }]
    ]
  };
}

function buildEditCancelKeyboard(labels: AppLabels): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: labels.telegram.buttons.cancel, callback_data: "task:edit:cancel" }]
    ]
  };
}

function buildCreateCancelKeyboard(labels: AppLabels): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: labels.telegram.buttons.cancel, callback_data: "task:create:cancel" }]
    ]
  };
}

function buildTaskTypeKeyboard(labels: AppLabels): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: labels.telegram.taskTypes.oneTime, callback_data: "task:create:type:one_time" }],
      [{ text: labels.telegram.taskTypes.oneTimeWindow, callback_data: "task:create:type:one_time_window" }],
      [{ text: labels.telegram.taskTypes.weekly, callback_data: "task:create:type:weekly" }],
      [{ text: labels.telegram.taskTypes.monthly, callback_data: "task:create:type:monthly" }],
      [{ text: labels.telegram.buttons.cancel, callback_data: "task:create:cancel" }]
    ]
  };
}

function buildAssigneeModeKeyboard(labels: AppLabels): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: labels.telegram.assigneeModes.self, callback_data: "task:create:assignees:self" }],
      [{ text: labels.telegram.assigneeModes.all, callback_data: "task:create:assignees:all" }],
      [{ text: labels.telegram.assigneeModes.selected, callback_data: "task:create:assignees:selected" }],
      [{ text: labels.telegram.buttons.cancel, callback_data: "task:create:cancel" }]
    ]
  };
}

function buildMonthlyModeKeyboard(labels: AppLabels): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: labels.telegram.monthlyModes.fixed, callback_data: "task:create:monthly_mode:fixed" }],
      [{ text: labels.telegram.monthlyModes.lastDays, callback_data: "task:create:monthly_mode:last_days" }],
      [{ text: labels.telegram.monthlyModes.endPlusStart, callback_data: "task:create:monthly_mode:end_plus_start" }],
      [{ text: labels.telegram.buttons.cancel, callback_data: "task:create:cancel" }]
    ]
  };
}

function buildWeekdayKeyboard(labels: AppLabels): InlineKeyboardMarkup {
  const weekdays = labels.telegram.weekdaysShort;

  return {
    inline_keyboard: [
      [
        { text: weekdays[0] ?? "1", callback_data: "task:create:weekday:1" },
        { text: weekdays[1] ?? "2", callback_data: "task:create:weekday:2" },
        { text: weekdays[2] ?? "3", callback_data: "task:create:weekday:3" },
        { text: weekdays[3] ?? "4", callback_data: "task:create:weekday:4" }
      ],
      [
        { text: weekdays[4] ?? "5", callback_data: "task:create:weekday:5" },
        { text: weekdays[5] ?? "6", callback_data: "task:create:weekday:6" },
        { text: weekdays[6] ?? "7", callback_data: "task:create:weekday:7" }
      ],
      [{ text: labels.telegram.buttons.cancel, callback_data: "task:create:cancel" }]
    ]
  };
}

function getLocalizedWeekdayName(weekday: number, labels: AppLabels): string {
  return labels.telegram.weekdaysShort[weekday - 1] ?? getWeekdayName(weekday);
}

function getMainMenuKeyboard(isAdmin: boolean, labels?: AppLabels): InlineKeyboardMarkup {
  if (!labels) {
    return isAdmin ? ADMIN_MAIN_MENU_KEYBOARD : MAIN_MENU_KEYBOARD;
  }

  return isAdmin ? buildAdminMainMenuKeyboard(labels) : buildMainMenuKeyboard(labels);
}

function formatUserName(user: {
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
}): string {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  if (user.username) {
    return `@${user.username}`;
  }

  return `ID ${user.telegram_user_id}`;
}

function buildAdminUsersText(users: Awaited<ReturnType<typeof getAllUsers>>, labels: AppLabels): string {
  if (users.length === 0) {
    return labels.telegram.adminUsers.empty;
  }

  const lines = users.map((user) => {
    const status = user.is_active === 1 ? labels.telegram.adminUsers.statusActive : labels.telegram.adminUsers.statusDisabled;
    const role = user.is_admin === 1 ? labels.telegram.adminUsers.userAdminRole : "";

    return `${formatUserName(user)}\nID: ${user.telegram_user_id}\n${labels.telegram.adminUsers.statusLabel}: ${status}${role}`;
  });

  return `${labels.telegram.adminUsers.title(users.length)}\n\n${lines.join("\n\n")}`;
}

function buildAdminUsersKeyboard(users: Awaited<ReturnType<typeof getAllUsers>>, labels: AppLabels): InlineKeyboardMarkup {
  const disableButtons = users
    .filter((user) => user.is_active === 1 && user.is_admin !== 1)
    .map((user) => [
      {
        text: labels.telegram.adminUsers.deactivate(formatUserName(user)),
        callback_data: `admin:users:disable:${user.id}`
      }
    ]);

  return {
    inline_keyboard: [
      [{ text: labels.telegram.adminUsers.addButton, callback_data: "admin:users:add" }],
      ...disableButtons,
      ...buildAdminMainMenuKeyboard(labels).inline_keyboard
    ]
  };
}

function buildTaskCardKeyboard(task: TelegramTaskListItem, isAdmin: boolean, labels: AppLabels): InlineKeyboardMarkup | undefined {
  const canAct = task.can_act === 1;
  const canClose = canAct || isAdmin;
  const canDelete = canAct || isAdmin;
  const canEdit = (canAct || isAdmin) && (
    task.schedule_type === "one_time" ||
    task.schedule_type === "weekly" ||
    task.schedule_type === "monthly_fixed_window" ||
    task.schedule_type === "monthly_end_plus_start_window"
  );

  if (!canClose && !canEdit && !canDelete) {
    return undefined;
  }

  const taskButtons: InlineKeyboardMarkup["inline_keyboard"] = [];

  if (canClose && task.status === "overdue") {
    taskButtons.push([
      {
        text: labels.telegram.buttons.done,
        callback_data: `task:done:${task.id}`
      },
      {
        text: labels.telegram.buttons.missed,
        callback_data: `task:miss:${task.id}`
      }
    ]);

    const manageRow = [];

    if (canEdit) {
      manageRow.push({
        text: labels.telegram.buttons.edit,
        callback_data: `task:edit:${task.id}`
      });
    }

    if (canDelete) {
      manageRow.push({
        text: labels.telegram.buttons.deleteTask,
        callback_data: `task:delete:ask:${task.id}`
      });
    }

    if (manageRow.length > 0) {
      taskButtons.push(manageRow);
    }
  } else if (canClose) {
    const row = [
      {
        text: labels.telegram.buttons.done,
        callback_data: `task:done:${task.id}`
      }
    ];

    if (canEdit) {
      row.push({
        text: labels.telegram.buttons.edit,
        callback_data: `task:edit:${task.id}`
      });
    }

    taskButtons.push(row);
  } else if (canEdit) {
    taskButtons.push([{ text: labels.telegram.buttons.edit, callback_data: `task:edit:${task.id}` }]);
  }

  if (canDelete && task.status !== "overdue") {
    taskButtons.push([
      {
        text: labels.telegram.buttons.deleteTask,
        callback_data: `task:delete:ask:${task.id}`
      }
    ]);
  }

  return {
    inline_keyboard: taskButtons
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getReminderTimeFromTask(task: { schedule_params_json: string | null }): string | null {
  if (!task.schedule_params_json) {
    return null;
  }

  try {
    const params = JSON.parse(task.schedule_params_json) as { hour?: number; minute?: number };

    return typeof params.hour === "number" && typeof params.minute === "number"
      ? `${String(params.hour).padStart(2, "0")}:${String(params.minute).padStart(2, "0")}`
      : null;
  } catch {
    return null;
  }
}

function buildTaskCardText(task: TelegramTaskListItem, timezone: string, labels: AppLabels): string {
  const ruleTimezone = normalizeIanaTimezone(task.rule_timezone);
  const userTimezone = normalizeIanaTimezone(timezone) ?? timezone;
  const taskTimezone = ruleTimezone ?? userTimezone;
  const taskTimezoneSuffix = ruleTimezone && ruleTimezone !== userTimezone ? ` (${ruleTimezone})` : "";
  const availableFrom = formatDateInTimeZone(task.available_from, taskTimezone);
  const dueDate = formatDateInTimeZone(task.due_at, taskTimezone);
  const window = availableFrom === dueDate ? availableFrom : `${availableFrom} - ${dueDate}`;
  const status = task.status === "overdue" ? labels.telegram.statuses.overdue : labels.telegram.statuses.active;
  const dueAt = formatDateTimeInTimeZone(task.due_at, taskTimezone);
  const reminderTime = getReminderTimeFromTask(task);
  const isMonthly = task.schedule_type === "monthly_fixed_window" || task.schedule_type === "monthly_end_plus_start_window";
  const isOneTimeWindow = isOneTimeWindowTask(task);
  const taskType = task.schedule_type === "one_time"
    ? isOneTimeWindow ? labels.telegram.taskTypes.oneTimeWindow : labels.telegram.taskTypes.oneTime
    : task.schedule_type === "weekly"
      ? labels.telegram.taskTypes.weekly
      : isMonthly
        ? labels.telegram.taskTypes.monthly
        : labels.telegram.taskTypes.fallback;
  const lines = [
    `<b>${escapeHtml(task.title)}</b>`,
    "",
    `<i>${labels.telegram.fields.taskType}:</i> ${taskType}`,
    `<i>${labels.telegram.fields.status}:</i> ${status}`,
    `<i>${labels.telegram.fields.dueAt}:</i> ${dueAt}${taskTimezoneSuffix}`
  ];

  if (isMonthly || isOneTimeWindow) {
    lines.push(`<i>${labels.telegram.fields.window}:</i> ${window}${taskTimezoneSuffix}`);
  }

  if (reminderTime) {
    lines.push(`<i>${labels.telegram.fields.reminderTime}:</i> ${reminderTime}${taskTimezoneSuffix}`);
  }

  if (task.assignee_names) {
    lines.push(`<i>${labels.telegram.fields.assignees}:</i> ${escapeHtml(task.assignee_names)}`);
  }

  return lines.join("\n");
}

function buildDeleteConfirmKeyboard(taskId: number, labels: AppLabels): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: labels.telegram.buttons.confirmDelete,
          callback_data: `task:delete:confirm:${taskId}`
        }
      ],
      [
        {
          text: labels.telegram.buttons.keepTask,
          callback_data: `task:delete:cancel:${taskId}`
        }
      ]
    ]
  };
}

function buildDeleteConfirmText(title: string, isRecurring: boolean, labels: AppLabels): string {
  if (isRecurring) {
    return `${labels.telegram.deleteConfirm.recurringTitle}\n\n${title}\n\n${labels.telegram.deleteConfirm.recurringDescription}`;
  }

  return `${labels.telegram.deleteConfirm.singleTitle}\n\n${title}\n\n${labels.telegram.deleteConfirm.singleDescription}`;
}

function buildEditFieldKeyboard(taskId: number, scheduleType: string | null, labels: AppLabels): InlineKeyboardMarkup {
  let fields: InlineKeyboardMarkup["inline_keyboard"];

  if (scheduleType === "weekly") {
    fields = [
      [
        { text: labels.telegram.fields.title, callback_data: `task:edit:field:title:${taskId}` },
        { text: labels.telegram.fields.weekday, callback_data: `task:edit:field:weekday:${taskId}` }
      ],
      [
        { text: labels.telegram.fields.reminderTime, callback_data: `task:edit:field:time:${taskId}` },
        { text: labels.telegram.fields.assignees, callback_data: `task:edit:field:assignees:${taskId}` }
      ]
    ];
  } else if (scheduleType === "monthly_fixed_window" || scheduleType === "monthly_end_plus_start_window") {
    fields = [
      [
        { text: labels.telegram.fields.title, callback_data: `task:edit:field:title:${taskId}` },
        { text: labels.telegram.fields.window, callback_data: `task:edit:field:monthly_window:${taskId}` }
      ],
      [
        { text: labels.telegram.fields.reminderTime, callback_data: `task:edit:field:time:${taskId}` },
        { text: labels.telegram.fields.assignees, callback_data: `task:edit:field:assignees:${taskId}` }
      ]
    ];
  } else {
    fields = [
      [
        { text: labels.telegram.fields.title, callback_data: `task:edit:field:title:${taskId}` },
        { text: labels.telegram.fields.dueAt, callback_data: `task:edit:field:due_at:${taskId}` }
      ],
      [
        { text: labels.telegram.fields.reminderTime, callback_data: `task:edit:field:reminder_time:${taskId}` },
        { text: labels.telegram.fields.assignees, callback_data: `task:edit:field:assignees:${taskId}` }
      ]
    ];
  }

  return {
    inline_keyboard: [
      ...fields,
      [{ text: labels.telegram.buttons.cancel, callback_data: "task:edit:cancel" }]
    ]
  };
}

function buildEditWeekdayKeyboard(taskId: number, labels: AppLabels): InlineKeyboardMarkup {
  const weekdays = labels.telegram.weekdaysShort;

  return {
    inline_keyboard: [
      [
        { text: weekdays[0] ?? "1", callback_data: `task:edit:weekday:${taskId}:1` },
        { text: weekdays[1] ?? "2", callback_data: `task:edit:weekday:${taskId}:2` },
        { text: weekdays[2] ?? "3", callback_data: `task:edit:weekday:${taskId}:3` },
        { text: weekdays[3] ?? "4", callback_data: `task:edit:weekday:${taskId}:4` }
      ],
      [
        { text: weekdays[4] ?? "5", callback_data: `task:edit:weekday:${taskId}:5` },
        { text: weekdays[5] ?? "6", callback_data: `task:edit:weekday:${taskId}:6` },
        { text: weekdays[6] ?? "7", callback_data: `task:edit:weekday:${taskId}:7` }
      ],
      [{ text: labels.telegram.buttons.cancel, callback_data: "task:edit:cancel" }]
    ]
  };
}

function buildEditScheduleConfirmKeyboard(taskId: number, labels: AppLabels): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: labels.telegram.buttons.confirmRecreate, callback_data: `task:edit:schedule:confirm:${taskId}` }],
      [{ text: labels.telegram.buttons.cancel, callback_data: "task:edit:cancel" }]
    ]
  };
}

function buildEditAssigneesApplyKeyboard(taskId: number, labels: AppLabels): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: labels.telegram.buttons.futureOnly, callback_data: `task:edit:assignees:apply_future:${taskId}` }],
      [{ text: labels.telegram.buttons.currentAndFuture, callback_data: `task:edit:assignees:apply_current:${taskId}` }],
      [{ text: labels.telegram.buttons.cancel, callback_data: "task:edit:cancel" }]
    ]
  };
}

function getWeeklyParamsFromTask(task: { schedule_params_json: string | null }): { weekday: number; hour: number; minute: number } | null {
  if (!task.schedule_params_json) {
    return null;
  }

  const params = JSON.parse(task.schedule_params_json) as {
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

function getOneTimeParamsFromTask(task: {
  schedule_params_json: string | null;
  available_from: string;
  due_at: string;
}): { availableFrom: string; dueAt: string; hour: number; minute: number } | null {
  if (!task.schedule_params_json) {
    return null;
  }

  const params = JSON.parse(task.schedule_params_json) as {
    available_from?: string;
    due_at?: string;
    hour?: number;
    minute?: number;
  };

  if (
    typeof params.hour !== "number" ||
    typeof params.minute !== "number"
  ) {
    return null;
  }

  return {
    availableFrom: typeof params.available_from === "string" ? params.available_from : task.available_from,
    dueAt: typeof params.due_at === "string" ? params.due_at : task.due_at,
    hour: params.hour,
    minute: params.minute
  };
}

function isOneTimeWindowTask(task: { schedule_type: string | null; schedule_params_json: string | null }): boolean {
  if (task.schedule_type !== "one_time" || !task.schedule_params_json) {
    return false;
  }

  try {
    const params = JSON.parse(task.schedule_params_json) as { available_from?: unknown };

    return typeof params.available_from === "string";
  } catch {
    return false;
  }
}

function isMonthlyScheduleType(value: string | null): value is "monthly_fixed_window" | "monthly_end_plus_start_window" {
  return value === "monthly_fixed_window" || value === "monthly_end_plus_start_window";
}

function getMonthlyParamsFromTask(
  task: { schedule_type: string | null; schedule_params_json: string | null }
):
  | { scheduleType: "monthly_fixed_window"; startDay: number; endDay: number; hour: number; minute: number }
  | { scheduleType: "monthly_end_plus_start_window"; lastDays: number; firstDays: number; hour: number; minute: number }
  | null {
  if (!isMonthlyScheduleType(task.schedule_type) || !task.schedule_params_json) {
    return null;
  }

  const params = JSON.parse(task.schedule_params_json) as {
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
    task.schedule_type === "monthly_fixed_window" &&
    typeof params.start_day === "number" &&
    typeof params.end_day === "number"
  ) {
    return {
      scheduleType: task.schedule_type,
      startDay: params.start_day,
      endDay: params.end_day,
      hour: params.hour,
      minute: params.minute
    };
  }

  if (
    task.schedule_type === "monthly_end_plus_start_window" &&
    typeof params.last_days === "number" &&
    typeof params.first_days === "number"
  ) {
    return {
      scheduleType: task.schedule_type,
      lastDays: params.last_days,
      firstDays: params.first_days,
      hour: params.hour,
      minute: params.minute
    };
  }

  return null;
}

function getMonthlyWindowSummary(data: EditTaskSessionData, labels: AppLabels): string | null {
  if (data.monthlyScheduleType === "monthly_fixed_window") {
    if (typeof data.startDay !== "number" || typeof data.endDay !== "number") {
      return null;
    }

    return labels.telegram.editPrompts.windowSummary.fixed(data.startDay, data.endDay);
  }

  if (data.monthlyScheduleType === "monthly_end_plus_start_window") {
    if (typeof data.lastDays !== "number" || typeof data.firstDays !== "number") {
      return null;
    }

    return labels.telegram.editPrompts.windowSummary.endPlusStart(data.lastDays, data.firstDays);
  }

  return null;
}

function getTelegramWeeklyChangedFields(
  currentParams: { weekday: number; hour: number; minute: number },
  next: { weekday: number; hour: number; minute: number }
): string[] {
  const changedFields: string[] = [];

  if (currentParams.weekday !== next.weekday) {
    changedFields.push("weekday");
  }

  if (currentParams.hour !== next.hour || currentParams.minute !== next.minute) {
    changedFields.push("reminder_time");
  }

  return changedFields;
}

function getTelegramMonthlyChangedFields(
  currentParams:
    | { scheduleType: "monthly_fixed_window"; startDay: number; endDay: number; hour: number; minute: number }
    | { scheduleType: "monthly_end_plus_start_window"; lastDays: number; firstDays: number; hour: number; minute: number },
  next:
    | { scheduleType: "monthly_fixed_window"; startDay: number; endDay: number; hour: number; minute: number }
    | { scheduleType: "monthly_end_plus_start_window"; lastDays: number; firstDays: number; hour: number; minute: number }
): string[] {
  const changedFields: string[] = [];

  if (
    currentParams.scheduleType === "monthly_fixed_window" &&
    next.scheduleType === "monthly_fixed_window" &&
    (currentParams.startDay !== next.startDay || currentParams.endDay !== next.endDay)
  ) {
    changedFields.push("window");
  }

  if (
    currentParams.scheduleType === "monthly_end_plus_start_window" &&
    next.scheduleType === "monthly_end_plus_start_window" &&
    (currentParams.lastDays !== next.lastDays || currentParams.firstDays !== next.firstDays)
  ) {
    changedFields.push("window");
  }

  if (currentParams.hour !== next.hour || currentParams.minute !== next.minute) {
    changedFields.push("reminder_time");
  }

  return changedFields;
}

async function recordTelegramTaskCreated(
  env: Env,
  actorUserId: number,
  taskId: number,
  taskType: string,
  assigneeCount: number,
  now: string
): Promise<void> {
  await recordAuditEvent(env, {
    actorUserId,
    action: "task.created",
    entityType: "task",
    entityId: taskId,
    metadata: {
      source: "telegram",
      taskType,
      assigneeCount
    },
    now
  });
}

async function recordTelegramTaskUpdated(
  env: Env,
  actorUserId: number,
  taskId: number,
  taskType: string,
  changedFields: string[],
  now: string,
  previousTaskId: number | null = null
): Promise<void> {
  await recordAuditEvent(env, {
    actorUserId,
    action: "task.updated",
    entityType: "task",
    entityId: taskId,
    metadata: {
      source: "telegram",
      taskType,
      changedFields,
      previousTaskId
    },
    now
  });
}

async function buildEditAssigneesKeyboard(
  env: Env,
  taskId: number,
  selectedUserIds: number[],
  labels: AppLabels
): Promise<InlineKeyboardMarkup> {
  const selected = new Set(selectedUserIds);
  const users = await getActiveUsers(env);
  const userButtons = users.map((user) => [
    {
      text: `${selected.has(user.id) ? "✓ " : ""}${formatUserName(user)}`,
      callback_data: `task:edit:assignee_toggle:${taskId}:${user.id}`
    }
  ]);

  return {
    inline_keyboard: [
      ...userButtons,
      [{ text: labels.telegram.buttons.doneSelection, callback_data: `task:edit:assignees:done:${taskId}` }],
      [{ text: labels.telegram.buttons.cancel, callback_data: "task:edit:cancel" }]
    ]
  };
}

function parseDayRange(value: string): { startDay: number; endDay: number } | null {
  const singleDayMatch = value.trim().match(/^(\d{1,2})$/);

  if (singleDayMatch) {
    const day = Number(singleDayMatch[1]);

    if (day < 1 || day > 31) {
      return null;
    }

    return {
      startDay: day,
      endDay: day
    };
  }

  const match = value.trim().match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);

  if (!match) {
    return null;
  }

  const startDay = Number(match[1]);
  const endDay = Number(match[2]);

  if (startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31 || startDay > endDay) {
    return null;
  }

  return {
    startDay,
    endDay
  };
}

function parseOneTimeDateWindow(
  value: string,
  timezone: string
): { availableFrom: string; dueAt: string; display: string } | null {
  const match = value.trim().match(/^(\d{2}-\d{2}-\d{4})\s*-\s*(\d{2}-\d{2}-\d{4})$/);

  if (!match) {
    return null;
  }

  const start = parseLocalDateTime(`${match[1]} 00:00`, timezone);
  const end = parseLocalDateTime(`${match[2]} 23:59`, timezone);

  if (!start || !end || Date.parse(start.iso) > Date.parse(end.iso)) {
    return null;
  }

  return {
    availableFrom: start.iso,
    dueAt: end.iso,
    display: `${match[1]} - ${match[2]}`
  };
}

function parseEndPlusStartWindow(value: string): { lastDays: number; firstDays: number } | null {
  const match = value.trim().match(/^(\d{1,2})\s*\+\s*(\d{1,2})$/);

  if (!match) {
    return null;
  }

  const lastDays = Number(match[1]);
  const firstDays = Number(match[2]);

  if (lastDays < 1 || lastDays > 31 || firstDays < 0 || firstDays > 31) {
    return null;
  }

  return {
    lastDays,
    firstDays
  };
}

function parseLastDaysWindow(value: string): { lastDays: number; firstDays: 0 } | null {
  const normalized = value.trim();

  if (!/^\d{1,2}$/.test(normalized)) {
    return null;
  }

  const lastDays = Number(normalized);

  if (lastDays < 1 || lastDays > 31) {
    return null;
  }

  return {
    lastDays,
    firstDays: 0
  };
}

interface TelegramMessageRef {
  chat_id: number;
  message_id: number;
}

type TelegramMessagePurpose = "task_list" | "create_flow";

async function recordTelegramMessageRef(
  env: Env,
  userId: number,
  chatId: number,
  messageId: number,
  purpose: TelegramMessagePurpose,
  now: string
): Promise<void> {
  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO telegram_message_refs (
        user_id,
        chat_id,
        message_id,
        purpose,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `
  )
    .bind(userId, chatId, messageId, purpose, now)
    .run();
}

async function deleteStoredMessages(env: Env, userId: number, purposes: TelegramMessagePurpose[]): Promise<void> {
  if (purposes.length === 0) {
    return;
  }

  const placeholders = purposes.map(() => "?").join(", ");
  const result = await env.DB.prepare(
    `
      SELECT chat_id, message_id
      FROM telegram_message_refs
      WHERE user_id = ?
        AND purpose IN (${placeholders})
      ORDER BY id ASC
    `
  )
    .bind(userId, ...purposes)
    .all<TelegramMessageRef>();

  for (const ref of result.results ?? []) {
    try {
      await deleteTelegramMessage(env, ref.chat_id, ref.message_id);
    } catch {
      // Telegram can reject deletion of old messages; stale refs are cleared anyway.
    }
  }

  await env.DB.prepare(
    `
      DELETE FROM telegram_message_refs
      WHERE user_id = ?
        AND purpose IN (${placeholders})
    `
  )
    .bind(userId, ...purposes)
    .run();
}

function buildTaskListHeader(
  title: string,
  tasks: TelegramTaskListItem[],
  now: string,
  timezone: string,
  labels: AppLabels
): string {
  const updatedAt = formatDateTimeInTimeZone(now, timezone);
  const overdueCount = tasks.filter((task) => task.status === "overdue").length;
  const countLabel = labels.telegram.taskList.countLabel(tasks.length);
  const line = "━━━━━━━━━━━━━━━━━━━━";
  const overdueLine = overdueCount > 0
    ? `\n<b>${labels.telegram.taskList.overdue}:</b> ${overdueCount}`
    : "";

  return `${line}\n${line}\n<b>${title.toUpperCase()}</b>\n\n<b>${labels.telegram.taskList.total}:</b> ${tasks.length} ${countLabel}${overdueLine}\n<b>${labels.telegram.taskList.updated}:</b> ${updatedAt}\n${line}`;
}

async function resolveAssigneeUserIds(
  env: Env,
  userId: number,
  assigneeMode: CreateOneTimeTaskSessionData["assigneeMode"],
  selectedUserIds?: number[]
): Promise<number[]> {
  if (assigneeMode !== "all") {
    if (assigneeMode === "selected") {
      const selected = new Set((selectedUserIds ?? []).filter((id) => Number.isSafeInteger(id) && id > 0));
      const users = await getActiveUsers(env);
      const userIds = users.filter((user) => selected.has(user.id)).map((user) => user.id);

      return userIds;
    }

    return [userId];
  }

  const users = await getActiveUsers(env);
  const userIds = users.map((user) => user.id);

  return userIds.length > 0 ? userIds : [userId];
}

function getAssigneeSummary(
  assigneeMode: CreateOneTimeTaskSessionData["assigneeMode"],
  assigneeCount: number,
  labels: AppLabels
): string {
  if (assigneeMode === "all") {
    return labels.telegram.createPrompts.assigneeSummary.all(assigneeCount);
  }

  if (assigneeMode === "selected") {
    return labels.telegram.createPrompts.assigneeSummary.selected(assigneeCount);
  }

  return labels.telegram.createPrompts.assigneeSummary.self;
}

async function buildSelectedAssigneesKeyboard(
  env: Env,
  selectedUserIds: number[],
  labels: AppLabels
): Promise<InlineKeyboardMarkup> {
  const selected = new Set(selectedUserIds);
  const users = await getActiveUsers(env);
  const userButtons = users.map((user) => [
    {
      text: `${selected.has(user.id) ? "✓ " : ""}${formatUserName(user)}`,
      callback_data: `task:create:assignee_toggle:${user.id}`
    }
  ]);

  return {
    inline_keyboard: [
      ...userButtons,
      [{ text: labels.telegram.buttons.doneSelection, callback_data: "task:create:assignees:done" }],
      [{ text: labels.telegram.buttons.cancel, callback_data: "task:create:cancel" }]
    ]
  };
}

async function sendTrackedTaskListMessage(
  env: Env,
  chatId: number,
  userId: number,
  now: string,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
  options?: { parseMode?: "HTML" }
): Promise<void> {
  const message = await sendTelegramMessage(env, chatId, text, replyMarkup, options);

  await recordTelegramMessageRef(env, userId, chatId, message.message_id, "task_list", now);
}

async function sendTrackedCreateFlowMessage(
  env: Env,
  chatId: number,
  userId: number,
  now: string,
  text: string,
  replyMarkup?: InlineKeyboardMarkup
): Promise<void> {
  const message = await sendTelegramMessage(env, chatId, text, replyMarkup);

  await recordTelegramMessageRef(env, userId, chatId, message.message_id, "create_flow", now);
}

async function editCallbackMessageOrSendTracked(
  env: Env,
  chatId: number,
  userId: number,
  now: string,
  messageId: number | undefined,
  text: string,
  replyMarkup?: InlineKeyboardMarkup
): Promise<void> {
  if (messageId) {
    try {
      await editTelegramMessageText(env, chatId, messageId, text, replyMarkup);
      return;
    } catch {
      // Telegram can reject edits for old or changed messages; fall back to a new tracked flow message.
    }
  }

  await sendTrackedCreateFlowMessage(env, chatId, userId, now, text, replyMarkup);
}

async function editCallbackMessageOrSend(
  env: Env,
  chatId: number,
  messageId: number | undefined,
  text: string,
  replyMarkup?: InlineKeyboardMarkup
): Promise<void> {
  if (messageId) {
    try {
      await editTelegramMessageText(env, chatId, messageId, text, replyMarkup);
      return;
    } catch {
      // Telegram can reject edits for old or changed messages; fall back to a new message.
    }
  }

  await sendTelegramMessage(env, chatId, text, replyMarkup);
}

async function sendTaskList(
  env: Env,
  chatId: number,
  userId: number,
  isAdmin: boolean,
  labels: AppLabels,
  timezone: string,
  now: string,
  title: string,
  tasks: TelegramTaskListItem[],
  emptyText: string
): Promise<void> {
  await deleteStoredMessages(env, userId, ["task_list", "create_flow"]);

  await sendTrackedTaskListMessage(
    env,
    chatId,
    userId,
    now,
    buildTaskListHeader(title, tasks, now, timezone, labels),
    undefined,
    { parseMode: "HTML" }
  );

  if (tasks.length === 0) {
    await sendTrackedTaskListMessage(env, chatId, userId, now, emptyText, undefined, { parseMode: "HTML" });
    await sendTrackedTaskListMessage(env, chatId, userId, now, labels.telegram.messages.menuTitle, getMainMenuKeyboard(isAdmin, labels));
    return;
  }

  for (const task of tasks) {
    await sendTrackedTaskListMessage(
      env,
      chatId,
      userId,
      now,
      buildTaskCardText(task, timezone, labels),
      buildTaskCardKeyboard(task, isAdmin, labels),
      { parseMode: "HTML" }
    );
  }

  await sendTrackedTaskListMessage(env, chatId, userId, now, labels.telegram.messages.menuTitle, getMainMenuKeyboard(isAdmin, labels));
}

async function sendMyTasks(env: Env, chatId: number, userId: number, isAdmin: boolean, labels: AppLabels, timezone: string, now: string): Promise<void> {
  const tasks = await getActiveTasksForUser(env, userId);

  await sendTaskList(
    env,
    chatId,
    userId,
    isAdmin,
    labels,
    timezone,
    now,
    labels.telegram.menu.myTasks,
    tasks,
    labels.telegram.messages.emptyMyTasks
  );
}

async function sendFamilyTasks(env: Env, chatId: number, userId: number, isAdmin: boolean, labels: AppLabels, timezone: string, now: string): Promise<void> {
  const tasks = await getActiveFamilyTasks(env, userId);

  await sendTaskList(
    env,
    chatId,
    userId,
    isAdmin,
    labels,
    timezone,
    now,
    labels.telegram.menu.familyTasks,
    tasks,
    labels.telegram.messages.emptyFamilyTasks
  );
}

async function sendAdminUsers(env: Env, chatId: number, labels: AppLabels): Promise<void> {
  const users = await getAllUsers(env);

  await sendTelegramMessage(env, chatId, buildAdminUsersText(users, labels), buildAdminUsersKeyboard(users, labels));
}

async function handleAdminAddUserSession(
  env: Env,
  chatId: number,
  adminUserId: number,
  isAdmin: boolean,
  labels: AppLabels,
  timezone: string,
  now: string,
  text: string
): Promise<void> {
  const telegramUserId = Number(text.trim());

  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
    await sendTelegramMessage(
      env,
      chatId,
      labels.telegram.adminUsers.addPromptWithExample,
      buildAdminAddUserKeyboard(labels)
    );
    return;
  }

  const user = await addUserByTelegramId(env, telegramUserId, timezone, now);

  await recordAuditEvent(env, {
    actorUserId: adminUserId,
    action: "user.added",
    entityType: "user",
    entityId: user.id,
    metadata: {
      source: "telegram",
      telegramUserId: user.telegram_user_id
    },
    now
  });

  await clearUserSession(env, adminUserId, ADMIN_ADD_USER_SCENARIO);
  await sendTelegramMessage(
    env,
    chatId,
    labels.telegram.adminUsers.added(formatUserName(user), user.telegram_user_id),
    getMainMenuKeyboard(isAdmin, labels)
  );
}

async function handleEditTaskSession(
  env: Env,
  chatId: number,
  userId: number,
  isAdmin: boolean,
  labels: AppLabels,
  timezone: string,
  now: string,
  session: UserSession,
  text: string,
  messageId: number | null
): Promise<void> {
  if (session.scenario !== EDIT_TASK_SCENARIO) {
    await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.useMenuOrStart, getMainMenuKeyboard(isAdmin, labels));
    return;
  }

  if (messageId !== null) {
    await recordTelegramMessageRef(env, userId, chatId, messageId, "create_flow", now);
  }

  const data = getSessionData<EditTaskSessionData>(session);
  const task = await getEditableTaskForUser(env, data.taskId, userId, isAdmin);

  if (!task) {
    await clearUserSession(env, userId, EDIT_TASK_SCENARIO);
    await deleteStoredMessages(env, userId, ["create_flow"]);
    await sendTelegramMessage(env, chatId, labels.telegram.notices.notFoundOrClosed, getMainMenuKeyboard(isAdmin, labels));
    return;
  }

  if (task.schedule_type !== "one_time" && task.schedule_type !== "weekly" && !isMonthlyScheduleType(task.schedule_type)) {
    await clearUserSession(env, userId, EDIT_TASK_SCENARIO);
    await deleteStoredMessages(env, userId, ["create_flow"]);
    await sendTelegramMessage(env, chatId, labels.telegram.editPrompts.taskTypeNotEditable, getMainMenuKeyboard(isAdmin, labels));
    return;
  }

  if (session.step === "field") {
    await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.editPrompts.chooseField, buildEditFieldKeyboard(task.id, task.schedule_type, labels));
    return;
  }

  if (session.step === "title") {
    const title = text.trim();

    if (title.length < 1 || title.length > 120) {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.editPrompts.invalidTitle,
        buildEditCancelKeyboard(labels)
      );
      return;
    }

    const result = task.schedule_type === "weekly"
      ? await updateWeeklyTaskTitle(env, task.id, userId, isAdmin, title, now)
      : isMonthlyScheduleType(task.schedule_type)
        ? await updateMonthlyTaskTitle(env, task.id, userId, isAdmin, title, now)
        : await updateOneTimeTaskTitle(env, task.id, userId, isAdmin, title, now);

    if (result.status === "updated") {
      await recordTelegramTaskUpdated(env, userId, task.id, task.schedule_type ?? "one_time", ["title"], now);
    }

    await clearUserSession(env, userId, EDIT_TASK_SCENARIO);
    await deleteStoredMessages(env, userId, ["create_flow"]);
    await sendTelegramMessage(
      env,
      chatId,
      result.status === "updated" ? labels.telegram.editPrompts.titleChanged(title) : labels.telegram.notices.notFoundOrClosed,
      getMainMenuKeyboard(isAdmin, labels)
    );
    return;
  }

  if (session.step === "due_at") {
    if (task.schedule_type !== "one_time" || typeof data.hour !== "number" || typeof data.minute !== "number") {
      await clearUserSession(env, userId, EDIT_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.editPrompts.editDataMissing, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    const dueAt = parseLocalDateTime(`${text.trim()} 23:59`, timezone);

    if (!dueAt) {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.editPrompts.invalidDueDate,
        buildEditCancelKeyboard(labels)
      );
      return;
    }

    if (Date.parse(dueAt.iso) <= Date.parse(now)) {
      await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.dueDateFuture, buildEditCancelKeyboard(labels));
      return;
    }

    const result = await updateOneTimeTaskDueAt(
      env,
      task.id,
      userId,
      isAdmin,
      dueAt.iso,
      data.hour,
      data.minute,
      timezone,
      now
    );

    if (result.status === "updated") {
      await recordTelegramTaskUpdated(env, userId, task.id, "one_time", ["due_at"], now);
    }

    await clearUserSession(env, userId, EDIT_TASK_SCENARIO);
    await deleteStoredMessages(env, userId, ["create_flow"]);
    await sendTelegramMessage(
      env,
      chatId,
      result.status === "updated" ? labels.telegram.editPrompts.dueAtChanged(formatDateInTimeZone(dueAt.iso, timezone)) : labels.telegram.notices.notFoundOrClosed,
      getMainMenuKeyboard(isAdmin, labels)
    );
    return;
  }

  if (session.step === "reminder_time") {
    const time = parseLocalTime(text);

    if (task.schedule_type !== "one_time" || !data.dueAt || !data.dueDateDisplay) {
      await clearUserSession(env, userId, EDIT_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.editPrompts.editDataMissing, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    if (!time) {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.editPrompts.invalidTime,
        buildEditCancelKeyboard(labels)
      );
      return;
    }

    const result = isOneTimeWindowTask(task) && data.availableFrom
      ? await updateOneTimeTaskWindow(
          env,
          task.id,
          userId,
          isAdmin,
          {
            availableFrom: data.availableFrom,
            dueAt: data.dueAt,
            hour: time.hour,
            minute: time.minute,
            timezone
          },
          now
        )
      : await updateOneTimeTaskDueAt(
          env,
          task.id,
          userId,
          isAdmin,
          data.dueAt,
          time.hour,
          time.minute,
          timezone,
          now
        );

    if (result.status === "updated") {
      await recordTelegramTaskUpdated(env, userId, task.id, "one_time", ["reminder_time"], now);
    }

    await clearUserSession(env, userId, EDIT_TASK_SCENARIO);
    await deleteStoredMessages(env, userId, ["create_flow"]);
    await sendTelegramMessage(
      env,
      chatId,
      result.status === "updated" ? labels.telegram.editPrompts.reminderTimeChanged(time.display) : labels.telegram.notices.notFoundOrClosed,
      getMainMenuKeyboard(isAdmin, labels)
    );
    return;
  }

  if (session.step === "time") {
    if (task.schedule_type !== "weekly" && !isMonthlyScheduleType(task.schedule_type)) {
      await clearUserSession(env, userId, EDIT_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.editPrompts.recurringTimeOnly, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    const time = parseLocalTime(text);

    if (!time) {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.editPrompts.invalidTime,
        buildEditCancelKeyboard(labels)
      );
      return;
    }

    if (task.schedule_type === "weekly") {
      const currentParams = getWeeklyParamsFromTask(task);

      if (!currentParams) {
        await clearUserSession(env, userId, EDIT_TASK_SCENARIO);
        await deleteStoredMessages(env, userId, ["create_flow"]);
        await sendTelegramMessage(env, chatId, labels.telegram.editPrompts.weeklyScheduleReadFailed, getMainMenuKeyboard(isAdmin, labels));
        return;
      }

      await updateUserSession(
        env,
        userId,
        EDIT_TASK_SCENARIO,
        "schedule_confirm",
        { ...data, weekday: data.weekday ?? currentParams.weekday, hour: time.hour, minute: time.minute },
        now
      );
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.editPrompts.scheduleConfirm([
          `${labels.telegram.fields.weekday}: ${getLocalizedWeekdayName(data.weekday ?? currentParams.weekday, labels)}`,
          `${labels.telegram.fields.reminderTime}: ${time.display}`
        ]),
        buildEditScheduleConfirmKeyboard(task.id, labels)
      );
      return;
    }

    const currentMonthlyParams = getMonthlyParamsFromTask(task);

    if (!currentMonthlyParams) {
      await clearUserSession(env, userId, EDIT_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.editPrompts.monthlyScheduleReadFailed, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    const nextData: EditTaskSessionData = currentMonthlyParams.scheduleType === "monthly_fixed_window"
      ? {
          ...data,
          monthlyScheduleType: currentMonthlyParams.scheduleType,
          startDay: data.startDay ?? currentMonthlyParams.startDay,
          endDay: data.endDay ?? currentMonthlyParams.endDay,
          hour: time.hour,
          minute: time.minute
        }
      : {
          ...data,
          monthlyScheduleType: currentMonthlyParams.scheduleType,
          lastDays: data.lastDays ?? currentMonthlyParams.lastDays,
          firstDays: data.firstDays ?? currentMonthlyParams.firstDays,
          hour: time.hour,
          minute: time.minute
        };

    await updateUserSession(
      env,
      userId,
      EDIT_TASK_SCENARIO,
      "schedule_confirm",
      nextData,
      now
    );
    const windowSummary = getMonthlyWindowSummary(nextData, labels);

    await deleteStoredMessages(env, userId, ["create_flow"]);
    await sendTrackedCreateFlowMessage(
      env,
      chatId,
      userId,
      now,
      labels.telegram.editPrompts.scheduleConfirm([
        `${labels.telegram.fields.window}: ${windowSummary ?? labels.telegram.editPrompts.scheduleFallback}`,
        `${labels.telegram.fields.reminderTime}: ${time.display}`
      ]),
      buildEditScheduleConfirmKeyboard(task.id, labels)
    );
    return;
  }

  if (session.step === "monthly_window") {
    if (!isMonthlyScheduleType(task.schedule_type)) {
      await clearUserSession(env, userId, EDIT_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.editPrompts.monthlyOnly, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    const currentParams = getMonthlyParamsFromTask(task);

    if (!currentParams) {
      await clearUserSession(env, userId, EDIT_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.editPrompts.monthlyScheduleReadFailed, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    let nextData: EditTaskSessionData | null = null;
    let windowSummary: string | null = null;

    if (currentParams.scheduleType === "monthly_fixed_window") {
      const range = parseDayRange(text);

      if (!range) {
        await sendTrackedCreateFlowMessage(
          env,
          chatId,
          userId,
          now,
          labels.telegram.createPrompts.monthlyFixedWindow,
          buildEditCancelKeyboard(labels)
        );
        return;
      }

      nextData = {
        ...data,
        monthlyScheduleType: currentParams.scheduleType,
        startDay: range.startDay,
        endDay: range.endDay,
        hour: data.hour ?? currentParams.hour,
        minute: data.minute ?? currentParams.minute
      };
      windowSummary = getMonthlyWindowSummary(nextData, labels);
    } else if (currentParams.firstDays === 0) {
      const window = parseLastDaysWindow(text);

      if (!window) {
        await sendTrackedCreateFlowMessage(
          env,
          chatId,
          userId,
          now,
          labels.telegram.createPrompts.lastDaysWindow,
          buildEditCancelKeyboard(labels)
        );
        return;
      }

      nextData = {
        ...data,
        monthlyScheduleType: currentParams.scheduleType,
        lastDays: window.lastDays,
        firstDays: window.firstDays,
        hour: data.hour ?? currentParams.hour,
        minute: data.minute ?? currentParams.minute
      };
      windowSummary = getMonthlyWindowSummary(nextData, labels);
    } else {
      const window = parseEndPlusStartWindow(text);

      if (!window) {
        await sendTrackedCreateFlowMessage(
          env,
          chatId,
          userId,
          now,
          labels.telegram.createPrompts.endPlusStartWindow,
          buildEditCancelKeyboard(labels)
        );
        return;
      }

      nextData = {
        ...data,
        monthlyScheduleType: currentParams.scheduleType,
        lastDays: window.lastDays,
        firstDays: window.firstDays,
        hour: data.hour ?? currentParams.hour,
        minute: data.minute ?? currentParams.minute
      };
      windowSummary = getMonthlyWindowSummary(nextData, labels);
    }

    await updateUserSession(
      env,
      userId,
      EDIT_TASK_SCENARIO,
      "schedule_confirm",
      nextData,
      now
    );
    await deleteStoredMessages(env, userId, ["create_flow"]);
    await sendTrackedCreateFlowMessage(
      env,
      chatId,
      userId,
      now,
      labels.telegram.editPrompts.scheduleConfirm([
        `${labels.telegram.fields.window}: ${windowSummary ?? labels.telegram.editPrompts.scheduleFallback}`,
        `${labels.telegram.fields.reminderTime}: ${String(nextData.hour).padStart(2, "0")}:${String(nextData.minute).padStart(2, "0")}`
      ]),
      buildEditScheduleConfirmKeyboard(task.id, labels)
    );
    return;
  }

  await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.editPrompts.chooseField, buildEditFieldKeyboard(task.id, task.schedule_type, labels));
}

async function handleCreateTaskSession(
  env: Env,
  chatId: number,
  userId: number,
  isAdmin: boolean,
  labels: AppLabels,
  timezone: string,
  now: string,
  session: UserSession,
  text: string,
  messageId: number | null
): Promise<void> {
  if (session.scenario !== CREATE_ONE_TIME_TASK_SCENARIO) {
    await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.useMenuOrStart, getMainMenuKeyboard(isAdmin, labels));
    return;
  }

  if (messageId !== null) {
    await recordTelegramMessageRef(env, userId, chatId, messageId, "create_flow", now);
  }

  if (session.step === "task_type") {
    await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.chooseTaskType, buildTaskTypeKeyboard(labels));
    return;
  }

  if (session.step === "assignees") {
    await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.chooseAssignees, buildAssigneeModeKeyboard(labels));
    return;
  }

  if (session.step === "title") {
    const title = text.trim();
    const data = getSessionData<CreateOneTimeTaskSessionData>(session);

    if (title.length < 1 || title.length > 120) {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.createPrompts.invalidTitle,
        buildCreateCancelKeyboard(labels)
      );
      return;
    }

    await updateUserSession(
      env,
      userId,
      CREATE_ONE_TIME_TASK_SCENARIO,
      data.taskType === "weekly"
        ? "weekday"
        : data.taskType === "monthly"
          ? "monthly_mode"
          : data.taskType === "one_time_window"
            ? "one_time_window"
            : "due_at",
      { ...data, title },
      now
    );

    if (data.taskType === "weekly") {
      await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.chooseWeekday, buildWeekdayKeyboard(labels));
    } else if (data.taskType === "monthly") {
      await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.chooseMonthlyMode, buildMonthlyModeKeyboard(labels));
    } else if (data.taskType === "one_time_window") {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.createPrompts.oneTimeWindow,
        buildCreateCancelKeyboard(labels)
      );
    } else {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.createPrompts.dueDate,
        buildCreateCancelKeyboard(labels)
      );
    }

    return;
  }

  if (session.step === "due_at") {
    const data = getSessionData<CreateOneTimeTaskSessionData>(session);
    const title = data.title?.trim();
    const dueAt = parseLocalDateTime(`${text.trim()} 23:59`, timezone);

    if (!title) {
      await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.missingCreateData, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    if (!dueAt) {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.createPrompts.invalidDueDate,
        buildCreateCancelKeyboard(labels)
      );
      return;
    }

    if (Date.parse(dueAt.iso) <= Date.parse(now)) {
      await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.dueDateFuture, buildCreateCancelKeyboard(labels));
      return;
    }

    await updateUserSession(
      env,
      userId,
      CREATE_ONE_TIME_TASK_SCENARIO,
      "reminder_time",
      { ...data, dueAt: dueAt.iso, dueDateDisplay: formatDateInTimeZone(dueAt.iso, timezone) },
      now
    );
    await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.reminderTime, buildCreateCancelKeyboard(labels));
    return;
  }

  if (session.step === "reminder_time") {
    const data = getSessionData<CreateOneTimeTaskSessionData>(session);
    const title = data.title?.trim();
    const time = parseLocalTime(text);

    if (!title || !data.dueAt || !data.dueDateDisplay) {
      await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.missingCreateData, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    if (!time) {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.createPrompts.invalidTime,
        buildCreateCancelKeyboard(labels)
      );
      return;
    }

    const assigneeUserIds = await resolveAssigneeUserIds(env, userId, data.assigneeMode, data.assigneeUserIds);

    if (assigneeUserIds.length === 0) {
      await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.selectedAssigneesUnavailable, buildAssigneeModeKeyboard(labels));
      return;
    }

    const taskId = await createOneTimeTask(env, {
      userId,
      assigneeUserIds,
      title,
      dueAt: data.dueAt,
      reminderHour: time.hour,
      reminderMinute: time.minute,
      timezone,
      now
    });
    await recordTelegramTaskCreated(env, userId, taskId, "one_time", assigneeUserIds.length, now);
    await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
    await deleteStoredMessages(env, userId, ["create_flow"]);
    await sendTelegramMessage(
      env,
      chatId,
      labels.telegram.createPrompts.createdOneTime(
        title,
        getAssigneeSummary(data.assigneeMode, assigneeUserIds.length, labels),
        data.dueDateDisplay,
        time.display
      ),
      getMainMenuKeyboard(isAdmin, labels)
    );
    return;
  }

  if (session.step === "one_time_window") {
    const data = getSessionData<CreateOneTimeTaskSessionData>(session);
    const title = data.title?.trim();
    const window = parseOneTimeDateWindow(text, timezone);

    if (!title || data.taskType !== "one_time_window") {
      await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.missingCreateData, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    if (!window) {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.createPrompts.invalidOneTimeWindow,
        buildCreateCancelKeyboard(labels)
      );
      return;
    }

    if (Date.parse(window.dueAt) <= Date.parse(now)) {
      await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.oneTimeWindowEndFuture, buildCreateCancelKeyboard(labels));
      return;
    }

    await updateUserSession(
      env,
      userId,
      CREATE_ONE_TIME_TASK_SCENARIO,
      "time",
      {
        ...data,
        availableFrom: window.availableFrom,
        dueAt: window.dueAt,
        windowDisplay: window.display
      },
      now
    );
    await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.dailyReminderTime, buildCreateCancelKeyboard(labels));
    return;
  }

  if (session.step === "weekday") {
    await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.chooseWeekday, buildWeekdayKeyboard(labels));
    return;
  }

  if (session.step === "monthly_mode") {
    await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.chooseMonthlyMode, buildMonthlyModeKeyboard(labels));
    return;
  }

  if (session.step === "monthly_fixed_window") {
    const data = getSessionData<CreateOneTimeTaskSessionData>(session);
    const title = data.title?.trim();
    const range = parseDayRange(text);

    if (!title || data.taskType !== "monthly" || data.monthlyMode !== "fixed") {
      await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.missingCreateData, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    if (!range) {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.createPrompts.monthlyFixedWindow,
        buildCreateCancelKeyboard(labels)
      );
      return;
    }

    await updateUserSession(
      env,
      userId,
      CREATE_ONE_TIME_TASK_SCENARIO,
      "time",
      { ...data, startDay: range.startDay, endDay: range.endDay },
      now
    );
    await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.reminderTime, buildCreateCancelKeyboard(labels));
    return;
  }

  if (session.step === "monthly_end_plus_start_window") {
    const data = getSessionData<CreateOneTimeTaskSessionData>(session);
    const title = data.title?.trim();
    const window = parseEndPlusStartWindow(text);

    if (!title || data.taskType !== "monthly" || data.monthlyMode !== "end_plus_start") {
      await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.missingCreateData, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    if (!window) {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.createPrompts.endPlusStartWindow,
        buildCreateCancelKeyboard(labels)
      );
      return;
    }

    await updateUserSession(
      env,
      userId,
      CREATE_ONE_TIME_TASK_SCENARIO,
      "time",
      { ...data, lastDays: window.lastDays, firstDays: window.firstDays },
      now
    );
    await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.reminderTime, buildCreateCancelKeyboard(labels));
    return;
  }

  if (session.step === "monthly_last_days_window") {
    const data = getSessionData<CreateOneTimeTaskSessionData>(session);
    const title = data.title?.trim();
    const window = parseLastDaysWindow(text);

    if (!title || data.taskType !== "monthly" || data.monthlyMode !== "last_days") {
      await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.missingCreateData, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    if (!window) {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.createPrompts.lastDaysWindow,
        buildCreateCancelKeyboard(labels)
      );
      return;
    }

    await updateUserSession(
      env,
      userId,
      CREATE_ONE_TIME_TASK_SCENARIO,
      "time",
      { ...data, lastDays: window.lastDays, firstDays: window.firstDays },
      now
    );
    await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.reminderTime, buildCreateCancelKeyboard(labels));
    return;
  }

  if (session.step === "time") {
    const data = getSessionData<CreateOneTimeTaskSessionData>(session);
    const title = data.title?.trim();
    const time = parseLocalTime(text);

    if (!title) {
      await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.missingCreateData, getMainMenuKeyboard(isAdmin, labels));
      return;
    }

    if (!time) {
      await sendTrackedCreateFlowMessage(
        env,
        chatId,
        userId,
        now,
        labels.telegram.createPrompts.invalidTime,
        buildCreateCancelKeyboard(labels)
      );
      return;
    }

    if (data.taskType === "one_time_window") {
      if (!data.availableFrom || !data.dueAt || !data.windowDisplay) {
        await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
        await deleteStoredMessages(env, userId, ["create_flow"]);
        await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.missingCreateData, getMainMenuKeyboard(isAdmin, labels));
        return;
      }

      const assigneeUserIds = await resolveAssigneeUserIds(env, userId, data.assigneeMode, data.assigneeUserIds);

      if (assigneeUserIds.length === 0) {
        await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.selectedAssigneesUnavailable, buildAssigneeModeKeyboard(labels));
        return;
      }

      const taskId = await createOneTimeTask(env, {
        userId,
        assigneeUserIds,
        title,
        availableFrom: data.availableFrom,
        dueAt: data.dueAt,
        reminderHour: time.hour,
        reminderMinute: time.minute,
        timezone,
        now
      });
      await recordTelegramTaskCreated(env, userId, taskId, "one_time_window", assigneeUserIds.length, now);
      await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(
        env,
        chatId,
        labels.telegram.createPrompts.createdOneTimeWindow(
          title,
          getAssigneeSummary(data.assigneeMode, assigneeUserIds.length, labels),
          data.windowDisplay,
          time.display
        ),
        getMainMenuKeyboard(isAdmin, labels)
      );
      return;
    }

    if (data.taskType === "weekly") {
      const weekday = data.weekday;

      if (typeof weekday !== "number") {
        await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
        await deleteStoredMessages(env, userId, ["create_flow"]);
        await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.missingCreateData, getMainMenuKeyboard(isAdmin, labels));
        return;
      }

      const window = getNextWeeklyTaskWindow(now, weekday, time.hour, time.minute, timezone);

      if (!window) {
        await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.nextDueFailed, buildCreateCancelKeyboard(labels));
        return;
      }

      const assigneeUserIds = await resolveAssigneeUserIds(env, userId, data.assigneeMode, data.assigneeUserIds);

      if (assigneeUserIds.length === 0) {
        await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.selectedAssigneesUnavailable, buildAssigneeModeKeyboard(labels));
        return;
      }

      const taskId = await createWeeklyTask(env, {
        userId,
        assigneeUserIds,
        title,
        weekday,
        hour: time.hour,
        minute: time.minute,
        timezone,
        now
      });
      await recordTelegramTaskCreated(env, userId, taskId, "weekly", assigneeUserIds.length, now);
      await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(
        env,
        chatId,
        labels.telegram.createPrompts.createdWeekly(
          title,
          getAssigneeSummary(data.assigneeMode, assigneeUserIds.length, labels),
          getLocalizedWeekdayName(weekday, labels),
          time.display,
          window.dueDisplay
        ),
        getMainMenuKeyboard(isAdmin, labels)
      );
      return;
    }

    if (data.taskType === "monthly" && data.monthlyMode === "fixed") {
      if (typeof data.startDay !== "number" || typeof data.endDay !== "number") {
        await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
        await deleteStoredMessages(env, userId, ["create_flow"]);
        await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.missingCreateData, getMainMenuKeyboard(isAdmin, labels));
        return;
      }

      const assigneeUserIds = await resolveAssigneeUserIds(env, userId, data.assigneeMode, data.assigneeUserIds);

      if (assigneeUserIds.length === 0) {
        await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.selectedAssigneesUnavailable, buildAssigneeModeKeyboard(labels));
        return;
      }

      const taskId = await createMonthlyFixedTask(env, {
        userId,
        assigneeUserIds,
        title,
        startDay: data.startDay,
        endDay: data.endDay,
        hour: time.hour,
        minute: time.minute,
        timezone,
        now
      });
      await recordTelegramTaskCreated(env, userId, taskId, "monthly_fixed_window", assigneeUserIds.length, now);
      await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(
        env,
        chatId,
        labels.telegram.createPrompts.createdMonthly(
          title,
          getAssigneeSummary(data.assigneeMode, assigneeUserIds.length, labels),
          data.startDay === data.endDay ? String(data.startDay) : `${data.startDay}-${data.endDay}`,
          time.display
        ),
        getMainMenuKeyboard(isAdmin, labels)
      );
      return;
    }

    if (data.taskType === "monthly" && (data.monthlyMode === "end_plus_start" || data.monthlyMode === "last_days")) {
      if (typeof data.lastDays !== "number" || typeof data.firstDays !== "number") {
        await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
        await deleteStoredMessages(env, userId, ["create_flow"]);
        await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.missingCreateData, getMainMenuKeyboard(isAdmin, labels));
        return;
      }

      const assigneeUserIds = await resolveAssigneeUserIds(env, userId, data.assigneeMode, data.assigneeUserIds);

      if (assigneeUserIds.length === 0) {
        await sendTrackedCreateFlowMessage(env, chatId, userId, now, labels.telegram.createPrompts.selectedAssigneesUnavailable, buildAssigneeModeKeyboard(labels));
        return;
      }

      const taskId = await createMonthlyEndPlusStartTask(env, {
        userId,
        assigneeUserIds,
        title,
        lastDays: data.lastDays,
        firstDays: data.firstDays,
        hour: time.hour,
        minute: time.minute,
        timezone,
        now
      });
      await recordTelegramTaskCreated(env, userId, taskId, "monthly_end_plus_start_window", assigneeUserIds.length, now);
      await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
      await deleteStoredMessages(env, userId, ["create_flow"]);
      await sendTelegramMessage(
        env,
        chatId,
        labels.telegram.createPrompts.createdMonthly(
          title,
          getAssigneeSummary(data.assigneeMode, assigneeUserIds.length, labels),
          data.firstDays === 0 ? `${data.lastDays}+0` : `${data.lastDays}+${data.firstDays}`,
          time.display
        ),
        getMainMenuKeyboard(isAdmin, labels)
      );
      return;
    }

    await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
    await deleteStoredMessages(env, userId, ["create_flow"]);
    await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.reset, getMainMenuKeyboard(isAdmin, labels));
    return;
  }

  await clearUserSession(env, userId, CREATE_ONE_TIME_TASK_SCENARIO);
  await deleteStoredMessages(env, userId, ["create_flow"]);
  await sendTelegramMessage(env, chatId, labels.telegram.createPrompts.reset, getMainMenuKeyboard(isAdmin, labels));
}

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  if (!validateTelegramWebhookSecret(request, env)) {
    return jsonResponse({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;

  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const context = getTelegramUpdateContext(update);

  if (!context) {
    return jsonResponse({ ok: true, ignored: true, reason: "unsupported_update" });
  }

  const config = getAppConfig(env);
  const labels = getAppLabels(config.appLocale);
  const isBootstrapAdmin = config.adminTelegramUserIds.has(context.user.id);
  const existingUser = await getUserByTelegramId(env, context.user.id);

  if (!isBootstrapAdmin && (!existingUser || existingUser.is_active !== 1)) {
    await sendTelegramMessage(
      env,
      context.chat.id,
      labels.telegram.adminUsers.accessDenied
    );

    return jsonResponse({ ok: true, ignored: true, reason: "user_not_allowed" });
  }

  const now = new Date().toISOString();
  const storedUser = await upsertTelegramUser(env, context.user, context.chat, config.appTimezone, isBootstrapAdmin, now);
  const text = getTelegramUpdateText(update);
  const callbackData = getTelegramCallbackData(update);
  const activeSession = await getActiveUserSession(env, storedUser.id, now);

  if (text === "/start") {
    await clearUserSession(env, storedUser.id, CREATE_ONE_TIME_TASK_SCENARIO);
    await clearUserSession(env, storedUser.id, ADMIN_ADD_USER_SCENARIO);
    await clearUserSession(env, storedUser.id, EDIT_TASK_SCENARIO);
    await deleteStoredMessages(env, storedUser.id, ["create_flow"]);
    await sendTelegramMessage(
      env,
      context.chat.id,
      labels.telegram.messages.start,
      getMainMenuKeyboard(storedUser.is_admin === 1, labels)
    );
  } else if (callbackData === "tasks:mine") {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");
    await clearUserSession(env, storedUser.id, CREATE_ONE_TIME_TASK_SCENARIO);
    await clearUserSession(env, storedUser.id, EDIT_TASK_SCENARIO);
    await sendMyTasks(env, context.chat.id, storedUser.id, storedUser.is_admin === 1, labels, storedUser.timezone, now);
  } else if (callbackData === "tasks:family") {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");
    await clearUserSession(env, storedUser.id, CREATE_ONE_TIME_TASK_SCENARIO);
    await clearUserSession(env, storedUser.id, EDIT_TASK_SCENARIO);
    await sendFamilyTasks(env, context.chat.id, storedUser.id, storedUser.is_admin === 1, labels, storedUser.timezone, now);
  } else if (callbackData === "admin:users") {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");

    if (storedUser.is_admin !== 1) {
      await sendTelegramMessage(env, context.chat.id, labels.telegram.adminUsers.adminOnly, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      await sendAdminUsers(env, context.chat.id, labels);
    }
  } else if (callbackData === "admin:users:add") {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");

    if (storedUser.is_admin !== 1) {
      await sendTelegramMessage(env, context.chat.id, labels.telegram.adminUsers.adminOnly, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      await clearUserSession(env, storedUser.id, CREATE_ONE_TIME_TASK_SCENARIO);
      await clearUserSession(env, storedUser.id, EDIT_TASK_SCENARIO);
      await startAdminAddUserSession(env, storedUser.id, now);
      await sendTelegramMessage(
        env,
        context.chat.id,
        labels.telegram.adminUsers.addPrompt,
        buildAdminAddUserKeyboard(labels)
      );
    }
  } else if (callbackData === "admin:users:add:cancel") {
    await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.adminUsers.addCancelled);
    await clearUserSession(env, storedUser.id, ADMIN_ADD_USER_SCENARIO);
    await sendTelegramMessage(env, context.chat.id, labels.telegram.adminUsers.addCancelled, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
  } else if (callbackData?.startsWith("admin:users:disable:")) {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");

    if (storedUser.is_admin !== 1) {
      await sendTelegramMessage(env, context.chat.id, labels.telegram.adminUsers.deactivateAdminOnly, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const userId = Number(callbackData.slice("admin:users:disable:".length));

      if (!Number.isSafeInteger(userId) || userId <= 0) {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.adminUsers.invalidUser, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else {
        const disabledUser = await deactivateUserById(env, userId, now);

        if (!disabledUser) {
          await sendTelegramMessage(env, context.chat.id, labels.telegram.adminUsers.notFoundOrCannotDeactivate, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
        } else {
          await recordAuditEvent(env, {
            actorUserId: storedUser.id,
            action: "user.deactivated",
            entityType: "user",
            entityId: disabledUser.id,
            metadata: {
              source: "telegram",
              telegramUserId: disabledUser.telegram_user_id
            },
            now
          });
          await sendTelegramMessage(
            env,
            context.chat.id,
            labels.telegram.adminUsers.deactivated(formatUserName(disabledUser), disabledUser.telegram_user_id),
            getMainMenuKeyboard(storedUser.is_admin === 1, labels)
          );
        }
      }
    }
  } else if (callbackData?.startsWith("task:edit:field:")) {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");
    const rest = callbackData.slice("task:edit:field:".length);
    const separatorIndex = rest.lastIndexOf(":");
    const field = rest.slice(0, separatorIndex);
    const taskId = Number(rest.slice(separatorIndex + 1));

    if (
      !Number.isSafeInteger(taskId) ||
      taskId <= 0 ||
      (
        field !== "title" &&
        field !== "due_at" &&
        field !== "reminder_time" &&
        field !== "assignees" &&
        field !== "weekday" &&
        field !== "time" &&
        field !== "monthly_window"
      )
    ) {
      await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.invalidTaskType, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const task = await getEditableTaskForUser(env, taskId, storedUser.id, storedUser.is_admin === 1);

      if (!task) {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.notices.notFoundOrClosed, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else if (task.schedule_type !== "one_time" && task.schedule_type !== "weekly" && !isMonthlyScheduleType(task.schedule_type)) {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.taskTypeNotEditable, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else if (field === "due_at" && task.schedule_type !== "one_time") {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.dueAtOnlyOneTime, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else if (field === "due_at" && isOneTimeWindowTask(task)) {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.oneTimeWindowWebOnly, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else if (field === "reminder_time" && task.schedule_type !== "one_time") {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.reminderTimeOnlyRegularOneTime, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else if ((field === "weekday" || field === "time") && task.schedule_type !== "weekly") {
        if (field === "time" && isMonthlyScheduleType(task.schedule_type)) {
          const currentMonthlyParams = getMonthlyParamsFromTask(task);

          if (!currentMonthlyParams) {
            await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.monthlyScheduleReadFailed, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
          } else {
            await startEditTaskSession(env, storedUser.id, taskId, now, update.callback_query?.message?.message_id);
            await updateUserSession(
              env,
              storedUser.id,
              EDIT_TASK_SCENARIO,
              "time",
              currentMonthlyParams.scheduleType === "monthly_fixed_window"
                ? {
                    taskId,
                    field,
                    editMessageId: update.callback_query?.message?.message_id,
                    monthlyScheduleType: currentMonthlyParams.scheduleType,
                    startDay: currentMonthlyParams.startDay,
                    endDay: currentMonthlyParams.endDay
                  }
                : {
                    taskId,
                    field,
                    editMessageId: update.callback_query?.message?.message_id,
                    monthlyScheduleType: currentMonthlyParams.scheduleType,
                    lastDays: currentMonthlyParams.lastDays,
                    firstDays: currentMonthlyParams.firstDays
                  },
              now
            );
            await editCallbackMessageOrSendTracked(
              env,
              context.chat.id,
              storedUser.id,
              now,
              update.callback_query?.message?.message_id,
              labels.telegram.editPrompts.newReminderTime,
              buildEditCancelKeyboard(labels)
            );
          }
        } else {
          await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.weekdayOnlyWeekly, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
        }
      } else if (field === "monthly_window" && !isMonthlyScheduleType(task.schedule_type)) {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.monthlyOnly, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else if (field === "assignees") {
        await startEditTaskSession(env, storedUser.id, taskId, now, update.callback_query?.message?.message_id);
        const assigneeUserIds = await getTaskAssigneeUserIds(env, taskId, storedUser.id, storedUser.is_admin === 1);

        if (!assigneeUserIds) {
          await sendTelegramMessage(env, context.chat.id, labels.telegram.notices.notFoundOrClosed, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
        } else {
          await updateUserSession(
            env,
            storedUser.id,
            EDIT_TASK_SCENARIO,
            "assignees",
            { taskId, field, editMessageId: update.callback_query?.message?.message_id, assigneeUserIds },
            now
          );
          await editCallbackMessageOrSendTracked(
            env,
            context.chat.id,
            storedUser.id,
            now,
            update.callback_query?.message?.message_id,
            labels.telegram.createPrompts.selectAssignees,
            await buildEditAssigneesKeyboard(env, taskId, assigneeUserIds, labels)
          );
        }
      } else if (field === "weekday") {
        const currentParams = getWeeklyParamsFromTask(task);

        if (!currentParams) {
          await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.weeklyScheduleReadFailed, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
        } else {
          await startEditTaskSession(env, storedUser.id, taskId, now, update.callback_query?.message?.message_id);
          await updateUserSession(
            env,
            storedUser.id,
            EDIT_TASK_SCENARIO,
            "weekday",
            { taskId, field, editMessageId: update.callback_query?.message?.message_id, hour: currentParams.hour, minute: currentParams.minute },
            now
          );
          await editCallbackMessageOrSendTracked(
            env,
            context.chat.id,
            storedUser.id,
            now,
            update.callback_query?.message?.message_id,
            labels.telegram.editPrompts.chooseNewWeekday,
            buildEditWeekdayKeyboard(taskId, labels)
          );
        }
      } else if (field === "monthly_window") {
        const currentMonthlyParams = getMonthlyParamsFromTask(task);

        if (!currentMonthlyParams) {
          await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.monthlyScheduleReadFailed, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
        } else {
          await startEditTaskSession(env, storedUser.id, taskId, now, update.callback_query?.message?.message_id);
          await updateUserSession(
            env,
            storedUser.id,
            EDIT_TASK_SCENARIO,
            "monthly_window",
            currentMonthlyParams.scheduleType === "monthly_fixed_window"
              ? {
                  taskId,
                  field,
                  editMessageId: update.callback_query?.message?.message_id,
                  monthlyScheduleType: currentMonthlyParams.scheduleType,
                  hour: currentMonthlyParams.hour,
                  minute: currentMonthlyParams.minute
                }
              : {
                  taskId,
                  field,
                  editMessageId: update.callback_query?.message?.message_id,
                  monthlyScheduleType: currentMonthlyParams.scheduleType,
                  hour: currentMonthlyParams.hour,
                  minute: currentMonthlyParams.minute
                },
            now
          );
          await editCallbackMessageOrSendTracked(
            env,
            context.chat.id,
            storedUser.id,
            now,
            update.callback_query?.message?.message_id,
            currentMonthlyParams.scheduleType === "monthly_fixed_window"
              ? labels.telegram.createPrompts.monthlyFixedWindow
              : currentMonthlyParams.firstDays === 0
                ? labels.telegram.createPrompts.lastDaysWindow
                : labels.telegram.createPrompts.endPlusStartWindow,
            buildEditCancelKeyboard(labels)
          );
        }
      } else if (field === "due_at") {
        const currentParams = getOneTimeParamsFromTask(task);

        if (!currentParams) {
          await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.editDataMissing, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
        } else {
          await startEditTaskSession(env, storedUser.id, taskId, now, update.callback_query?.message?.message_id);
          await updateUserSession(
            env,
            storedUser.id,
            EDIT_TASK_SCENARIO,
            "due_at",
            {
              taskId,
              field,
              editMessageId: update.callback_query?.message?.message_id,
              hour: currentParams.hour,
              minute: currentParams.minute
            },
            now
          );
          await editCallbackMessageOrSendTracked(
            env,
            context.chat.id,
            storedUser.id,
            now,
            update.callback_query?.message?.message_id,
            labels.telegram.editPrompts.newDueDate,
            buildEditCancelKeyboard(labels)
          );
        }
      } else if (field === "reminder_time") {
        const currentParams = getOneTimeParamsFromTask(task);

        if (!currentParams) {
          await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.editDataMissing, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
        } else {
          await startEditTaskSession(env, storedUser.id, taskId, now, update.callback_query?.message?.message_id);
          await updateUserSession(
            env,
            storedUser.id,
            EDIT_TASK_SCENARIO,
            "reminder_time",
            {
              taskId,
              field,
              editMessageId: update.callback_query?.message?.message_id,
              availableFrom: currentParams.availableFrom,
              dueAt: currentParams.dueAt,
              dueDateDisplay: formatDateInTimeZone(currentParams.dueAt, storedUser.timezone)
            },
            now
          );
          await editCallbackMessageOrSendTracked(
            env,
            context.chat.id,
            storedUser.id,
            now,
            update.callback_query?.message?.message_id,
            labels.telegram.editPrompts.newReminderTime,
            buildEditCancelKeyboard(labels)
          );
        }
      } else {
        await startEditTaskSession(env, storedUser.id, taskId, now, update.callback_query?.message?.message_id);
        await updateUserSession(
          env,
          storedUser.id,
          EDIT_TASK_SCENARIO,
          field,
          { taskId, field, editMessageId: update.callback_query?.message?.message_id },
          now
        );
        await editCallbackMessageOrSendTracked(
          env,
          context.chat.id,
          storedUser.id,
          now,
          update.callback_query?.message?.message_id,
          field === "title"
            ? labels.telegram.editPrompts.newTitle
            : field === "time"
              ? labels.telegram.editPrompts.newReminderTime
              : labels.telegram.editPrompts.newDueDate,
          buildEditCancelKeyboard(labels)
        );
      }
    }
  } else if (callbackData?.startsWith("task:edit:weekday:")) {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");
    const rest = callbackData.slice("task:edit:weekday:".length);
    const [taskIdText, weekdayText] = rest.split(":");
    const taskId = Number(taskIdText);
    const weekday = Number(weekdayText);

    if (
      !activeSession ||
      activeSession.scenario !== EDIT_TASK_SCENARIO ||
      activeSession.step !== "weekday" ||
      !Number.isSafeInteger(taskId) ||
      taskId <= 0 ||
      !Number.isInteger(weekday) ||
      weekday < 1 ||
      weekday > 7
    ) {
      await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.notActual, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const data = getSessionData<EditTaskSessionData>(activeSession);
      const task = await getEditableTaskForUser(env, taskId, storedUser.id, storedUser.is_admin === 1);

      if (data.taskId !== taskId || !task || task.schedule_type !== "weekly") {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.notActual, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else {
        const currentParams = getWeeklyParamsFromTask(task);

        if (!currentParams) {
          await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.weeklyScheduleReadFailed, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
        } else {
          const nextData = {
            ...data,
            weekday,
            hour: data.hour ?? currentParams.hour,
            minute: data.minute ?? currentParams.minute
          };

          await updateUserSession(
            env,
            storedUser.id,
            EDIT_TASK_SCENARIO,
            "schedule_confirm",
            nextData,
            now
          );
          await editCallbackMessageOrSendTracked(
            env,
            context.chat.id,
            storedUser.id,
            now,
            update.callback_query?.message?.message_id,
            labels.telegram.editPrompts.scheduleConfirm([
              `${labels.telegram.fields.weekday}: ${getLocalizedWeekdayName(weekday, labels)}`,
              `${labels.telegram.fields.reminderTime}: ${String(nextData.hour).padStart(2, "0")}:${String(nextData.minute).padStart(2, "0")}`
            ]),
            buildEditScheduleConfirmKeyboard(taskId, labels)
          );
        }
      }
    }
  } else if (callbackData?.startsWith("task:edit:schedule:confirm:")) {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");
    const taskId = Number(callbackData.slice("task:edit:schedule:confirm:".length));

    if (
      !activeSession ||
      activeSession.scenario !== EDIT_TASK_SCENARIO ||
      activeSession.step !== "schedule_confirm" ||
      !Number.isSafeInteger(taskId) ||
      taskId <= 0
    ) {
      await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.notActual, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const data = getSessionData<EditTaskSessionData>(activeSession);

      if (data.taskId !== taskId || typeof data.hour !== "number" || typeof data.minute !== "number") {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.notActual, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else {
        if (typeof data.weekday === "number") {
          const task = await getEditableTaskForUser(env, taskId, storedUser.id, storedUser.is_admin === 1);
          const currentParams = task?.schedule_type === "weekly" ? getWeeklyParamsFromTask(task) : null;
          const result = await updateWeeklyTaskSchedule(
            env,
            taskId,
            storedUser.id,
            storedUser.is_admin === 1,
            data.weekday,
            data.hour,
            data.minute,
            now
          );

          if (result.status === "updated") {
            const changedFields = currentParams
              ? getTelegramWeeklyChangedFields(currentParams, { weekday: data.weekday, hour: data.hour, minute: data.minute })
              : ["weekday", "reminder_time"];
            const auditTaskId = result.newTaskId ?? taskId;

            await recordTelegramTaskUpdated(
              env,
              storedUser.id,
              auditTaskId,
              "weekly",
              changedFields,
              now,
              result.newTaskId ? taskId : null
            );
          }

          await clearUserSession(env, storedUser.id, EDIT_TASK_SCENARIO);
          await deleteStoredMessages(env, storedUser.id, ["create_flow"]);
          await editCallbackMessageOrSend(
            env,
            context.chat.id,
            update.callback_query?.message?.message_id,
            result.status === "updated"
              ? labels.telegram.editPrompts.weekdayChanged(getLocalizedWeekdayName(data.weekday, labels), `${String(data.hour).padStart(2, "0")}:${String(data.minute).padStart(2, "0")}`)
              : labels.telegram.notices.notFoundOrClosed,
            getMainMenuKeyboard(storedUser.is_admin === 1, labels)
          );
        } else if (
          data.monthlyScheduleType === "monthly_fixed_window" &&
          typeof data.startDay === "number" &&
          typeof data.endDay === "number"
        ) {
          const task = await getEditableTaskForUser(env, taskId, storedUser.id, storedUser.is_admin === 1);
          const currentParams = task && isMonthlyScheduleType(task.schedule_type) ? getMonthlyParamsFromTask(task) : null;
          const nextParams = {
            scheduleType: data.monthlyScheduleType,
            startDay: data.startDay,
            endDay: data.endDay,
            hour: data.hour,
            minute: data.minute
          } as const;
          const result = await updateMonthlyTaskSchedule(
            env,
            taskId,
            storedUser.id,
            storedUser.is_admin === 1,
            {
              scheduleType: data.monthlyScheduleType,
              startDay: data.startDay,
              endDay: data.endDay,
              hour: data.hour,
              minute: data.minute
            },
            now
          );

          if (result.status === "updated") {
            const changedFields = currentParams
              ? getTelegramMonthlyChangedFields(currentParams, nextParams)
              : ["window", "reminder_time"];
            const auditTaskId = result.newTaskId ?? taskId;

            await recordTelegramTaskUpdated(
              env,
              storedUser.id,
              auditTaskId,
              "monthly",
              changedFields,
              now,
              result.newTaskId ? taskId : null
            );
          }

          await clearUserSession(env, storedUser.id, EDIT_TASK_SCENARIO);
          await deleteStoredMessages(env, storedUser.id, ["create_flow"]);
          await editCallbackMessageOrSend(
            env,
            context.chat.id,
            update.callback_query?.message?.message_id,
            result.status === "updated"
              ? labels.telegram.editPrompts.monthlyWindowChanged(getMonthlyWindowSummary(data, labels) ?? labels.telegram.editPrompts.scheduleFallback, `${String(data.hour).padStart(2, "0")}:${String(data.minute).padStart(2, "0")}`)
              : labels.telegram.notices.notFoundOrClosed,
            getMainMenuKeyboard(storedUser.is_admin === 1, labels)
          );
        } else if (
          data.monthlyScheduleType === "monthly_end_plus_start_window" &&
          typeof data.lastDays === "number" &&
          typeof data.firstDays === "number"
        ) {
          const task = await getEditableTaskForUser(env, taskId, storedUser.id, storedUser.is_admin === 1);
          const currentParams = task && isMonthlyScheduleType(task.schedule_type) ? getMonthlyParamsFromTask(task) : null;
          const nextParams = {
            scheduleType: data.monthlyScheduleType,
            lastDays: data.lastDays,
            firstDays: data.firstDays,
            hour: data.hour,
            minute: data.minute
          } as const;
          const result = await updateMonthlyTaskSchedule(
            env,
            taskId,
            storedUser.id,
            storedUser.is_admin === 1,
            {
              scheduleType: data.monthlyScheduleType,
              lastDays: data.lastDays,
              firstDays: data.firstDays,
              hour: data.hour,
              minute: data.minute
            },
            now
          );

          if (result.status === "updated") {
            const changedFields = currentParams
              ? getTelegramMonthlyChangedFields(currentParams, nextParams)
              : ["window", "reminder_time"];
            const auditTaskId = result.newTaskId ?? taskId;

            await recordTelegramTaskUpdated(
              env,
              storedUser.id,
              auditTaskId,
              "monthly",
              changedFields,
              now,
              result.newTaskId ? taskId : null
            );
          }

          await clearUserSession(env, storedUser.id, EDIT_TASK_SCENARIO);
          await deleteStoredMessages(env, storedUser.id, ["create_flow"]);
          await editCallbackMessageOrSend(
            env,
            context.chat.id,
            update.callback_query?.message?.message_id,
            result.status === "updated"
              ? labels.telegram.editPrompts.monthlyWindowChanged(getMonthlyWindowSummary(data, labels) ?? labels.telegram.editPrompts.scheduleFallback, `${String(data.hour).padStart(2, "0")}:${String(data.minute).padStart(2, "0")}`)
              : labels.telegram.notices.notFoundOrClosed,
            getMainMenuKeyboard(storedUser.is_admin === 1, labels)
          );
        } else {
          await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.notActual, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
        }
      }
    }
  } else if (callbackData?.startsWith("task:edit:assignee_toggle:")) {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");
    const rest = callbackData.slice("task:edit:assignee_toggle:".length);
    const [taskIdText, userIdText] = rest.split(":");
    const taskId = Number(taskIdText);
    const userIdToToggle = Number(userIdText);

    if (
      !activeSession ||
      activeSession.scenario !== EDIT_TASK_SCENARIO ||
      activeSession.step !== "assignees" ||
      !Number.isSafeInteger(taskId) ||
      taskId <= 0 ||
      !Number.isSafeInteger(userIdToToggle) ||
      userIdToToggle <= 0
    ) {
      await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.notActual, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const data = getSessionData<EditTaskSessionData>(activeSession);

      if (data.taskId !== taskId) {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.notActual, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else {
        const activeUsers = await getActiveUsers(env);
        const activeUserIds = new Set(activeUsers.map((user) => user.id));
        const selected = new Set((data.assigneeUserIds ?? []).filter((id) => activeUserIds.has(id)));

        if (selected.has(userIdToToggle)) {
          selected.delete(userIdToToggle);
        } else if (activeUserIds.has(userIdToToggle)) {
          selected.add(userIdToToggle);
        }

        const selectedUserIds = Array.from(selected);

        await updateUserSession(
          env,
          storedUser.id,
          EDIT_TASK_SCENARIO,
          "assignees",
          { ...data, assigneeUserIds: selectedUserIds },
          now
        );

        const callbackMessageId = update.callback_query?.message?.message_id;
        const keyboard = await buildEditAssigneesKeyboard(env, taskId, selectedUserIds, labels);

        if (callbackMessageId) {
          try {
            await editTelegramMessageText(
              env,
              context.chat.id,
              callbackMessageId,
              labels.telegram.createPrompts.selectAssignees,
              keyboard
            );
          } catch {
            await sendTrackedCreateFlowMessage(
              env,
              context.chat.id,
              storedUser.id,
              now,
              labels.telegram.createPrompts.selectAssignees,
              keyboard
            );
          }
        } else {
          await sendTrackedCreateFlowMessage(
            env,
            context.chat.id,
            storedUser.id,
            now,
            labels.telegram.createPrompts.selectAssignees,
            keyboard
          );
        }
      }
    }
  } else if (callbackData?.startsWith("task:edit:assignees:done:")) {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");
    const taskId = Number(callbackData.slice("task:edit:assignees:done:".length));

    if (
      !activeSession ||
      activeSession.scenario !== EDIT_TASK_SCENARIO ||
      activeSession.step !== "assignees" ||
      !Number.isSafeInteger(taskId) ||
      taskId <= 0
    ) {
      await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.notActual, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const data = getSessionData<EditTaskSessionData>(activeSession);
      const assigneeUserIds = await resolveAssigneeUserIds(env, storedUser.id, "selected", data.assigneeUserIds);

      if (data.taskId !== taskId) {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.notActual, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else if (assigneeUserIds.length === 0) {
        await editCallbackMessageOrSendTracked(
          env,
          context.chat.id,
          storedUser.id,
          now,
          update.callback_query?.message?.message_id,
          labels.telegram.createPrompts.selectAtLeastOneAssignee,
          await buildEditAssigneesKeyboard(env, taskId, data.assigneeUserIds ?? [], labels)
        );
      } else {
        const task = await getEditableTaskForUser(env, taskId, storedUser.id, storedUser.is_admin === 1);

        if (!task) {
          await sendTelegramMessage(env, context.chat.id, labels.telegram.notices.notFoundOrClosed, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
        } else if (task.schedule_type === "weekly" || isMonthlyScheduleType(task.schedule_type)) {
          await updateUserSession(
            env,
            storedUser.id,
            EDIT_TASK_SCENARIO,
            "assignees_apply",
            { ...data, assigneeUserIds },
            now
          );
          await editCallbackMessageOrSendTracked(
            env,
            context.chat.id,
            storedUser.id,
            now,
            update.callback_query?.message?.message_id,
            task.schedule_type === "weekly"
              ? labels.telegram.editPrompts.applyWeeklyAssignees
              : labels.telegram.editPrompts.applyMonthlyAssignees,
            buildEditAssigneesApplyKeyboard(taskId, labels)
          );
        } else {
          const result = await updateOneTimeTaskAssignees(
            env,
            taskId,
            storedUser.id,
            storedUser.is_admin === 1,
            assigneeUserIds,
            now
          );

          if (result.status === "updated") {
            await recordTelegramTaskUpdated(env, storedUser.id, taskId, "one_time", ["assignees"], now);
          }

          await clearUserSession(env, storedUser.id, EDIT_TASK_SCENARIO);
          await deleteStoredMessages(env, storedUser.id, ["create_flow"]);
          await editCallbackMessageOrSend(
            env,
            context.chat.id,
            update.callback_query?.message?.message_id,
            result.status === "updated"
              ? labels.telegram.editPrompts.assigneesChanged(getAssigneeSummary("selected", assigneeUserIds.length, labels))
              : labels.telegram.notices.notFoundOrClosed,
            getMainMenuKeyboard(storedUser.is_admin === 1, labels)
          );
        }
      }
    }
  } else if (
    callbackData?.startsWith("task:edit:assignees:apply_future:") ||
    callbackData?.startsWith("task:edit:assignees:apply_current:")
  ) {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");
    const applyToCurrent = callbackData.startsWith("task:edit:assignees:apply_current:");
    const prefix = applyToCurrent ? "task:edit:assignees:apply_current:" : "task:edit:assignees:apply_future:";
    const taskId = Number(callbackData.slice(prefix.length));

    if (
      !activeSession ||
      activeSession.scenario !== EDIT_TASK_SCENARIO ||
      activeSession.step !== "assignees_apply" ||
      !Number.isSafeInteger(taskId) ||
      taskId <= 0
    ) {
      await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.notActual, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const data = getSessionData<EditTaskSessionData>(activeSession);
      const assigneeUserIds = await resolveAssigneeUserIds(env, storedUser.id, "selected", data.assigneeUserIds);

      if (data.taskId !== taskId || assigneeUserIds.length === 0) {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.notActual, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else {
        const task = await getEditableTaskForUser(env, taskId, storedUser.id, storedUser.is_admin === 1);

        if (!task || (task.schedule_type !== "weekly" && !isMonthlyScheduleType(task.schedule_type))) {
          await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.notActual, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
        } else {
          const result = task.schedule_type === "weekly"
            ? await updateWeeklyTaskAssignees(
                env,
                taskId,
                storedUser.id,
                storedUser.is_admin === 1,
                assigneeUserIds,
                applyToCurrent,
                now
              )
            : await updateMonthlyTaskAssignees(
                env,
                taskId,
                storedUser.id,
                storedUser.is_admin === 1,
                assigneeUserIds,
                applyToCurrent,
                now
              );

          if (result.status === "updated") {
            await recordTelegramTaskUpdated(
              env,
              storedUser.id,
              taskId,
              task.schedule_type === "weekly" ? "weekly" : "monthly",
              ["assignees"],
              now
            );
          }

          await clearUserSession(env, storedUser.id, EDIT_TASK_SCENARIO);
          await deleteStoredMessages(env, storedUser.id, ["create_flow"]);
          await editCallbackMessageOrSend(
            env,
            context.chat.id,
            update.callback_query?.message?.message_id,
            result.status === "updated"
              ? labels.telegram.editPrompts.assigneesChanged(getAssigneeSummary("selected", assigneeUserIds.length, labels))
              : labels.telegram.notices.notFoundOrClosed,
            getMainMenuKeyboard(storedUser.is_admin === 1, labels)
          );
        }
      }
    }
  } else if (callbackData === "task:edit:cancel") {
    await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.editPrompts.cancelled);
    const data = activeSession?.scenario === EDIT_TASK_SCENARIO
      ? getSessionData<EditTaskSessionData>(activeSession)
      : null;
    const task = data
      ? await getActiveTaskForViewer(env, data.taskId, storedUser.id, storedUser.is_admin === 1)
      : null;
    const callbackMessageId = update.callback_query?.message?.message_id;

    await clearUserSession(env, storedUser.id, EDIT_TASK_SCENARIO);
    await deleteStoredMessages(env, storedUser.id, ["create_flow"]);

    if (task && callbackMessageId) {
      try {
        await editTelegramMessageText(
          env,
          context.chat.id,
          callbackMessageId,
          buildTaskCardText(task, storedUser.timezone, labels),
          buildTaskCardKeyboard(task, storedUser.is_admin === 1, labels),
          { parseMode: "HTML" }
        );
      } catch {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.cancelled, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      }
    } else {
      await sendTelegramMessage(env, context.chat.id, labels.telegram.editPrompts.cancelled, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    }
  } else if (callbackData?.startsWith("task:edit:")) {
    const taskId = Number(callbackData.slice("task:edit:".length));

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.editPrompts.invalidTaskType);
    } else {
      const task = await getEditableTaskForUser(env, taskId, storedUser.id, storedUser.is_admin === 1);

      if (!task) {
        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.notFoundOrClosed);
      } else if (task.schedule_type !== "one_time" && task.schedule_type !== "weekly" && !isMonthlyScheduleType(task.schedule_type)) {
        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.editPrompts.taskTypeNotEditable);
      } else {
        await answerCallbackQuery(env, update.callback_query?.id ?? "");
        await deleteStoredMessages(env, storedUser.id, ["create_flow"]);
        await clearUserSession(env, storedUser.id, CREATE_ONE_TIME_TASK_SCENARIO);
        await clearUserSession(env, storedUser.id, ADMIN_ADD_USER_SCENARIO);
        await startEditTaskSession(env, storedUser.id, taskId, now, update.callback_query?.message?.message_id);
        await editCallbackMessageOrSendTracked(
          env,
          context.chat.id,
          storedUser.id,
          now,
          update.callback_query?.message?.message_id,
          labels.telegram.editPrompts.chooseFieldFor(task.title),
          buildEditFieldKeyboard(taskId, task.schedule_type, labels)
        );
      }
    }
  } else if (callbackData?.startsWith("task:done:")) {
    const taskId = Number(callbackData.slice("task:done:".length));

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.invalidTask);
    } else {
      const result = await completeTaskForUser(env, taskId, storedUser.id, storedUser.is_admin === 1, now);

      if (result.status === "not_found_or_closed") {
        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.notFoundOrClosed);
      } else {
        const resultTitle = result.title ?? labels.telegram.taskTypes.fallback;

        await recordAuditEvent(env, {
          actorUserId: storedUser.id,
          action: "task.completed",
          entityType: "task",
          entityId: taskId,
          metadata: {
            source: "telegram",
            resultStatus: result.status
          },
          now
        });
        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.done);
        await editCallbackMessageOrSend(
          env,
          context.chat.id,
          update.callback_query?.message?.message_id,
          labels.telegram.results.done(resultTitle),
          getMainMenuKeyboard(storedUser.is_admin === 1, labels)
        );
      }
    }
  } else if (callbackData?.startsWith("task:miss:")) {
    const taskId = Number(callbackData.slice("task:miss:".length));

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.invalidTask);
    } else {
      const result = await missTaskForUser(env, taskId, storedUser.id, storedUser.is_admin === 1, now);

      if (result.status === "not_found_or_closed") {
        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.notFoundOrClosedOrNotOverdue);
      } else {
        const resultTitle = result.title ?? labels.telegram.taskTypes.fallback;

        await recordAuditEvent(env, {
          actorUserId: storedUser.id,
          action: "task.missed",
          entityType: "task",
          entityId: taskId,
          metadata: {
            source: "telegram"
          },
          now
        });
        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.missed);
        await editCallbackMessageOrSend(
          env,
          context.chat.id,
          update.callback_query?.message?.message_id,
          labels.telegram.results.missed(resultTitle),
          getMainMenuKeyboard(storedUser.is_admin === 1, labels)
        );
      }
    }
  } else if (callbackData?.startsWith("task:cancel:")) {
    const taskId = Number(callbackData.slice("task:cancel:".length));

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.invalidTask);
    } else {
      const result = await cancelTaskForUser(env, taskId, storedUser.id, now);

      if (result.status === "not_found_or_closed") {
        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.notFoundOrClosed);
      } else {
        const resultTitle = result.title ?? labels.telegram.taskTypes.fallback;

        await recordAuditEvent(env, {
          actorUserId: storedUser.id,
          action: "task.cancelled",
          entityType: "task",
          entityId: taskId,
          metadata: {
            source: "telegram"
          },
          now
        });
        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.cancelled);
        await editCallbackMessageOrSend(
          env,
          context.chat.id,
          update.callback_query?.message?.message_id,
          labels.telegram.results.cancelled(resultTitle),
          getMainMenuKeyboard(storedUser.is_admin === 1, labels)
        );
      }
    }
  } else if (callbackData?.startsWith("task:delete:ask:")) {
    const taskId = Number(callbackData.slice("task:delete:ask:".length));

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.invalidTask);
    } else {
      const preview = await getTaskDeletePreview(env, taskId, storedUser.id, storedUser.is_admin === 1);

      if (preview.status === "not_found_or_closed" || !preview.title || typeof preview.isRecurring !== "boolean") {
        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.notFoundOrClosed);
      } else {
        await answerCallbackQuery(env, update.callback_query?.id ?? "");
        const callbackMessageId = update.callback_query?.message?.message_id;

        if (callbackMessageId) {
          try {
            await editTelegramMessageText(
              env,
              context.chat.id,
              callbackMessageId,
              buildDeleteConfirmText(preview.title, preview.isRecurring, labels),
              buildDeleteConfirmKeyboard(taskId, labels)
            );
          } catch {
            await sendTelegramMessage(
              env,
              context.chat.id,
              buildDeleteConfirmText(preview.title, preview.isRecurring, labels),
              buildDeleteConfirmKeyboard(taskId, labels)
            );
          }
        } else {
          await sendTelegramMessage(
            env,
            context.chat.id,
            buildDeleteConfirmText(preview.title, preview.isRecurring, labels),
            buildDeleteConfirmKeyboard(taskId, labels)
          );
        }
      }
    }
  } else if (callbackData?.startsWith("task:delete:confirm:")) {
    const taskId = Number(callbackData.slice("task:delete:confirm:".length));

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.invalidTask);
    } else {
      const result = await deleteTaskForUser(env, taskId, storedUser.id, storedUser.is_admin === 1, now);

      if (result.status === "not_found_or_closed") {
        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.notFoundOrClosed);
      } else {
        const resultTitle = result.title ?? labels.telegram.taskTypes.fallback;

        await recordAuditEvent(env, {
          actorUserId: storedUser.id,
          action: "task.deleted",
          entityType: "task",
          entityId: taskId,
          metadata: {
            source: "telegram",
            resultStatus: result.status
          },
          now
        });
        const resultText = result.status === "deleted_rule"
          ? labels.telegram.results.deletedRule(resultTitle)
          : labels.telegram.results.deletedInstance(resultTitle);

        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.deleted);
        const callbackMessageId = update.callback_query?.message?.message_id;
        const mainMenuKeyboard = getMainMenuKeyboard(storedUser.is_admin === 1, labels);

        if (callbackMessageId) {
          try {
            await editTelegramMessageText(env, context.chat.id, callbackMessageId, resultText, mainMenuKeyboard);
          } catch {
            await sendTelegramMessage(env, context.chat.id, resultText, mainMenuKeyboard);
          }
        } else {
          await sendTelegramMessage(env, context.chat.id, resultText, mainMenuKeyboard);
        }
      }
    }
  } else if (callbackData?.startsWith("task:delete:cancel:")) {
    const taskId = Number(callbackData.slice("task:delete:cancel:".length));

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.invalidTask);
    } else {
      await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.deleteCancelled);

      const task = await getActiveTaskForUser(env, taskId, storedUser.id);
      const callbackMessageId = update.callback_query?.message?.message_id;

      if (!task || !callbackMessageId) {
        await sendTelegramMessage(env, context.chat.id, labels.telegram.results.deleteCancelled, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
      } else {
        try {
          await editTelegramMessageText(
            env,
            context.chat.id,
            callbackMessageId,
            buildTaskCardText(task, storedUser.timezone, labels),
            buildTaskCardKeyboard(task, storedUser.is_admin === 1, labels),
            { parseMode: "HTML" }
          );
        } catch {
          await sendTelegramMessage(
            env,
            context.chat.id,
            buildTaskCardText(task, storedUser.timezone, labels),
            buildTaskCardKeyboard(task, storedUser.is_admin === 1, labels),
            { parseMode: "HTML" }
          );
        }
      }
    }
  } else if (callbackData === "task:delete:cancel") {
    await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.deleteCancelled);
    await sendTelegramMessage(env, context.chat.id, labels.telegram.results.deleteCancelled, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
  } else if (callbackData?.startsWith("task:snooze:")) {
    const taskId = Number(callbackData.slice("task:snooze:".length));

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.invalidTask);
    } else {
      const result = await snoozeTaskForUser(env, taskId, storedUser.id, now, 60);

      if (result.status === "not_found_or_closed" || !result.nextRemindAt) {
        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.notFoundOrClosed);
      } else {
        const nextRemindAt = formatDateTimeInTimeZone(result.nextRemindAt, storedUser.timezone);
        const resultTitle = result.title ?? labels.telegram.taskTypes.fallback;

        await recordAuditEvent(env, {
          actorUserId: storedUser.id,
          action: "task.snoozed",
          entityType: "task",
          entityId: taskId,
          metadata: {
            source: "telegram",
            snoozeMinutes: 60,
            nextRemindAt: result.nextRemindAt
          },
          now
        });

        await answerCallbackQuery(env, update.callback_query?.id ?? "", labels.telegram.notices.snoozedOneHour);
        await sendTelegramMessage(
          env,
          context.chat.id,
          labels.telegram.results.snoozed(resultTitle, nextRemindAt),
          getMainMenuKeyboard(storedUser.is_admin === 1, labels)
        );
      }
    }
  } else if (callbackData?.startsWith("task:create:type:")) {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");

    if (!activeSession || activeSession.scenario !== CREATE_ONE_TIME_TASK_SCENARIO) {
      await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.createAgain, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const taskType = callbackData.slice("task:create:type:".length);

      if (taskType !== "one_time" && taskType !== "one_time_window" && taskType !== "weekly" && taskType !== "monthly") {
        await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.invalidTaskType, buildTaskTypeKeyboard(labels));
      } else {
        await updateUserSession(
          env,
          storedUser.id,
          CREATE_ONE_TIME_TASK_SCENARIO,
          "assignees",
          { taskType },
          now
        );
        await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.chooseAssignees, buildAssigneeModeKeyboard(labels));
      }
    }
  } else if (callbackData?.startsWith("task:create:assignees:") && callbackData !== "task:create:assignees:done") {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");

    if (!activeSession || activeSession.scenario !== CREATE_ONE_TIME_TASK_SCENARIO) {
      await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.createAgain, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const assigneeMode = callbackData.slice("task:create:assignees:".length);
      const data = getSessionData<CreateOneTimeTaskSessionData>(activeSession);

      if (activeSession.step !== "assignees" || !data.taskType) {
        await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.chooseAssignees, buildAssigneeModeKeyboard(labels));
      } else if (assigneeMode === "self" || assigneeMode === "all") {
        await updateUserSession(
          env,
          storedUser.id,
          CREATE_ONE_TIME_TASK_SCENARIO,
          "title",
          { ...data, assigneeMode },
          now
        );
        await sendTrackedCreateFlowMessage(
          env,
          context.chat.id,
          storedUser.id,
          now,
          labels.telegram.createPrompts.title,
          buildCreateCancelKeyboard(labels)
        );
      } else if (assigneeMode === "selected") {
        const users = await getActiveUsers(env);
        const selectedUserIds = users.some((user) => user.id === storedUser.id)
          ? [storedUser.id]
          : users.slice(0, 1).map((user) => user.id);

        await updateUserSession(
          env,
          storedUser.id,
          CREATE_ONE_TIME_TASK_SCENARIO,
          "assignee_selection",
          { ...data, assigneeMode, assigneeUserIds: selectedUserIds },
          now
        );
        await sendTrackedCreateFlowMessage(
          env,
          context.chat.id,
          storedUser.id,
          now,
          labels.telegram.createPrompts.selectAssignees,
          await buildSelectedAssigneesKeyboard(env, selectedUserIds, labels)
        );
      } else {
        await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.chooseAssignees, buildAssigneeModeKeyboard(labels));
      }
    }
  } else if (callbackData?.startsWith("task:create:assignee_toggle:")) {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");

    if (!activeSession || activeSession.scenario !== CREATE_ONE_TIME_TASK_SCENARIO) {
      await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.createAgain, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const userIdToToggle = Number(callbackData.slice("task:create:assignee_toggle:".length));
      const data = getSessionData<CreateOneTimeTaskSessionData>(activeSession);

      if (
        activeSession.step !== "assignee_selection" ||
        data.assigneeMode !== "selected" ||
        !Number.isSafeInteger(userIdToToggle) ||
        userIdToToggle <= 0
      ) {
        await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.selectAssigneesByButtons, buildAssigneeModeKeyboard(labels));
      } else {
        const activeUsers = await getActiveUsers(env);
        const activeUserIds = new Set(activeUsers.map((user) => user.id));
        const selected = new Set((data.assigneeUserIds ?? []).filter((id) => activeUserIds.has(id)));

        if (selected.has(userIdToToggle)) {
          selected.delete(userIdToToggle);
        } else if (activeUserIds.has(userIdToToggle)) {
          selected.add(userIdToToggle);
        }

        const selectedUserIds = Array.from(selected);

        await updateUserSession(
          env,
          storedUser.id,
          CREATE_ONE_TIME_TASK_SCENARIO,
          "assignee_selection",
          { ...data, assigneeUserIds: selectedUserIds },
          now
        );
        const callbackMessageId = update.callback_query?.message?.message_id;
        const keyboard = await buildSelectedAssigneesKeyboard(env, selectedUserIds, labels);

        if (callbackMessageId) {
          try {
            await editTelegramMessageText(
              env,
              context.chat.id,
              callbackMessageId,
              labels.telegram.createPrompts.selectAssignees,
              keyboard
            );
          } catch {
            await sendTrackedCreateFlowMessage(
              env,
              context.chat.id,
              storedUser.id,
              now,
              labels.telegram.createPrompts.selectAssignees,
              keyboard
            );
          }
        } else {
          await sendTrackedCreateFlowMessage(
            env,
            context.chat.id,
            storedUser.id,
            now,
            labels.telegram.createPrompts.selectAssignees,
            keyboard
          );
        }
      }
    }
  } else if (callbackData === "task:create:assignees:done") {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");

    if (!activeSession || activeSession.scenario !== CREATE_ONE_TIME_TASK_SCENARIO) {
      await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.createAgain, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const data = getSessionData<CreateOneTimeTaskSessionData>(activeSession);
      const assigneeUserIds = await resolveAssigneeUserIds(env, storedUser.id, data.assigneeMode, data.assigneeUserIds);

      if (activeSession.step !== "assignee_selection" || data.assigneeMode !== "selected") {
        await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.chooseAssignees, buildAssigneeModeKeyboard(labels));
      } else if (assigneeUserIds.length === 0) {
        await sendTrackedCreateFlowMessage(
          env,
          context.chat.id,
          storedUser.id,
          now,
          labels.telegram.createPrompts.selectAtLeastOneAssignee,
          await buildSelectedAssigneesKeyboard(env, data.assigneeUserIds ?? [], labels)
        );
      } else {
        await updateUserSession(
          env,
          storedUser.id,
          CREATE_ONE_TIME_TASK_SCENARIO,
          "title",
          { ...data, assigneeUserIds },
          now
        );
        await sendTrackedCreateFlowMessage(
          env,
          context.chat.id,
          storedUser.id,
          now,
          labels.telegram.createPrompts.title,
          buildCreateCancelKeyboard(labels)
        );
      }
    }
  } else if (callbackData?.startsWith("task:create:monthly_mode:")) {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");

    if (!activeSession || activeSession.scenario !== CREATE_ONE_TIME_TASK_SCENARIO) {
      await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.createAgain, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const monthlyMode = callbackData.slice("task:create:monthly_mode:".length);
      const data = getSessionData<CreateOneTimeTaskSessionData>(activeSession);

      if (activeSession.step !== "monthly_mode" || data.taskType !== "monthly") {
        await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.chooseMonthlyMode, buildMonthlyModeKeyboard(labels));
      } else if (monthlyMode === "fixed") {
        await updateUserSession(
          env,
          storedUser.id,
          CREATE_ONE_TIME_TASK_SCENARIO,
          "monthly_fixed_window",
          { ...data, monthlyMode },
          now
        );
        await sendTrackedCreateFlowMessage(
          env,
          context.chat.id,
          storedUser.id,
          now,
          labels.telegram.createPrompts.monthlyFixedWindow,
          buildCreateCancelKeyboard(labels)
        );
      } else if (monthlyMode === "end_plus_start") {
        await updateUserSession(
          env,
          storedUser.id,
          CREATE_ONE_TIME_TASK_SCENARIO,
          "monthly_end_plus_start_window",
          { ...data, monthlyMode },
          now
        );
        await sendTrackedCreateFlowMessage(
          env,
          context.chat.id,
          storedUser.id,
          now,
          labels.telegram.createPrompts.endPlusStartWindow,
          buildCreateCancelKeyboard(labels)
        );
      } else if (monthlyMode === "last_days") {
        await updateUserSession(
          env,
          storedUser.id,
          CREATE_ONE_TIME_TASK_SCENARIO,
          "monthly_last_days_window",
          { ...data, monthlyMode },
          now
        );
        await sendTrackedCreateFlowMessage(
          env,
          context.chat.id,
          storedUser.id,
          now,
          labels.telegram.createPrompts.lastDaysWindow,
          buildCreateCancelKeyboard(labels)
        );
      } else {
        await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.invalidMonthlyMode, buildMonthlyModeKeyboard(labels));
      }
    }
  } else if (callbackData?.startsWith("task:create:weekday:")) {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");

    if (!activeSession || activeSession.scenario !== CREATE_ONE_TIME_TASK_SCENARIO) {
      await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.createAgain, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      const weekday = Number(callbackData.slice("task:create:weekday:".length));
      const data = getSessionData<CreateOneTimeTaskSessionData>(activeSession);

      if (
        activeSession.step !== "weekday" ||
        data.taskType !== "weekly" ||
        !Number.isInteger(weekday) ||
        weekday < 1 ||
        weekday > 7
      ) {
        await sendTrackedCreateFlowMessage(env, context.chat.id, storedUser.id, now, labels.telegram.createPrompts.chooseWeekday, buildWeekdayKeyboard(labels));
      } else {
        await updateUserSession(
          env,
          storedUser.id,
          CREATE_ONE_TIME_TASK_SCENARIO,
          "time",
          { ...data, weekday },
          now
        );
        await sendTrackedCreateFlowMessage(
          env,
          context.chat.id,
          storedUser.id,
          now,
          `${labels.telegram.fields.weekday}: ${getLocalizedWeekdayName(weekday, labels)}\n${labels.telegram.createPrompts.reminderTime}`,
          buildCreateCancelKeyboard(labels)
        );
      }
    }
  } else if (callbackData === "task:create:cancel") {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");
    await clearUserSession(env, storedUser.id, CREATE_ONE_TIME_TASK_SCENARIO);
    await deleteStoredMessages(env, storedUser.id, ["create_flow"]);
    await sendTelegramMessage(env, context.chat.id, labels.telegram.createPrompts.cancelled, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
  } else if (callbackData === "task:create") {
    await answerCallbackQuery(env, update.callback_query?.id ?? "");
    await deleteStoredMessages(env, storedUser.id, ["create_flow"]);
    await clearUserSession(env, storedUser.id, EDIT_TASK_SCENARIO);
    await startCreateTaskSession(env, storedUser.id, now);
    await sendTrackedCreateFlowMessage(
      env,
      context.chat.id,
      storedUser.id,
      now,
      labels.telegram.createPrompts.chooseTaskType,
      buildTaskTypeKeyboard(labels)
    );
  } else if (text !== null && activeSession?.scenario === ADMIN_ADD_USER_SCENARIO) {
    if (storedUser.is_admin !== 1) {
      await clearUserSession(env, storedUser.id, ADMIN_ADD_USER_SCENARIO);
      await sendTelegramMessage(env, context.chat.id, labels.telegram.adminUsers.adminOnly, getMainMenuKeyboard(storedUser.is_admin === 1, labels));
    } else {
      await handleAdminAddUserSession(
        env,
        context.chat.id,
        storedUser.id,
        storedUser.is_admin === 1,
        labels,
        storedUser.timezone,
        now,
        text
      );
    }
  } else if (text !== null && activeSession?.scenario === EDIT_TASK_SCENARIO) {
    await handleEditTaskSession(
      env,
      context.chat.id,
      storedUser.id,
      storedUser.is_admin === 1,
      labels,
      storedUser.timezone,
      now,
      activeSession,
      text,
      update.message?.message_id ?? null
    );
  } else if (text !== null && activeSession) {
    await handleCreateTaskSession(
      env,
      context.chat.id,
      storedUser.id,
      storedUser.is_admin === 1,
      labels,
      storedUser.timezone,
      now,
      activeSession,
      text,
      update.message?.message_id ?? null
    );
  } else if (text !== null) {
    await sendTelegramMessage(
      env,
      context.chat.id,
      labels.telegram.createPrompts.useMenuOrStart,
      getMainMenuKeyboard(storedUser.is_admin === 1, labels)
    );
  }

  return jsonResponse({
    ok: true,
    user_id: storedUser.id
  });
}
