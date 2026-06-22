# Task Scheduler에서 호출되는 wrapper.
# 매주 월요일 00:05에 weekly_report.py 실행 (지난 주 데이터).

$ErrorActionPreference = "Continue"
$scriptDir = $PSScriptRoot
$logFile = "C:\BLUE\Project\blue\SAAS\BluePad\docs\분석\.cron.log"

# GA4 ADC 인증 보장 (서비스계정 JSON fallback 방지)
Remove-Item Env:\GOOGLE_APPLICATION_CREDENTIALS -ErrorAction SilentlyContinue

# Python 자동 탐지
$pythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $pythonExe) {
    $pythonExe = "C:\Users\bluee\AppData\Local\Programs\Python\Python311\python.exe"
}

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Encoding utf8 -Value "[$ts] === Task Scheduler 트리거 ==="

try {
    & $pythonExe "$scriptDir\weekly_report.py" 2>&1 |
        ForEach-Object { Add-Content -Path $logFile -Encoding utf8 -Value $_ }
    $endTs = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Encoding utf8 -Value "[$endTs] === 완료 ==="
} catch {
    $errTs = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Encoding utf8 -Value "[$errTs] === 실패: $_ ==="
    exit 1
}
