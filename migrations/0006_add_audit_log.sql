CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  actor_user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_log_entity
  ON audit_log (entity_type, entity_id, created_at);

CREATE INDEX idx_audit_log_actor_user_id
  ON audit_log (actor_user_id);

CREATE INDEX idx_audit_log_created_at
  ON audit_log (created_at);

CREATE INDEX idx_audit_log_action
  ON audit_log (action);
