import type { Env } from "../env";
import { apiErrorResponse } from "../http";
import { recordAuditEvent } from "../audit";
import type { AuthenticatedWebUser } from "./auth";

const EXPORT_SCHEMA_VERSION = 1;

type ExportRow = Record<string, number | string | null>;

async function selectRows<T extends ExportRow>(env: Env, query: string): Promise<T[]> {
  const result = await env.DB.prepare(query).all<T>();

  return result.results ?? [];
}

function buildExportFilename(exportedAt: string): string {
  return `family-reminder-export-${exportedAt.slice(0, 10)}.json`;
}

export async function handleExportData(env: Env, user: AuthenticatedWebUser): Promise<Response> {
  if (!user.isAdmin) {
    return apiErrorResponse("forbidden", 403);
  }

  const exportedAt = new Date().toISOString();
  const [
    users,
    reminderRules,
    reminderRuleAssignees,
    taskInstances,
    taskAssignees,
    completionLog,
    notificationLog,
    auditLog
  ] = await Promise.all([
    selectRows(env, `
      SELECT
        id,
        telegram_user_id,
        telegram_chat_id,
        username,
        first_name,
        last_name,
        timezone,
        is_active,
        is_admin,
        created_at,
        updated_at
      FROM users
      ORDER BY id
    `),
    selectRows(env, `
      SELECT
        id,
        created_by_user_id,
        title,
        description,
        schedule_type,
        schedule_params_json,
        timezone,
        is_active,
        created_at,
        updated_at
      FROM reminder_rules
      ORDER BY id
    `),
    selectRows(env, `
      SELECT
        id,
        reminder_rule_id,
        user_id,
        created_at
      FROM reminder_rule_assignees
      ORDER BY id
    `),
    selectRows(env, `
      SELECT
        id,
        reminder_rule_id,
        created_by_user_id,
        title,
        description,
        period_label,
        period_start,
        period_end,
        available_from,
        due_at,
        next_remind_at,
        status,
        closed_by_user_id,
        closed_at,
        created_at,
        updated_at
      FROM task_instances
      ORDER BY id
    `),
    selectRows(env, `
      SELECT
        id,
        task_instance_id,
        user_id,
        created_at
      FROM task_assignees
      ORDER BY id
    `),
    selectRows(env, `
      SELECT
        id,
        task_instance_id,
        user_id,
        action,
        created_at
      FROM completion_log
      ORDER BY id
    `),
    selectRows(env, `
      SELECT
        id,
        task_instance_id,
        user_id,
        scheduled_for,
        sent_at,
        telegram_message_id,
        status,
        error_message,
        created_at
      FROM notification_log
      ORDER BY id
    `),
    selectRows(env, `
      SELECT
        id,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        metadata_json,
        created_at
      FROM audit_log
      ORDER BY id
    `)
  ]);

  const body = {
    app: "family-reminder",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt,
    timezone: env.APP_TIMEZONE,
    exportedBy: {
      userId: user.id,
      telegramUserId: user.telegramUserId
    },
    tables: {
      users,
      reminder_rules: reminderRules,
      reminder_rule_assignees: reminderRuleAssignees,
      task_instances: taskInstances,
      task_assignees: taskAssignees,
      completion_log: completionLog,
      notification_log: notificationLog,
      audit_log: auditLog
    }
  };

  await recordAuditEvent(env, {
    actorUserId: user.id,
    action: "export.created",
    entityType: "export",
    metadata: {
      source: "web",
      schemaVersion: EXPORT_SCHEMA_VERSION,
      tableCounts: {
        users: users.length,
        reminder_rules: reminderRules.length,
        reminder_rule_assignees: reminderRuleAssignees.length,
        task_instances: taskInstances.length,
        task_assignees: taskAssignees.length,
        completion_log: completionLog.length,
        notification_log: notificationLog.length,
        audit_log: auditLog.length
      }
    },
    now: exportedAt
  });

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-disposition": `attachment; filename="${buildExportFilename(exportedAt)}"`,
      "content-type": "application/json; charset=utf-8"
    }
  });
}
