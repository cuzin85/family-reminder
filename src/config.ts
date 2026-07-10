import type { Env } from "./env";
import { normalizeAppLocale, type AppLocale } from "./i18n";

export interface AppConfig {
  adminTelegramUserIds: Set<number>;
  appLocale: AppLocale;
  appTimezone: string;
  annualEventNotifyDays: number[];
}

const DEFAULT_ANNUAL_EVENT_NOTIFY_DAYS = [3, 1, 0];

export function parseAllowedTelegramUserIds(value: string | undefined): Set<number> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => Number(item))
      .filter((item) => Number.isSafeInteger(item) && item > 0)
  );
}

export function parseAnnualEventNotifyDays(value: string | undefined): number[] {
  const rawItems = value
    ?.split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (!rawItems || rawItems.length === 0) {
    return DEFAULT_ANNUAL_EVENT_NOTIFY_DAYS;
  }

  const parsed = rawItems.map((item) => Number(item));

  if (
    parsed.some((item) => !Number.isSafeInteger(item) || item < 0 || item > 60) ||
    new Set(parsed).size !== parsed.length
  ) {
    return DEFAULT_ANNUAL_EVENT_NOTIFY_DAYS;
  }

  return [...parsed].sort((left, right) => right - left);
}

export function serializeAnnualEventNotifyDays(days: number[]): string {
  return JSON.stringify([...days].sort((left, right) => right - left));
}

export function getAppConfig(env: Env): AppConfig {
  const annualEventNotifyDays = parseAnnualEventNotifyDays(env.ANNUAL_EVENT_NOTIFY_DAYS);

  return {
    adminTelegramUserIds: parseAllowedTelegramUserIds(env.ALLOWED_TELEGRAM_USER_IDS),
    appLocale: normalizeAppLocale(env.APP_LOCALE),
    appTimezone: env.APP_TIMEZONE || "Europe/Kyiv",
    annualEventNotifyDays
  };
}
