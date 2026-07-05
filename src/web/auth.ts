import type { Env } from "../env";
import { getActiveUsers, getUserByTelegramId, updateUserTelegramProfile, type StoredUser } from "../users";

const SESSION_COOKIE_NAME = "tr_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const TELEGRAM_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;

interface TelegramLoginPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface WebSessionPayload {
  userId: number;
  telegramUserId: number;
  exp: number;
}

export interface AuthenticatedWebUser {
  id: number;
  telegramUserId: number;
  displayName: string;
  timezone: string;
  isAdmin: boolean;
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";

  for (const byte of array) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string): Uint8Array | null {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    return null;
  }
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

async function sha256Bytes(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

async function hmacSha256Hex(keyBytes: ArrayBuffer, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Base64Url(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return base64UrlEncode(signature);
}

function parseTelegramLoginPayload(url: URL): TelegramLoginPayload | null {
  const id = Number(url.searchParams.get("id"));
  const authDate = Number(url.searchParams.get("auth_date"));
  const hash = url.searchParams.get("hash");

  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !Number.isSafeInteger(authDate) ||
    authDate <= 0 ||
    !hash
  ) {
    return null;
  }

  return {
    id,
    first_name: url.searchParams.get("first_name") ?? undefined,
    last_name: url.searchParams.get("last_name") ?? undefined,
    username: url.searchParams.get("username") ?? undefined,
    photo_url: url.searchParams.get("photo_url") ?? undefined,
    auth_date: authDate,
    hash
  };
}

async function verifyTelegramLoginPayload(env: Env, url: URL, now: Date): Promise<TelegramLoginPayload | null> {
  const payload = parseTelegramLoginPayload(url);

  if (!payload) {
    return null;
  }

  const authAgeSeconds = Math.floor(now.getTime() / 1000) - payload.auth_date;

  if (authAgeSeconds < 0 || authAgeSeconds > TELEGRAM_AUTH_MAX_AGE_SECONDS) {
    return null;
  }

  const entries = [...url.searchParams.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right));
  const dataCheckString = entries
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = await sha256Bytes(env.TELEGRAM_BOT_TOKEN);
  const expectedHash = await hmacSha256Hex(secretKey, dataCheckString);

  if (!timingSafeEqual(expectedHash, payload.hash)) {
    return null;
  }

  return payload;
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const item of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = item.trim().split("=");

    if (rawName === name) {
      return rawValue.join("=") || null;
    }
  }

  return null;
}

function buildSessionCookie(value: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE_NAME}=${value}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

async function createSessionValue(env: Env, user: StoredUser, now: Date): Promise<string> {
  const payload: WebSessionPayload = {
    userId: user.id,
    telegramUserId: user.telegram_user_id,
    exp: Math.floor(now.getTime() / 1000) + SESSION_TTL_SECONDS
  };
  const payloadText = JSON.stringify(payload);
  const payloadEncoded = base64UrlEncode(new TextEncoder().encode(payloadText));
  const signature = await hmacSha256Base64Url(env.WEB_SESSION_SECRET, payloadEncoded);

  return `${payloadEncoded}.${signature}`;
}

async function parseSessionValue(env: Env, value: string, now: Date): Promise<WebSessionPayload | null> {
  const [payloadEncoded, signature] = value.split(".");

  if (!payloadEncoded || !signature) {
    return null;
  }

  const expectedSignature = await hmacSha256Base64Url(env.WEB_SESSION_SECRET, payloadEncoded);

  if (!timingSafeEqual(expectedSignature, signature)) {
    return null;
  }

  const payloadBytes = base64UrlDecode(payloadEncoded);

  if (!payloadBytes) {
    return null;
  }

  let payload: Partial<WebSessionPayload>;

  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as Partial<WebSessionPayload>;
  } catch {
    return null;
  }

  const userId = payload.userId;
  const telegramUserId = payload.telegramUserId;
  const exp = payload.exp;

  if (
    typeof userId !== "number" ||
    typeof telegramUserId !== "number" ||
    typeof exp !== "number" ||
    !Number.isSafeInteger(userId) ||
    !Number.isSafeInteger(telegramUserId) ||
    !Number.isSafeInteger(exp) ||
    Math.floor(now.getTime() / 1000) >= exp
  ) {
    return null;
  }

  return {
    userId,
    telegramUserId,
    exp
  };
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

export async function getAuthenticatedWebUser(
  request: Request,
  env: Env,
  now = new Date()
): Promise<AuthenticatedWebUser | null> {
  const sessionCookie = getCookie(request, SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    return null;
  }

  const session = await parseSessionValue(env, sessionCookie, now);

  if (!session) {
    return null;
  }

  const user = await getUserByTelegramId(env, session.telegramUserId);

  if (!user || user.id !== session.userId || user.is_active !== 1) {
    return null;
  }

  return {
    id: user.id,
    telegramUserId: user.telegram_user_id,
    displayName: getDisplayName(user),
    timezone: user.timezone,
    isAdmin: user.is_admin === 1
  };
}

export async function handleTelegramLoginCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const now = new Date();
  const payload = await verifyTelegramLoginPayload(env, url, now);

  if (!payload) {
    return new Response("Telegram login failed.", { status: 401 });
  }

  const user = await getUserByTelegramId(env, payload.id);

  if (!user || user.is_active !== 1) {
    return new Response("User is not allowed.", { status: 403 });
  }

  const updatedUser = await updateUserTelegramProfile(
    env,
    payload.id,
    {
      telegramChatId: payload.id,
      username: payload.username ?? null,
      firstName: payload.first_name ?? null,
      lastName: payload.last_name ?? null
    },
    now.toISOString()
  );
  const sessionValue = await createSessionValue(env, updatedUser ?? user, now);

  return new Response(null, {
    status: 302,
    headers: {
      "location": "/app",
      "set-cookie": buildSessionCookie(sessionValue, SESSION_TTL_SECONDS)
    }
  });
}

export async function handleDevLogin(request: Request, env: Env): Promise<Response> {
  if (env.WEB_DEV_AUTH_ENABLED !== "true" || !env.WEB_DEV_AUTH_TOKEN) {
    return new Response("Dev auth is disabled.", { status: 404 });
  }

  const token = request.headers.get("x-dev-auth-token");

  if (!token || !timingSafeEqual(token, env.WEB_DEV_AUTH_TOKEN)) {
    return new Response("Dev auth failed.", { status: 401 });
  }

  const url = new URL(request.url);
  const role = url.searchParams.get("role") === "user" ? "user" : "admin";
  const users = await getActiveUsers(env);
  const user = users.find((item) => role === "admin" ? item.is_admin === 1 : item.is_admin !== 1);

  if (!user) {
    return new Response(`No active ${role} user found.`, { status: 404 });
  }

  const sessionValue = await createSessionValue(env, user, new Date());

  return new Response(null, {
    status: 302,
    headers: {
      "location": "/app",
      "set-cookie": buildSessionCookie(sessionValue, SESSION_TTL_SECONDS)
    }
  });
}

export function handleLogout(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      "location": "/login",
      "set-cookie": buildClearSessionCookie()
    }
  });
}
