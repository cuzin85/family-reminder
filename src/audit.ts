import type { Env } from "./env";

export type AuditAction =
  | "task.created"
  | "task.updated"
  | "task.completed"
  | "task.missed"
  | "task.snoozed"
  | "task.cancelled"
  | "task.deleted"
  | "user.added"
  | "user.deactivated"
  | "export.created"
  | "maintenance.cleanup";

export type AuditEntityType = "task" | "user" | "export" | "maintenance";

interface AuditEventInput {
  actorUserId: number;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: number | null;
  metadata?: Record<string, unknown>;
  now: string;
}

export async function recordAuditEvent(env: Env, input: AuditEventInput): Promise<void> {
  try {
    await env.DB.prepare(
      `
        INSERT INTO audit_log (
          actor_user_id,
          action,
          entity_type,
          entity_id,
          metadata_json,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        input.actorUserId,
        input.action,
        input.entityType,
        input.entityId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.now
      )
      .run();
  } catch (error) {
    console.error("Failed to record audit event", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      error
    });
  }
}
