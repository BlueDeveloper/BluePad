-- 2026-05-10: payments 테이블 재구성
-- 1) paypal_order_id NOT NULL 제거 — Paddle 결제 시 INSERT 실패 방지 (CRITICAL)
-- 2) paddle_txn_id UNIQUE 추가 — 동시 webhook 시 중복 결제 INSERT race 방지
-- 3) status / created_at 검색 인덱스 추가 — 관리자 대시보드 성능
-- 데이터 0건 시점에서 안전하게 DROP+CREATE

DROP TABLE IF EXISTS payments;

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paypal_order_id TEXT UNIQUE,
  paddle_txn_id TEXT UNIQUE,
  paddle_customer_id TEXT,
  license_key TEXT,
  email TEXT,
  amount TEXT,
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'captured',
  refunded INTEGER DEFAULT 0,
  refunded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_payments_paddle_customer ON payments(paddle_customer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at DESC);
