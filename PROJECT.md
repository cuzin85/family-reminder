# Project Brief

Family Reminder is a small household reminder system built around Telegram notifications and a web management interface.

The project is intended for a small trusted group, such as a family or shared household. It is not designed as a public multi-tenant SaaS.

## Goals

- Help household members remember recurring and one-time tasks.
- Support shared tasks with multiple assignees.
- Keep Telegram as the primary notification channel.
- Provide a web interface for task management, history, users, export, and maintenance.
- Run on serverless infrastructure with minimal operational overhead.
- Keep the deployment small enough for typical free-tier Cloudflare usage.
- Avoid storing runtime state in process memory.
- Keep application data in Cloudflare D1.

## Non-Goals

- Public registration.
- Multi-tenant organizations.
- Payments or subscriptions.
- Large teams.
- Complex project management workflows.
- Native mobile apps.
- Web push notifications.
- Internationalization in the current version.

## Target Users

- A household administrator who configures the bot, adds users, and maintains the deployment.
- Household members who receive reminders and complete or miss tasks.

Expected scale:

- small number of users;
- low request volume;
- low storage volume;
- human-scale recurring reminders.

## Example Tasks

- Take out the trash every week.
- Submit utility meter readings during a monthly window.
- Pay a bill.
- Water plants.
- Replace a filter.
- Complete a one-time task by a specific date.
- Complete a one-time task during a specific date window.

## Main Interfaces

### Telegram Bot

Telegram is used for:

- receiving reminder notifications;
- quick task actions;
- viewing active tasks;
- creating tasks through guided flows;
- editing or deleting tasks;
- completing, missing, or snoozing reminders;
- basic user administration.

### Web App

The web app is used for:

- easier task creation and editing;
- active task lists;
- family task lists;
- task history;
- user administration;
- audit log review;
- portable JSON export;
- maintenance cleanup.

## Task Types

The application supports:

- one-time task with a due date and separate reminder time;
- one-time task with an execution window;
- weekly task;
- monthly task by fixed days;
- monthly task by the last days of the month;
- monthly task with end-of-month plus beginning-of-next-month window.

## Access Model

- Bootstrap admins are configured through `ALLOWED_TELEGRAM_USER_IDS`.
- Ordinary users are stored in D1.
- Admins can add, activate, and deactivate users.
- Only active users can use the bot and web app.
- Admins have broader permissions than ordinary users.
- Assigned users can act on their assigned tasks.

## Reminder Model

- Telegram webhook handles incoming bot updates.
- Cloudflare Cron periodically checks due reminders.
- Reminder state is stored in D1.
- No per-task background timer is created.
- Cron cadence is intentionally coarse; reminders can arrive several minutes after the selected time.

## Data Model Expectations

The system stores:

- users;
- recurring rules;
- task instances;
- task assignments;
- completion history;
- notification logs;
- audit logs;
- web sessions.

Data must survive deploys, Worker restarts, and idle periods.

## Operational Requirements

- Deploy must be reproducible from Git.
- Secrets must be stored outside Git.
- D1 migrations must be versioned.
- Backup and export paths must be documented.
- The bot should recover cleanly after redeploy.
- Errors should be diagnosable through Cloudflare logs and D1 data.

## Platform Requirements

The preferred deployment target is Cloudflare:

- Cloudflare Workers;
- Cloudflare D1;
- Cloudflare Cron Triggers;
- Cloudflare Worker Secrets;
- Workers Static Assets.

Telegram Bot API is the only required external API.

## Current Limitations

- The UI language is Russian.
- Web push notifications are not implemented.
- Telegram remains the only notification channel.
- The project assumes a trusted household, not untrusted public users.
- Deployment requires manual Cloudflare and BotFather setup.
