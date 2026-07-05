import { addUserByTelegramId, deactivateUserById, getActiveUsers, getAllUsers, updateUserTimezone, type StoredUser } from "../users";
import { recordAuditEvent } from "../audit";
import { normalizeIanaTimezone } from "../dates";
import type { AuthenticatedWebUser } from "./auth";
import type { Env } from "../env";
import { apiErrorResponse, jsonResponse } from "../http";

interface WebUserListItem {
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

function getDisplayName(user: StoredUser): string {
  if (user.first_name) {
    return user.first_name;
  }

  if (user.username) {
    return `@${user.username}`;
  }

  return `ID ${user.telegram_user_id}`;
}

function toWebUser(user: StoredUser): WebUserListItem {
  return {
    id: user.id,
    telegramUserId: user.telegram_user_id,
    telegramChatId: user.telegram_chat_id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    displayName: getDisplayName(user),
    timezone: user.timezone,
    isActive: user.is_active === 1,
    isAdmin: user.is_admin === 1,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

function getValidIanaTimezone(value: string): string | null {
  const timezone = normalizeIanaTimezone(value);

  if (!timezone || timezone.length > 100) {
    return null;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());

    return timezone;
  } catch {
    return null;
  }
}

export async function handleUpdateCurrentUserTimezone(
  request: Request,
  env: Env,
  user: AuthenticatedWebUser
): Promise<Response> {
  const input = (await request.json()) as { timezone?: unknown };

  if (typeof input.timezone !== "string") {
    return apiErrorResponse("invalid_timezone", 400);
  }

  const timezone = getValidIanaTimezone(input.timezone);

  if (!timezone) {
    return apiErrorResponse("invalid_timezone", 400);
  }

  const now = new Date().toISOString();
  const updatedUser = await updateUserTimezone(env, user.id, timezone, now);

  if (!updatedUser) {
    return apiErrorResponse("not_found", 404);
  }

  return jsonResponse({
    ok: true,
    user: {
      ...user,
      timezone: updatedUser.timezone
    }
  });
}

export async function handleGetUsers(env: Env, user: AuthenticatedWebUser): Promise<Response> {
  if (!user.isAdmin) {
    return jsonResponse({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const users = await getAllUsers(env);

  return jsonResponse({
    ok: true,
    users: users.map(toWebUser)
  });
}

export async function handleAddUser(request: Request, env: Env, user: AuthenticatedWebUser): Promise<Response> {
  if (!user.isAdmin) {
    return apiErrorResponse("forbidden", 403);
  }

  const input = (await request.json()) as { telegramUserId?: unknown };

  if (
    typeof input.telegramUserId !== "number" ||
    !Number.isSafeInteger(input.telegramUserId) ||
    input.telegramUserId <= 0
  ) {
    return apiErrorResponse("invalid_telegram_user_id", 400);
  }

  const now = new Date().toISOString();
  const addedUser = await addUserByTelegramId(env, input.telegramUserId, env.APP_TIMEZONE, now);

  await recordAuditEvent(env, {
    actorUserId: user.id,
    action: "user.added",
    entityType: "user",
    entityId: addedUser.id,
    metadata: {
      source: "web",
      telegramUserId: addedUser.telegram_user_id
    },
    now
  });

  return jsonResponse({
    ok: true,
    user: toWebUser(addedUser)
  });
}

export async function handleDeactivateUser(env: Env, user: AuthenticatedWebUser, userId: number): Promise<Response> {
  if (!user.isAdmin) {
    return apiErrorResponse("forbidden", 403);
  }

  if (user.id === userId) {
    return apiErrorResponse("cannot_deactivate_self", 400);
  }

  const now = new Date().toISOString();
  const updatedUser = await deactivateUserById(env, userId, now);

  if (!updatedUser) {
    return apiErrorResponse("not_found_or_not_deactivatable", 404);
  }

  await recordAuditEvent(env, {
    actorUserId: user.id,
    action: "user.deactivated",
    entityType: "user",
    entityId: updatedUser.id,
    metadata: {
      source: "web",
      telegramUserId: updatedUser.telegram_user_id
    },
    now
  });

  return jsonResponse({
    ok: true,
    user: toWebUser(updatedUser)
  });
}

export async function handleGetAssignees(env: Env): Promise<Response> {
  const users = await getActiveUsers(env);

  return jsonResponse({
    ok: true,
    users: users.map(toWebUser)
  });
}
