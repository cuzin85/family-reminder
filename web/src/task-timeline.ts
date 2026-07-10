import type { TaskListItem, UpcomingAnnualEventListItem } from "./api";

export type TaskTimelineItem =
  | { kind: "event"; event: UpcomingAnnualEventListItem }
  | { kind: "task"; task: TaskListItem };

function normalizeTimezone(value: string | null, fallback: string): string {
  const timezone = value?.trim() || fallback;

  return timezone === "Europe/Kiev" ? "Europe/Kyiv" : timezone;
}

function getDateKey(value: string, timezone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function compareTimelineItems(left: TaskTimelineItem, right: TaskTimelineItem, userTimezone: string): number {
  const leftOverdue = left.kind === "task" && left.task.status === "overdue";
  const rightOverdue = right.kind === "task" && right.task.status === "overdue";

  if (leftOverdue !== rightOverdue) {
    return leftOverdue ? -1 : 1;
  }

  const leftDate = left.kind === "event"
    ? left.event.upcomingEventDate
    : getDateKey(left.task.dueAt, normalizeTimezone(left.task.ruleTimezone, userTimezone));
  const rightDate = right.kind === "event"
    ? right.event.upcomingEventDate
    : getDateKey(right.task.dueAt, normalizeTimezone(right.task.ruleTimezone, userTimezone));
  const dateComparison = leftDate.localeCompare(rightDate);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  if (left.kind !== right.kind) {
    return left.kind === "event" ? -1 : 1;
  }

  if (left.kind === "event" && right.kind === "event") {
    return left.event.title.localeCompare(right.event.title);
  }

  if (left.kind === "task" && right.kind === "task") {
    return Date.parse(left.task.dueAt) - Date.parse(right.task.dueAt) || left.task.title.localeCompare(right.task.title);
  }

  return 0;
}

export function buildTaskTimeline(
  tasks: TaskListItem[],
  annualEvents: UpcomingAnnualEventListItem[],
  userTimezone: string
): TaskTimelineItem[] {
  return [
    ...tasks.map((task): TaskTimelineItem => ({ kind: "task", task })),
    ...annualEvents.map((event): TaskTimelineItem => ({ kind: "event", event }))
  ].sort((left, right) => compareTimelineItems(left, right, userTimezone));
}
