export interface WorkersAiBinding {
  run(model: string, input: unknown, options?: unknown): Promise<unknown>;
}

export interface Env {
  DB: D1Database;
  AI?: WorkersAiBinding;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_BOT_USERNAME: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ALLOWED_TELEGRAM_USER_IDS: string;
  APP_LOCALE?: string;
  APP_TIMEZONE: string;
  ANNUAL_EVENT_NOTIFY_DAYS?: string;
  AI_TASK_CREATION_ENABLED?: string;
  AI_TASK_CREATION_MODEL?: string;
  WEB_SESSION_SECRET: string;
  WEB_DEV_AUTH_ENABLED?: string;
  WEB_DEV_AUTH_TOKEN?: string;
}
