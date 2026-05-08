#!/bin/bash
# BluePad 배포 자동화 스크립트
# 사용법: ./scripts/deploy.sh <version> "<release notes>"
# 예시:   ./scripts/deploy.sh 1.2.0 "PDF 내보내기, 성능 개선"

set -e

# ── 인자 확인 ──
VERSION="$1"
NOTES="$2"

if [ -z "$VERSION" ] || [ -z "$NOTES" ]; then
  echo "사용법: ./scripts/deploy.sh <version> \"<release notes>\""
  echo "예시:   ./scripts/deploy.sh 1.2.0 \"PDF 내보내기, 성능 개선\""
  exit 1
fi

# ── 환경변수 (실행 전 .env.deploy에서 로드하거나 셸에서 export) ──
if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  if [ -f "$HOME/.bluepad-deploy-env" ]; then
    source "$HOME/.bluepad-deploy-env"
  else
    echo "❌ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID 환경변수가 필요합니다."
    echo "   ~/.bluepad-deploy-env 파일을 생성하거나 export 후 실행하세요."
    exit 1
  fi
fi
SIGNING_KEY_PATH="${SIGNING_KEY_PATH:-C:/Users/bluee/.tauri/bluepad.key}"
SIGNING_KEY_PASSWORD="${SIGNING_KEY_PASSWORD:-!blue@129323#}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MSI_NAME="BluePad_${VERSION}_x64_en-US.msi"
R2_MSI_NAME="BluePad_${VERSION}_x64.msi"
MSI_PATH="${PROJECT_ROOT}/src-tauri/target/release/bundle/msi/${MSI_NAME}"
SIG_PATH="${MSI_PATH}.sig"
WORKER_BASE="https://bluepad-download.blueehdwp.workers.dev"

cd "$PROJECT_ROOT"

# ── 현재 버전 확인 ──
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' src-tauri/tauri.conf.json | head -1 | grep -o '[0-9][0-9.]*')
echo "📋 현재 버전: ${CURRENT_VERSION} → 새 버전: ${VERSION}"

if [ "$CURRENT_VERSION" = "$VERSION" ]; then
  echo "⚠️  동일 버전입니다. 버전을 올려주세요."
  exit 1
fi

# ── 1. 버전 변경 ──
echo ""
echo "🔄 [1/6] 버전 변경..."
sed -i "s/\"version\": \"${CURRENT_VERSION}\"/\"version\": \"${VERSION}\"/" src-tauri/tauri.conf.json
sed -i "s/\"version\": \"${CURRENT_VERSION}\"/\"version\": \"${VERSION}\"/" package.json
echo "   tauri.conf.json ✓"
echo "   package.json ✓"

# ── 2. BluePad 프로세스 확인 ──
if tasklist 2>/dev/null | grep -qi "bluepad.exe"; then
  echo ""
  echo "❌ BluePad가 실행 중입니다. 종료 후 다시 실행해주세요."
  exit 1
fi

# ── 3. 빌드 ──
echo ""
echo "🔨 [2/6] MSI 빌드 중... (수 분 소요)"
TAURI_SIGNING_PRIVATE_KEY="$(cat "$SIGNING_KEY_PATH")" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$SIGNING_KEY_PASSWORD" \
npm run tauri build -- --bundles msi 2>&1 | tail -5

if [ ! -f "$MSI_PATH" ] || [ ! -f "$SIG_PATH" ]; then
  echo "❌ 빌드 실패: MSI 또는 .sig 파일이 없습니다."
  exit 1
fi
echo "   ${MSI_NAME} ✓"
echo "   ${MSI_NAME}.sig ✓"

# ── 4. R2 업로드 ──
echo ""
echo "☁️  [3/6] R2 업로드..."
npx wrangler r2 object put "bluepad-downloads/${R2_MSI_NAME}" \
  --file="$MSI_PATH" --content-type="application/x-msi" --remote 2>&1 | tail -1

SIG_CONTENT=$(cat "$SIG_PATH")
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > /tmp/update.json << JSONEOF
{
  "version": "${VERSION}",
  "notes": "${NOTES}",
  "pub_date": "${PUB_DATE}",
  "platforms": {
    "windows-x86_64": {
      "signature": "${SIG_CONTENT}",
      "url": "${WORKER_BASE}/update/download/${R2_MSI_NAME}"
    }
  }
}
JSONEOF

npx wrangler r2 object put "bluepad-downloads/update.json" \
  --file=/tmp/update.json --content-type="application/json" --remote 2>&1 | tail -1
echo "   MSI ✓"
echo "   update.json ✓"

# ── 5. 랜딩 다운로드 URL 업데이트 ──
echo ""
echo "🌐 [4/6] 랜딩 다운로드 URL 업데이트..."
OLD_MSI="BluePad_${CURRENT_VERSION}_x64.msi"
NEW_MSI="BluePad_${VERSION}_x64.msi"
COUNT=$(grep -rl "$OLD_MSI" landing/ 2>/dev/null | wc -l)
find landing -name "*.html" -exec sed -i "s/${OLD_MSI}/${NEW_MSI}/g" {} +
echo "   ${COUNT}개 파일 업데이트 ✓"

# ── 6. 릴리즈 노트 자동 추가 ──
echo ""
echo "📝 [5/8] 릴리즈 노트 업데이트..."
CHANGELOG_FILE="${PROJECT_ROOT}/landing/changelog/index.html"
TODAY=$(date +"%Y-%m-%d")
NEW_RELEASE="<div class=\"release\">\n    <div class=\"release-header\">\n      <span class=\"version\">v${VERSION}<\/span>\n      <span class=\"tag tag-latest\">Latest<\/span>\n      <span class=\"date\">${TODAY}<\/span>\n    <\/div>\n    <h3>Changes<\/h3>\n    <ul>\n      <li>${NOTES}<\/li>\n    <\/ul>\n    <a href=\"${WORKER_BASE}\/download\/${R2_MSI_NAME}\" class=\"dl-btn\">Download v${VERSION}<\/a>\n  <\/div>\n\n  "
# 이전 Latest 태그 → Stable로 변경
sed -i 's/tag-latest">Latest/tag-stable">Stable/g' "$CHANGELOG_FILE"
# 새 릴리즈 블록 삽입 (첫 번째 release div 앞에)
sed -i "0,/<div class=\"release\">/{s/<div class=\"release\">/${NEW_RELEASE}<div class=\"release\">/}" "$CHANGELOG_FILE"
# 다운로드 버전 업데이트
sed -i "s/Download v${CURRENT_VERSION}/Download v${CURRENT_VERSION}/g" "$CHANGELOG_FILE"
echo "   changelog 업데이트 ✓"

# ── 7. 커밋 & 푸시 ──
echo ""
echo "📦 [6/8] 커밋 & 푸시..."
git add -A
git commit -m "v${VERSION} 배포: ${NOTES}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" 2>&1 | tail -1
git push 2>&1 | tail -1

# ── 8. 검증 ──
echo ""
echo "✅ [7/8] 검증..."
HTTP_CODE=$(curl -sI "${WORKER_BASE}/download/${R2_MSI_NAME}" | head -1 | awk '{print $2}')
UPDATE_VER=$(curl -s "${WORKER_BASE}/update.json" | grep -o '"version":"[^"]*"' | grep -o '[0-9][0-9.]*')

echo "   다운로드 HTTP: ${HTTP_CODE}"
echo "   update.json 버전: ${UPDATE_VER}"

# ── 9. IndexNow 제출 ──
echo ""
echo "🔍 [8/8] IndexNow 제출..."
INDEXNOW_KEY="52cbe3af562eb1c50d5dfb86fc922388"
INDEXNOW_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"host\":\"bluepad.work\",\"key\":\"${INDEXNOW_KEY}\",\"keyLocation\":\"https://bluepad.work/${INDEXNOW_KEY}.txt\",\"urlList\":[\"https://bluepad.work/changelog/\",\"https://bluepad.work/ko/\",\"https://bluepad.work/en/\",\"https://bluepad.work/ja/\"]}")
echo "   IndexNow: ${INDEXNOW_CODE}"

if [ "$HTTP_CODE" = "200" ] && [ "$UPDATE_VER" = "$VERSION" ]; then
  # GitHub Release 생성
  echo ""
  echo "🏷️  GitHub Release 생성..."
  gh release create "v${VERSION}" \
    --title "v${VERSION}" \
    --notes "${NOTES}" \
    --latest 2>&1 | tail -1 || echo "   (gh CLI 없거나 실패 — 수동 생성 필요)"

  echo ""
  echo "🎉 v${VERSION} 배포 완료!"
  echo "   다운로드: ${WORKER_BASE}/download/${R2_MSI_NAME}"
  echo "   업데이트: ${WORKER_BASE}/update.json"
  echo "   릴리즈 노트: https://bluepad.work/changelog/"
  echo "   GitHub: https://github.com/BlueDeveloper/BluePad/releases/tag/v${VERSION}"
else
  echo ""
  echo "⚠️  검증 실패. 수동으로 확인해주세요."
fi
