import type { Env } from "./env";
import type { TelegramChat, TelegramUser } from "./telegram/types";

export interface StoredUser {
  id: number;
  telegram_user_id: number;
  telegram_chat_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  timezone: string;
  is_active: number;
  is_admin: number;
  created_at: string;
  updated_at: string;
}

const USER_SELECT_COLUMNS = `
  id,
  telegram_user_id,
  telegram_chat_id,
  username,
  first_name,
  last_name,
  timezone,
  is_active,
  is_admin,
  created_at,
  updated_at
`;

export async function getActiveUsers(env: Env): Promise<StoredUser[]> {
  const result = await env.DB.prepare(
    `
      SELECT ${USER_SELECT_COLUMNS}
      FROM users
      WHERE is_active = 1
      ORDER BY first_name COLLATE NOCASE ASC,
        username COLLATE NOCASE ASC,
        id ASC
    `
  )
    .all<StoredUser>();

  return result.results ?? [];
}

export async function getAllUsers(env: Env): Promise<StoredUser[]> {
  const result = await env.DB.prepare(
    `
      SELECT ${USER_SELECT_COLUMNS}
      FROM users
      ORDER BY is_admin DESC,
        is_active DESC,
        first_name COLLATE NOCASE ASC,
        username COLLATE NOCASE ASC,
        id ASC
    `
  )
    .all<StoredUser>();

  return result.results ?? [];
}

export async function getUserByTelegramId(env: Env, telegramUserId: number): Promise<StoredUser | null> {
  const user = await env.DB.prepare(
    `
      SELECT ${USER_SELECT_COLUMNS}
      FROM users
      WHERE telegram_user_id = ?
      LIMIT 1
    `
  )
    .bind(telegramUserId)
    .first<StoredUser>();

  return user ?? null;
}

export async function getUserById(env: Env, userId: number): Promise<StoredUser | null> {
  const user = await env.DB.prepare(
    `
      SELECT ${USER_SELECT_COLUMNS}
      FROM users
      WHERE id = ?
      LIMIT 1
    `
  )
    .bind(userId)
    .first<StoredUser>();

  return user ?? null;
}

export async function updateUserTimezone(env: Env, userId: number, timezone: string, now: string): Promise<StoredUser | null> {
  await env.DB.prepare(
    `
      UPDATE users
      SET timezone = ?,
        updated_at = ?
      WHERE id = ?
        AND is_active = 1
    `
  )
    .bind(timezone, now, userId)
    .run();

  return getUserById(env, userId);
}

export async function updateUserTelegramProfile(
  env: Env,
  telegramUserId: number,
  profile: {
    telegramChatId?: number;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  },
  now: string
): Promise<StoredUser | null> {
  await env.DB.prepare(
    `
      UPDATE users
      SET telegram_chat_id = COALESCE(?, telegram_chat_id),
        username = ?,
        first_name = ?,
        last_name = ?,
        updated_at = ?
      WHERE telegram_user_id = ?
    `
  )
    .bind(
      profile.telegramChatId ?? null,
      profile.username ?? null,
      profile.firstName ?? null,
      profile.lastName ?? null,
      now,
      telegramUserId
    )
    .run();

  return getUserByTelegramId(env, telegramUserId);
}

export async function addUserByTelegramId(
  env: Env,
  telegramUserId: number,
  timezone: string,
  now: string
): Promise<StoredUser> {
  await env.DB.prepare(
    `
      INSERT INTO users (
        telegram_user_id,
        telegram_chat_id,
        username,
        first_name,
        last_name,
        timezone,
        is_active,
        is_admin,
        created_at,
        updated_at
      )
      VALUES (?, ?, NULL, NULL, NULL, ?, 1, 0, ?, ?)
      ON CONFLICT(telegram_user_id) DO UPDATE SET
        is_active = 1,
        updated_at = excluded.updated_at
    `
  )
    .bind(telegramUserId, telegramUserId, timezone, now, now)
    .run();

  const user = await getUserByTelegramId(env, telegramUserId);

  if (!user) {
    throw new Error("Failed to load user after add");
  }

  return user;
}

export async function deactivateUserById(env: Env, userId: number, now: string): Promise<StoredUser | null> {
  const existing = await env.DB.prepare(
    `
      SELECT ${USER_SELECT_COLUMNS}
      FROM users
      WHERE id = ?
      LIMIT 1
    `
  )
    .bind(userId)
    .first<StoredUser>();

  if (!existing || existing.is_admin === 1) {
    return null;
  }

  await env.DB.prepare(
    `
      UPDATE users
      SET is_active = 0,
        updated_at = ?
      WHERE id = ?
        AND is_admin = 0
    `
  )
    .bind(now, userId)
    .run();

  return getUserByTelegramId(env, existing.telegram_user_id);
}

export async function upsertTelegramUser(
  env: Env,
  user: TelegramUser,
  chat: TelegramChat,
  timezone: string,
  isAdmin: boolean,
  now: string
): Promise<StoredUser> {
  await env.DB.prepare(
    `
      INSERT INTO users (
        telegram_user_id,
        telegram_chat_id,
        username,
        first_name,
        last_name,
        timezone,
        is_active,
        is_admin,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(telegram_user_id) DO UPDATE SET
        telegram_chat_id = excluded.telegram_chat_id,
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        is_active = 1,
        is_admin = CASE
          WHEN excluded.is_admin = 1 THEN 1
          ELSE users.is_admin
        END,
        updated_at = excluded.updated_at
    `
  )
    .bind(
      user.id,
      chat.id,
      user.username ?? null,
      user.first_name ?? null,
      user.last_name ?? null,
      timezone,
      isAdmin ? 1 : 0,
      now,
      now
    )
    .run();

  const storedUser = await env.DB.prepare(
    `
      SELECT ${USER_SELECT_COLUMNS}
      FROM users
      WHERE telegram_user_id = ?
    `
  )
    .bind(user.id)
    .first<StoredUser>();

  if (!storedUser) {
    throw new Error("Failed to load user after upsert");
  }

  return storedUser;
}
