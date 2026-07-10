import { getAppConfig, serializeAnnualEventNotifyDays } from "./config";
import {
  formatAnnualEventDisplayDate,
  getDueAnnualEventNotifications,
  recordAnnualEventNotification,
  updateAnnualEventNextNotification
} from "./annual-events";
import { formatDateTimeInTimeZone, getNextDailyReminderWithinWindow, normalizeIanaTimezone } from "./dates";
import type { Env } from "./env";
import { getAppLabels } from "./i18n";
import { sendTelegramMessage } from "./telegram/client";
import { buildAdminMainMenuKeyboard, buildMainMenuKeyboard } from "./telegram/menu";

interface DueNotification {
  task_id: number;
  user_id: number;
  telegram_chat_id: number;
  is_admin: number;
  status: "pending" | "overdue";
  title: string;
  due_at: string;
  next_remind_at: string;
  schedule_type: string | null;
  schedule_params_json: string | null;
  user_timezone: string;
  rule_timezone: string | null;
}

async function getDueNotifications(env: Env, now: string): Promise<DueNotification[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        task_instances.id AS task_id,
        users.id AS user_id,
        users.telegram_chat_id,
        users.is_admin,
        task_instances.status,
        task_instances.title,
        task_instances.due_at,
        task_instances.next_remind_at,
        reminder_rules.schedule_type,
        reminder_rules.schedule_params_json,
        users.timezone AS user_timezone,
        reminder_rules.timezone AS rule_timezone
      FROM task_instances
      LEFT JOIN reminder_rules
        ON reminder_rules.id = task_instances.reminder_rule_id
      INNER JOIN task_assignees
        ON task_assignees.task_instance_id = task_instances.id
      INNER JOIN users
        ON users.id = task_assignees.user_id
      WHERE task_instances.status IN ('pending', 'overdue')
        AND task_instances.next_remind_at IS NOT NULL
        AND task_instances.next_remind_at <= ?
        AND users.is_active = 1
        AND NOT EXISTS (
          SELECT 1
          FROM notification_log
          WHERE notification_log.task_instance_id = task_instances.id
            AND notification_log.user_id = users.id
            AND notification_log.scheduled_for = task_instances.next_remind_at
        )
      ORDER BY task_instances.next_remind_at ASC
      LIMIT 20
    `
  )
    .bind(now)
    .all<DueNotification>();

  return result.results ?? [];
}

async function recordNotification(
  env: Env,
  notification: DueNotification,
  status: "sent" | "failed",
  now: string,
  telegramMessageId: number | null,
  errorMessage: string | null
): Promise<void> {
  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO notification_log (
        task_instance_id,
        user_id,
        scheduled_for,
        sent_at,
        telegram_message_id,
        status,
        error_message,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      notification.task_id,
      notification.user_id,
      notification.next_remind_at,
      status === "sent" ? now : null,
      telegramMessageId,
      status,
      errorMessage,
      now
    )
    .run();
}

function getNextReminderAfterNotification(notification: DueNotification): string | null {
  if (
    notification.schedule_type !== "one_time" &&
    notification.schedule_type !== "monthly_fixed_window" &&
    notification.schedule_type !== "monthly_end_plus_start_window"
  ) {
    return null;
  }

  if (!notification.schedule_params_json) {
    return null;
  }

  const params = JSON.parse(notification.schedule_params_json) as {
    available_from?: string;
    hour?: number;
    minute?: number;
  };

  if (notification.schedule_type === "one_time" && !params.available_from) {
    return null;
  }

  if (typeof params.hour !== "number" || typeof params.minute !== "number") {
    return null;
  }

  return getNextDailyReminderWithinWindow(
    notification.next_remind_at,
    notification.due_at,
    params.hour,
    params.minute,
    normalizeIanaTimezone(notification.rule_timezone) ?? normalizeIanaTimezone(notification.user_timezone) ?? notification.user_timezone
  );
}

async function updateNextReminderForTask(
  env: Env,
  taskId: number,
  nextRemindAt: string | null,
  now: string
): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE task_instances
      SET next_remind_at = ?,
        updated_at = ?
      WHERE id = ?
    `
  )
    .bind(nextRemindAt, now, taskId)
    .run();
}

export async function sendDueTaskNotifications(env: Env, now: string): Promise<number> {
  const config = getAppConfig(env);
  const labels = getAppLabels(config.appLocale);
  const notifications = await getDueNotifications(env, now);
  let sentCount = 0;

  for (const notification of notifications) {
    const ruleTimezone = normalizeIanaTimezone(notification.rule_timezone);
    const userTimezone = normalizeIanaTimezone(notification.user_timezone) ?? notification.user_timezone;
    const taskTimezone = ruleTimezone ?? userTimezone;
    const timezoneSuffix = ruleTimezone && ruleTimezone !== userTimezone
      ? ` (${ruleTimezone})`
      : "";
    const dueAt = `${formatDateTimeInTimeZone(notification.due_at, taskTimezone)}${timezoneSuffix}`;
    const closeButtons = [
      {
        text: labels.telegram.buttons.done,
        callback_data: `task:done:${notification.task_id}`
      },
      ...(notification.status === "overdue"
        ? [
            {
              text: labels.telegram.buttons.missed,
              callback_data: `task:miss:${notification.task_id}`
            }
          ]
        : [])
    ];

    try {
      const message = await sendTelegramMessage(
        env,
        notification.telegram_chat_id,
        labels.telegram.notifications.reminder(notification.title, dueAt),
        {
          inline_keyboard: [
            closeButtons,
            [
              {
                text: labels.telegram.buttons.snoozeOneHour,
                callback_data: `task:snooze:${notification.task_id}`
              }
            ],
            ...(notification.is_admin === 1
              ? buildAdminMainMenuKeyboard(labels).inline_keyboard
              : buildMainMenuKeyboard(labels).inline_keyboard)
          ]
        }
      );

      await recordNotification(env, notification, "sent", now, message.message_id, null);
      sentCount += 1;
    } catch (error) {
      await recordNotification(
        env,
        notification,
        "failed",
        now,
        null,
        error instanceof Error ? error.message : "Unknown notification error"
      );
    }

    await updateNextReminderForTask(env, notification.task_id, getNextReminderAfterNotification(notification), now);
  }

  return sentCount;
}

export async function sendDueAnnualEventNotifications(env: Env, now: string): Promise<number> {
  const config = getAppConfig(env);
  const labels = getAppLabels(config.appLocale);
  const notificationDaysJson = serializeAnnualEventNotifyDays(config.annualEventNotifyDays);
  const notifications = await getDueAnnualEventNotifications(env, now, notificationDaysJson);
  let sentCount = 0;

  for (const notification of notifications) {
    const eventDate = notification.next_notification_event_date
      ? formatAnnualEventDisplayDate(notification.next_notification_event_date)
      : "";
    const offsetDays = notification.next_notification_offset_days ?? 0;

    try {
      const message = await sendTelegramMessage(
        env,
        notification.telegram_chat_id,
        labels.telegram.notifications.annualEvent(notification.title, eventDate, offsetDays),
        notification.is_admin === 1
          ? buildAdminMainMenuKeyboard(labels)
          : buildMainMenuKeyboard(labels)
      );

      await recordAnnualEventNotification(env, notification, "sent", now, message.message_id, null);
      sentCount += 1;
    } catch (error) {
      await recordAnnualEventNotification(
        env,
        notification,
        "failed",
        now,
        null,
        error instanceof Error ? error.message : "Unknown annual event notification error"
      );
    }

    await updateAnnualEventNextNotification(
      env,
      notification,
      notification.next_notification_at ?? now,
      config.annualEventNotifyDays,
      notificationDaysJson
    );
  }

  return sentCount;
}
