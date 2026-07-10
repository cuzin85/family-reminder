# Privacy

Family Reminder stores household task data in the deployer's own Cloudflare account.

This document describes the data categories used by the app. If you publish or operate a fork, update this document for your own deployment and jurisdiction.

## Data Stored

The app may store:

- Telegram user ID;
- Telegram chat ID;
- Telegram username;
- Telegram first and last name;
- user active/admin status;
- user timezone;
- task titles and descriptions;
- task schedules and recurrence rules;
- task assignees;
- task status and completion history;
- annual event titles, dates, optional original years, and recipients;
- annual-event notification delivery logs;
- Telegram notification delivery logs;
- Telegram message IDs for best-effort cleanup;
- web sessions;
- audit log events;
- portable JSON export data when an admin downloads it.

## Where Data Is Stored

Production data is stored in Cloudflare D1 in the deployer's Cloudflare account.

Secrets are stored in Cloudflare Worker Secrets.

Telegram messages are processed through Telegram Bot API.

If `AI_TASK_CREATION_ENABLED=true`, free-form task text and active household members' display names/aliases are processed by Cloudflare Workers AI in the deployer's Cloudflare account. The application uses temporary member references and does not intentionally send Telegram IDs, D1 IDs, bot tokens, or session secrets to the model.

## Data Not Intended To Be Stored

The app should not store:

- Telegram bot token in D1;
- Cloudflare API tokens in D1;
- plaintext web session secret;
- user passwords;
- payment data.
- full AI prompts or model responses in D1.

## Data Exports

Admins can download a portable JSON export.

Treat exports as sensitive. They may contain Telegram IDs, names, task history, and audit events.

Do not commit exports to Git.

## Cleanup

The maintenance UI can clean old technical logs such as notification logs and Telegram message references.

Task history, users, rules, assignments, annual events, recipients, and audit logs should not be deleted automatically without an explicit product decision.

## User Access

Only active users can use the app.

Admins can add, activate, and deactivate users.

Deactivating a user should not remove their historical task data.

## Operator Responsibility

The person deploying this app controls:

- Cloudflare account;
- D1 database;
- Worker secrets;
- Telegram bot;
- user access;
- backups;
- exports.

The operator is responsible for protecting that infrastructure and complying with applicable privacy requirements.
