CREATE INDEX IF NOT EXISTS idx_notification_log_created_at
  ON notification_log (created_at);

CREATE INDEX IF NOT EXISTS idx_telegram_message_refs_created_at
  ON telegram_message_refs (created_at);
