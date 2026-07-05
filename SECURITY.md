# Security

## Supported Use

Family Reminder is designed for a small trusted household.

It is not designed as a public multi-tenant SaaS. Do not expose it as an open registration service without additional security review.

## Secrets

Never commit real secrets.

Keep these values outside Git:

- `TELEGRAM_BOT_TOKEN`;
- `TELEGRAM_WEBHOOK_SECRET`;
- `ALLOWED_TELEGRAM_USER_IDS`;
- `WEB_SESSION_SECRET`;
- `WEB_DEV_AUTH_TOKEN`;
- `CLOUDFLARE_API_TOKEN`;
- `.env`;
- `.dev.vars`;
- D1 exports;
- Wrangler local state.

Use Cloudflare Worker Secrets for production.

Use `.env.example` only as a safe template.

## Authentication

Telegram bot access starts from Telegram user IDs.

Bootstrap admins are configured through:

```text
ALLOWED_TELEGRAM_USER_IDS
```

Additional users are stored in D1 and managed by admins.

The web app uses Telegram Login. The Worker verifies the Telegram login payload server-side before creating a session.

## Authorization

Do not rely on frontend visibility for permissions.

Backend routes must check:

- user is active;
- user is admin for admin-only actions;
- user is assigned or otherwise allowed to mutate a task;
- task status allows the requested action.

## Web Sessions

Web sessions should use signed cookies.

Recommended cookie properties:

- `HttpOnly`;
- `Secure`;
- `SameSite=Lax`.

If `WEB_SESSION_SECRET` leaks, rotate it. Existing sessions may become invalid and users may need to sign in again.

## Telegram Webhook

Use a random `TELEGRAM_WEBHOOK_SECRET` and pass it as Telegram webhook `secret_token`.

The Worker should reject webhook requests with an invalid secret header.

If the Telegram bot token leaks:

1. Regenerate the token in BotFather.
2. Update Cloudflare Worker Secrets.
3. Set the webhook again.
4. Test `/start`.

## D1 Data

D1 contains personal and household data such as Telegram user IDs, names, tasks, history, notification logs, and audit logs.

Do not commit:

- D1 exports;
- SQL dumps;
- copied production rows;
- screenshots containing personal data.

## Reporting Security Issues

If you publish a fork, add your own security contact or GitHub Security Policy.

Do not report private tokens or personal user data in public issues.
