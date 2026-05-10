-- 2026-05-10: webhook_events 테이블 분리 + payments에 customer_id 추가
-- error_logs에 정상 audit 이벤트가 섞이는 문제 해결, API key 만료 대비 customer_id 보관

CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  summary TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_severity ON webhook_events(severity);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at DESC);

ALTER TABLE payments ADD COLUMN paddle_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_payments_paddle_customer ON payments(paddle_customer_id);
