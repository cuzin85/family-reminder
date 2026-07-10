# Data Model

This document describes the Cloudflare D1 data model.

The actual schema is defined by SQL migrations in `migrations/`. This document is a human-readable guide to tables, relationships, and key constraints.

## Migrations

- `0001_initial_schema.sql` - base users, rules, task instances, assignees, notifications, completion log, and sessions.
- `0002_add_cancelled_task_status.sql` - `cancelled` status/action.
- `0003_add_telegram_message_refs.sql` - Telegram message references for cleanup.
- `0004_expand_telegram_message_ref_purposes.sql` - message reference purposes.
- `0005_add_user_admin_flag.sql` - `users.is_admin`.
- `0006_add_audit_log.sql` - audit log.
- `0007_add_maintenance_cleanup_indexes.sql` - cleanup indexes.
- `0008_add_annual_events.sql` - annual events, recipients, notification state, and delivery log.

## General Rules

- Main store: Cloudflare D1.
- Timestamps are stored as UTC ISO 8601 text.
- User-facing dates are converted through the configured household timezone.
- Real secrets and tokens are not stored in D1.
- Bootstrap admins are configured through `ALLOWED_TELEGRAM_USER_IDS`.
- Ordinary user access is stored in `users`.

## Enums

### `reminder_rules.schedule_type`

- `one_time`
- `weekly`
- `monthly_fixed_window`
- `monthly_end_plus_start_window`

`monthly_end_plus_start_window` with `first_days = 0` represents a last-days-of-month task.

### `task_instances.status`

- `pending`
- `overdue`
- `done`
- `done_late`
- `missed`
- `cancelled`

### `completion_log.action`

- `done`
- `done_late`
- `missed`
- `cancelled`

### `notification_log.status`

- `sent`
- `failed`
- `skipped`

## `users`

Stores known Telegram users.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Internal user ID |
| `telegram_user_id` | integer not null unique | Telegram user ID |
| `telegram_chat_id` | integer not null | Chat ID for bot messages |
| `username` | text null | Telegram username |
| `first_name` | text null | Telegram first name |
| `last_name` | text null | Telegram last name |
| `timezone` | text not null | User timezone |
| `is_active` | integer not null | 1 active, 0 disabled |
| `is_admin` | integer not null | 1 admin, 0 ordinary user |
| `created_at` | text not null | Created timestamp |
| `updated_at` | text not null | Updated timestamp |

Indexes:

- unique index on `telegram_user_id`;
- index on `telegram_chat_id`;
- index on `is_admin`.

## `reminder_rules`

Stores rules used to create task instances.

One-time tasks also have a rule with `schedule_type = 'one_time'`.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Rule ID |
| `created_by_user_id` | integer not null | Creator user ID |
| `title` | text not null | Task title |
| `description` | text null | Optional description |
| `schedule_type` | text not null | Schedule type |
| `schedule_params_json` | text not null | Schedule parameters |
| `timezone` | text not null | Rule timezone |
| `is_active` | integer not null | 1 active, 0 disabled |
| `created_at` | text not null | Created timestamp |
| `updated_at` | text not null | Updated timestamp |

Relationships:

- `created_by_user_id` -> `users.id`.

Indexes:

- `created_by_user_id`;
- `is_active`;
- `schedule_type`.

### `schedule_params_json`

For `one_time`:

```json
{
  "available_at": "2026-07-15T00:00:00.000Z",
  "due_at": "2026-07-15T20:59:00.000Z",
  "initial_remind_at": "2026-07-15T07:00:00.000Z"
}
```

For `weekly`:

```json
{
  "weekday": 2,
  "initial_remind_time": "18:00"
}
```

`weekday` uses ISO numbering: Monday is `1`, Sunday is `7`.

For `monthly_fixed_window`:

```json
{
  "start_day": 1,
  "end_day": 5,
  "hour": 9,
  "minute": 0
}
```

For `monthly_end_plus_start_window`:

```json
{
  "last_days": 3,
  "first_days": 2,
  "hour": 9,
  "minute": 0
}
```

For last-days-only tasks, use `first_days = 0`.

## `reminder_rule_assignees`

Stores assignees for a rule.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Row ID |
| `reminder_rule_id` | integer not null | Rule ID |
| `user_id` | integer not null | Assignee user ID |
| `created_at` | text not null | Created timestamp |

Relationships:

- `reminder_rule_id` -> `reminder_rules.id`;
- `user_id` -> `users.id`.

Constraint:

- unique on (`reminder_rule_id`, `user_id`).

## `task_instances`

Stores concrete tasks.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Task instance ID |
| `reminder_rule_id` | integer null | Rule ID |
| `created_by_user_id` | integer not null | Creator user ID |
| `title` | text not null | Instance title |
| `description` | text null | Instance description |
| `period_label` | text null | Human-readable period label |
| `period_start` | text null | Period start |
| `period_end` | text null | Period end |
| `available_from` | text not null | When the task becomes relevant |
| `due_at` | text not null | Due timestamp |
| `next_remind_at` | text null | Next reminder timestamp |
| `status` | text not null | Task status |
| `closed_by_user_id` | integer null | Closing user ID |
| `closed_at` | text null | Closed timestamp |
| `created_at` | text not null | Created timestamp |
| `updated_at` | text not null | Updated timestamp |

Relationships:

- `reminder_rule_id` -> `reminder_rules.id`;
- `created_by_user_id` -> `users.id`;
- `closed_by_user_id` -> `users.id`.

Indexes:

- `status`;
- `available_from`;
- `due_at`;
- `next_remind_at`;
- `reminder_rule_id`;
- (`status`, `next_remind_at`).

Recurring rules should not create duplicate instances for the same period.

## `task_assignees`

Stores assignees for a concrete task instance.

Assignees are copied from the rule when an instance is created, so history remains stable even if the rule changes later.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Row ID |
| `task_instance_id` | integer not null | Task instance ID |
| `user_id` | integer not null | Assignee user ID |
| `created_at` | text not null | Created timestamp |

Relationships:

- `task_instance_id` -> `task_instances.id`;
- `user_id` -> `users.id`.

Constraint:

- unique on (`task_instance_id`, `user_id`).

## `completion_log`

Stores task closing events.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Row ID |
| `task_instance_id` | integer not null | Task instance ID |
| `user_id` | integer not null | Acting user ID |
| `action` | text not null | Closing action |
| `created_at` | text not null | Created timestamp |

Relationships:

- `task_instance_id` -> `task_instances.id`;
- `user_id` -> `users.id`.

## `notification_log`

Stores Telegram notification delivery attempts.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Row ID |
| `task_instance_id` | integer not null | Task instance ID |
| `user_id` | integer not null | Recipient user ID |
| `scheduled_for` | text not null | Scheduled reminder timestamp |
| `status` | text not null | Delivery status |
| `telegram_message_id` | integer null | Telegram message ID |
| `error_message` | text null | Error text |
| `created_at` | text not null | Created timestamp |

Recommended uniqueness:

- (`task_instance_id`, `user_id`, `scheduled_for`) to avoid duplicate delivery attempts for the same reminder time.

## `dialog_state`

Stores Telegram guided flow state.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Row ID |
| `user_id` | integer not null unique | User ID |
| `state` | text not null | Current flow state |
| `data_json` | text not null | Flow data |
| `created_at` | text not null | Created timestamp |
| `updated_at` | text not null | Updated timestamp |

## `annual_events`

Stores birthdays, anniversaries, and other calendar dates that repeat annually.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Annual event ID |
| `created_by_user_id` | integer not null | Creator user ID |
| `title` | text not null | Event title |
| `description` | text null | Optional description |
| `event_month` | integer not null | Month, 1 through 12 |
| `event_day` | integer not null | Day, 1 through 31; calendar validity is checked by application logic |
| `event_year` | integer null | Optional original year for age/anniversary display |
| `reminder_hour` | integer not null | Notification hour in event timezone |
| `reminder_minute` | integer not null | Notification minute in event timezone |
| `timezone` | text not null | IANA timezone defining the event schedule |
| `notification_days_json` | text not null | Notification offsets copied from configuration |
| `next_notification_at` | text null | Next due notification timestamp in UTC |
| `next_notification_event_date` | text null | Event occurrence associated with the next notification |
| `next_notification_offset_days` | integer null | Offset for the next notification |
| `is_active` | integer not null | 1 active, 0 deleted/deactivated |
| `created_at` | text not null | Created timestamp |
| `updated_at` | text not null | Updated timestamp |

Indexes support creator lookup, active-event lists, and scheduled processing by `next_notification_at`.

## `annual_event_recipients`

Stores users who should see and receive notifications for an annual event.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Row ID |
| `annual_event_id` | integer not null | Annual event ID |
| `user_id` | integer not null | Recipient user ID |
| `created_at` | text not null | Created timestamp |

Constraint:

- unique on (`annual_event_id`, `user_id`).

## `annual_event_notification_log`

Stores annual-event delivery attempts and provides idempotency.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Delivery row ID |
| `annual_event_id` | integer not null | Annual event ID |
| `user_id` | integer not null | Recipient user ID |
| `event_date` | text not null | Calendar occurrence being notified |
| `offset_days` | integer not null | Days before the occurrence |
| `scheduled_for` | text not null | Planned UTC notification time |
| `sent_at` | text null | Successful send time |
| `telegram_message_id` | integer null | Telegram message ID |
| `status` | text not null | `sent`, `failed`, or `skipped` |
| `error_message` | text null | Compact delivery error |
| `created_at` | text not null | Created timestamp |

Constraint:

- unique on (`annual_event_id`, `user_id`, `event_date`, `offset_days`).

## `telegram_message_refs`

Stores bot-generated Telegram message references that can be deleted later.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Row ID |
| `user_id` | integer not null | User ID |
| `chat_id` | integer not null | Telegram chat ID |
| `message_id` | integer not null | Telegram message ID |
| `purpose` | text not null | Message purpose |
| `created_at` | text not null | Created timestamp |

Examples of `purpose`:

- `task_list`;
- `create_flow`;

Telegram may reject deletion of older messages, so this table is best-effort cleanup support.

## `user_sessions`

Stores web session data.

| Column | Type | Description |
| --- | --- | --- |
| `id` | text primary key | Session ID |
| `user_id` | integer not null | User ID |
| `expires_at` | text not null | Expiration timestamp |
| `created_at` | text not null | Created timestamp |

## `audit_log`

Stores important user actions.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer primary key | Audit event ID |
| `actor_user_id` | integer null | Acting user ID |
| `action` | text not null | Action name |
| `entity_type` | text not null | Entity type |
| `entity_id` | integer null | Entity ID |
| `metadata_json` | text null | Compact metadata |
| `created_at` | text not null | Created timestamp |

Indexes:

- (`entity_type`, `entity_id`, `created_at`);
- `actor_user_id`;
- `created_at`;
- `action`.

Audit logging should not block the main user action. If audit writing fails, the main action should still complete when possible.

## Key Queries

### My Active Tasks

Select task instances with `pending` or `overdue` status where the current user is assigned.

### Family Active Tasks

Select task instances with `pending` or `overdue` status and include assignee display data.

### Due Reminders

Select task instances where:

- status is `pending` or `overdue`;
- `next_remind_at` is not null;
- `next_remind_at` is less than or equal to current time.

### Due Annual-Event Notifications

Select active annual events where `next_notification_at` is not null and is less than or equal to current time. Join only active recipients and use the annual notification log uniqueness constraint to avoid duplicate sends.

### History

Select closed task instances with statuses:

- `done`;
- `done_late`;
- `missed`;
- `cancelled`.

Always paginate history queries.

## Consistency Rules

- Check current task status before closing a task.
- Check permissions before mutating a task.
- Avoid duplicate recurring instances for the same period.
- Keep rule assignees and instance assignees separate.
- Do not delete users when disabling access.
- Do not store secrets in D1.
- Keep annual event recipients separate from task assignees.
- Recalculate `next_notification_at` after annual event schedule changes and after each processed notification.
