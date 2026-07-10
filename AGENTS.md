# Instructions for AI Coding Agents

This repository contains Family Reminder, a Telegram bot and web application for shared household tasks.

## Read First

Before changing code or configuration, read the relevant project documents:

- `README.md` for setup and deployment;
- `ARCHITECTURE.md` and `WEB_ARCHITECTURE.md` for service boundaries;
- `DOMAIN.md` for task and event behavior;
- `DATA_MODEL.md` for D1 tables and relationships;
- `SECURITY.md` and `PRIVACY.md` for secret and data-handling rules;
- `RUNBOOK.md` for operational procedures.

## Working Rules

- Inspect the repository and `git status` before editing.
- Keep changes scoped to the requested task and preserve existing patterns.
- Do not overwrite unrelated or unfamiliar user changes.
- Do not use destructive Git commands or rewrite history without explicit approval.
- Do not commit or push unless the user requests it.
- Keep this public repository generic. Never add personal names, Telegram IDs, account IDs, database IDs, private domains, local paths, or real credentials.

## Secrets and External Resources

- Never store tokens, secrets, passwords, session keys, or real `.env` files in Git.
- Keep examples empty or use obvious placeholders such as `your_bot_username` and zero UUIDs.
- Do not create, delete, or modify Cloudflare resources without explicit user approval.
- Do not deploy Workers, apply remote D1 migrations, set Telegram webhooks, or change BotFather settings without explicit user approval.
- Explain commands that require secrets and have the user enter values directly into the appropriate CLI prompt.

## Architecture Constraints

- The bot Worker owns the Telegram webhook, Cron Trigger, and reminder delivery.
- The web Worker serves the React application and web API and must not own the production reminder Cron Trigger.
- Production bot and web Workers share one D1 database.
- Workers AI is optional and must remain disabled by default in the public template.
- Preserve atomic task-closing behavior for shared tasks.
- Keep Russian and English labels synchronized when changing user-facing text.

## Database Changes

- Treat applied migrations as immutable.
- Add schema changes as a new sequential file in `migrations/`.
- Review migrations before applying them to a remote database.
- Update `DATA_MODEL.md`, setup instructions, and export behavior when the schema or portable data contract changes.

## Validation

Use Node.js 24 or newer. For an existing checkout, prefer:

```bash
npm ci
npm run typecheck
npm run web:build
```

- Run focused checks appropriate to the change.
- Do not run `npm audit fix` blindly; inspect advisories and proposed dependency changes first.
- If configuration or deployment steps change, update and review the public README and RUNBOOK.
- Report any checks that could not be run.
