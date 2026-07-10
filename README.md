# Family Reminder

Family Reminder is a Telegram bot and web app for household tasks and recurring reminders.

It is designed for a small family or household where several people can see, create, edit, complete, miss, or delete shared tasks. Telegram is the main notification channel. The web app provides a more comfortable interface for task management, history, users, export, and maintenance.

The interface supports Russian and English through the `APP_LOCALE` setting.

## Features

- Telegram bot with webhook-based updates.
- Web app with Telegram Login authentication.
- One-time tasks with a due date and separate reminder time.
- One-time tasks with an execution window.
- Weekly tasks.
- Monthly tasks by fixed days.
- Monthly tasks by the last days of the month.
- Annual events such as birthdays and anniversaries.
- Configurable annual-event notifications before and on the event date.
- Shared tasks with one or more assignees.
- Optional AI-assisted one-time task creation from free-form Telegram text.
- Personal and family task lists.
- Personal and family annual-event lists with pagination.
- Task statuses: active, overdue, done, done late, missed, cancelled.
- Reminder notifications through Telegram.
- "Remind me in 1 hour" action from Telegram notification messages.
- Admin user management.
- Task history.
- Per-task audit log.
- Portable JSON export for backup or future migration.
- Manual cleanup of old technical logs.
- Russian and English interface labels.
- Per-user timezone preference in the web app.

## Stack

- TypeScript
- Cloudflare Workers
- Cloudflare D1
- Cloudflare Cron Triggers
- Cloudflare Worker Secrets
- Cloudflare Workers Static Assets
- Cloudflare Workers AI (optional)
- Telegram Bot API
- Telegram Login Widget
- React
- Vite

Long polling is not used.

## Repository Structure

```text
src/                 Worker, Telegram bot, API, domain logic
src/web/             Web API handlers
web/                 React frontend
migrations/          Cloudflare D1 migrations
test-data/           Local D1 test data
wrangler.jsonc       Cloudflare Workers configuration template
.env.example         Safe environment variable template
```

Additional documentation:

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [WEB_ARCHITECTURE.md](./WEB_ARCHITECTURE.md)
- [DOMAIN.md](./DOMAIN.md)
- [DATA_MODEL.md](./DATA_MODEL.md)
- [RUNBOOK.md](./RUNBOOK.md)
- [SECURITY.md](./SECURITY.md)
- [PRIVACY.md](./PRIVACY.md)

## Requirements

- Node.js 24 or newer
- npm
- Cloudflare account
- Wrangler
- Telegram account
- Telegram bot created with BotFather

Install dependencies:

```bash
npm install
```

Check versions:

```bash
node -v
npm -v
```

## Cloudflare Configuration

This repository includes a public-safe `wrangler.jsonc` template.

Before deploy, replace placeholder values in `wrangler.jsonc`:

- `database_id` for `family-reminder-db`
- `database_id` for `family-reminder-dev-db`, if you want a separate dev environment
- `TELEGRAM_BOT_USERNAME`
- Worker names, if you want different names
- `APP_TIMEZONE`, if `Europe/Kyiv` is not your household timezone
- `APP_LOCALE`, if you want `en` instead of the default `ru`
- `ANNUAL_EVENT_NOTIFY_DAYS`, if you want offsets other than `3,1,0`
- `AI_TASK_CREATION_ENABLED`, if you want to enable AI-assisted task drafts
- `AI_TASK_CREATION_MODEL`, if you want to use another compatible Workers AI model

The default Worker names in the template are:

- `family-reminder-bot`
- `family-reminder-web`
- `family-reminder-web-dev`

The default D1 database names are:

- `family-reminder-db`
- `family-reminder-dev-db`

## Create D1 Databases

Create the production D1 database:

```bash
npx wrangler d1 create family-reminder-db
```

Copy the returned `database_id` into both production D1 bindings in `wrangler.jsonc`:

- top-level `d1_databases`
- `env.web.d1_databases`

Keep the binding name as `DB`. The Worker code expects `env.DB`.

If Wrangler asks whether it should update `wrangler.jsonc` automatically, you can choose `No` and paste the returned `database_id` manually. If you choose `Yes`, review the generated config and make sure there is only one `DB` binding per Worker environment.

Optional: create a separate dev database for `web-dev`:

```bash
npx wrangler d1 create family-reminder-dev-db
```

Copy that `database_id` into `env.web-dev.d1_databases`.

Apply production migrations:

```bash
npm run d1:migrations:remote
```

The migration script above uses the default database name `family-reminder-db`. If you choose a different database name, apply migrations with:

```bash
npx wrangler d1 migrations apply <your-database-name> --remote
```

If you use the `web-dev` environment:

```bash
npm run d1:migrations:web-dev:remote
```

Migration `0008_add_annual_events.sql` creates annual events, recipients, and annual notification log tables. Apply all migrations before using annual events.

## Optional Workers AI Task Drafts

The public template keeps AI task creation disabled by default:

```json
"AI_TASK_CREATION_ENABLED": "false"
```

To enable it, change the value to `"true"` in the top-level bot Worker variables. The template already defines the `AI` binding and a default model.

The AI flow currently supports:

- one-time tasks;
- one-time tasks with a date window;
- dates, reminder time, title, and assignees from Russian or English text;
- named active household members;
- confirmation before a task is created.

The application validates the returned draft and calendar dates before writing anything to D1. Impossible or reversed dates are rejected for correction instead of being silently accepted.

When this feature is enabled, the user's free-form task text and active members' display names/aliases are sent to Cloudflare Workers AI. Telegram IDs, D1 IDs, bot tokens, and session secrets are not included in the AI prompt.

## Telegram Bot Setup

1. Open BotFather in Telegram.
2. Create a new bot with `/newbot`.
3. Save the bot token securely.
4. Copy the bot username without `@`.
5. Put that username into `wrangler.jsonc` as `TELEGRAM_BOT_USERNAME`.
6. Configure the Telegram Login domain in BotFather after your web Worker is deployed.

The Telegram Login domain must match your web app hostname, for example:

```text
family-reminder-web.<your-subdomain>.workers.dev
```

## Secrets

Do not commit real secrets.

Production secrets are stored in Cloudflare Worker Secrets.

Required secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `ALLOWED_TELEGRAM_USER_IDS`
- `WEB_SESSION_SECRET`

Optional dev-only secret:

- `WEB_DEV_AUTH_TOKEN`

Generate random secrets with a password manager or with a command such as:

```bash
openssl rand -hex 32
```

`WEB_SESSION_SECRET` must not be empty. If it is empty, Telegram Login can fail with an HMAC key error.

Set bot Worker secrets:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put ALLOWED_TELEGRAM_USER_IDS
npx wrangler secret put WEB_SESSION_SECRET
```

Set web Worker secrets:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN --env web
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET --env web
npx wrangler secret put ALLOWED_TELEGRAM_USER_IDS --env web
npx wrangler secret put WEB_SESSION_SECRET --env web
```

The bot Worker and the web Worker both need the required secrets. In particular, `TELEGRAM_BOT_TOKEN` in the web Worker must belong to the same Telegram bot configured in BotFather for Telegram Login.

`ALLOWED_TELEGRAM_USER_IDS` is a comma-separated bootstrap admin list:

```text
123456789,987654321
```

Only bootstrap admins can enter the app before additional users are added from the admin UI.

## Deploy

Run type checks:

```bash
npm run typecheck
```

Build the web app:

```bash
npm run web:build
```

Deploy the Telegram bot Worker:

```bash
npm run deploy
```

Deploy the production web Worker:

```bash
npm run deploy:web
```

The bot Worker owns:

- Telegram webhook endpoint
- Cron trigger
- reminder delivery

The web Worker owns:

- web UI static assets
- web login
- web API

Both production Workers use the same production D1 database.

## Set Telegram Webhook

After deploying the bot Worker, set the Telegram webhook:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://family-reminder-bot.<your-subdomain>.workers.dev/telegram/webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d "drop_pending_updates=true"
```

Check webhook status:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

## First Use

1. Open the bot in Telegram from a bootstrap admin account.
2. Send `/start`.
3. Open the web app.
4. Sign in with Telegram Login.
5. Add household members from the admin UI.
6. Create the first task.
7. Optionally create annual events from the web app.

## Useful Commands

```bash
npm run typecheck
npm run web:build
npm run deploy
npm run deploy:web
npm run cf:whoami
```

Local D1 migrations:

```bash
npm run d1:migrations:local
```

Remote D1 migrations:

```bash
npm run d1:migrations:remote
```

The `web-dev` environment can use a dev-only `/auth/dev` flow when `WEB_DEV_AUTH_ENABLED=true` and `WEB_DEV_AUTH_TOKEN` is configured.

## Locale and Timezone

`APP_LOCALE` controls interface language. Supported values:

- `ru`
- `en`

If `APP_LOCALE` is missing or unknown, the app falls back to `ru`.

`APP_TIMEZONE` is the default household timezone for new users and new task rules. Use an IANA timezone name such as `Europe/Kyiv` or `America/New_York`.

Users can change their own timezone in the web app. New dates entered by that user are interpreted in the user's current timezone.

Task due dates, execution windows, and reminder times are displayed in the timezone stored on the task rule. If the viewer's timezone is different, the UI shows the task rule timezone next to the time, for example `(Europe/Kyiv)`.

The known IANA alias `Europe/Kiev` is normalized to `Europe/Kyiv`.

## Annual Events

Annual events are separate from task instances. They are intended for birthdays, anniversaries, and similar dates.

- Create, edit, delete, and browse annual events in the web app.
- Assign one or more recipients who should receive Telegram notifications.
- Upcoming assigned events appear in `My tasks` during the seven days before the event.
- Full `My events` and `All events` lists remain available in the web app.
- February 29 events use February 28 in non-leap years.
- `ANNUAL_EVENT_NOTIFY_DAYS=3,1,0` means three days before, one day before, and on the event day.

## Data and Privacy

Application data is stored in your Cloudflare D1 database:

- Telegram user IDs
- display names
- tasks
- task assignments
- annual events and recipients
- annual-event notification logs
- task history
- notification logs
- audit logs
- web sessions

Telegram bot tokens, webhook secrets, session secrets, and API tokens must be kept outside Git.

## Limits and Notes

- The project is designed for a small household, not a large multi-tenant SaaS.
- Telegram is the only notification channel in the current version.
- Web push notifications are not implemented.
- Supported UI languages are Russian and English.
- Free Cloudflare limits should be enough for small household usage, but you should monitor D1 storage, Worker requests, CPU time, and Cron usage in your own Cloudflare dashboard.
- Workers AI quotas are separate from normal Worker request/CPU limits and may change; monitor AI usage when the optional feature is enabled.

## License

No license has been selected yet. Add a license before publishing the repository as open source.
