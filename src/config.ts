import type { Env } from "./env";
import { normalizeAppLocale, type AppLocale } from "./i18n";

export interface AppConfig {
  adminTelegramUserIds: Set<number>;
  appLocale: AppLocale;
  appTimezone: string;
}

export function parseAllowedTelegramUserIds(value: string): Set<number> {
  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => Number(item))
      .filter((item) => Number.isSafeInteger(item) && item > 0)
  );
}

export function getAppConfig(env: Env): AppConfig {
  return {
    adminTelegramUserIds: parseAllowedTelegramUserIds(env.ALLOWED_TELEGRAM_USER_IDS),
    appLocale: normalizeAppLocale(env.APP_LOCALE),
    appTimezone: env.APP_TIMEZONE || "Europe/Kyiv"
  };
}
