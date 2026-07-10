# Runbook

This runbook describes common operations for a deployed Family Reminder instance.

It is intentionally generic. Replace placeholder hostnames, Worker names, database names, and IDs with values from your own Cloudflare and Telegram setup.

## Production Components

A production deployment usually contains:

- bot Worker, for example `family-reminder-bot`;
- web Worker, for example `family-reminder-web`;
- one production Cloudflare D1 database, for example `family-reminder-db`;
- one Telegram bot created with BotFather;
- one Telegram webhook pointing to the bot Worker;
- one Cron Trigger on the bot Worker;
- Cloudflare Worker Secrets;
- Cloudflare Workers Static Assets for the web UI.
- optional Cloudflare Workers AI binding for text-to-task drafts.

The bot Worker owns:

- Telegram webhook endpoint;
- scheduled reminder processing;
- Telegram notification delivery.

The web Worker owns:

- web UI assets;
- Telegram Login;
- web API.

Both production Workers should use the same production D1 database.

## Quick Health Check

If the bot behaves unexpectedly, check:

1. The bot opens in Telegram.
2. `/start` responds.
3. Telegram buttons work.
4. Cloudflare Worker logs have no new errors.
5. Cloudflare Worker and D1 limits are not exhausted.
6. The Telegram bot token was not rotated accidentally.
7. The user is active in the app.

If the web app behaves unexpectedly, check:

1. The web URL opens.
2. Telegram Login works.
3. The user exists in D1 and is active.
4. The Telegram Login domain in BotFather matches the web hostname.
5. The web Worker logs have no new errors.

Health endpoints:

```bash
curl -sS https://family-reminder-bot.<your-subdomain>.workers.dev/health
curl -sS https://family-reminder-web.<your-subdomain>.workers.dev/health
curl -sS https://family-reminder-web.<your-subdomain>.workers.dev/api/health
```

Expected result: JSON response, not a Cloudflare HTML error page.

## Logs and Metrics

In Cloudflare Dashboard, check both Workers separately:

- requests;
- CPU time;
- errors;
- real-time logs, if available;
- Cron executions;
- D1 metrics;
- D1 storage.
- Workers AI neurons/usage when AI task creation is enabled.

Bot Worker errors do not necessarily mean the web app is broken. Web Worker errors do not necessarily mean Telegram webhook processing is broken.

Wrangler tail:

```bash
npx wrangler tail family-reminder-bot
npx wrangler tail family-reminder-web
```

## Telegram Webhook

Check current webhook:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Set webhook:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://family-reminder-bot.<your-subdomain>.workers.dev/telegram/webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d "drop_pending_updates=true"
```

If the bot does not respond:

1. Verify the webhook URL points to the bot Worker.
2. Verify `TELEGRAM_BOT_TOKEN` is correct.
3. Verify `TELEGRAM_WEBHOOK_SECRET` in Cloudflare matches the webhook `secret_token`.
4. Check bot Worker logs.
5. Send `/start` again.

If `wrangler tail` shows successful `POST /telegram/webhook` requests but the bot stays silent, the most common cause is a secret mismatch: the `secret_token` used in `setWebhook` must be exactly the same value as the bot Worker's `TELEGRAM_WEBHOOK_SECRET`.

## Reminders

Reminders are processed by the bot Worker's Cron Trigger.

Default schedule:

```text
*/5 * * * *
```

This means reminders can be delivered up to several minutes after the selected reminder time.

If reminders do not arrive:

1. Check that the Cron Trigger is configured on the bot Worker.
2. Check that the task has `next_remind_at`.
3. Check that the task is not already closed.
4. Check that the assigned user is active.
5. Check `notification_log`.
6. Check Telegram API errors in Worker logs.
7. Check Cloudflare Worker CPU/errors.

Annual-event notifications use the same Cron Trigger. If they do not arrive:

1. Confirm migration `0008_add_annual_events.sql` was applied.
2. Check that the event is active and has active recipients.
3. Check `next_notification_at` and `annual_event_notification_log`.
4. Confirm `ANNUAL_EVENT_NOTIFY_DAYS` contains the intended offsets.
5. Check the event timezone and notification time.

## Optional Workers AI

AI-assisted task drafts are controlled by:

- `AI_TASK_CREATION_ENABLED`;
- `AI_TASK_CREATION_MODEL`;
- the bot Worker's `AI` binding.

The public template defaults to `AI_TASK_CREATION_ENABLED=false`.

If AI drafting does not respond:

1. Confirm the feature is enabled on the bot Worker.
2. Confirm the top-level Worker has an `AI` binding.
3. Check Workers AI usage and model availability in Cloudflare Dashboard.
4. Check bot Worker logs for validation or model errors.
5. Verify normal guided task creation still works as a fallback.

Do not log full prompts, tokens, Telegram IDs, or session secrets while troubleshooting.

## Locale and Timezone

`APP_LOCALE` controls interface language. Supported values:

- `ru`
- `en`

If `APP_LOCALE` is missing or unknown, the app falls back to `ru`. Changing `APP_LOCALE` does not change D1 data or reminder schedules. Deploy the affected Worker after changing it.

`APP_TIMEZONE` is the default timezone for new users and new task rules. Use an IANA timezone name.

After creation, timezone values are stored in D1:

- `users.timezone` - the user's current timezone preference;
- `reminder_rules.timezone` - the timezone that defines the task rule.
- `annual_events.timezone` - the timezone that defines an annual event and its notification time.

Date and reminder behavior:

- user input is interpreted in the current user's timezone;
- recurring rules are calculated in `reminder_rules.timezone`;
- task timestamps are stored in UTC;
- task due dates, execution windows, and reminder times are displayed in `reminder_rules.timezone`;
- if the viewer's timezone differs from the task rule timezone, the UI shows the task rule timezone next to the time, for example `(Europe/Kyiv)`;
- Telegram notification text formats the due date in the task rule timezone;
- Cloudflare Cron runs in UTC, while domain logic uses the stored task rule timezone.

The known IANA alias `Europe/Kiev` is normalized to `Europe/Kyiv`.

Changing `APP_TIMEZONE` later only affects new default values. It does not rewrite existing users, task rules, task instances, `due_at`, or `next_remind_at`.

`ANNUAL_EVENT_NOTIFY_DAYS` is read when an annual event is created or its schedule is recalculated. Existing events keep their stored `notification_days_json` until they are updated.

If you need to change the household timezone for an existing deployment, plan it as a data migration:

1. Decide whether to update `users.timezone`.
2. Decide whether to update `reminder_rules.timezone`.
3. Decide whether future `available_from`, `due_at`, and `next_remind_at` should be recalculated.
4. Check recurring tasks, especially weekly and monthly windows.
5. Decide whether history and audit log should remain as-is.

## Users and Access

Bootstrap admins are configured through:

```text
ALLOWED_TELEGRAM_USER_IDS
```

The value is a comma-separated list of Telegram user IDs:

```text
123456789,987654321
```

Additional users can be added by an admin through the app UI.

Disabling a user should not delete that user's task history.

## Admin Access Recovery

If the only admin loses access to Telegram, but Cloudflare access remains available:

1. Get the Telegram ID of a new admin account.
2. Verify Wrangler is authenticated:

```bash
npm run cf:whoami
```

3. Replace the bootstrap admin secret:

```bash
npx wrangler secret put ALLOWED_TELEGRAM_USER_IDS
```

4. Enter the full comma-separated admin list.
5. Open the bot from the new Telegram account.
6. Send `/start`.
7. Sign in to the web app with Telegram Login.

Important: `wrangler secret put` replaces the whole secret value. If you need multiple bootstrap admins, enter all IDs at once.

If Cloudflare account access is also lost, recover the Cloudflare account first.

## Secrets

Never commit real secrets.

Required production secrets:

- `TELEGRAM_BOT_TOKEN`;
- `TELEGRAM_WEBHOOK_SECRET`;
- `ALLOWED_TELEGRAM_USER_IDS`;
- `WEB_SESSION_SECRET`.

The bot Worker and the web Worker are separate Cloudflare Workers, so configure secrets for the Worker that needs them. In a split deployment:

- the bot Worker needs `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `ALLOWED_TELEGRAM_USER_IDS`;
- the web Worker needs `TELEGRAM_BOT_TOKEN`, `ALLOWED_TELEGRAM_USER_IDS`, and `WEB_SESSION_SECRET`.

`WEB_SESSION_SECRET` must be a non-empty random value. An empty value can break Telegram Login session signing with an HMAC key length error.

The web Worker's `TELEGRAM_BOT_TOKEN` must belong to the same Telegram bot whose domain is configured in BotFather.

Optional development secret:

- `WEB_DEV_AUTH_TOKEN`.

If the Telegram bot token leaks:

1. Revoke or regenerate it in BotFather.
2. Update Cloudflare Worker Secrets.
3. Set the webhook again.
4. Test `/start`.

If `WEB_SESSION_SECRET` leaks:

1. Generate a new secret.
2. Update the web Worker secret.
3. Existing web sessions may become invalid.
4. Ask users to sign in again.

## Deploy

Before deploy:

```bash
npm run typecheck
npm run web:build
```

Deploy the bot Worker:

```bash
npm run deploy
```

Deploy the web Worker:

```bash
npm run deploy:web
```

If you changed only web UI or web API, deploy only the web Worker.

If you changed Telegram webhook, reminder processing, Cron behavior, or shared runtime code used by the bot Worker, deploy the bot Worker.

## Wrangler Authentication

`npx wrangler login` opens a browser flow that redirects to `localhost`. This works well on a local computer, but may fail in remote or SSH-only development environments because the callback URL points to the remote machine, not your browser.

If browser login does not complete in a remote environment, use one of these approaches:

1. Run Wrangler deploy/setup commands from your local computer where browser login works.
2. Use a Cloudflare API token through `CLOUDFLARE_API_TOKEN`.

Do not commit Cloudflare API tokens.

## D1 Migrations

Production migrations are remote operations. Review migrations before applying them.

Apply production migrations:

```bash
npm run d1:migrations:remote
```

If you use a separate `web-dev` environment:

```bash
npm run d1:migrations:web-dev:remote
```

The production bot Worker and production web Worker should point to the same D1 database. A production migration usually needs to be applied only once to that shared database.

The D1 binding name in `wrangler.jsonc` must remain `DB`, because the Worker code expects `env.DB`.

If Wrangler offers to add a newly created D1 database to `wrangler.jsonc` automatically, either decline and paste the values manually, or accept and then review the file. Make sure each Worker environment has only one `DB` binding.

If you use a custom D1 database name, apply migrations with that database name:

```bash
npx wrangler d1 migrations apply <your-database-name> --remote
```

Before risky migrations:

1. Create a D1 export.
2. Review the migration SQL.
3. Apply the migration.
4. Run smoke checks.

Migration `0008_add_annual_events.sql` adds annual events and their notification log. After applying it, verify event creation in the web app and one scheduled Telegram notification before relying on the feature.

## D1 Backup

Create a D1 export before risky operations:

```bash
mkdir -p tmp/d1-backups
npx wrangler d1 export family-reminder-db --remote --output=tmp/d1-backups/family-reminder-db-YYYY-MM-DD.sql
```

Do not commit D1 exports.

Recommended backup moments:

- before remote migrations;
- before manual SQL changes;
- before bulk cleanup;
- before import/export experiments;
- before changing recurring task logic.

## Rollback

If a deploy breaks the bot:

1. Do not apply new migrations until the cause is known.
2. Check Worker logs.
3. Check the last deployed version in Cloudflare Dashboard.
4. Roll back the Worker version in Cloudflare Dashboard if needed.
5. Verify `/start`.
6. Verify reminder delivery.

If a deploy breaks only the web app:

1. Do not change the bot Worker or Telegram webhook.
2. Check web Worker logs.
3. Roll back or redeploy the web Worker.
4. Verify Telegram Login.
5. Verify task list loading.

## Portable JSON Export

The app includes a portable JSON export endpoint for backups or future migration.

Admin-only endpoint:

```text
GET /api/admin/export
```

The export is intended as an application-level snapshot. It is not a full SQL backup.

Current exports include annual events, recipients, and annual-event notification history in addition to task data.

Use D1 SQL export for database-level backup and portable JSON export for migration-oriented data review.

## Maintenance Cleanup

Maintenance cleanup is intended for old technical logs only.

It should not delete:

- users;
- task rules;
- task instances;
- task history;
- audit log;
- assignments.
- annual events and recipients.

Use preview before running cleanup.

## Security Checklist

Before making a deployment public or sharing access:

- check that no real `.env` files are committed;
- check that no real tokens are in documentation;
- check that `wrangler.jsonc` does not contain somebody else's D1 IDs;
- check that Telegram Login domain is correct;
- check that `ALLOWED_TELEGRAM_USER_IDS` contains the intended bootstrap admins;
- check that ordinary users cannot access admin endpoints;
- check that old D1 exports are not committed.
- if AI is enabled, check that the configured model and expected Workers AI usage are acceptable.

## Routine Change Checklist

Before code changes:

1. Check `git status`.
2. Make the change.
3. Run `npm run typecheck`.
4. Run `npm run web:build` if web code changed.
5. Deploy the affected Worker.
6. Verify the affected Telegram or web scenario.
7. Update documentation if behavior changed.
8. Commit and push.
