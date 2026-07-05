import { recordAuditEvent } from "../audit";
import type { Env } from "../env";
import { apiErrorResponse, jsonResponse } from "../http";
import type { AuthenticatedWebUser } from "./auth";

const TELEGRAM_MESSAGE_REFS_RETENTION_DAYS = 30;
const NOTIFICATION_LOG_RETENTION_DAYS = 90;

export interface MaintenanceCleanupPreview {
  notificationLog: {
    count: number;
    cutoff: string;
    retentionDays: number;
  };
  telegramMessageRefs: {
    count: number;
    cutoff: string;
    retentionDays: number;
  };
}

function subtractDays(now: string, days: number): string {
  return new Date(Date.parse(now) - days * 24 * 60 * 60 * 1000).toISOString();
}

async function countRows(env: Env, tableName: "notification_log" | "telegram_message_refs", cutoff: string): Promise<number> {
  const row = await env.DB.prepare(
    `
      SELECT COUNT(*) AS count
      FROM ${tableName}
      WHERE created_at < ?
    `
  )
    .bind(cutoff)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

async function deleteRows(env: Env, tableName: "notification_log" | "telegram_message_refs", cutoff: string): Promise<number> {
  const result = await env.DB.prepare(
    `
      DELETE FROM ${tableName}
      WHERE created_at < ?
    `
  )
    .bind(cutoff)
    .run();

  return result.meta.changes ?? 0;
}

async function buildCleanupPreview(env: Env, now: string): Promise<MaintenanceCleanupPreview> {
  const notificationLogCutoff = subtractDays(now, NOTIFICATION_LOG_RETENTION_DAYS);
  const telegramMessageRefsCutoff = subtractDays(now, TELEGRAM_MESSAGE_REFS_RETENTION_DAYS);
  const [notificationLogCount, telegramMessageRefsCount] = await Promise.all([
    countRows(env, "notification_log", notificationLogCutoff),
    countRows(env, "telegram_message_refs", telegramMessageRefsCutoff)
  ]);

  return {
    notificationLog: {
      count: notificationLogCount,
      cutoff: notificationLogCutoff,
      retentionDays: NOTIFICATION_LOG_RETENTION_DAYS
    },
    telegramMessageRefs: {
      count: telegramMessageRefsCount,
      cutoff: telegramMessageRefsCutoff,
      retentionDays: TELEGRAM_MESSAGE_REFS_RETENTION_DAYS
    }
  };
}

export async function handleGetMaintenanceCleanupPreview(env: Env, user: AuthenticatedWebUser): Promise<Response> {
  if (!user.isAdmin) {
    return apiErrorResponse("forbidden", 403);
  }

  return jsonResponse({
    ok: true,
    preview: await buildCleanupPreview(env, new Date().toISOString())
  });
}

export async function handleRunMaintenanceCleanup(env: Env, user: AuthenticatedWebUser): Promise<Response> {
  if (!user.isAdmin) {
    return apiErrorResponse("forbidden", 403);
  }

  const now = new Date().toISOString();
  const preview = await buildCleanupPreview(env, now);
  const [notificationLogDeleted, telegramMessageRefsDeleted] = await Promise.all([
    deleteRows(env, "notification_log", preview.notificationLog.cutoff),
    deleteRows(env, "telegram_message_refs", preview.telegramMessageRefs.cutoff)
  ]);

  await recordAuditEvent(env, {
    actorUserId: user.id,
    action: "maintenance.cleanup",
    entityType: "maintenance",
    metadata: {
      source: "web",
      notificationLog: {
        cutoff: preview.notificationLog.cutoff,
        deleted: notificationLogDeleted,
        retentionDays: preview.notificationLog.retentionDays
      },
      telegramMessageRefs: {
        cutoff: preview.telegramMessageRefs.cutoff,
        deleted: telegramMessageRefsDeleted,
        retentionDays: preview.telegramMessageRefs.retentionDays
      }
    },
    now
  });

  return jsonResponse({
    ok: true,
    result: {
      notificationLog: {
        cutoff: preview.notificationLog.cutoff,
        deleted: notificationLogDeleted,
        retentionDays: preview.notificationLog.retentionDays
      },
      telegramMessageRefs: {
        cutoff: preview.telegramMessageRefs.cutoff,
        deleted: telegramMessageRefsDeleted,
        retentionDays: preview.telegramMessageRefs.retentionDays
      }
    }
  });
}
