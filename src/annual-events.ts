import { getAppConfig, serializeAnnualEventNotifyDays } from "./config";
import {
  getDateTimePartsInTimeZone,
  getLastDayOfMonth,
  localDateTimeToUtcIso,
  normalizeIanaTimezone,
  parseLocalTime
} from "./dates";
import type { Env } from "./env";

export interface AnnualEvent {
  id: number;
  created_by_user_id: number;
  title: string;
  description: string | null;
  event_month: number;
  event_day: number;
  event_year: number | null;
  reminder_hour: number;
  reminder_minute: number;
  timezone: string;
  notification_days_json: string;
  next_notification_at: string | null;
  next_notification_event_date: string | null;
  next_notification_offset_days: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface AnnualEventNotificationCandidate {
  at: string;
  eventDate: string;
  offsetDays: number;
}

export interface CreateAnnualEventInput {
  title: string;
  description?: string | null;
  eventMonth: number;
  eventDay: number;
  eventYear?: number | null;
  reminderTime: string;
  timezone: string;
  recipientUserIds: number[];
  createdByUserId: number;
  now: string;
}

export interface UpdateAnnualEventInput extends Omit<CreateAnnualEventInput, "createdByUserId"> {}

export interface AnnualEventListItem extends AnnualEvent {
  recipient_ids: string | null;
  recipient_names: string | null;
  can_manage: number;
}

export type AnnualEventListScope = "family" | "my";

export interface UpcomingAnnualEvent extends AnnualEventListItem {
  upcoming_event_date: string;
  days_until: number;
}

export interface DueAnnualEventNotification extends AnnualEvent {
  user_id: number;
  telegram_chat_id: number;
  is_admin: number;
}

const MAX_ANNUAL_EVENT_RECIPIENTS = 50;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isValidAnnualEventDate(month: number, day: number): boolean {
  if (!Number.isSafeInteger(month) || !Number.isSafeInteger(day) || month < 1 || month > 12 || day < 1) {
    return false;
  }

  if (month === 2 && day === 29) {
    return true;
  }

  return day <= getLastDayOfMonth(2024, month);
}

function getAnnualEventDateParts(year: number, month: number, day: number): { year: number; month: number; day: number } | null {
  if (!isValidAnnualEventDate(month, day)) {
    return null;
  }

  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return { year, month: 2, day: 28 };
  }

  return { year, month, day };
}

function formatLocalDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split("-");

  return year && month && day ? `${day}-${month}-${year}` : value;
}

function subtractLocalDays(
  parts: { year: number; month: number; day: number },
  days: number
): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - days));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function buildAnnualEventNotificationCandidate(
  event: Pick<AnnualEvent, "event_month" | "event_day" | "reminder_hour" | "reminder_minute" | "timezone">,
  eventYear: number,
  offsetDays: number
): AnnualEventNotificationCandidate | null {
  const eventDate = getAnnualEventDateParts(eventYear, event.event_month, event.event_day);

  if (!eventDate) {
    return null;
  }

  const notificationDate = subtractLocalDays(eventDate, offsetDays);
  const at = localDateTimeToUtcIso(
    {
      ...notificationDate,
      hour: event.reminder_hour,
      minute: event.reminder_minute
    },
    event.timezone
  );

  if (!at) {
    return null;
  }

  return {
    at,
    eventDate: formatLocalDate(eventDate.year, eventDate.month, eventDate.day),
    offsetDays
  };
}

export function getNextAnnualEventNotification(
  now: string,
  event: Pick<AnnualEvent, "event_month" | "event_day" | "reminder_hour" | "reminder_minute" | "timezone">,
  notifyDays: number[]
): AnnualEventNotificationCandidate | null {
  const nowDate = new Date(now);

  if (Number.isNaN(nowDate.getTime())) {
    return null;
  }

  const normalizedTimezone = normalizeIanaTimezone(event.timezone) ?? event.timezone;
  const nowParts = getDateTimePartsInTimeZone(now, normalizedTimezone);

  if (!nowParts) {
    return null;
  }

  const eventWithTimezone = {
    ...event,
    timezone: normalizedTimezone
  };

  const candidates = [nowParts.year, nowParts.year + 1, nowParts.year + 2]
    .flatMap((year) => notifyDays.map((offsetDays) => buildAnnualEventNotificationCandidate(eventWithTimezone, year, offsetDays)))
    .filter((candidate): candidate is AnnualEventNotificationCandidate => candidate !== null)
    .filter((candidate) => Date.parse(candidate.at) > nowDate.getTime())
    .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));

  return candidates[0] ?? null;
}

export function getUpcomingAnnualEventOccurrence(
  now: string,
  event: Pick<AnnualEvent, "event_month" | "event_day" | "timezone">,
  windowDays: number
): { eventDate: string; daysUntil: number } | null {
  const timezone = normalizeIanaTimezone(event.timezone) ?? event.timezone;
  const nowParts = getDateTimePartsInTimeZone(now, timezone);

  if (!nowParts) {
    return null;
  }

  const todayUtc = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  const candidates = [nowParts.year, nowParts.year + 1]
    .map((year) => getAnnualEventDateParts(year, event.event_month, event.event_day))
    .filter((parts): parts is { year: number; month: number; day: number } => parts !== null)
    .map((parts) => {
      const eventUtc = Date.UTC(parts.year, parts.month - 1, parts.day);

      return {
        eventDate: formatLocalDate(parts.year, parts.month, parts.day),
        daysUntil: Math.round((eventUtc - todayUtc) / 86_400_000)
      };
    })
    .filter((candidate) => candidate.daysUntil >= 0 && candidate.daysUntil <= windowDays)
    .sort((left, right) => left.daysUntil - right.daysUntil);

  return candidates[0] ?? null;
}

export function validateAnnualEventInput(input: CreateAnnualEventInput): {
  title: string;
  description: string | null;
  eventMonth: number;
  eventDay: number;
  eventYear: number | null;
  reminderHour: number;
  reminderMinute: number;
  timezone: string;
  recipientUserIds: number[];
} | null {
  const title = input.title.trim();
  const description = input.description?.trim() || null;
  const timezone = normalizeIanaTimezone(input.timezone);
  const reminderTime = parseLocalTime(input.reminderTime);
  const recipientUserIds = [...new Set(input.recipientUserIds)]
    .filter((userId) => Number.isSafeInteger(userId) && userId > 0)
    .slice(0, MAX_ANNUAL_EVENT_RECIPIENTS);

  if (
    title.length === 0 ||
    title.length > 200 ||
    !timezone ||
    !reminderTime ||
    !isValidAnnualEventDate(input.eventMonth, input.eventDay) ||
    recipientUserIds.length === 0
  ) {
    return null;
  }

  const eventYear = input.eventYear ?? null;

  if (eventYear !== null && (!Number.isSafeInteger(eventYear) || eventYear < 1 || eventYear > 9999)) {
    return null;
  }

  return {
    title,
    description,
    eventMonth: input.eventMonth,
    eventDay: input.eventDay,
    eventYear,
    reminderHour: reminderTime.hour,
    reminderMinute: reminderTime.minute,
    timezone,
    recipientUserIds
  };
}

export async function createAnnualEvent(env: Env, input: CreateAnnualEventInput): Promise<number | null> {
  const validated = validateAnnualEventInput(input);

  if (!validated) {
    return null;
  }

  const validRecipientUserIds = await getValidRecipientUserIds(env, validated.recipientUserIds);

  if (validRecipientUserIds.length === 0) {
    return null;
  }

  const config = getAppConfig(env);
  const notificationDaysJson = serializeAnnualEventNotifyDays(config.annualEventNotifyDays);
  const nextNotification = getNextAnnualEventNotification(
    input.now,
    {
      event_month: validated.eventMonth,
      event_day: validated.eventDay,
      reminder_hour: validated.reminderHour,
      reminder_minute: validated.reminderMinute,
      timezone: validated.timezone
    },
    config.annualEventNotifyDays
  );

  const result = await env.DB.prepare(
    `
      INSERT INTO annual_events (
        created_by_user_id,
        title,
        description,
        event_month,
        event_day,
        event_year,
        reminder_hour,
        reminder_minute,
        timezone,
        notification_days_json,
        next_notification_at,
        next_notification_event_date,
        next_notification_offset_days,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      input.createdByUserId,
      validated.title,
      validated.description,
      validated.eventMonth,
      validated.eventDay,
      validated.eventYear,
      validated.reminderHour,
      validated.reminderMinute,
      validated.timezone,
      notificationDaysJson,
      nextNotification?.at ?? null,
      nextNotification?.eventDate ?? null,
      nextNotification?.offsetDays ?? null,
      input.now,
      input.now
    )
    .run();

  const eventId = result.meta.last_row_id;

  if (!eventId) {
    return null;
  }

  const statements = validRecipientUserIds.map((userId) =>
    env.DB.prepare(
      `
        INSERT OR IGNORE INTO annual_event_recipients (
          annual_event_id,
          user_id,
          created_at
        )
        VALUES (?, ?, ?)
      `
    ).bind(eventId, userId, input.now)
  );

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  return eventId;
}

async function getValidRecipientUserIds(env: Env, userIds: number[]): Promise<number[]> {
  const uniqueUserIds = [...new Set(userIds)].filter((userId) => Number.isSafeInteger(userId) && userId > 0);

  if (uniqueUserIds.length === 0) {
    return [];
  }

  const placeholders = uniqueUserIds.map(() => "?").join(", ");
  const result = await env.DB.prepare(
    `
      SELECT id
      FROM users
      WHERE is_active = 1
        AND id IN (${placeholders})
      ORDER BY id
    `
  )
    .bind(...uniqueUserIds)
    .all<{ id: number }>();

  return (result.results ?? []).map((row) => row.id);
}

export async function getAnnualEventsForUser(
  env: Env,
  userId: number,
  isAdmin: boolean,
  scope: AnnualEventListScope
): Promise<AnnualEventListItem[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        annual_events.*,
        GROUP_CONCAT(annual_event_recipients.user_id) AS recipient_ids,
        GROUP_CONCAT(
          COALESCE(
            NULLIF(TRIM(COALESCE(users.first_name, '') || ' ' || COALESCE(users.last_name, '')), ''),
            users.username,
            'ID ' || users.telegram_user_id
          ),
          ', '
        ) AS recipient_names,
        CASE
          WHEN ? = 1
            OR annual_events.created_by_user_id = ?
            OR EXISTS (
              SELECT 1
              FROM annual_event_recipients AS current_user_recipients
              WHERE current_user_recipients.annual_event_id = annual_events.id
                AND current_user_recipients.user_id = ?
            )
          THEN 1
          ELSE 0
        END AS can_manage
      FROM annual_events
      LEFT JOIN annual_event_recipients
        ON annual_event_recipients.annual_event_id = annual_events.id
      LEFT JOIN users
        ON users.id = annual_event_recipients.user_id
      WHERE annual_events.is_active = 1
        AND (
          ? = 1
          OR EXISTS (
            SELECT 1
            FROM annual_event_recipients AS visible_recipients
            WHERE visible_recipients.annual_event_id = annual_events.id
              AND visible_recipients.user_id = ?
          )
        )
      GROUP BY annual_events.id
      ORDER BY
        annual_events.next_notification_event_date IS NULL,
        annual_events.next_notification_event_date ASC,
        annual_events.event_month ASC,
        annual_events.event_day ASC,
        annual_events.title ASC
    `
  )
    .bind(isAdmin ? 1 : 0, userId, userId, scope === "family" ? 1 : 0, userId)
    .all<AnnualEventListItem>();

  return result.results ?? [];
}

export async function getUpcomingAnnualEventsForUser(
  env: Env,
  userId: number,
  now: string,
  windowDays = 7
): Promise<UpcomingAnnualEvent[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        annual_events.*,
        GROUP_CONCAT(annual_event_recipients.user_id) AS recipient_ids,
        GROUP_CONCAT(
          COALESCE(
            NULLIF(TRIM(COALESCE(users.first_name, '') || ' ' || COALESCE(users.last_name, '')), ''),
            users.username,
            'ID ' || users.telegram_user_id
          ),
          ', '
        ) AS recipient_names,
        CASE
          WHEN annual_events.created_by_user_id = ?
            OR EXISTS (
              SELECT 1
              FROM annual_event_recipients AS managing_recipients
              WHERE managing_recipients.annual_event_id = annual_events.id
                AND managing_recipients.user_id = ?
            )
          THEN 1
          ELSE 0
        END AS can_manage
      FROM annual_events
      INNER JOIN annual_event_recipients AS current_recipient
        ON current_recipient.annual_event_id = annual_events.id
        AND current_recipient.user_id = ?
      LEFT JOIN annual_event_recipients
        ON annual_event_recipients.annual_event_id = annual_events.id
      LEFT JOIN users
        ON users.id = annual_event_recipients.user_id
      WHERE annual_events.is_active = 1
      GROUP BY annual_events.id
      ORDER BY annual_events.event_month ASC, annual_events.event_day ASC, annual_events.title ASC
    `
  )
    .bind(userId, userId, userId)
    .all<AnnualEventListItem>();

  return (result.results ?? [])
    .map((event) => {
      const occurrence = getUpcomingAnnualEventOccurrence(now, event, windowDays);

      return occurrence
        ? {
            ...event,
            upcoming_event_date: occurrence.eventDate,
            days_until: occurrence.daysUntil
          }
        : null;
    })
    .filter((event): event is UpcomingAnnualEvent => event !== null)
    .sort((left, right) => left.days_until - right.days_until || left.title.localeCompare(right.title));
}

export async function getUpcomingAnnualEventsForFamily(
  env: Env,
  userId: number,
  isAdmin: boolean,
  now: string,
  windowDays = 7
): Promise<UpcomingAnnualEvent[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        annual_events.*,
        GROUP_CONCAT(annual_event_recipients.user_id) AS recipient_ids,
        GROUP_CONCAT(
          COALESCE(
            NULLIF(TRIM(COALESCE(users.first_name, '') || ' ' || COALESCE(users.last_name, '')), ''),
            users.username,
            'ID ' || users.telegram_user_id
          ),
          ', '
        ) AS recipient_names,
        CASE
          WHEN ? = 1
            OR annual_events.created_by_user_id = ?
            OR EXISTS (
              SELECT 1
              FROM annual_event_recipients AS managing_recipients
              WHERE managing_recipients.annual_event_id = annual_events.id
                AND managing_recipients.user_id = ?
            )
          THEN 1
          ELSE 0
        END AS can_manage
      FROM annual_events
      LEFT JOIN annual_event_recipients
        ON annual_event_recipients.annual_event_id = annual_events.id
      LEFT JOIN users
        ON users.id = annual_event_recipients.user_id
      WHERE annual_events.is_active = 1
      GROUP BY annual_events.id
      ORDER BY annual_events.event_month ASC, annual_events.event_day ASC, annual_events.title ASC
    `
  )
    .bind(isAdmin ? 1 : 0, userId, userId)
    .all<AnnualEventListItem>();

  return (result.results ?? [])
    .map((event) => {
      const occurrence = getUpcomingAnnualEventOccurrence(now, event, windowDays);

      return occurrence
        ? {
            ...event,
            upcoming_event_date: occurrence.eventDate,
            days_until: occurrence.daysUntil
          }
        : null;
    })
    .filter((event): event is UpcomingAnnualEvent => event !== null)
    .sort((left, right) => left.days_until - right.days_until || left.title.localeCompare(right.title));
}

export async function getDueAnnualEventNotifications(
  env: Env,
  now: string,
  notificationDaysJson: string,
  limit = 20
): Promise<DueAnnualEventNotification[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        annual_events.*,
        users.id AS user_id,
        users.telegram_chat_id,
        users.is_admin
      FROM annual_events
      INNER JOIN annual_event_recipients
        ON annual_event_recipients.annual_event_id = annual_events.id
      INNER JOIN users
        ON users.id = annual_event_recipients.user_id
      WHERE annual_events.is_active = 1
        AND annual_events.notification_days_json = ?
        AND annual_events.next_notification_at IS NOT NULL
        AND annual_events.next_notification_event_date IS NOT NULL
        AND annual_events.next_notification_offset_days IS NOT NULL
        AND annual_events.next_notification_at <= ?
        AND users.is_active = 1
        AND NOT EXISTS (
          SELECT 1
          FROM annual_event_notification_log
          WHERE annual_event_notification_log.annual_event_id = annual_events.id
            AND annual_event_notification_log.user_id = users.id
            AND annual_event_notification_log.event_date = annual_events.next_notification_event_date
            AND annual_event_notification_log.offset_days = annual_events.next_notification_offset_days
        )
      ORDER BY annual_events.next_notification_at ASC, annual_events.id ASC
      LIMIT ?
    `
  )
    .bind(notificationDaysJson, now, limit)
    .all<DueAnnualEventNotification>();

  return result.results ?? [];
}

export async function recordAnnualEventNotification(
  env: Env,
  notification: DueAnnualEventNotification,
  status: "sent" | "failed",
  now: string,
  telegramMessageId: number | null,
  errorMessage: string | null
): Promise<void> {
  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO annual_event_notification_log (
        annual_event_id,
        user_id,
        event_date,
        offset_days,
        scheduled_for,
        sent_at,
        telegram_message_id,
        status,
        error_message,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      notification.id,
      notification.user_id,
      notification.next_notification_event_date,
      notification.next_notification_offset_days,
      notification.next_notification_at,
      status === "sent" ? now : null,
      telegramMessageId,
      status,
      errorMessage,
      now
    )
    .run();
}

export async function updateAnnualEventNextNotification(
  env: Env,
  event: AnnualEvent,
  now: string,
  notifyDays: number[],
  notificationDaysJson: string
): Promise<void> {
  const nextNotification = getNextAnnualEventNotification(now, event, notifyDays);

  await env.DB.prepare(
    `
      UPDATE annual_events
      SET notification_days_json = ?,
        next_notification_at = ?,
        next_notification_event_date = ?,
        next_notification_offset_days = ?,
        updated_at = ?
      WHERE id = ?
    `
  )
    .bind(
      notificationDaysJson,
      nextNotification?.at ?? null,
      nextNotification?.eventDate ?? null,
      nextNotification?.offsetDays ?? null,
      now,
      event.id
    )
    .run();
}

export function formatAnnualEventDisplayDate(value: string): string {
  return formatDisplayDate(value);
}

export async function deleteAnnualEventForUser(
  env: Env,
  userId: number,
  isAdmin: boolean,
  annualEventId: number,
  now: string
): Promise<boolean> {
  const result = await env.DB.prepare(
    `
      UPDATE annual_events
      SET is_active = 0,
        next_notification_at = NULL,
        next_notification_event_date = NULL,
        next_notification_offset_days = NULL,
        updated_at = ?
      WHERE id = ?
        AND is_active = 1
        AND (
          ? = 1
          OR created_by_user_id = ?
          OR EXISTS (
            SELECT 1
            FROM annual_event_recipients
            WHERE annual_event_recipients.annual_event_id = annual_events.id
              AND annual_event_recipients.user_id = ?
          )
        )
    `
  )
    .bind(now, annualEventId, isAdmin ? 1 : 0, userId, userId)
    .run();

  return result.meta.changes > 0;
}

export async function updateAnnualEventForUser(
  env: Env,
  userId: number,
  isAdmin: boolean,
  annualEventId: number,
  input: UpdateAnnualEventInput
): Promise<boolean> {
  const validated = validateAnnualEventInput({
    ...input,
    createdByUserId: userId
  });

  if (!validated) {
    return false;
  }

  const validRecipientUserIds = await getValidRecipientUserIds(env, validated.recipientUserIds);

  if (validRecipientUserIds.length === 0) {
    return false;
  }

  const config = getAppConfig(env);
  const notificationDaysJson = serializeAnnualEventNotifyDays(config.annualEventNotifyDays);
  const nextNotification = getNextAnnualEventNotification(
    input.now,
    {
      event_month: validated.eventMonth,
      event_day: validated.eventDay,
      reminder_hour: validated.reminderHour,
      reminder_minute: validated.reminderMinute,
      timezone: validated.timezone
    },
    config.annualEventNotifyDays
  );

  const updateResult = await env.DB.prepare(
    `
      UPDATE annual_events
      SET title = ?,
        description = ?,
        event_month = ?,
        event_day = ?,
        event_year = ?,
        reminder_hour = ?,
        reminder_minute = ?,
        timezone = ?,
        notification_days_json = ?,
        next_notification_at = ?,
        next_notification_event_date = ?,
        next_notification_offset_days = ?,
        updated_at = ?
      WHERE id = ?
        AND is_active = 1
        AND (
          ? = 1
          OR created_by_user_id = ?
          OR EXISTS (
            SELECT 1
            FROM annual_event_recipients
            WHERE annual_event_recipients.annual_event_id = annual_events.id
              AND annual_event_recipients.user_id = ?
          )
        )
    `
  )
    .bind(
      validated.title,
      validated.description,
      validated.eventMonth,
      validated.eventDay,
      validated.eventYear,
      validated.reminderHour,
      validated.reminderMinute,
      validated.timezone,
      notificationDaysJson,
      nextNotification?.at ?? null,
      nextNotification?.eventDate ?? null,
      nextNotification?.offsetDays ?? null,
      input.now,
      annualEventId,
      isAdmin ? 1 : 0,
      userId,
      userId
    )
    .run();

  if (updateResult.meta.changes === 0) {
    return false;
  }

  await env.DB.prepare("DELETE FROM annual_event_recipients WHERE annual_event_id = ?")
    .bind(annualEventId)
    .run();

  await env.DB.batch(
    validRecipientUserIds.map((recipientUserId) =>
      env.DB.prepare(
        `
          INSERT OR IGNORE INTO annual_event_recipients (
            annual_event_id,
            user_id,
            created_at
          )
          VALUES (?, ?, ?)
        `
      ).bind(annualEventId, recipientUserId, input.now)
    )
  );

  return true;
}

export async function recalculateAnnualEventNotificationSchedule(env: Env, now: string, limit = 20): Promise<number> {
  const config = getAppConfig(env);
  const notificationDaysJson = serializeAnnualEventNotifyDays(config.annualEventNotifyDays);
  const result = await env.DB.prepare(
    `
      SELECT *
      FROM annual_events
      WHERE is_active = 1
        AND notification_days_json != ?
      ORDER BY updated_at ASC
      LIMIT ?
    `
  )
    .bind(notificationDaysJson, limit)
    .all<AnnualEvent>();

  const events = result.results ?? [];

  for (const event of events) {
    const nextNotification = getNextAnnualEventNotification(now, event, config.annualEventNotifyDays);

    await env.DB.prepare(
      `
        UPDATE annual_events
        SET notification_days_json = ?,
          next_notification_at = ?,
          next_notification_event_date = ?,
          next_notification_offset_days = ?,
          updated_at = ?
        WHERE id = ?
      `
    )
      .bind(
        notificationDaysJson,
        nextNotification?.at ?? null,
        nextNotification?.eventDate ?? null,
        nextNotification?.offsetDays ?? null,
        now,
        event.id
      )
      .run();
  }

  return events.length;
}
