#!/bin/bash
# BluePad D1 백업 스크립트
# 사용법: ./scripts/backup-d1.sh

set -e

if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  if [ -f "$HOME/.bluepad-deploy-env" ]; then
    source "$HOME/.bluepad-deploy-env"
  else
    echo "❌ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID 필요"
    exit 1
  fi
fi

BACKUP_DIR="$HOME/.bluepad-backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/bluepad-d1-${TIMESTAMP}.sql"

echo "📦 D1 백업 시작..."
npx wrangler d1 export bluepad-licenses --remote --output="$BACKUP_FILE" 2>&1 | tail -3

if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
  echo "✅ 백업 완료: ${BACKUP_FILE} (${SIZE})"

  # 30일 이상 된 백업 삭제
  find "$BACKUP_DIR" -name "bluepad-d1-*.sql" -mtime +30 -delete 2>/dev/null
  echo "   30일 이상 된 백업 정리 완료"
else
  echo "❌ 백업 실패"
fi
