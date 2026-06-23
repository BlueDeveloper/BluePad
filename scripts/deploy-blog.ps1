# BluePad 블로그 자동 배포 (호스트 측 실행 — Windows 작업 스케줄러용)
# Claude 스케줄 작업(bluepad-blog-post)이 landing/ 에 글을 써두면,
# 이 스크립트가 호스트에서 커밋+푸시한다. (샌드박스는 git 불가 → 호스트가 배포 담당)
$ErrorActionPreference = 'Stop'
Set-Location 'C:\BLUE\Project\blue\SAAS\BluePad'

# 샌드박스가 남긴 스테일 락 제거 (호스트는 삭제 가능)
Remove-Item .git\*.lock -Force -ErrorAction SilentlyContinue
Remove-Item .git\next-index-*.lock -Force -ErrorAction SilentlyContinue

# 블로그 관련 변경만 스테이징 (src-tauri 등 무관 변경 제외)
git add landing/en/blog landing/sitemap.xml

$staged = git diff --cached --name-only
if (-not $staged) { Write-Host "[deploy-blog] 배포할 블로그 변경 없음."; exit 0 }

Write-Host "[deploy-blog] 스테이징됨:`n$staged"
git commit -m ("blog: auto-publish {0}" -f (Get-Date -Format 'yyyy-MM-dd'))
git push
Write-Host "[deploy-blog] 푸시 완료 — Cloudflare Pages 자동 배포 시작."
