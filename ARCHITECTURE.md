# Architecture

This document describes the technical architecture of Family Reminder.

## Overview

Family Reminder has two user-facing surfaces:

- Telegram bot for notifications and quick actions;
- web app for richer task management and administration.

Both surfaces use the same Cloudflare D1 database.

```text
Telegram user
  |
Telegram Bot API
  |
Telegram webhook
  |
Cloudflare Worker: bot Worker
  |
Cloudflare D1

Cloudflare Cron Trigger
  |
Cloudflare Worker: bot Worker
  |
Telegram Bot API
  |
Telegram user

Browser
  |
Cloudflare Worker: web Worker
  |
React SPA + Web API
  |
Cloudflare D1
```

The application does not require a VPS, a long-running process, or Telegram long polling.

## Cloudflare Workers

The deployment uses two Workers.

### Bot Worker

The bot Worker handles:

- Telegram webhook requests;
- Telegram commands and callback queries;
- access checks;
- guided Telegram flows;
- task actions from Telegram;
- scheduled reminder processing;
- Telegram notification delivery.

The bot Worker has the Cron Trigger.

### Web Worker

The web Worker handles:

- React SPA assets through Workers Static Assets;
- Telegram Login;
- web session cookies;
- web API routes;
- task, history, user, export, and maintenance actions.

The web Worker should not have a Cron Trigger in production.

## Cloudflare D1

D1 is the primary persistent store.

It stores:

- users;
- recurring reminder rules;
- task instances;
- task assignments;
- completion history;
- notification logs;
- audit logs;
- Telegram message references;
- web sessions.

The bot Worker and web Worker should use the same production D1 database so both interfaces see the same tasks, users, and history.

## Cloudflare Cron Triggers

Cron periodically starts the bot Worker to process reminders.

Default schedule:

```text
*/5 * * * *
```

Reminder processing:

1. Mark due active tasks as overdue.
2. Find tasks whose `next_remind_at` is due.
3. Send Telegram notifications to assignees.
4. Record delivery attempts in `notification_log`.
5. Update `next_remind_at`.
6. Create future recurring task instances when needed.
7. Close old unfinished recurring instances as missed when a new period starts.

Cron runs in UTC. Application dates are stored in UTC. User-facing task times are displayed in the timezone stored on the task rule.

## Telegram Bot API

Telegram is used for:

- receiving updates through webhook;
- sending notifications;
- sending task cards;
- rendering inline buttons;
- handling callback actions.

Long polling is not used.

## Telegram Login

The web app uses Telegram Login to authenticate users.

The Worker verifies the Telegram login payload and then looks up the Telegram user ID in D1.

Access is granted only to active users.

Admin permissions are stored in D1.

## Worker Secrets

Secrets are stored in Cloudflare Worker Secrets, not in Git.

Required secrets:

- `TELEGRAM_BOT_TOKEN`;
- `TELEGRAM_WEBHOOK_SECRET`;
- `ALLOWED_TELEGRAM_USER_IDS`;
- `WEB_SESSION_SECRET`.

Optional development secret:

- `WEB_DEV_AUTH_TOKEN`.

`ALLOWED_TELEGRAM_USER_IDS` is only a bootstrap admin list. Ordinary users, active status, and admin flags are stored in D1.

## Time and Timezones

Internal storage uses UTC.

The default household timezone is configured through `APP_TIMEZONE`.

Examples in documentation may use `Europe/Kyiv`, but deployments can use another IANA timezone.

`APP_TIMEZONE` is used as the initial value for new users and new task rules. After creation, timezone values are stored in D1:

- `users.timezone` - the user's current timezone preference;
- `reminder_rules.timezone` - the timezone that defines the task rule.

When a user enters a date or time, the app interprets it in that user's current timezone and stores the resulting UTC timestamp.

Due dates, execution windows, and reminder times are displayed in `reminder_rules.timezone`. If the viewer's `users.timezone` differs, the UI shows the rule timezone next to the time, for example `(Europe/Kyiv)`. This keeps a task defined as `12:00 Europe/Kyiv` visually anchored to `12:00 Europe/Kyiv`, even for a user currently viewing from `Europe/Warsaw`.

The known IANA alias `Europe/Kiev` is normalized to `Europe/Kyiv`.

Monthly tasks support variable month lengths through:

- fixed day windows;
- last-day windows;
- end-of-month plus beginning-of-next-month windows.

## Idempotency

Telegram callbacks, webhook retries, and Cron invocations may be repeated.

Important operations must be idempotent:

- completing a task;
- marking a task missed;
- deleting or cancelling a task;
- sending notifications;
- creating recurring instances.

The database schema uses status checks, assignment checks, notification logs, and uniqueness constraints to reduce duplicate effects.

## Static Assets and SPA Routing

The web UI is a React SPA built with Vite.

Workers Static Assets serves built frontend files from `dist/`.

Worker routes must run before assets for:

- `/api/*`;
- `/auth/*`;
- `/logout`;
- `/health`;
- `/telegram/*`.

SPA fallback is used for web app routes.

## Technologies Not Used

The current architecture intentionally does not require:

- VPS;
- Docker;
- Telegram long polling;
- external SQL database outside Cloudflare;
- Cloudflare KV as the primary database;
- Durable Objects;
- Queues;
- third-party APIs other than Telegram Bot API.

These can be reconsidered if the project grows beyond small-household usage.

## Expected Scale

The architecture is intended for:

- small number of household users;
- low reminder volume;
- low request volume;
- modest D1 storage;
- Cloudflare free-tier friendly usage.

If usage grows, monitor:

- Worker requests;
- Worker CPU time;
- Worker errors;
- D1 rows read/written;
- D1 storage;
- Cron executions.

## Portability

The app is Cloudflare-first, but the domain model is portable.

Potential replacements:

- Cloudflare Workers -> Cloud Run, AWS Lambda, VPS Node.js process;
- Cloudflare Cron Triggers -> Cloud Scheduler, EventBridge, system cron;
- Cloudflare D1 -> PostgreSQL, SQLite, MySQL, Supabase;
- Worker Secrets -> target platform secrets or environment variables;
- Workers Static Assets -> static hosting, nginx, S3/CloudFront, or a VPS.

Telegram Bot API remains the same across hosting providers.
