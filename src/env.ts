export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_BOT_USERNAME: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ALLOWED_TELEGRAM_USER_IDS: string;
  APP_LOCALE?: string;
  APP_TIMEZONE: string;
  WEB_SESSION_SECRET: string;
  WEB_DEV_AUTH_ENABLED?: string;
  WEB_DEV_AUTH_TOKEN?: string;
}
