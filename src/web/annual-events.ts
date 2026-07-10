import {
  createAnnualEvent,
  deleteAnnualEventForUser,
  getAnnualEventsForUser,
  getUpcomingAnnualEventsForFamily,
  getUpcomingAnnualEventsForUser,
  updateAnnualEventForUser,
  type AnnualEventListScope,
  type AnnualEventListItem,
  type UpcomingAnnualEvent
} from "../annual-events";
import { apiErrorResponse, jsonResponse } from "../http";
import type { Env } from "../env";
import type { AuthenticatedWebUser } from "./auth";

interface AnnualEventCreateInput {
  title?: unknown;
  description?: unknown;
  eventMonth?: unknown;
  eventDay?: unknown;
  eventYear?: unknown;
  reminderTime?: unknown;
  recipientUserIds?: unknown;
}

interface WebAnnualEventListItem {
  id: number;
  title: string;
  description: string | null;
  eventMonth: number;
  eventDay: number;
  eventYear: number | null;
  reminderTime: string;
  timezone: string;
  nextNotificationAt: string | null;
  nextNotificationEventDate: string | null;
  nextNotificationOffsetDays: number | null;
  recipientIds: number[];
  recipientNames: string | null;
  canManage: boolean;
}

interface WebUpcomingAnnualEventListItem extends WebAnnualEventListItem {
  upcomingEventDate: string;
  daysUntil: number;
}

function parseRecipientIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isSafeInteger(item) && item > 0);
}

function parseOptionalYear(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const year = Number(value);

  return Number.isSafeInteger(year) && year >= 1 && year <= 9999 ? year : NaN;
}

function parseRecipientIdList(value: string | null): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isSafeInteger(item) && item > 0);
}

function toWebAnnualEvent(event: AnnualEventListItem): WebAnnualEventListItem {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    eventMonth: event.event_month,
    eventDay: event.event_day,
    eventYear: event.event_year,
    reminderTime: `${String(event.reminder_hour).padStart(2, "0")}:${String(event.reminder_minute).padStart(2, "0")}`,
    timezone: event.timezone,
    nextNotificationAt: event.next_notification_at,
    nextNotificationEventDate: event.next_notification_event_date,
    nextNotificationOffsetDays: event.next_notification_offset_days,
    recipientIds: parseRecipientIdList(event.recipient_ids),
    recipientNames: event.recipient_names,
    canManage: event.can_manage === 1
  };
}

function toWebUpcomingAnnualEvent(event: UpcomingAnnualEvent): WebUpcomingAnnualEventListItem {
  return {
    ...toWebAnnualEvent(event),
    upcomingEventDate: event.upcoming_event_date,
    daysUntil: event.days_until
  };
}

export async function handleGetAnnualEvents(request: Request, env: Env, user: AuthenticatedWebUser): Promise<Response> {
  const requestedScope = new URL(request.url).searchParams.get("scope");
  const scope: AnnualEventListScope = requestedScope === "family" ? "family" : "my";
  const events = await getAnnualEventsForUser(env, user.id, user.isAdmin, scope);

  return jsonResponse({
    ok: true,
    events: events.map(toWebAnnualEvent)
  });
}

export async function handleGetUpcomingAnnualEvents(env: Env, user: AuthenticatedWebUser, scope: "family" | "my"): Promise<Response> {
  const now = new Date().toISOString();
  const events = scope === "family"
    ? await getUpcomingAnnualEventsForFamily(env, user.id, user.isAdmin, now)
    : await getUpcomingAnnualEventsForUser(env, user.id, now);

  return jsonResponse({
    ok: true,
    events: events.map(toWebUpcomingAnnualEvent)
  });
}

export async function handleCreateAnnualEvent(request: Request, env: Env, user: AuthenticatedWebUser): Promise<Response> {
  const input = (await request.json().catch(() => null)) as AnnualEventCreateInput | null;

  if (!input || typeof input.title !== "string" || typeof input.reminderTime !== "string") {
    return apiErrorResponse("invalid_annual_event", 400);
  }

  const eventMonth = Number(input.eventMonth);
  const eventDay = Number(input.eventDay);
  const eventYear = parseOptionalYear(input.eventYear);

  if (
    !Number.isSafeInteger(eventMonth) ||
    !Number.isSafeInteger(eventDay) ||
    Number.isNaN(eventYear)
  ) {
    return apiErrorResponse("invalid_annual_event", 400);
  }

  const now = new Date().toISOString();
  const eventId = await createAnnualEvent(env, {
    title: input.title,
    description: typeof input.description === "string" ? input.description : null,
    eventMonth,
    eventDay,
    eventYear,
    reminderTime: input.reminderTime,
    timezone: user.timezone || env.APP_TIMEZONE,
    recipientUserIds: parseRecipientIds(input.recipientUserIds),
    createdByUserId: user.id,
    now
  });

  if (!eventId) {
    return apiErrorResponse("invalid_annual_event", 400);
  }

  return jsonResponse({ ok: true, eventId }, { status: 201 });
}

export async function handleDeleteAnnualEvent(env: Env, user: AuthenticatedWebUser, annualEventId: number): Promise<Response> {
  const deleted = await deleteAnnualEventForUser(env, user.id, user.isAdmin, annualEventId, new Date().toISOString());

  if (!deleted) {
    return apiErrorResponse("not_found_or_not_editable", 404);
  }

  return jsonResponse({ ok: true });
}

export async function handleUpdateAnnualEvent(request: Request, env: Env, user: AuthenticatedWebUser, annualEventId: number): Promise<Response> {
  const input = (await request.json().catch(() => null)) as AnnualEventCreateInput | null;

  if (!input || typeof input.title !== "string" || typeof input.reminderTime !== "string") {
    return apiErrorResponse("invalid_annual_event", 400);
  }

  const eventMonth = Number(input.eventMonth);
  const eventDay = Number(input.eventDay);
  const eventYear = parseOptionalYear(input.eventYear);

  if (
    !Number.isSafeInteger(eventMonth) ||
    !Number.isSafeInteger(eventDay) ||
    Number.isNaN(eventYear)
  ) {
    return apiErrorResponse("invalid_annual_event", 400);
  }

  const updated = await updateAnnualEventForUser(env, user.id, user.isAdmin, annualEventId, {
    title: input.title,
    description: typeof input.description === "string" ? input.description : null,
    eventMonth,
    eventDay,
    eventYear,
    reminderTime: input.reminderTime,
    timezone: user.timezone || env.APP_TIMEZONE,
    recipientUserIds: parseRecipientIds(input.recipientUserIds),
    now: new Date().toISOString()
  });

  if (!updated) {
    return apiErrorResponse("not_found_or_not_editable", 404);
  }

  return jsonResponse({ ok: true });
}
