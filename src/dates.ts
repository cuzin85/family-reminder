export interface ParsedLocalDateTime {
  iso: string;
  display: string;
}

export interface ParsedLocalTime {
  hour: number;
  minute: number;
  display: string;
}

export interface WeeklyTaskWindow {
  availableFrom: string;
  dueAt: string;
  remindAt: string;
  dueDisplay: string;
  reminderDisplay: string;
}

export interface MonthlyTaskWindow {
  availableFrom: string;
  dueAt: string;
  remindAt: string;
  periodLabel: string;
  dueDisplay: string;
  reminderDisplay: string;
}

export interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const offsetFormatterCache = new Map<string, Intl.DateTimeFormat>();
const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();
const timezoneAliases: Record<string, string> = {
  "Europe/Kiev": "Europe/Kyiv"
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function normalizeIanaTimezone(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const aliased = timezoneAliases[trimmed] ?? trimmed;

  try {
    const resolved = new Intl.DateTimeFormat("en-US", { timeZone: aliased }).resolvedOptions().timeZone;

    return timezoneAliases[resolved] ?? resolved ?? aliased;
  } catch {
    return aliased;
  }
}

function formatMonthPeriod(month: number, year: number): string {
  const monthNames = [
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "август",
    "сентябрь",
    "октябрь",
    "ноябрь",
    "декабрь"
  ];

  return `${monthNames[month - 1] ?? pad2(month)} ${year}`;
}

function parseDateTimeParts(value: string): DateTimeParts | null {
  const trimmed = value.trim();
  const isoLikeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);

  if (isoLikeMatch) {
    return {
      year: Number(isoLikeMatch[1]),
      month: Number(isoLikeMatch[2]),
      day: Number(isoLikeMatch[3]),
      hour: Number(isoLikeMatch[4]),
      minute: Number(isoLikeMatch[5])
    };
  }

  const localMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})$/);

  if (!localMatch) {
    return null;
  }

  return {
    day: Number(localMatch[1]),
    month: Number(localMatch[2]),
    year: Number(localMatch[3]),
    hour: Number(localMatch[4]),
    minute: Number(localMatch[5])
  };
}

function getOffsetMinutes(date: Date, timeZone: string): number | null {
  let formatter = offsetFormatterCache.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
    offsetFormatterCache.set(timeZone, formatter);
  }

  const timeZoneName = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  const match = timeZoneName?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);

  if (!match) {
    return null;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");

  return sign * (hours * 60 + minutes);
}

function formatParts(date: Date, timeZone: string): DateTimeParts {
  let formatter = partsFormatterCache.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
    partsFormatterCache.set(timeZone, formatter);
  }

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;

    if (!value) {
      throw new Error(`Missing ${type} in formatted date`);
    }

    return Number(value);
  };

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute")
  };
}

function localDateTimeToUtcDate(parts: DateTimeParts, timeZone: string): Date | null {
  const naiveUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const offsetMinutes = getOffsetMinutes(new Date(naiveUtcMs), timeZone);

  if (offsetMinutes === null) {
    return null;
  }

  const utcDate = new Date(naiveUtcMs - offsetMinutes * 60_000);
  const roundTrip = formatParts(utcDate, timeZone);

  if (
    roundTrip.year !== parts.year ||
    roundTrip.month !== parts.month ||
    roundTrip.day !== parts.day ||
    roundTrip.hour !== parts.hour ||
    roundTrip.minute !== parts.minute
  ) {
    return null;
  }

  return utcDate;
}

export function localDateTimeToUtcIso(parts: DateTimeParts, timeZone: string): string | null {
  return localDateTimeToUtcDate(parts, timeZone)?.toISOString() ?? null;
}

export function getDateTimePartsInTimeZone(value: string, timeZone: string): DateTimeParts | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatParts(date, timeZone);
}

export function parseLocalDateTime(value: string, timeZone: string): ParsedLocalDateTime | null {
  const parts = parseDateTimeParts(value);

  if (!parts) {
    return null;
  }

  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour > 23 ||
    parts.minute > 59
  ) {
    return null;
  }

  const utcDate = localDateTimeToUtcDate(parts, timeZone);

  if (!utcDate) {
    return null;
  }

  return {
    iso: utcDate.toISOString(),
    display: `${pad2(parts.day)}-${pad2(parts.month)}-${parts.year} ${pad2(parts.hour)}:${pad2(parts.minute)}`
  };
}

export function formatDateTimeInTimeZone(value: string, timeZone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = formatParts(date, timeZone);

  return `${pad2(parts.day)}-${pad2(parts.month)}-${parts.year} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function formatDateInTimeZone(value: string, timeZone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = formatParts(date, timeZone);

  return `${pad2(parts.day)}-${pad2(parts.month)}-${parts.year}`;
}

export function getNextDailyReminderWithinWindow(
  after: string,
  dueAt: string,
  hour: number,
  minute: number,
  timeZone: string
): string | null {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const afterDate = new Date(after);
  const dueDate = new Date(dueAt);

  if (Number.isNaN(afterDate.getTime()) || Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const afterParts = formatParts(afterDate, timeZone);

  for (let daysAhead = 0; daysAhead < 32; daysAhead += 1) {
    const localDate = new Date(Date.UTC(afterParts.year, afterParts.month - 1, afterParts.day + daysAhead));
    const candidate = localDateTimeToUtcDate(
      {
        year: localDate.getUTCFullYear(),
        month: localDate.getUTCMonth() + 1,
        day: localDate.getUTCDate(),
        hour,
        minute
      },
      timeZone
    );

    if (!candidate || candidate.getTime() <= afterDate.getTime()) {
      continue;
    }

    if (candidate.getTime() <= dueDate.getTime()) {
      return candidate.toISOString();
    }

    return null;
  }

  return null;
}

export function getNextWindowReminderOrNow(
  now: string,
  availableFrom: string,
  dueAt: string,
  hour: number,
  minute: number,
  timeZone: string
): string | null {
  const nowDate = new Date(now);
  const availableFromDate = new Date(availableFrom);
  const dueDate = new Date(dueAt);

  if (
    Number.isNaN(nowDate.getTime()) ||
    Number.isNaN(availableFromDate.getTime()) ||
    Number.isNaN(dueDate.getTime())
  ) {
    return null;
  }

  const searchAfterDate = new Date(Math.max(nowDate.getTime(), availableFromDate.getTime()) - 60_000);
  const nextPlannedReminder = getNextDailyReminderWithinWindow(
    searchAfterDate.toISOString(),
    dueAt,
    hour,
    minute,
    timeZone
  );

  if (nextPlannedReminder) {
    return nextPlannedReminder;
  }

  if (availableFromDate.getTime() <= nowDate.getTime() && dueDate.getTime() > nowDate.getTime()) {
    return nowDate.toISOString();
  }

  return null;
}

export function getOneTimeTaskReminderAt(
  dueAt: string,
  hour: number,
  minute: number,
  timeZone: string
): string | null {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const dueDate = new Date(dueAt);

  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const dueParts = formatParts(dueDate, timeZone);
  const reminderDate = localDateTimeToUtcDate(
    {
      year: dueParts.year,
      month: dueParts.month,
      day: dueParts.day,
      hour,
      minute
    },
    timeZone
  );

  return reminderDate?.toISOString() ?? null;
}

export function parseLocalTime(value: string): ParsedLocalTime | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour > 23 || minute > 59) {
    return null;
  }

  return {
    hour,
    minute,
    display: `${pad2(hour)}:${pad2(minute)}`
  };
}

export function getWeekdayName(weekday: number): string {
  const names = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];

  return names[weekday - 1] ?? "неизвестный день";
}

function buildWeeklyTaskWindow(
  localDate: Date,
  hour: number,
  minute: number,
  timeZone: string,
  nowDate: Date
): WeeklyTaskWindow | null {
  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth() + 1;
  const day = localDate.getUTCDate();
  const availableFrom = localDateTimeToUtcDate({ year, month, day, hour: 0, minute: 0 }, timeZone);
  const dueAt = localDateTimeToUtcDate({ year, month, day, hour: 23, minute: 59 }, timeZone);
  const remindAt = localDateTimeToUtcDate({ year, month, day, hour, minute }, timeZone);

  if (!availableFrom || !dueAt || !remindAt) {
    return null;
  }

  return {
    availableFrom: availableFrom.toISOString(),
    dueAt: dueAt.toISOString(),
    remindAt: getNextWindowReminderOrNow(
      nowDate.toISOString(),
      availableFrom.toISOString(),
      dueAt.toISOString(),
      hour,
      minute,
      timeZone
    ) ?? remindAt.toISOString(),
    dueDisplay: `${pad2(day)}-${pad2(month)}-${year} 23:59`,
    reminderDisplay: `${pad2(day)}-${pad2(month)}-${year} ${pad2(hour)}:${pad2(minute)}`
  };
}

export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildMonthlyTaskWindow(
  input: {
    reportYear: number;
    reportMonth: number;
    availableYear: number;
    availableMonth: number;
    availableDay: number;
    dueYear: number;
    dueMonth: number;
    dueDay: number;
    hour: number;
    minute: number;
    timeZone: string;
    nowDate: Date;
  }
): MonthlyTaskWindow | null {
  const availableFrom = localDateTimeToUtcDate(
    {
      year: input.availableYear,
      month: input.availableMonth,
      day: input.availableDay,
      hour: 0,
      minute: 0
    },
    input.timeZone
  );
  const dueAt = localDateTimeToUtcDate(
    {
      year: input.dueYear,
      month: input.dueMonth,
      day: input.dueDay,
      hour: 23,
      minute: 59
    },
    input.timeZone
  );
  const firstReminder = localDateTimeToUtcDate(
    {
      year: input.availableYear,
      month: input.availableMonth,
      day: input.availableDay,
      hour: input.hour,
      minute: input.minute
    },
    input.timeZone
  );

  if (!availableFrom || !dueAt || !firstReminder) {
    return null;
  }

  return {
    availableFrom: availableFrom.toISOString(),
    dueAt: dueAt.toISOString(),
    remindAt: getNextWindowReminderOrNow(
      input.nowDate.toISOString(),
      availableFrom.toISOString(),
      dueAt.toISOString(),
      input.hour,
      input.minute,
      input.timeZone
    ) ?? firstReminder.toISOString(),
    periodLabel: formatMonthPeriod(input.reportMonth, input.reportYear),
    dueDisplay: `${pad2(input.dueDay)}-${pad2(input.dueMonth)}-${input.dueYear} 23:59`,
    reminderDisplay: `${pad2(input.availableDay)}-${pad2(input.availableMonth)}-${input.availableYear} ${pad2(input.hour)}:${pad2(input.minute)}`
  };
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1
  };
}

function getMonthlyFixedWindowForReportMonth(
  reportYear: number,
  reportMonth: number,
  startDay: number,
  endDay: number,
  hour: number,
  minute: number,
  timeZone: string,
  nowDate: Date
): MonthlyTaskWindow | null {
  const lastDay = getLastDayOfMonth(reportYear, reportMonth);
  const availableDay = Math.min(startDay, lastDay);
  const dueDay = Math.min(endDay, lastDay);

  if (availableDay > dueDay) {
    return null;
  }

  return buildMonthlyTaskWindow({
    reportYear,
    reportMonth,
    availableYear: reportYear,
    availableMonth: reportMonth,
    availableDay,
    dueYear: reportYear,
    dueMonth: reportMonth,
    dueDay,
    hour,
    minute,
    timeZone,
    nowDate
  });
}

function getMonthlyEndPlusStartWindowForReportMonth(
  reportYear: number,
  reportMonth: number,
  lastDays: number,
  firstDays: number,
  hour: number,
  minute: number,
  timeZone: string,
  nowDate: Date
): MonthlyTaskWindow | null {
  const reportLastDay = getLastDayOfMonth(reportYear, reportMonth);
  const availableDay = Math.max(1, reportLastDay - lastDays + 1);
  const dueMonth = firstDays === 0
    ? { year: reportYear, month: reportMonth }
    : addMonths(reportYear, reportMonth, 1);
  const dueMonthLastDay = getLastDayOfMonth(dueMonth.year, dueMonth.month);
  const dueDay = firstDays === 0
    ? reportLastDay
    : Math.min(firstDays, dueMonthLastDay);

  return buildMonthlyTaskWindow({
    reportYear,
    reportMonth,
    availableYear: reportYear,
    availableMonth: reportMonth,
    availableDay,
    dueYear: dueMonth.year,
    dueMonth: dueMonth.month,
    dueDay,
    hour,
    minute,
    timeZone,
    nowDate
  });
}

function getNextMonthlyTaskWindowFromCandidates(
  now: string,
  timeZone: string,
  buildWindow: (year: number, month: number, nowDate: Date) => MonthlyTaskWindow | null
): MonthlyTaskWindow | null {
  const nowDate = new Date(now);

  if (Number.isNaN(nowDate.getTime())) {
    return null;
  }

  const nowParts = formatParts(nowDate, timeZone);
  const candidates = [-1, 0, 1, 2]
    .map((delta) => addMonths(nowParts.year, nowParts.month, delta))
    .map(({ year, month }) => buildWindow(year, month, nowDate))
    .filter((window): window is MonthlyTaskWindow => window !== null)
    .filter((window) => Date.parse(window.dueAt) > nowDate.getTime())
    .sort((left, right) => Date.parse(left.availableFrom) - Date.parse(right.availableFrom));

  return candidates[0] ?? null;
}

export function getNextMonthlyFixedWindow(
  now: string,
  startDay: number,
  endDay: number,
  hour: number,
  minute: number,
  timeZone: string
): MonthlyTaskWindow | null {
  if (
    startDay < 1 ||
    startDay > 31 ||
    endDay < 1 ||
    endDay > 31 ||
    startDay > endDay ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return getNextMonthlyTaskWindowFromCandidates(now, timeZone, (year, month, nowDate) =>
    getMonthlyFixedWindowForReportMonth(year, month, startDay, endDay, hour, minute, timeZone, nowDate)
  );
}

export function getNextMonthlyEndPlusStartWindow(
  now: string,
  lastDays: number,
  firstDays: number,
  hour: number,
  minute: number,
  timeZone: string
): MonthlyTaskWindow | null {
  if (
    lastDays < 1 ||
    lastDays > 31 ||
    firstDays < 0 ||
    firstDays > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return getNextMonthlyTaskWindowFromCandidates(now, timeZone, (year, month, nowDate) =>
    getMonthlyEndPlusStartWindowForReportMonth(year, month, lastDays, firstDays, hour, minute, timeZone, nowDate)
  );
}

export function getNextWeeklyTaskWindow(
  now: string,
  weekday: number,
  hour: number,
  minute: number,
  timeZone: string
): WeeklyTaskWindow | null {
  if (weekday < 1 || weekday > 7 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const nowDate = new Date(now);

  if (Number.isNaN(nowDate.getTime())) {
    return null;
  }

  const nowParts = formatParts(nowDate, timeZone);
  const localTodayUtc = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day));
  const currentWeekday = localTodayUtc.getUTCDay() === 0 ? 7 : localTodayUtc.getUTCDay();
  let daysUntil = (weekday - currentWeekday + 7) % 7;

  for (let attempts = 0; attempts < 2; attempts += 1) {
    const localDate = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day + daysUntil));
    const window = buildWeeklyTaskWindow(localDate, hour, minute, timeZone, nowDate);

    if (window && Date.parse(window.dueAt) > nowDate.getTime()) {
      return window;
    }

    daysUntil += 7;
  }

  return null;
}

export function getNextWeeklyTaskWindowAfter(
  after: string,
  weekday: number,
  hour: number,
  minute: number,
  timeZone: string
): WeeklyTaskWindow | null {
  const afterDate = new Date(after);

  if (Number.isNaN(afterDate.getTime())) {
    return null;
  }

  const afterParts = formatParts(afterDate, timeZone);
  const localAfterDate = new Date(Date.UTC(afterParts.year, afterParts.month - 1, afterParts.day + 1));

  return getNextWeeklyTaskWindow(localAfterDate.toISOString(), weekday, hour, minute, timeZone);
}
