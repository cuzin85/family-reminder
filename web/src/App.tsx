import { Check, CheckSquare, CircleSlash, Download, Globe2, History as HistoryIcon, LogIn, LogOut, Pencil, Plus, RefreshCw, ShieldCheck, Square, Trash2 } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getAppLabels, type AppLabels, type AppLocale } from "../../src/i18n";
import type { CurrentUser, HistoryScope, MaintenanceCleanupPreview, MonthlyTaskUpdate, TaskAuditItem, TaskCreateInput, TaskDeletePreview, OneTimeTaskUpdate, TaskHistoryItem, TaskListItem, UserListItem, WeeklyTaskUpdate } from "./api";
import {
  addUser,
  completeTask,
  createTask,
  deleteTask,
  deactivateUser,
  downloadAdminExport,
  getAssignees,
  getAppConfig,
  getCurrentUser,
  getFamilyTasks,
  getMaintenanceCleanupPreview,
  getMyTasks,
  getTaskAudit,
  getTaskHistory,
  getTaskDeletePreview,
  getUsers,
  missTask,
  runMaintenanceCleanup,
  setApiLabels,
  updateCurrentUserTimezone,
  updateMonthlyTask,
  updateOneTimeTask,
  updateWeeklyTask
} from "./api";
import { Badge, Button, Modal, Panel } from "./components";

const DEFAULT_LABELS = getAppLabels("ru");
const I18nContext = createContext<AppLabels>(DEFAULT_LABELS);

function useI18n(): AppLabels {
  return useContext(I18nContext);
}

type LoadState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "ready"; user: CurrentUser }
  | { status: "error"; message: string };

type ConfigLoadState =
  | { status: "loading" }
  | { status: "ready"; appLocale: AppLocale; telegramBotUsername: string }
  | { status: "error"; message: string };

type TaskLoadState =
  | { status: "loading" }
  | { status: "ready"; tasks: TaskListItem[] }
  | { status: "error"; message: string };

type HistoryLoadState =
  | { status: "loading" }
  | { status: "ready"; hasMore: boolean; offset: number; tasks: TaskHistoryItem[] }
  | { status: "error"; message: string };

type UsersLoadState =
  | { status: "loading" }
  | { status: "ready"; users: UserListItem[] }
  | { status: "error"; message: string };

type HistoryStatusFilter = "all" | TaskHistoryItem["status"];
type AppSection = "history" | "settings" | "tasks";
type CreateTaskMode = "deadline" | "monthly_fixed" | "monthly_last_days" | "weekly" | "window";
type SettingsTab = "maintenance" | "users";
type TaskTab = "my" | "family";
const HISTORY_PAGE_SIZE = 10;
function getWeekdayOptions(labels: AppLabels): Array<{ value: number; label: string }> {
  return labels.weekdays.map((label, index) => ({ value: index + 1, label }));
}

function areSameIds(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort((first, second) => first - second);
  const sortedRight = [...right].sort((first, second) => first - second);

  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function formatDate(value: string, timezone: string, labels: AppLabels): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(labels.dates.intlLocale, {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value: string, timezone: string, labels: AppLabels): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(labels.dates.intlLocale, {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function normalizeTimezone(value: string | null): string | null {
  const timezone = value?.trim();

  if (!timezone) {
    return null;
  }

  const aliases: Record<string, string> = {
    "Europe/Kiev": "Europe/Kyiv"
  };
  const aliased = aliases[timezone] ?? timezone;

  try {
    const resolved = new Intl.DateTimeFormat("en-US", { timeZone: aliased }).resolvedOptions().timeZone;

    return aliases[resolved] ?? resolved ?? aliased;
  } catch {
    return aliased;
  }
}

function getTaskTimezone(ruleTimezone: string | null, userTimezone: string): string {
  return normalizeTimezone(ruleTimezone) ?? normalizeTimezone(userTimezone) ?? userTimezone;
}

function getTaskTimezoneSuffix(ruleTimezone: string | null, userTimezone: string): string {
  const normalizedRuleTimezone = normalizeTimezone(ruleTimezone);
  const normalizedUserTimezone = normalizeTimezone(userTimezone);

  return normalizedRuleTimezone && normalizedRuleTimezone !== normalizedUserTimezone ? ` (${normalizedRuleTimezone})` : "";
}

function formatHtmlDateInput(value: string, timezone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function htmlDateToDisplay(value: string): string {
  const [year, month, day] = value.split("-");

  return year && month && day ? `${day}-${month}-${year}` : value;
}

function isValidHtmlDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

function isValidHtmlDateTime(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const [, datePart, hour, minute] = match;

  return isValidHtmlDate(datePart) && Number(hour) < 24 && Number(minute) < 60;
}

function getStatusLabel(status: TaskListItem["status"], labels: AppLabels): string {
  switch (status) {
    case "overdue":
      return labels.statuses.overdue;
    case "done":
      return labels.statuses.done;
    case "done_late":
      return labels.statuses.doneLate;
    case "missed":
      return labels.statuses.missed;
    case "cancelled":
      return labels.statuses.cancelled;
    case "pending":
    default:
      return labels.statuses.active;
  }
}

function getScheduleTypeLabel(scheduleType: string | null, labels: AppLabels): string {
  switch (scheduleType) {
    case "weekly":
      return labels.scheduleTypes.weekly;
    case "monthly_fixed_window":
    case "monthly_end_plus_start_window":
      return labels.scheduleTypes.monthly;
    case "one_time":
    case null:
    default:
      return labels.scheduleTypes.oneTime;
  }
}

function getAuditActionLabel(action: string, labels: AppLabels): string {
  return labels.audit.actions[action] ?? action;
}

function getChangedFieldLabel(field: string, labels: AppLabels): string {
  return labels.audit.fields[field] ?? field;
}

function getAuditResultStatusLabel(status: string, labels: AppLabels): string {
  return labels.audit.results[status] ?? status;
}

function getAuditDetails(metadata: Record<string, unknown>, labels: AppLabels): string | null {
  if (Array.isArray(metadata.changedFields) && metadata.changedFields.length > 0) {
    const fields = metadata.changedFields
      .filter((field): field is string => typeof field === "string")
      .map((field) => getChangedFieldLabel(field, labels));

    return fields.length > 0 ? `${labels.audit.changedPrefix}: ${fields.join(", ")}` : null;
  }

  if (typeof metadata.taskType === "string") {
    return getScheduleTypeLabel(metadata.taskType, labels);
  }

  if (typeof metadata.resultStatus === "string") {
    return `${labels.audit.resultPrefix}: ${getAuditResultStatusLabel(metadata.resultStatus, labels)}`;
  }

  if (typeof metadata.snoozeMinutes === "number") {
    return labels.audit.snoozedForMinutes(metadata.snoozeMinutes);
  }

  return null;
}

type AuditLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; events: TaskAuditItem[] }
  | { status: "error"; message: string };

function TaskAuditModal({
  onClose,
  state,
  taskTitle,
  timezone
}: {
  onClose: () => void;
  state: AuditLoadState;
  taskTitle: string;
  timezone: string;
}) {
  const labels = useI18n();

  return (
    <Modal title={labels.auditModal.title} description={taskTitle} onClose={onClose}>
      {state.status === "loading" || state.status === "idle" ? <div className="empty-state">{labels.auditModal.loading}</div> : null}
      {state.status === "error" ? <div className="empty-state empty-state--error">{state.message}</div> : null}
      {state.status === "ready" && state.events.length === 0 ? <div className="empty-state">{labels.auditModal.empty}</div> : null}
      {state.status === "ready" && state.events.length > 0 ? (
        <div className="audit-list">
          {state.events.map((event) => {
            const details = getAuditDetails(event.metadata, labels);
            const actor = event.actorName ?? (event.actorTelegramUserId ? `ID ${event.actorTelegramUserId}` : labels.audit.unknownActor);

            return (
              <div key={event.id} className="audit-item">
                <div className="audit-item__main">
                  <strong>{getAuditActionLabel(event.action, labels)}</strong>
                  <span>{formatDateTime(event.createdAt, timezone, labels)}</span>
                </div>
                <div className="audit-item__meta">
                  <span>{labels.auditModal.actor}: {actor}</span>
                  {details ? <span>{details}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </Modal>
  );
}

function TaskAuditButton({ taskId, taskTitle, timezone }: { taskId: number; taskTitle: string; timezone: string }) {
  const labels = useI18n();
  const [state, setState] = useState<AuditLoadState>({ status: "idle" });
  const [isOpen, setIsOpen] = useState(false);

  const openAudit = () => {
    setIsOpen(true);
    setState({ status: "loading" });

    getTaskAudit(taskId)
      .then((events) => {
        setState({ status: "ready", events });
      })
      .catch((error: unknown) => {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : labels.web.validation.updateFailed
        });
      });
  };

  return (
    <>
      <button className="task-card__audit-button" type="button" title={labels.auditModal.title} aria-label={labels.auditModal.title} onClick={openAudit}>
        <HistoryIcon size={18} />
      </button>
      {isOpen ? (
        <TaskAuditModal
          state={state}
          taskTitle={taskTitle}
          timezone={timezone}
          onClose={() => {
            setIsOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function TaskCard({
  task,
  timezone,
  showActions,
  showAssignees,
  onTaskAction,
  onMonthlyTaskUpdate,
  onTaskUpdate,
  onTaskDelete,
  onWeeklyTaskUpdate,
  user
}: {
  task: TaskListItem;
  timezone: string;
  showActions: boolean;
  showAssignees?: boolean;
  onTaskAction: (taskId: number, action: "complete" | "miss") => void;
  onMonthlyTaskUpdate: (taskId: number, input: MonthlyTaskUpdate) => Promise<void>;
  onTaskUpdate: (taskId: number, input: OneTimeTaskUpdate) => Promise<void>;
  onTaskDelete: (taskId: number) => Promise<void>;
  onWeeklyTaskUpdate: (taskId: number, input: WeeklyTaskUpdate) => Promise<void>;
  user: CurrentUser;
}) {
  const labels = useI18n();
  const weekdayOptions = getWeekdayOptions(labels);
  const [assignees, setAssignees] = useState<UserListItem[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePreview, setDeletePreview] = useState<TaskDeletePreview | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingDeletePreview, setIsLoadingDeletePreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false);
  const [applyAssigneesToCurrent, setApplyAssigneesToCurrent] = useState(true);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>(task.assigneeIds);
  const [title, setTitle] = useState(task.title);
  const [dueAt, setDueAt] = useState(formatHtmlDateInput(task.dueAt, timezone));
  const [windowEnd, setWindowEnd] = useState(formatHtmlDateInput(task.dueAt, timezone));
  const [windowStart, setWindowStart] = useState(formatHtmlDateInput(task.availableFrom, timezone));
  const [reminderTime, setReminderTime] = useState(task.reminderTime ?? "09:00");
  const [weekday, setWeekday] = useState(task.weekday ?? 1);
  const [monthlyStartDay, setMonthlyStartDay] = useState(String(task.monthlyStartDay ?? 1));
  const [monthlyEndDay, setMonthlyEndDay] = useState(String(task.monthlyEndDay ?? 5));
  const [monthlyLastDays, setMonthlyLastDays] = useState(String(task.monthlyLastDays ?? 3));
  const [monthlyFirstDays, setMonthlyFirstDays] = useState(String(task.monthlyFirstDays ?? 2));
  const taskTimezone = getTaskTimezone(task.ruleTimezone, timezone);
  const taskTimezoneSuffix = getTaskTimezoneSuffix(task.ruleTimezone, timezone);
  const availableFrom = formatDate(task.availableFrom, taskTimezone, labels);
  const dueDate = formatDate(task.dueAt, taskTimezone, labels);
  const windowText = availableFrom === dueDate ? availableFrom : `${availableFrom} - ${dueDate}`;
  const isMonthly = task.scheduleType === "monthly_fixed_window" || task.scheduleType === "monthly_end_plus_start_window";
  const isOneTimeWindow = task.isOneTimeWindow;
  const isOneTime = task.scheduleType === "one_time";
  const isWeekly = task.scheduleType === "weekly";
  const weekdayLabel = weekdayOptions.find((option) => option.value === task.weekday)?.label;
  const taskTypeLabel = isOneTimeWindow ? labels.scheduleTypes.oneTimeWindow : getScheduleTypeLabel(task.scheduleType, labels);
  const canEdit = (isOneTime || isWeekly || isMonthly) && (user.isAdmin || task.canAct);
  const canMiss = task.status === "overdue";
  const hasOneTimeDueChanges = isOneTime && !isOneTimeWindow && (
    dueAt !== formatHtmlDateInput(task.dueAt, timezone) ||
    reminderTime !== (task.reminderTime ?? "09:00")
  );
  const hasOneTimeWindowChanges = isOneTimeWindow && (
    windowStart !== formatHtmlDateInput(task.availableFrom, timezone) ||
    windowEnd !== formatHtmlDateInput(task.dueAt, timezone) ||
    reminderTime !== (task.reminderTime ?? "09:00")
  );
  const hasAssigneeChanges = !areSameIds(selectedAssigneeIds, task.assigneeIds);
  const hasWeeklyScheduleChanges = isWeekly && (weekday !== task.weekday || reminderTime !== (task.reminderTime ?? "09:00"));
  const hasMonthlyFixedScheduleChanges = task.scheduleType === "monthly_fixed_window" && (
    Number(monthlyStartDay) !== task.monthlyStartDay ||
    Number(monthlyEndDay) !== task.monthlyEndDay ||
    reminderTime !== (task.reminderTime ?? "09:00")
  );
  const hasMonthlyEndScheduleChanges = task.scheduleType === "monthly_end_plus_start_window" && (
    Number(monthlyLastDays) !== task.monthlyLastDays ||
    Number(monthlyFirstDays) !== task.monthlyFirstDays ||
    reminderTime !== (task.reminderTime ?? "09:00")
  );

  useEffect(() => {
    if (!isEditing || assignees.length > 0 || isLoadingAssignees) {
      return;
    }

    setIsLoadingAssignees(true);
    setEditError(null);

    getAssignees()
      .then((users) => {
        setAssignees(users);
      })
      .catch((error: unknown) => {
        setEditError(error instanceof Error ? error.message : labels.web.validation.loadingAssigneesFailed);
      })
      .finally(() => {
        setIsLoadingAssignees(false);
      });
  }, [assignees.length, isEditing, isLoadingAssignees]);

  const startEdit = () => {
    setTitle(task.title);
    setDueAt(formatHtmlDateInput(task.dueAt, timezone));
    setWindowStart(formatHtmlDateInput(task.availableFrom, timezone));
    setWindowEnd(formatHtmlDateInput(task.dueAt, timezone));
    setReminderTime(task.reminderTime ?? "09:00");
    setWeekday(task.weekday ?? 1);
    setMonthlyStartDay(String(task.monthlyStartDay ?? 1));
    setMonthlyEndDay(String(task.monthlyEndDay ?? 5));
    setMonthlyLastDays(String(task.monthlyLastDays ?? 3));
    setMonthlyFirstDays(String(task.monthlyFirstDays ?? 2));
    setApplyAssigneesToCurrent(true);
    setSelectedAssigneeIds(task.assigneeIds.length > 0 ? task.assigneeIds : [user.id]);
    setEditError(null);
    setIsEditing(true);
  };

  const startDelete = () => {
    setDeleteError(null);
    setIsLoadingDeletePreview(true);

    getTaskDeletePreview(task.id)
      .then((preview) => {
        setDeletePreview(preview);
      })
      .catch((error: unknown) => {
        setDeleteError(error instanceof Error ? error.message : labels.web.validation.updateFailed);
      })
      .finally(() => {
        setIsLoadingDeletePreview(false);
      });
  };

  const confirmDelete = () => {
    setDeleteError(null);
    setIsDeleting(true);

    onTaskDelete(task.id)
      .then(() => {
        setDeletePreview(null);
      })
      .catch((error: unknown) => {
        setDeleteError(error instanceof Error ? error.message : labels.web.validation.updateFailed);
      })
      .finally(() => {
        setIsDeleting(false);
      });
  };

  const toggleAssignee = (userId: number) => {
    setSelectedAssigneeIds((current) => {
      if (current.includes(userId)) {
        return current.filter((id) => id !== userId);
      }

      return [...current, userId];
    });
  };

  const toggleAllAssignees = () => {
    const allAssigneeIds = assignees.map((assignee) => assignee.id);

    setSelectedAssigneeIds((current) => (
      areSameIds(current, allAssigneeIds) ? [] : allAssigneeIds
    ));
  };

  const saveEdit = () => {
    const trimmedTitle = title.trim();

    if (trimmedTitle.length < 1 || trimmedTitle.length > 120) {
      setEditError(labels.web.validation.title);
      return;
    }

    if (isOneTimeWindow && (!windowStart.trim() || !windowEnd.trim() || !reminderTime.trim())) {
      setEditError(labels.web.validation.windowRequired);
      return;
    }

    if (isOneTimeWindow && (!isValidHtmlDate(windowStart) || !isValidHtmlDate(windowEnd))) {
      setEditError(labels.web.validation.invalidWindowDates);
      return;
    }

    if (isWeekly && !reminderTime.trim()) {
      setEditError(labels.web.validation.reminderTimeRequired);
      return;
    }

    if (isMonthly && !reminderTime.trim()) {
      setEditError(labels.web.validation.reminderTimeRequired);
      return;
    }

    if (!isOneTimeWindow && !isWeekly && !isMonthly && (!dueAt.trim() || !reminderTime.trim())) {
      setEditError(labels.web.validation.dueDateRequired);
      return;
    }

    if (!isOneTimeWindow && !isWeekly && !isMonthly && !isValidHtmlDate(dueAt)) {
      setEditError(labels.web.validation.invalidDueDate);
      return;
    }

    if (selectedAssigneeIds.length === 0) {
      setEditError(labels.web.validation.assigneesRequired);
      return;
    }

    setIsSaving(true);
    setEditError(null);

    let updateRequest: Promise<void>;
    const hasTitleChanges = trimmedTitle !== task.title;
    const hasAnyChanges = hasTitleChanges ||
      hasOneTimeDueChanges ||
      hasOneTimeWindowChanges ||
      hasWeeklyScheduleChanges ||
      hasMonthlyFixedScheduleChanges ||
      hasMonthlyEndScheduleChanges ||
      hasAssigneeChanges;

    if (!hasAnyChanges) {
      setEditError(labels.web.validation.noChanges);
      setIsSaving(false);
      return;
    }

    if (isWeekly) {
      const input: WeeklyTaskUpdate = {};

      if (hasTitleChanges) {
        input.title = trimmedTitle;
      }

      if (hasWeeklyScheduleChanges) {
        input.weekday = weekday;
        input.reminderTime = reminderTime;
      }

      if (hasAssigneeChanges) {
        input.assigneeUserIds = selectedAssigneeIds;
        input.applyAssigneesToCurrent = applyAssigneesToCurrent;
      }

      updateRequest = onWeeklyTaskUpdate(task.id, input);
    } else if (task.scheduleType === "monthly_fixed_window") {
      const input: MonthlyTaskUpdate = {};

      if (hasTitleChanges) {
        input.title = trimmedTitle;
      }

      if (hasMonthlyFixedScheduleChanges) {
        input.scheduleType = task.scheduleType;
        input.startDay = Number(monthlyStartDay);
        input.endDay = Number(monthlyEndDay);
        input.reminderTime = reminderTime;
      }

      if (hasAssigneeChanges) {
        input.assigneeUserIds = selectedAssigneeIds;
        input.applyAssigneesToCurrent = applyAssigneesToCurrent;
      }

      updateRequest = onMonthlyTaskUpdate(task.id, input);
    } else if (task.scheduleType === "monthly_end_plus_start_window") {
      const input: MonthlyTaskUpdate = {};

      if (hasTitleChanges) {
        input.title = trimmedTitle;
      }

      if (hasMonthlyEndScheduleChanges) {
        input.scheduleType = task.scheduleType;
        input.lastDays = Number(monthlyLastDays);
        input.firstDays = Number(monthlyFirstDays);
        input.reminderTime = reminderTime;
      }

      if (hasAssigneeChanges) {
        input.assigneeUserIds = selectedAssigneeIds;
        input.applyAssigneesToCurrent = applyAssigneesToCurrent;
      }

      updateRequest = onMonthlyTaskUpdate(task.id, input);
    } else {
      const input: OneTimeTaskUpdate = {};

      if (hasTitleChanges) {
        input.title = trimmedTitle;
      }

      if (isOneTimeWindow && hasOneTimeWindowChanges) {
        input.availableFrom = htmlDateToDisplay(windowStart);
        input.dueAt = htmlDateToDisplay(windowEnd);
        input.reminderTime = reminderTime;
      } else if (!isOneTimeWindow && hasOneTimeDueChanges) {
        input.dueAt = htmlDateToDisplay(dueAt);
        input.reminderTime = reminderTime;
      }

      if (hasAssigneeChanges) {
        input.assigneeUserIds = selectedAssigneeIds;
      }

      updateRequest = onTaskUpdate(task.id, input);
    }

    updateRequest
      .then(() => {
        setIsEditing(false);
      })
      .catch((error: unknown) => {
        setEditError(error instanceof Error ? error.message : labels.web.validation.updateFailed);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  return (
    <article className="task-card">
      <div className="task-card__main">
        <div className="task-card__title-row">
          <h3>{task.title}</h3>
          <TaskAuditButton taskId={task.id} taskTitle={task.title} timezone={timezone} />
        </div>
        <div className="task-card__meta">
          <span>{taskTypeLabel}</span>
          <span>{labels.web.fields.dueAt}: {formatDateTime(task.dueAt, taskTimezone, labels)}{taskTimezoneSuffix}</span>
          {isWeekly && weekdayLabel ? <span>{labels.web.fields.weekday}: {weekdayLabel}</span> : null}
          {isMonthly || isOneTimeWindow ? <span>{labels.web.fields.window}: {windowText}{taskTimezoneSuffix}</span> : null}
          {(isOneTime || isWeekly || isMonthly) && task.reminderTime ? <span>{labels.web.fields.reminderTime}: {task.reminderTime}{taskTimezoneSuffix}</span> : null}
          {showAssignees && task.assigneeNames ? <span>{labels.web.fields.assignees}: {task.assigneeNames}</span> : null}
        </div>
      </div>
      <div className="task-card__badges">
        <Badge tone={task.status === "overdue" ? "warning" : "success"}>{getStatusLabel(task.status, labels)}</Badge>
        {showAssignees && task.canAct ? <Badge>{labels.web.messages.assignedToYou}</Badge> : null}
      </div>
      {showActions ? (
        <div className={`task-card__actions ${canMiss ? "task-card__actions--with-miss" : ""}`}>
          <Button className="task-action-complete" variant="primary" type="button" onClick={() => onTaskAction(task.id, "complete")}>
            <Check size={16} />
            {labels.web.actions.complete}
          </Button>
          {canEdit ? (
            <Button className="task-action-edit" variant="secondary" type="button" onClick={startEdit}>
              <Pencil size={16} />
              {labels.web.actions.edit}
            </Button>
          ) : null}
          {canMiss ? (
            <Button className="task-action-miss" variant="warning" type="button" onClick={() => onTaskAction(task.id, "miss")}>
              <CircleSlash size={16} />
              {labels.web.actions.miss}
            </Button>
          ) : null}
          <Button className="task-action-delete" variant="danger" type="button" disabled={isLoadingDeletePreview} onClick={startDelete}>
            <Trash2 size={16} />
            {isLoadingDeletePreview ? labels.web.messages.checking : labels.web.actions.delete}
          </Button>
        </div>
      ) : null}
      {deleteError && !deletePreview ? <div className="form-error">{deleteError}</div> : null}
      {isEditing ? (
        <Modal
          title={labels.web.actions.edit}
          description={task.title}
          onClose={() => {
            if (!isSaving) {
              setIsEditing(false);
            }
          }}
        >
          <form className="task-edit-form" onSubmit={(event) => {
            event.preventDefault();
            saveEdit();
          }}>
            <label className="field">
              <span>{labels.web.fields.title}</span>
              <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
            </label>
            {isWeekly ? (
              <div className="field-grid">
                <label className="field">
                  <span>{labels.web.fields.weekday}</span>
                  <select className="select" value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>
                    {weekdayOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{labels.web.fields.reminderTime}</span>
                  <input value={reminderTime} placeholder="HH:mm" onChange={(event) => setReminderTime(event.target.value)} />
                </label>
              </div>
            ) : task.scheduleType === "monthly_fixed_window" ? (
              <div className="field-grid">
                <label className="field">
                  <span>{labels.web.fields.lastDays}</span>
                  <input type="number" min={1} max={31} value={monthlyStartDay} onChange={(event) => setMonthlyStartDay(event.target.value)} />
                </label>
                <label className="field">
                  <span>{labels.web.fields.endDay}</span>
                  <input type="number" min={1} max={31} value={monthlyEndDay} onChange={(event) => setMonthlyEndDay(event.target.value)} />
                </label>
                <label className="field">
                  <span>{labels.web.fields.reminderTime}</span>
                  <input value={reminderTime} placeholder="HH:mm" onChange={(event) => setReminderTime(event.target.value)} />
                </label>
              </div>
            ) : task.scheduleType === "monthly_end_plus_start_window" ? (
              <div className="field-grid">
                <label className="field">
                  <span>{labels.web.fields.startDay}</span>
                  <input type="number" min={1} max={31} value={monthlyLastDays} onChange={(event) => setMonthlyLastDays(event.target.value)} />
                </label>
                <label className="field">
                  <span>{labels.web.fields.firstDays}</span>
                  <input type="number" min={0} max={31} value={monthlyFirstDays} onChange={(event) => setMonthlyFirstDays(event.target.value)} />
                </label>
                <label className="field">
                  <span>{labels.web.fields.reminderTime}</span>
                  <input value={reminderTime} placeholder="HH:mm" onChange={(event) => setReminderTime(event.target.value)} />
                </label>
              </div>
            ) : isOneTimeWindow ? (
              <div className="field-grid">
                <label className="field">
                  <span>{labels.web.fields.windowStart}</span>
                  <input type="date" value={windowStart} onChange={(event) => setWindowStart(event.target.value)} />
                </label>
                <label className="field">
                  <span>{labels.web.fields.windowEnd}</span>
                  <input type="date" value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)} />
                </label>
                <label className="field">
                  <span>{labels.web.fields.reminderTime}</span>
                  <input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} />
                </label>
              </div>
            ) : (
              <div className="field-grid">
                <label className="field">
                  <span>{labels.web.fields.dueAt}</span>
                  <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                </label>
                <label className="field">
                  <span>{labels.web.fields.reminderTime}</span>
                  <input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} />
                </label>
              </div>
            )}
            <fieldset className="assignee-field">
              <legend>
                <span>{labels.web.fields.assignees}</span>
                {assignees.length > 0 ? (
                  <button className="assignee-toggle" type="button" onClick={toggleAllAssignees}>
                    {areSameIds(selectedAssigneeIds, assignees.map((assignee) => assignee.id)) ? <CheckSquare size={16} /> : <Square size={16} />}
                    <span>{areSameIds(selectedAssigneeIds, assignees.map((assignee) => assignee.id)) ? labels.web.actions.unchooseAll : labels.web.actions.chooseAll}</span>
                  </button>
                ) : null}
              </legend>
              {isLoadingAssignees ? <span className="muted-text">{labels.web.messages.loadingAssignees}</span> : null}
              {assignees.map((assignee) => (
                <label key={assignee.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedAssigneeIds.includes(assignee.id)}
                    onChange={() => toggleAssignee(assignee.id)}
                  />
                  <span>{assignee.displayName}</span>
                </label>
              ))}
            </fieldset>
            {(isWeekly || isMonthly) && hasAssigneeChanges ? (
              <fieldset className="assignee-apply-field">
                <legend>{labels.web.fields.applyAssignees}</legend>
                <label className="radio-row">
                  <input
                    type="radio"
                    name={`assignee-apply-${task.id}`}
                    checked={applyAssigneesToCurrent}
                    onChange={() => setApplyAssigneesToCurrent(true)}
                  />
                  <span>{labels.web.messages.applyAssigneesCurrentAndFuture}</span>
                </label>
                <label className="radio-row">
                  <input
                    type="radio"
                    name={`assignee-apply-${task.id}`}
                    checked={!applyAssigneesToCurrent}
                    onChange={() => setApplyAssigneesToCurrent(false)}
                  />
                  <span>{labels.web.messages.applyAssigneesFutureOnly}</span>
                </label>
              </fieldset>
            ) : null}
            {editError ? <div className="form-error">{editError}</div> : null}
            <div className="task-card__actions">
              <Button variant="primary" type="submit" disabled={isSaving}>
                {isSaving ? labels.web.actions.saving : labels.web.actions.save}
              </Button>
              <Button variant="ghost" type="button" disabled={isSaving} onClick={() => setIsEditing(false)}>
                {labels.web.actions.cancel}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
      {deletePreview ? (
        <Modal
          title={deletePreview.isRecurring ? labels.web.delete.recurringTitle : labels.web.delete.singleTitle}
          description={deletePreview.title}
          onClose={() => {
            if (!isDeleting) {
              setDeletePreview(null);
            }
          }}
        >
          <div className="delete-confirm">
            <p>
              {deletePreview.isRecurring
                ? labels.web.delete.recurringDescription
                : labels.web.delete.singleDescription}
            </p>
            {deleteError ? <div className="form-error">{deleteError}</div> : null}
            <div className="task-card__actions">
              <Button variant="danger" type="button" disabled={isDeleting} onClick={confirmDelete}>
                {isDeleting ? labels.web.actions.deleting : labels.web.delete.confirm}
              </Button>
              <Button variant="ghost" type="button" disabled={isDeleting} onClick={() => setDeletePreview(null)}>
                {labels.web.actions.keep}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </article>
  );
}

function TaskListContent({
  emptyText,
  onTaskAction,
  onMonthlyTaskUpdate,
  onTaskUpdate,
  onTaskDelete,
  onWeeklyTaskUpdate,
  showAssignees = false,
  state,
  user
}: {
  emptyText: string;
  onTaskAction: (taskId: number, action: "complete" | "miss") => void;
  onMonthlyTaskUpdate: (taskId: number, input: MonthlyTaskUpdate) => Promise<void>;
  onTaskUpdate: (taskId: number, input: OneTimeTaskUpdate) => Promise<void>;
  onTaskDelete: (taskId: number) => Promise<void>;
  onWeeklyTaskUpdate: (taskId: number, input: WeeklyTaskUpdate) => Promise<void>;
  showAssignees?: boolean;
  state: TaskLoadState;
  user: CurrentUser;
}) {
  const labels = useI18n();

  if (state.status === "loading") {
    return <div className="empty-state">{labels.web.messages.loadingTasks}</div>;
  }

  if (state.status === "error") {
    return <div className="empty-state empty-state--error">{state.message}</div>;
  }

  if (state.tasks.length === 0) {
    return <div className="empty-state">{emptyText}</div>;
  }

  return (
    <div className="task-list">
      {state.tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          timezone={user.timezone}
          showActions={user.isAdmin || task.canAct}
          showAssignees={showAssignees}
          onTaskAction={onTaskAction}
          onMonthlyTaskUpdate={onMonthlyTaskUpdate}
          onTaskUpdate={onTaskUpdate}
          onTaskDelete={onTaskDelete}
          onWeeklyTaskUpdate={onWeeklyTaskUpdate}
          user={user}
        />
      ))}
    </div>
  );
}

function HistoryCard({ task, timezone }: { task: TaskHistoryItem; timezone: string }) {
  const labels = useI18n();
  const taskTimezone = getTaskTimezone(task.ruleTimezone, timezone);
  const taskTimezoneSuffix = getTaskTimezoneSuffix(task.ruleTimezone, timezone);

  return (
    <article className="task-card">
      <div className="task-card__main">
        <div className="task-card__title-row">
          <h3>{task.title}</h3>
          <TaskAuditButton taskId={task.id} taskTitle={task.title} timezone={timezone} />
        </div>
        <div className="task-card__meta">
          <span>{getScheduleTypeLabel(task.scheduleType, labels)}</span>
          <span>{labels.web.fields.dueAt}: {formatDateTime(task.dueAt, taskTimezone, labels)}{taskTimezoneSuffix}</span>
          {task.closedAt ? <span>{labels.web.fields.closedAt}: {formatDateTime(task.closedAt, timezone, labels)}</span> : null}
          {task.closedByName ? <span>{labels.web.fields.closedBy}: {task.closedByName}</span> : null}
          {task.assigneeNames ? <span>{labels.web.fields.assignees}: {task.assigneeNames}</span> : null}
        </div>
      </div>
      <div className="task-card__badges">
        <Badge tone={task.status === "missed" || task.status === "cancelled" ? "warning" : "success"}>
          {getStatusLabel(task.status, labels)}
        </Badge>
      </div>
    </article>
  );
}

function HistorySection({ user }: { user: CurrentUser }) {
  const labels = useI18n();
  const [offset, setOffset] = useState(0);
  const [scope, setScope] = useState<HistoryScope>(user.isAdmin ? "family" : "my");
  const [state, setState] = useState<HistoryLoadState>({ status: "loading" });
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");

  const refreshHistory = (nextOffset = offset) => {
    setState({ status: "loading" });
    let isMounted = true;

    getTaskHistory(scope, HISTORY_PAGE_SIZE, nextOffset)
      .then((page) => {
        if (isMounted) {
          setOffset(page.offset);
          setState({
            status: "ready",
            hasMore: page.hasMore,
            offset: page.offset,
            tasks: page.tasks
          });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : labels.history.loadFailed
          });
        }
      });

    return () => {
      isMounted = false;
    };
  };

  useEffect(() => {
    return refreshHistory(0);
  }, [scope]);

  const visibleTasks = state.status === "ready" && statusFilter !== "all"
    ? state.tasks.filter((task) => task.status === statusFilter)
    : state.status === "ready"
      ? state.tasks
      : [];

  return (
    <Panel className="tasks-panel" title={labels.history.title} description={labels.history.description}>
      <div className="sticky-panel-toolbar">
        <div className="filter-row">
          {user.isAdmin ? (
            <div className="tabs tabs--compact" role="tablist" aria-label={labels.history.toolbarLabel}>
              <button
                className={`tab ${scope === "family" ? "tab--active" : ""}`}
                type="button"
                role="tab"
                aria-selected={scope === "family"}
                onClick={() => {
                  setOffset(0);
                  setScope("family");
                }}
              >
                {labels.history.familyScope}
              </button>
              <button
                className={`tab ${scope === "my" ? "tab--active" : ""}`}
                type="button"
                role="tab"
                aria-selected={scope === "my"}
                onClick={() => {
                  setOffset(0);
                  setScope("my");
                }}
              >
                {labels.history.myScope}
              </button>
            </div>
          ) : null}
          <select
            className="select"
            value={statusFilter}
            aria-label={labels.history.statusFilterLabel}
            onChange={(event) => setStatusFilter(event.target.value as HistoryStatusFilter)}
          >
            <option value="all">{labels.history.allStatuses}</option>
            <option value="done">{labels.history.done}</option>
            <option value="done_late">{labels.history.doneLate}</option>
            <option value="missed">{labels.history.missed}</option>
            <option value="cancelled">{labels.history.cancelled}</option>
          </select>
          <Button className="button--icon-mobile" variant="ghost" type="button" title={labels.common.refresh} aria-label={labels.common.refresh} onClick={() => refreshHistory(offset)}>
            <RefreshCw size={18} />
            <span className="button__text">{labels.common.refresh}</span>
          </Button>
        </div>
      </div>
      {state.status === "loading" ? <div className="empty-state">{labels.history.loading}</div> : null}
      {state.status === "error" ? <div className="empty-state empty-state--error">{state.message}</div> : null}
      {state.status === "ready" && state.tasks.length === 0 ? (
        <div className="empty-state">{labels.history.empty}</div>
      ) : null}
      {state.status === "ready" && state.tasks.length > 0 && visibleTasks.length === 0 ? (
        <div className="empty-state">{labels.history.filteredEmpty}</div>
      ) : null}
      {state.status === "ready" && visibleTasks.length > 0 ? (
        <div className="task-list">
          {visibleTasks.map((task) => (
            <HistoryCard key={task.id} task={task} timezone={user.timezone} />
          ))}
        </div>
      ) : null}
      {state.status === "ready" ? (
        <div className="pagination">
          <Button
            variant="ghost"
            type="button"
            disabled={state.offset === 0}
            onClick={() => refreshHistory(Math.max(0, state.offset - HISTORY_PAGE_SIZE))}
          >
            {labels.common.back}
          </Button>
          <span>
            {state.tasks.length === 0
              ? labels.history.records(0)
              : `${state.offset + 1}-${state.offset + state.tasks.length}`}
          </span>
          <Button
            variant="ghost"
            type="button"
            disabled={!state.hasMore}
            onClick={() => refreshHistory(state.offset + HISTORY_PAGE_SIZE)}
          >
            {labels.common.next}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

function UserCard({
  currentUser,
  isSaving,
  onActivate,
  onDeactivate,
  user
}: {
  currentUser: CurrentUser;
  isSaving: boolean;
  onActivate: (telegramUserId: number) => void;
  onDeactivate: (userId: number) => void;
  user: UserListItem;
}) {
  const labels = useI18n();
  const canDeactivate = user.isActive && !user.isAdmin && user.id !== currentUser.id;
  const canActivate = !user.isActive && !user.isAdmin;

  return (
    <article className="user-list-row">
      <div className="user-list-row__identity">
        <h3>{user.displayName}</h3>
        <div className="user-list-row__meta">
          <span>Telegram ID: {user.telegramUserId}</span>
          {user.username ? <span>Username: @{user.username}</span> : null}
          <span>Timezone: {user.timezone}</span>
        </div>
      </div>
      <div className="user-list-row__controls">
        <div className="badge-row">
          <Badge tone={user.isActive ? "success" : "warning"}>{user.isActive ? labels.users.active : labels.users.disabled}</Badge>
          <Badge tone={user.isAdmin ? "warning" : "neutral"}>{user.isAdmin ? labels.account.admin : labels.users.participant}</Badge>
        </div>
        <div className="user-list-row__actions">
          {canActivate ? (
            <Button variant="secondary" type="button" disabled={isSaving} onClick={() => onActivate(user.telegramUserId)}>
              {labels.users.activate}
            </Button>
          ) : null}
          {canDeactivate ? (
            <Button variant="danger" type="button" disabled={isSaving} onClick={() => onDeactivate(user.id)}>
              {labels.users.deactivate}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function UsersSection({ currentUser }: { currentUser: CurrentUser }) {
  const labels = useI18n();
  const [addError, setAddError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, setState] = useState<UsersLoadState>({ status: "loading" });
  const [telegramUserId, setTelegramUserId] = useState("");

  const refreshUsers = () => {
    setState({ status: "loading" });
    let isMounted = true;

    getUsers()
      .then((users) => {
        if (isMounted) {
          setState({ status: "ready", users });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : labels.users.loadFailed
          });
        }
      });

    return () => {
      isMounted = false;
    };
  };

  useEffect(() => {
    return refreshUsers();
  }, []);

  const addOrActivateUser = (nextTelegramUserId: number, message: string) => {
    setIsSaving(true);
    setAddError(null);
    setNotice(null);

    addUser(nextTelegramUserId)
      .then(() => {
        setTelegramUserId("");
        refreshUsers();
        setNotice(message);
      })
      .catch((error: unknown) => {
        setAddError(error instanceof Error ? error.message : labels.users.addFailed);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleAddUser = () => {
    const parsedTelegramUserId = Number(telegramUserId.trim());

    if (!Number.isSafeInteger(parsedTelegramUserId) || parsedTelegramUserId <= 0) {
      setAddError(labels.users.invalidTelegramId);
      return;
    }

    addOrActivateUser(parsedTelegramUserId, labels.users.addedOrActivated);
  };

  const handleDeactivateUser = (userId: number) => {
    setIsSaving(true);
    setAddError(null);
    setNotice(null);

    deactivateUser(userId)
      .then(() => {
        refreshUsers();
        setNotice(labels.users.deactivated);
      })
      .catch((error: unknown) => {
        setAddError(error instanceof Error ? error.message : labels.users.deactivateFailed);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  return (
    <Panel className="tasks-panel" title={labels.users.title} description={labels.users.description}>
      <form className="sticky-panel-toolbar user-add-form" onSubmit={(event) => {
        event.preventDefault();
        handleAddUser();
      }}>
        <label className="field user-add-form__field">
          <span>{labels.users.inputLabel}</span>
          <input
            inputMode="numeric"
            value={telegramUserId}
            placeholder="123456789"
            onChange={(event) => setTelegramUserId(event.target.value)}
          />
        </label>
        <Button variant="primary" type="submit" disabled={isSaving}>
          {isSaving ? labels.web.actions.saving : labels.users.addActivate}
        </Button>
        <Button className="button--icon-mobile" variant="ghost" type="button" title={labels.common.refresh} aria-label={labels.common.refresh} onClick={refreshUsers}>
          <RefreshCw size={18} />
          <span className="button__text">{labels.common.refresh}</span>
        </Button>
      </form>
      {notice ? <div className="notice">{notice}</div> : null}
      {addError ? <div className="form-error">{addError}</div> : null}
      {state.status === "loading" ? <div className="empty-state">{labels.users.loading}</div> : null}
      {state.status === "error" ? <div className="empty-state empty-state--error">{state.message}</div> : null}
      {state.status === "ready" && state.users.length === 0 ? (
        <div className="empty-state">{labels.users.empty}</div>
      ) : null}
      {state.status === "ready" && state.users.length > 0 ? (
        <div className="user-list">
          {state.users.map((user) => (
            <UserCard
              key={user.id}
              currentUser={currentUser}
              isSaving={isSaving}
              onActivate={(nextTelegramUserId) => addOrActivateUser(nextTelegramUserId, labels.users.userActivated)}
              onDeactivate={handleDeactivateUser}
              user={user}
            />
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

function MaintenanceSection({ timezone }: { timezone: string }) {
  const labels = useI18n();
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [cleanupNotice, setCleanupNotice] = useState<string | null>(null);
  const [cleanupPreview, setCleanupPreview] = useState<MaintenanceCleanupPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleDownloadExport = () => {
    setError(null);
    setNotice(null);
    setIsDownloading(true);

    downloadAdminExport()
      .then(({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        setNotice(labels.maintenance.downloadDone);
      })
      .catch((downloadError: unknown) => {
        setError(downloadError instanceof Error ? downloadError.message : labels.maintenance.downloadError);
      })
      .finally(() => {
        setIsDownloading(false);
      });
  };

  const handlePreviewCleanup = () => {
    setCleanupError(null);
    setCleanupNotice(null);
    setIsPreviewLoading(true);

    getMaintenanceCleanupPreview()
      .then((preview) => {
        setCleanupPreview(preview);
      })
      .catch((previewError: unknown) => {
        setCleanupError(previewError instanceof Error ? previewError.message : labels.maintenance.cleanupPreviewError);
      })
      .finally(() => {
        setIsPreviewLoading(false);
      });
  };

  const handleRunCleanup = () => {
    setCleanupError(null);
    setCleanupNotice(null);
    setIsCleaning(true);

    runMaintenanceCleanup()
      .then((result) => {
        setCleanupNotice(
          labels.maintenance.cleanupDone(result.notificationLog.deleted, result.telegramMessageRefs.deleted)
        );
        setCleanupPreview({
          notificationLog: {
            count: 0,
            cutoff: result.notificationLog.cutoff,
            retentionDays: result.notificationLog.retentionDays
          },
          telegramMessageRefs: {
            count: 0,
            cutoff: result.telegramMessageRefs.cutoff,
            retentionDays: result.telegramMessageRefs.retentionDays
          }
        });
      })
      .catch((cleanupRunError: unknown) => {
        setCleanupError(cleanupRunError instanceof Error ? cleanupRunError.message : labels.maintenance.cleanupError);
      })
      .finally(() => {
        setIsCleaning(false);
      });
  };

  return (
    <Panel className="tasks-panel maintenance-panel" title={labels.maintenance.title} description={labels.maintenance.description}>
      <div className="maintenance-actions">
        <div>
          <h3>{labels.maintenance.exportTitle}</h3>
          <p>{labels.maintenance.exportDescription}</p>
        </div>
        <Button variant="primary" type="button" disabled={isDownloading} onClick={handleDownloadExport}>
          <Download size={18} />
          {isDownloading ? labels.maintenance.downloading : labels.maintenance.downloadButton}
        </Button>
      </div>
      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="form-error">{error}</div> : null}
      <div className="maintenance-actions">
        <div>
          <h3>{labels.maintenance.cleanupTitle}</h3>
          <p>{labels.maintenance.previewIntro}</p>
        </div>
        <div className="maintenance-actions__buttons">
          <Button variant="secondary" type="button" disabled={isPreviewLoading || isCleaning} onClick={handlePreviewCleanup}>
            <RefreshCw size={18} />
            {isPreviewLoading ? labels.web.messages.checking : labels.maintenance.previewButton}
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={!cleanupPreview || isPreviewLoading || isCleaning || (cleanupPreview.notificationLog.count + cleanupPreview.telegramMessageRefs.count === 0)}
            onClick={handleRunCleanup}
          >
            {isCleaning ? labels.web.actions.deleting : labels.maintenance.cleanupButton}
          </Button>
        </div>
      </div>
      {cleanupPreview ? (
        <div className="maintenance-preview">
          <div>
            <strong>notification_log</strong>
            <span>{labels.maintenance.olderThanDays(cleanupPreview.notificationLog.retentionDays, cleanupPreview.notificationLog.count)}</span>
            <span>{labels.maintenance.previewUntil(formatDateTime(cleanupPreview.notificationLog.cutoff, timezone, labels))}</span>
          </div>
          <div>
            <strong>telegram_message_refs</strong>
            <span>{labels.maintenance.olderThanDays(cleanupPreview.telegramMessageRefs.retentionDays, cleanupPreview.telegramMessageRefs.count)}</span>
            <span>{labels.maintenance.previewUntil(formatDateTime(cleanupPreview.telegramMessageRefs.cutoff, timezone, labels))}</span>
          </div>
          <p>{labels.maintenance.safeCleanupNote}</p>
        </div>
      ) : null}
      {cleanupNotice ? <div className="notice">{cleanupNotice}</div> : null}
      {cleanupError ? <div className="form-error">{cleanupError}</div> : null}
    </Panel>
  );
}

function SettingsSection({ user }: { user: CurrentUser }) {
  const labels = useI18n();
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("users");

  if (!user.isAdmin) {
    return null;
  }

  return (
    <>
      <section className="settings-switcher sticky-panel-toolbar" aria-label={labels.settings.title}>
        <div className="tabs tabs--compact" role="tablist" aria-label={labels.settings.tabsLabel}>
          <button
            className={`tab ${activeSettingsTab === "users" ? "tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeSettingsTab === "users"}
            onClick={() => setActiveSettingsTab("users")}
          >
            {labels.settings.users}
          </button>
          <button
            className={`tab ${activeSettingsTab === "maintenance" ? "tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeSettingsTab === "maintenance"}
            onClick={() => setActiveSettingsTab("maintenance")}
          >
            {labels.settings.maintenance}
          </button>
        </div>
      </section>

      {activeSettingsTab === "users" ? <UsersSection currentUser={user} /> : null}
      {activeSettingsTab === "maintenance" ? <MaintenanceSection timezone={user.timezone} /> : null}
    </>
  );
}

function CreateTaskModal({
  onClose,
  onCreated,
  timezone,
  user
}: {
  onClose: () => void;
  onCreated: (input: TaskCreateInput) => Promise<void>;
  timezone: string;
  user: CurrentUser;
}) {
  const labels = useI18n();
  const weekdayOptions = getWeekdayOptions(labels);
  const [assignees, setAssignees] = useState<UserListItem[]>([]);
  const [createMode, setCreateMode] = useState<CreateTaskMode>("deadline");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([user.id]);
  const [title, setTitle] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [windowStart, setWindowStart] = useState("");
  const [monthlyStartDay, setMonthlyStartDay] = useState("1");
  const [monthlyEndDay, setMonthlyEndDay] = useState("5");
  const [monthlyLastDays, setMonthlyLastDays] = useState("3");
  const [monthlyFirstDays, setMonthlyFirstDays] = useState("2");

  useEffect(() => {
    let isMounted = true;

    getAssignees()
      .then((users) => {
        if (isMounted) {
          setAssignees(users);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setError(error instanceof Error ? error.message : labels.web.validation.loadingAssigneesFailed);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingAssignees(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleAssignee = (userId: number) => {
    setSelectedAssigneeIds((current) => {
      if (current.includes(userId)) {
        return current.filter((id) => id !== userId);
      }

      return [...current, userId];
    });
  };

  const toggleAllAssignees = () => {
    const allAssigneeIds = assignees.map((assignee) => assignee.id);

    setSelectedAssigneeIds((current) => (
      areSameIds(current, allAssigneeIds) ? [] : allAssigneeIds
    ));
  };

  const changeCreateMode = (nextMode: CreateTaskMode) => {
    setCreateMode(nextMode);
    setDueAt("");
    setWindowStart("");
  };

  const saveTask = () => {
    const trimmedTitle = title.trim();

    if (trimmedTitle.length < 1 || trimmedTitle.length > 120) {
      setError(labels.web.validation.title);
      return;
    }

    if (createMode === "deadline" && (!dueAt.trim() || !reminderTime.trim())) {
      setError(labels.web.validation.dueDateRequired);
      return;
    }

    if (createMode === "deadline" && !isValidHtmlDate(dueAt)) {
      setError(labels.web.validation.invalidDueDate);
      return;
    }

    if (createMode === "window" && (!windowStart.trim() || !dueAt.trim() || !reminderTime.trim())) {
      setError(labels.web.validation.windowRequired);
      return;
    }

    if (createMode === "window" && (!isValidHtmlDate(windowStart) || !isValidHtmlDate(dueAt))) {
      setError(labels.web.validation.invalidWindowDates);
      return;
    }

    if (createMode === "weekly" && !reminderTime.trim()) {
      setError(labels.web.validation.reminderTimeRequired);
      return;
    }

    if (
      createMode === "monthly_fixed" &&
      (!monthlyStartDay.trim() || !monthlyEndDay.trim() || !reminderTime.trim())
    ) {
      setError(labels.web.validation.windowRequired);
      return;
    }

    if (
      createMode === "monthly_last_days" &&
      (!monthlyLastDays.trim() || !monthlyFirstDays.trim() || !reminderTime.trim())
    ) {
      setError(labels.web.validation.monthlyLastWindowRequired);
      return;
    }

    if (selectedAssigneeIds.length === 0) {
      setError(labels.web.validation.assigneesRequired);
      return;
    }

    setError(null);
    setIsSaving(true);

    onCreated({
      title: trimmedTitle,
      taskType: createMode === "weekly"
        ? "weekly"
        : createMode === "monthly_fixed" || createMode === "monthly_last_days"
          ? "monthly"
          : "one_time",
      availableFrom: createMode === "window" ? htmlDateToDisplay(windowStart) : undefined,
      dueAt: createMode === "deadline" || createMode === "window" ? htmlDateToDisplay(dueAt) : dueAt,
      reminderTime,
      weekday: createMode === "weekly" ? weekday : undefined,
      startDay: createMode === "monthly_fixed" ? Number(monthlyStartDay) : undefined,
      endDay: createMode === "monthly_fixed" ? Number(monthlyEndDay) : undefined,
      lastDays: createMode === "monthly_last_days" ? Number(monthlyLastDays) : undefined,
      firstDays: createMode === "monthly_last_days" ? Number(monthlyFirstDays) : undefined,
      assigneeUserIds: selectedAssigneeIds
    })
      .then(onClose)
      .catch((error: unknown) => {
        setError(error instanceof Error ? error.message : labels.web.validation.createFailed);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  return (
    <Modal
      title={labels.web.actions.create}
      description={labels.web.messages.datesInTimezone(timezone)}
      onClose={() => {
        if (!isSaving) {
          onClose();
        }
      }}
    >
      <form className="task-edit-form" onSubmit={(event) => {
        event.preventDefault();
        saveTask();
      }}>
        <label className="field">
          <span>{labels.web.fields.title}</span>
          <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="field">
          <span>{labels.web.fields.taskType}</span>
          <select
            className="select"
            value={createMode}
            onChange={(event) => changeCreateMode(event.target.value as CreateTaskMode)}
          >
            <option value="deadline">{labels.web.createModes.deadline}</option>
            <option value="window">{labels.web.createModes.window}</option>
            <option value="weekly">{labels.web.createModes.weekly}</option>
            <option value="monthly_fixed">{labels.web.createModes.monthlyFixed}</option>
            <option value="monthly_last_days">{labels.web.createModes.monthlyLastDays}</option>
          </select>
        </label>
        {createMode === "weekly" ? (
          <div className="field-grid">
            <label className="field">
              <span>{labels.web.fields.weekday}</span>
              <select className="select" value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>
                {weekdayOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{labels.web.fields.reminderTime}</span>
              <input value={reminderTime} placeholder="HH:mm" onChange={(event) => setReminderTime(event.target.value)} />
            </label>
          </div>
        ) : createMode === "monthly_fixed" ? (
          <div className="field-grid">
            <label className="field">
              <span>{labels.web.fields.startDay}</span>
              <input type="number" min={1} max={31} value={monthlyStartDay} onChange={(event) => setMonthlyStartDay(event.target.value)} />
            </label>
            <label className="field">
              <span>{labels.web.fields.endDay}</span>
              <input type="number" min={1} max={31} value={monthlyEndDay} onChange={(event) => setMonthlyEndDay(event.target.value)} />
            </label>
            <label className="field">
              <span>{labels.web.fields.reminderTime}</span>
              <input value={reminderTime} placeholder="HH:mm" onChange={(event) => setReminderTime(event.target.value)} />
            </label>
          </div>
        ) : createMode === "monthly_last_days" ? (
          <div className="field-grid">
            <label className="field">
              <span>{labels.web.fields.lastDays}</span>
              <input type="number" min={1} max={31} value={monthlyLastDays} onChange={(event) => setMonthlyLastDays(event.target.value)} />
            </label>
            <label className="field">
              <span>{labels.web.fields.firstDays}</span>
              <input type="number" min={0} max={31} value={monthlyFirstDays} onChange={(event) => setMonthlyFirstDays(event.target.value)} />
            </label>
            <label className="field">
              <span>{labels.web.fields.reminderTime}</span>
              <input value={reminderTime} placeholder="HH:mm" onChange={(event) => setReminderTime(event.target.value)} />
            </label>
          </div>
        ) : createMode === "window" ? (
          <div className="field-grid">
            <label className="field">
              <span>{labels.web.fields.windowStart}</span>
              <input type="date" value={windowStart} onChange={(event) => setWindowStart(event.target.value)} />
            </label>
            <label className="field">
              <span>{labels.web.fields.windowEnd}</span>
              <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </label>
            <label className="field">
              <span>{labels.web.fields.reminderTime}</span>
              <input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} />
            </label>
          </div>
        ) : (
          <div className="field-grid">
            <label className="field">
              <span>{labels.web.fields.dueAt}</span>
              <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </label>
            <label className="field">
              <span>{labels.web.fields.reminderTime}</span>
              <input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} />
            </label>
          </div>
        )}
        <fieldset className="assignee-field">
          <legend>
            <span>{labels.web.fields.assignees}</span>
            {assignees.length > 0 ? (
              <button className="assignee-toggle" type="button" onClick={toggleAllAssignees}>
                {areSameIds(selectedAssigneeIds, assignees.map((assignee) => assignee.id)) ? <CheckSquare size={16} /> : <Square size={16} />}
                <span>{areSameIds(selectedAssigneeIds, assignees.map((assignee) => assignee.id)) ? labels.web.actions.unchooseAll : labels.web.actions.chooseAll}</span>
              </button>
            ) : null}
          </legend>
          {isLoadingAssignees ? <span className="muted-text">{labels.web.messages.loadingAssignees}</span> : null}
          {assignees.map((assignee) => (
            <label key={assignee.id} className="checkbox-row">
              <input
                type="checkbox"
                checked={selectedAssigneeIds.includes(assignee.id)}
                onChange={() => toggleAssignee(assignee.id)}
              />
              <span>{assignee.displayName}</span>
            </label>
          ))}
        </fieldset>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="task-card__actions">
          <Button variant="primary" type="submit" disabled={isSaving || isLoadingAssignees}>
            {isSaving ? labels.web.actions.creating : labels.web.actions.create}
          </Button>
          <Button variant="ghost" type="button" disabled={isSaving} onClick={onClose}>
            {labels.web.actions.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TasksSection({ user }: { user: CurrentUser }) {
  const labels = useI18n();
  const [activeTab, setActiveTab] = useState<TaskTab>("my");
  const [familyTasks, setFamilyTasks] = useState<TaskLoadState>({ status: "loading" });
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [myTasks, setMyTasks] = useState<TaskLoadState>({ status: "loading" });
  const [notice, setNotice] = useState<string | null>(null);

  const refreshTaskLists = (message?: string) => {
    if (message) {
      setNotice(message);
    }

    setFamilyTasks({ status: "loading" });
    setMyTasks({ status: "loading" });
    let isMounted = true;

    getMyTasks()
      .then((tasks) => {
        if (isMounted) {
          setMyTasks({ status: "ready", tasks });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setMyTasks({
            status: "error",
            message: error instanceof Error ? error.message : labels.tasks.loadFailed
          });
        }
      });

    getFamilyTasks()
      .then((tasks) => {
        if (isMounted) {
          setFamilyTasks({ status: "ready", tasks });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setFamilyTasks({
            status: "error",
            message: error instanceof Error ? error.message : labels.tasks.loadFailed
          });
        }
      });

    return () => {
      isMounted = false;
    };
  };

  useEffect(() => {
    return refreshTaskLists();
  }, []);

  const handleTaskAction = (taskId: number, action: "complete" | "miss") => {
    const actionRequest = action === "complete" ? completeTask(taskId) : missTask(taskId);

    setNotice(null);

    actionRequest
      .then(() => {
        refreshTaskLists();
      })
      .catch(() => {
        refreshTaskLists(labels.tasks.alreadyChanged);
      });
  };

  const handleTaskUpdate = (taskId: number, input: OneTimeTaskUpdate) => {
    setNotice(null);

    return updateOneTimeTask(taskId, input).then(() => {
      refreshTaskLists(labels.tasks.updated);
    });
  };

  const handleWeeklyTaskUpdate = (taskId: number, input: WeeklyTaskUpdate) => {
    setNotice(null);

    return updateWeeklyTask(taskId, input).then(() => {
      refreshTaskLists(labels.tasks.updated);
    });
  };

  const handleMonthlyTaskUpdate = (taskId: number, input: MonthlyTaskUpdate) => {
    setNotice(null);

    return updateMonthlyTask(taskId, input).then(() => {
      refreshTaskLists(labels.tasks.updated);
    });
  };

  const handleTaskDelete = (taskId: number) => {
    setNotice(null);

    return deleteTask(taskId).then(() => {
      refreshTaskLists(labels.tasks.deleted);
    });
  };

  const handleTaskCreate = (input: TaskCreateInput) => {
    setNotice(null);

    return createTask(input).then(() => {
      refreshTaskLists(labels.tasks.created);
    });
  };

  const visibleState = activeTab === "my" ? myTasks : familyTasks;
  const visibleEmptyText = activeTab === "my" ? labels.tasks.emptyMy : labels.tasks.emptyFamily;

  return (
    <Panel className="tasks-panel" title={labels.tasks.title} description={labels.tasks.description}>
      <div className="task-toolbar task-toolbar--tasks sticky-panel-toolbar">
        <div className="tabs" role="tablist" aria-label={labels.tasks.listLabel}>
          <button
            className={`tab ${activeTab === "my" ? "tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "my"}
            onClick={() => setActiveTab("my")}
          >
            {labels.tasks.myTab}
          </button>
          <button
            className={`tab ${activeTab === "family" ? "tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "family"}
            onClick={() => setActiveTab("family")}
          >
            {labels.tasks.familyTab}
          </button>
        </div>
        <Button className="button--icon-mobile" variant="ghost" type="button" title={labels.common.refresh} aria-label={labels.common.refresh} onClick={() => refreshTaskLists(labels.tasks.refreshed)}>
          <RefreshCw size={18} />
          <span className="button__text">{labels.common.refresh}</span>
        </Button>
        <Button variant="primary" type="button" onClick={() => setIsCreatingTask(true)}>
          <Plus size={18} />
          {labels.web.actions.create}
        </Button>
      </div>
      {notice ? <div className="notice">{notice}</div> : null}
      <TaskListContent
        emptyText={visibleEmptyText}
        onTaskAction={handleTaskAction}
        onMonthlyTaskUpdate={handleMonthlyTaskUpdate}
        onTaskUpdate={handleTaskUpdate}
        onTaskDelete={handleTaskDelete}
        onWeeklyTaskUpdate={handleWeeklyTaskUpdate}
        showAssignees={activeTab === "family"}
        state={visibleState}
        user={user}
      />
      {isCreatingTask ? (
        <CreateTaskModal
          timezone={user.timezone}
          user={user}
          onClose={() => setIsCreatingTask(false)}
          onCreated={handleTaskCreate}
        />
      ) : null}
    </Panel>
  );
}

function TelegramLoginButton({ telegramBotUsername }: { telegramBotUsername: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.replaceChildren();

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.dataset.telegramLogin = telegramBotUsername;
    script.dataset.size = "large";
    script.dataset.authUrl = `${window.location.origin}/auth/telegram/callback`;
    script.dataset.requestAccess = "write";

    container.appendChild(script);

    return () => {
      container.replaceChildren();
    };
  }, [telegramBotUsername]);

  return <div className="telegram-login" ref={containerRef} />;
}

function LoginView({ telegramBotUsername }: { telegramBotUsername: string }) {
  const labels = useI18n();

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-panel__icon" aria-hidden="true">
          <LogIn size={28} />
        </div>
        <h1>{labels.auth.loginTitle}</h1>
        <p>{labels.auth.loginDescription}</p>
        <TelegramLoginButton telegramBotUsername={telegramBotUsername} />
      </section>
    </main>
  );
}

function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
}

function isValidTimezone(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > 100) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());

    return true;
  } catch {
    return false;
  }
}

function AccountTimezoneButton({
  onUserUpdate,
  user
}: {
  onUserUpdate: (user: CurrentUser) => void;
  user: CurrentUser;
}) {
  const labels = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [timezone, setTimezone] = useState(user.timezone);
  const browserTimezone = getBrowserTimezone();

  const openModal = () => {
    setError(null);
    setTimezone(user.timezone);
    setIsOpen(true);
  };

  const saveTimezone = () => {
    const trimmed = timezone.trim();

    if (!isValidTimezone(trimmed)) {
      setError(labels.api.errors.invalid_timezone ?? labels.api.fallbacks.updateTimezoneFailed);
      return;
    }

    setError(null);
    setIsSaving(true);

    updateCurrentUserTimezone(trimmed)
      .then((updatedUser) => {
        onUserUpdate(updatedUser);
        setIsOpen(false);
      })
      .catch((error: unknown) => {
        setError(error instanceof Error ? error.message : labels.api.fallbacks.updateTimezoneFailed);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  return (
    <>
      <Button className="button--icon-mobile timezone-button" variant="ghost" type="button" title={labels.account.timezone} aria-label={labels.account.timezone} onClick={openModal}>
        <Globe2 size={18} />
        <span className="button__text">{user.timezone}</span>
      </Button>
      {isOpen ? (
        <Modal
          title={labels.account.timezoneTitle}
          description={labels.account.timezoneDescription}
          onClose={() => {
            if (!isSaving) {
              setIsOpen(false);
            }
          }}
        >
          <form className="task-edit-form" onSubmit={(event) => {
            event.preventDefault();
            saveTimezone();
          }}>
            <label className="field">
              <span>{labels.account.timezone}</span>
              <input
                autoComplete="off"
                placeholder="Europe/Kyiv"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              />
            </label>
            <p className="field-hint">{labels.account.timezoneHint}</p>
            {browserTimezone ? (
              <Button variant="secondary" type="button" disabled={isSaving} onClick={() => setTimezone(browserTimezone)}>
                {labels.account.useBrowserTimezone}: {browserTimezone}
              </Button>
            ) : null}
            {error ? <div className="form-error">{error}</div> : null}
            <div className="form-actions">
              <Button variant="primary" type="submit" disabled={isSaving}>
                {isSaving ? labels.web.actions.saving : labels.web.actions.save}
              </Button>
              <Button variant="ghost" type="button" disabled={isSaving} onClick={() => setIsOpen(false)}>
                {labels.web.actions.cancel}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

function AppView({ onUserUpdate, user }: { onUserUpdate: (user: CurrentUser) => void; user: CurrentUser }) {
  const labels = useI18n();
  const [activeSection, setActiveSection] = useState<AppSection>("tasks");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <img className="brand-mark__logo" src="/logo.png" alt="" aria-hidden="true" />
          <p className="eyebrow">Family Reminder</p>
        </div>
        <div className="topbar__actions">
          <AccountTimezoneButton user={user} onUserUpdate={onUserUpdate} />
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="account-bar" aria-label={labels.account.currentUser}>
          <div className="account-bar__identity">
            <span className="account-bar__label">{labels.account.user}:</span>
            <strong>{user.displayName}</strong>
            <span>ID {user.telegramUserId}</span>
          </div>
          <div className="account-bar__actions">
            {user.isAdmin ? (
              <Badge tone="warning">
                <ShieldCheck size={14} />
                {labels.account.admin}
              </Badge>
            ) : (
              <Badge>{labels.account.participant}</Badge>
            )}
            <a className="button button--ghost" href="/logout">
              <LogOut size={18} />
              <span className="button__text">{labels.account.logout}</span>
            </a>
          </div>
        </section>

        <section className="section-tabs" aria-label={labels.navigation.appSections}>
          <div className="tabs tabs--sections" role="tablist" aria-label={labels.navigation.appSections}>
            <button
              className={`tab ${activeSection === "tasks" ? "tab--active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeSection === "tasks"}
              onClick={() => setActiveSection("tasks")}
            >
              {labels.navigation.tasks}
            </button>
            <button
              className={`tab ${activeSection === "history" ? "tab--active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeSection === "history"}
              onClick={() => setActiveSection("history")}
            >
              {labels.navigation.history}
            </button>
            {user.isAdmin ? (
              <button
                className={`tab ${activeSection === "settings" ? "tab--active" : ""}`}
                type="button"
                role="tab"
                aria-selected={activeSection === "settings"}
                onClick={() => setActiveSection("settings")}
              >
                {labels.navigation.settings}
              </button>
            ) : null}
          </div>
        </section>

        {activeSection === "tasks" ? <TasksSection user={user} /> : null}
        {activeSection === "history" ? <HistorySection user={user} /> : null}
        {activeSection === "settings" ? <SettingsSection user={user} /> : null}
      </div>
    </main>
  );
}

export function App() {
  const [configState, setConfigState] = useState<ConfigLoadState>({ status: "loading" });
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;

    getAppConfig()
      .then((config) => {
        if (!isMounted) {
          return;
        }

        setConfigState({
          status: "ready",
          appLocale: config.appLocale === "en" ? "en" : "ru",
          telegramBotUsername: config.telegramBotUsername
        });
        setApiLabels(getAppLabels(config.appLocale === "en" ? "en" : "ru"));
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setConfigState({
          status: "error",
          message: error instanceof Error ? error.message : DEFAULT_LABELS.common.unknownError
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    getCurrentUser()
      .then((user) => {
        if (!isMounted) {
          return;
        }

        setState(user ? { status: "ready", user } : { status: "guest" });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setState({
          status: "error",
          message: error instanceof Error ? error.message : DEFAULT_LABELS.common.unknownError
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (configState.status === "loading") {
    return <main className="status-page">{DEFAULT_LABELS.common.loading}</main>;
  }

  if (configState.status === "error") {
    return <main className="status-page status-page--error">{configState.message}</main>;
  }

  const labels = getAppLabels(configState.appLocale);

  if (state.status === "loading") {
    return <main className="status-page">{labels.common.loading}</main>;
  }

  if (state.status === "error") {
    return <main className="status-page status-page--error">{state.message}</main>;
  }

  if (state.status === "guest" || window.location.pathname === "/login") {
    return (
      <I18nContext.Provider value={labels}>
        <LoginView telegramBotUsername={configState.telegramBotUsername} />
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={labels}>
      <AppView
        user={state.user}
        onUserUpdate={(user) => {
          setState({ status: "ready", user });
        }}
      />
    </I18nContext.Provider>
  );
}
