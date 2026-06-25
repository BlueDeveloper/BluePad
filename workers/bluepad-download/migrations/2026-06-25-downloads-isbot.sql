-- downloads 테이블에 사람/봇 구분 컬럼 추가 (2026-06-25)
-- 기존 행은 전부 사람(과거엔 봇을 INSERT 안 했으므로) → is_bot 기본 0 유지.
ALTER TABLE downloads ADD COLUMN is_bot INTEGER DEFAULT 0;
ALTER TABLE downloads ADD COLUMN bot_reason TEXT;
