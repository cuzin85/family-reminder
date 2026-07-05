# Domain Model

This document describes the business rules of Family Reminder.

Infrastructure is described in `ARCHITECTURE.md`. Database structure is described in `DATA_MODEL.md`.

## Core Idea

The app manages household tasks that can be:

- one-time;
- recurring;
- assigned to one or more people;
- available during an execution window;
- completed on time;
- completed late;
- explicitly missed;
- cancelled.

Recurring rules create concrete task instances. Users complete or miss task instances, not abstract rules.

## Terms

### Reminder Rule

A reminder rule describes how task instances are created.

It defines:

- task title;
- optional description;
- schedule type;
- schedule parameters;
- timezone;
- assignees;
- whether the rule is active.

Examples:

- every week, take out the trash;
- every month, submit meter readings;
- one time, buy a filter;
- every month, complete a task during the last N days and first M days of the next month.

### Task Instance

A task instance is a concrete task created from a rule.

Examples:

- "Submit electricity readings for June 2026";
- "Take out the trash on Wednesday";
- "Buy a filter by July 15".

Recurring rules can create many instances over time.

### Execution Window

An execution window is the period when a task can be completed on time.

Fields:

- `available_from` - when the task becomes relevant;
- `due_at` - when the task becomes overdue.

Before `available_from`, the task is not yet relevant. After `due_at`, an open task becomes overdue.

### Reminder

A reminder is a Telegram message sent by the bot at a planned time.

It is not a phone alarm. If Telegram notifications are enabled, the user's device may show a push notification for the bot message.

The task list and reminders are separate. A user can open the bot or web app and see current tasks without waiting for a reminder message.

## Schedule Types

### One-Time Task

A one-time task has:

- due date;
- separate reminder time;
- assignees;
- status.

For a standard one-time task:

- `available_from` is the task creation time;
- `due_at` is the end of the selected due date in the rule timezone;
- `next_remind_at` is the selected reminder time on that date.

If the task must be done at an exact time, that time can be part of the title. The reminder time remains a separate notification setting.

### One-Time Task With Window

A one-time window task has explicit start and end dates.

Example:

- "Submit documents from July 10 to July 14".

For this task:

- `available_from` is the start of the first window day;
- `due_at` is the end of the last window day;
- `next_remind_at` is the next planned daily reminder time inside the window.

If the task is created while the window is already active and today's reminder time already passed, the app should schedule the next available reminder inside the window. It should remind immediately only if no future planned reminder time remains inside the window.

### Weekly Task

A weekly task has:

- weekday;
- reminder time;
- assignees.

For each weekly instance:

- `available_from` is the beginning of the selected weekday;
- `due_at` is the end of the selected weekday;
- `next_remind_at` is the reminder time on that day.

The next weekly instance is not created immediately after completing the current one. It is created by scheduled processing at the next matching weekly period.

If a weekly task is not completed before the next matching period starts, the old unfinished instance is closed as `missed`, and a new instance is created for the new period.

### Monthly Fixed-Day Window

A monthly fixed-day task has:

- start day of month;
- end day of month;
- reminder time.

Examples:

- day 5 only;
- days 1 through 5.

The reminder repeats daily at the configured time while the task is open and inside the window.

### Monthly Last-Days Window

A monthly last-days task has:

- number of last days in the month;
- reminder time.

Examples:

- last day of the month;
- last 3 days of the month.

This handles variable month length.

Internally this can use the same schedule type as end-plus-start with `first_days = 0`.

### Monthly End-Plus-Start Window

This task has:

- N last days of the reporting month;
- M first days of the next month;
- reminder time.

Example for `3+2` and reporting month June 2026:

- June 28;
- June 29;
- June 30;
- July 1;
- July 2.

The reminder repeats daily at the configured time while the task is open and inside the window.

If the user presses "remind me in 1 hour", only the next reminder is postponed. After that reminder, the task returns to the normal daily reminder schedule.

## Task Statuses

### `pending`

The task is open and not overdue.

### `overdue`

The due time has passed, but the task is still open.

Overdue tasks remain visible until an assigned user or admin closes them.

### `done`

The task was completed on time.

### `done_late`

The task was completed after `due_at`.

### `missed`

The task was explicitly marked as missed.

Missed tasks leave active lists and remain in history.

### `cancelled`

The task was cancelled because it is no longer needed or was created by mistake.

`cancelled` differs from `missed`: missed means the task should have been done but was not; cancelled means the task should no longer be treated as required.

## Lists

### My Tasks

Shows active and overdue tasks assigned to the current user.

### Family Tasks

Shows active and overdue tasks for the household.

Task actions are available only when the current user has permission to act on that task.

Admins can act on more tasks than ordinary users.

### History

Shows closed tasks:

- `done`;
- `done_late`;
- `missed`;
- `cancelled`.

History should be paginated.

## Assignees

A task can be assigned to:

- the creator only;
- all active household users;
- selected active users.

For shared tasks, completion by any assigned user closes the task for everyone.

This matches household tasks where the work only needs to be done once.

## Actions

### Complete

Before `due_at`, completing a task sets status `done`.

After `due_at`, completing a task sets status `done_late`.

### Miss

Marks an overdue task as `missed`.

### Cancel/Delete

For a one-time task, delete/cancel closes the current instance as `cancelled`.

For a recurring task, delete/cancel deactivates the rule and closes the current active instance as `cancelled`.

### Snooze

Snooze is available from Telegram notification messages.

Current behavior:

- postpone the next reminder by 1 hour;
- do not change `due_at`;
- do not change the execution window;
- do not change recurrence rules.

For shared tasks, snooze currently affects the task instance's next reminder, not a per-user reminder schedule.

## Editing

Editing permissions:

- assigned users can edit tasks assigned to them;
- admins can edit tasks more broadly.

One-time tasks can be edited for:

- title;
- due date;
- reminder time;
- assignees.

One-time window tasks can be edited for:

- title;
- start date;
- end date;
- reminder time;
- assignees.

Weekly tasks can be edited for:

- title;
- weekday;
- reminder time;
- assignees.

Monthly tasks can be edited for:

- title;
- window parameters;
- reminder time;
- assignees.

When schedule changes invalidate the current active instance, the app can close the current instance as `cancelled` and create a new instance from the updated rule.

When assignees change for a recurring task, the user can choose whether to apply the change only to future instances or also to the current active instance.

## Audit Log

Important user actions should be written to audit log:

- task created;
- task updated;
- task completed;
- task missed;
- task snoozed;
- task cancelled/deleted;
- user added;
- user deactivated;
- export created;
- maintenance cleanup.

Telegram and web actions should both write audit events.

Audit log is viewed in the web interface, not in Telegram.

## Telegram Message Cleanup

The bot may try to delete old bot-generated task list messages and flow messages to keep the chat readable.

Telegram can reject deletion of older messages, so the UI must remain understandable even when older messages stay in the chat.

## Invariants

- Closed tasks do not appear in active lists.
- Overdue tasks remain visible until closed.
- Recurring rules create task instances; users close instances.
- Secrets are never stored in D1.
- User permissions are checked server-side.
- Web and Telegram actions must follow the same domain rules.
