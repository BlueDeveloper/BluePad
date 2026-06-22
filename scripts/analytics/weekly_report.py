"""
bluepad.work 주간 통계 리포트 자동 생성기.
(Archive scripts/analytics/weekly_report.py 이식 — BluePad 측정기반용)

사용:
  python weekly_report.py                  # 기본: 지난 주 (월~일)
  python weekly_report.py --week 2026-W25  # 특정 ISO 주차
  python weekly_report.py --dry-run        # 파일 저장 없이 stdout 출력
  python weekly_report.py --skip-clarity   # Clarity 호출 건너뜀
  python weekly_report.py --skip-gsc       # Search Console 호출 건너뜀

데이터 소스:
  - Cloudflare Zone Analytics (GraphQL)        : secrets/cloudflare-token.txt
  - GA4 Data API (ADC 인증, Archive와 동일 계정) : 측정 G-3PRY6YKV05 / 속성 542487056
  - Google Search Console API (ADC, webmasters.readonly) : sc-domain:bluepad.work
  - Microsoft Clarity API (최근 3일, 토큰 있으면) : secrets/clarity-token.txt

출력:
  C:\\BLUE\\Project\\blue\\SAAS\\BluePad\\docs\\분석\\YYYY-Www.md
"""

import argparse
import datetime
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

# ─────────────────────────────────────────────────────────────
# 설정
# ─────────────────────────────────────────────────────────────

SECRETS_DIR = Path("C:/Users/bluee/.claude/projects/C--BLUE-Project-blue/secrets")
ANALYTICS_DIR = Path("C:/BLUE/Project/blue/SAAS/BluePad/docs/분석")
LOG_FILE = ANALYTICS_DIR / ".cron.log"

CLOUDFLARE_ZONE_ID = "027e709c72befdd4cd39c8ede1a9df8a"   # bluepad.work
CLOUDFLARE_TOKEN_FILE = SECRETS_DIR / "cloudflare-token.txt"
GA4_PROPERTY_ID = "542487056"                              # bluepad.work GA4 속성
GSC_SITE_URL = "sc-domain:bluepad.work"                    # 도메인 속성
CLARITY_TOKEN_FILE = SECRETS_DIR / "clarity-token.txt"


def _load_cloudflare_token():
    try:
        return CLOUDFLARE_TOKEN_FILE.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return os.environ.get("CLOUDFLARE_API_TOKEN", "")


CLOUDFLARE_API_TOKEN = _load_cloudflare_token()
ANTHROPIC_KEY_FILE = SECRETS_DIR / "anthropic-key.txt"
ANTHROPIC_MODEL = "claude-sonnet-4-5"  # 비용 효율 + 자연어 분석

# 인사이트 룰 임계치
INSIGHT_THRESHOLDS = {
    "pv_uv_up_pct": 5.0,
    "focus_page_pv_share": 0.15,
    "threats_change_pct": 0.5,
    "weekday_anomaly_drop_pct": 0.5,
}

# ─────────────────────────────────────────────────────────────
# 로그
# ─────────────────────────────────────────────────────────────

def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, file=sys.stderr)
    try:
        ANALYTICS_DIR.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

# ─────────────────────────────────────────────────────────────
# 날짜 / 주차 계산
# ─────────────────────────────────────────────────────────────

def get_week_range(week_arg=None):
    if week_arg:
        year, w = week_arg.split("-W")
        monday = datetime.date.fromisocalendar(int(year), int(w), 1)
    else:
        today = datetime.date.today()
        monday = today - datetime.timedelta(days=today.weekday() + 7)
    return monday, monday + datetime.timedelta(days=6)

def iso_week_str(monday):
    iso = monday.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"

# ─────────────────────────────────────────────────────────────
# Cloudflare GraphQL
# ─────────────────────────────────────────────────────────────

def fetch_cloudflare(start_date, end_date):
    query = """
    query($zone: String!, $since: String!, $until: String!) {
      viewer { zones(filter: {zoneTag: $zone}) {
        httpRequests1dGroups(
          limit: 31,
          filter: {date_geq: $since, date_leq: $until},
          orderBy: [date_ASC]
        ) {
          dimensions { date }
          sum { requests pageViews bytes threats cachedRequests cachedBytes }
          uniq { uniques }
        }
      } }
    }
    """
    body = json.dumps({
        "query": query,
        "variables": {
            "zone": CLOUDFLARE_ZONE_ID,
            "since": start_date.strftime("%Y-%m-%d"),
            "until": end_date.strftime("%Y-%m-%d"),
        }
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/graphql",
        data=body,
        headers={
            "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
        return data["data"]["viewer"]["zones"][0]["httpRequests1dGroups"]
    except Exception as e:
        log(f"[ERR] Cloudflare fetch 실패: {e}")
        return []

# ─────────────────────────────────────────────────────────────
# GA4 Data API
# ─────────────────────────────────────────────────────────────

def fetch_ga4_batch(start_date, end_date, dimensions_list, metrics=None):
    os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import (
            DateRange, Metric, Dimension, RunReportRequest, BatchRunReportsRequest
        )
    except ImportError:
        log("[ERR] google-analytics-data 패키지 없음 — pip install google-analytics-data")
        return None

    if metrics is None:
        metrics = ["activeUsers", "screenPageViews", "sessions", "averageSessionDuration"]

    try:
        client = BetaAnalyticsDataClient()
        requests_arr = [
            RunReportRequest(
                property=f"properties/{GA4_PROPERTY_ID}",
                date_ranges=[DateRange(
                    start_date=start_date.strftime("%Y-%m-%d"),
                    end_date=end_date.strftime("%Y-%m-%d"),
                )],
                dimensions=[Dimension(name=d) for d in dims],
                metrics=[Metric(name=m) for m in metrics],
                limit=100,
            ) for dims in dimensions_list
        ]
        batch_resp = client.batch_run_reports(BatchRunReportsRequest(
            property=f"properties/{GA4_PROPERTY_ID}",
            requests=requests_arr,
        ))
        all_results = []
        for resp, dims in zip(batch_resp.reports, dimensions_list):
            rows = []
            for row in resp.rows:
                r = {}
                for i, d in enumerate(dims):
                    r[d] = row.dimension_values[i].value
                for i, m in enumerate(metrics):
                    v = row.metric_values[i].value
                    try:
                        r[m] = float(v) if "." in v or m == "averageSessionDuration" else int(v)
                    except ValueError:
                        r[m] = v
                rows.append(r)
            all_results.append(rows)
        return all_results
    except Exception as e:
        log(f"[ERR] GA4 batch fetch 실패: {e}")
        return None


def fetch_ga4_events(start_date, end_date):
    """전환 측정용 — 이벤트 이름별 카운트 (file_download, purchase 등)."""
    res = fetch_ga4_batch(start_date, end_date, [["eventName"]], metrics=["eventCount"])
    if not res:
        return None
    rows = res[0]
    rows.sort(key=lambda x: x.get("eventCount", 0), reverse=True)
    return rows

# ─────────────────────────────────────────────────────────────
# Google Search Console API (검색어)
# ─────────────────────────────────────────────────────────────

def fetch_gsc(start_date, end_date, row_limit=15):
    """상위 검색어 (clicks, impressions, ctr, position). ADC + webmasters.readonly."""
    os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
    try:
        import google.auth
        from google.auth.transport.requests import Request as GAuthRequest
    except ImportError:
        log("[ERR] google-auth 패키지 없음")
        return None
    try:
        creds, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
        )
        creds.refresh(GAuthRequest())
        token = creds.token
    except Exception as e:
        log(f"[ERR] GSC 인증 실패(ADC에 webmasters.readonly scope 필요): {e}")
        return None

    site_enc = urllib.parse.quote(GSC_SITE_URL, safe="")
    url = f"https://searchconsole.googleapis.com/webmasters/v3/sites/{site_enc}/searchAnalytics/query"
    body = json.dumps({
        "startDate": start_date.strftime("%Y-%m-%d"),
        "endDate": end_date.strftime("%Y-%m-%d"),
        "dimensions": ["query"],
        "rowLimit": row_limit,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
        return data.get("rows", [])
    except Exception as e:
        log(f"[ERR] GSC fetch 실패: {e}")
        return None

# ─────────────────────────────────────────────────────────────
# Microsoft Clarity API
# ─────────────────────────────────────────────────────────────

def fetch_clarity(num_days=3):
    try:
        token = CLARITY_TOKEN_FILE.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        log("[INFO] Clarity 토큰 없음 — 건너뜀")
        return None
    url = (
        "https://www.clarity.ms/export-data/api/v1/project-live-insights"
        f"?numOfDays={num_days}&dimension1=Device&dimension2=URL"
    )
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read())
    except Exception as e:
        log(f"[ERR] Clarity fetch 실패: {e}")
        return None

# ─────────────────────────────────────────────────────────────
# 집계
# ─────────────────────────────────────────────────────────────

def aggregate_cloudflare(rows):
    out = {"pv": 0, "uv": 0, "req": 0, "bytes": 0, "threats": 0, "cached": 0, "by_day": []}
    for r in rows:
        d = r["dimensions"]["date"]
        pv = r["sum"]["pageViews"]; uv = r["uniq"]["uniques"]; req = r["sum"]["requests"]
        threats = r["sum"]["threats"]; cached = r["sum"]["cachedRequests"]
        out["pv"] += pv; out["uv"] += uv; out["req"] += req
        out["bytes"] += r["sum"]["bytes"]; out["threats"] += threats; out["cached"] += cached
        out["by_day"].append({"date": d, "pv": pv, "uv": uv, "req": req, "threats": threats})
    return out

# ─────────────────────────────────────────────────────────────
# LLM 인사이트
# ─────────────────────────────────────────────────────────────

WEEKDAY_KR = ["월", "화", "수", "목", "금", "토", "일"]

def generate_llm_insights(monday, sunday, this_cf, prev_cf, ga4_pages, ga4_devices,
                          ga4_channels, ga4_events, gsc_rows, clarity, four_week_history):
    try:
        import anthropic
    except ImportError:
        log("[ERR] anthropic SDK 없음 — pip install anthropic")
        return None
    try:
        key = ANTHROPIC_KEY_FILE.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        log("[ERR] anthropic 키 파일 없음")
        return None

    parts = [f"## 기간: {monday} ~ {sunday} (월~일)\n"]
    if prev_cf:
        def pct(a, b):
            return (a - b) / b * 100 if b else 0
        parts.append(
            "## 트래픽 (Cloudflare)\n"
            f"- PV: {this_cf['pv']} (전주 {prev_cf['pv']}, {pct(this_cf['pv'], prev_cf['pv']):+.1f}%)\n"
            f"- UV: {this_cf['uv']} (전주 {prev_cf['uv']}, {pct(this_cf['uv'], prev_cf['uv']):+.1f}%)\n"
            f"- 위협 차단: {this_cf['threats']} (전주 {prev_cf['threats']}, {pct(this_cf['threats'], prev_cf['threats']):+.1f}%)\n"
        )
    if this_cf["by_day"]:
        parts.append("## 요일별")
        for d in this_cf["by_day"]:
            wd = WEEKDAY_KR[datetime.date.fromisoformat(d["date"]).weekday()]
            parts.append(f"- {wd} {d['date']}: PV {d['pv']}, UV {d['uv']}, 위협 {d['threats']}")
        parts.append("")
    if ga4_pages:
        total_users = sum(p.get("activeUsers", 0) for p in ga4_pages)
        total_pv = sum(p.get("screenPageViews", 0) for p in ga4_pages)
        parts.append(f"## GA4\n- 활성 사용자: {total_users}\n- PV: {total_pv}\n")
        parts.append("### 인기 페이지 Top 10")
        for i, p in enumerate(ga4_pages[:10], 1):
            parts.append(f"{i}. `{p.get('pagePath','?')}` — 사용자 {p.get('activeUsers',0)}, "
                         f"PV {p.get('screenPageViews',0)}, 체류 {p.get('averageSessionDuration',0):.0f}초")
        parts.append("")
    if ga4_channels:
        parts.append("## 유입 채널 Top 8")
        for c in ga4_channels[:8]:
            parts.append(f"- {c.get('sessionDefaultChannelGroup','?')} / {c.get('sessionSource','?')}: "
                         f"세션 {c.get('sessions',0)}")
        parts.append("")
    if ga4_events:
        parts.append("## 전환·이벤트 (GA4 eventCount)")
        for e in ga4_events[:12]:
            parts.append(f"- {e.get('eventName','?')}: {e.get('eventCount',0)}")
        parts.append("")
    if gsc_rows:
        parts.append("## 검색어 Top (Search Console)")
        for r in gsc_rows[:15]:
            q = (r.get("keys") or ["?"])[0]
            parts.append(f"- \"{q}\": 클릭 {r.get('clicks',0):.0f}, 노출 {r.get('impressions',0):.0f}, "
                         f"CTR {r.get('ctr',0)*100:.1f}%, 평균순위 {r.get('position',0):.1f}")
        parts.append("")
    if four_week_history:
        parts.append("## 4주 추세")
        for h in four_week_history:
            parts.append(f"- {h['week']}: PV {h['pv']}, UV {h['uv']}, 위협 {h['threats']}")
        parts.append("")

    data_text = "\n".join(parts)

    prompt = f"""당신은 1인 개발자가 운영하는 BluePad(bluepad.work)의 주간 통계 리포트 작성 담당입니다.
BluePad는 Tauri 기반 경량 마크다운 에디터(Typora 대안)이며, Windows/Linux용 일회성 결제 Pro($10.99 USD, 구독 아님) + 14일 체험 모델입니다.
랜딩은 한국어/영어/일본어 3개 언어이고, SEO 자연 유입 → 다운로드 → Pro 구매가 핵심 깔때기입니다.
핵심 전환 이벤트는 file_download(다운로드), purchase(구매)입니다.

아래는 지난 한 주의 실측 데이터입니다.

{data_text}

이 데이터를 바탕으로 아래 구조를 markdown으로 작성하세요.

# 작성 규칙
- 직설적, 간결, 한국어. 비유 남발 금지(정말 효과적인 1~2개만).
- 데이터 표는 만들지 마세요(표는 별도 자동 생성).
- 숫자 나열보다 의미 해석. 다음 주 액션이 보이는 인사이트가 좋은 인사이트.
- 요일 언급 시 날짜 병기. 예: "화요일(6/24)".
- 약어는 매번 `약어(풀어쓰기)`로. 예: "PV(조회수)", "UV(고유 방문자)".
- 빈 줄로 자주 끊기(한 문단 2~3문장).
- 물결(~)·dash 두 개 연속 금지. 범위는 "월요일에서 수요일"처럼 글자로.
- **전환 깔때기 점검을 반드시 1개 인사이트로**: 다운로드(file_download) 발생량, 그리고 (있으면) 구매(purchase)와의 비율. 유입은 있는데 다운로드가 0이면 깔때기 막힌 것으로 해석.
- **검색어(Search Console) 데이터가 있으면 1개 인사이트로**: 어떤 검색어가 유입을 만드는지, 노출 대비 클릭(CTR)이 낮은 키워드는 제목/메타 개선 기회로.

# 출력 형식 (이 구조 그대로)

## 🎯 이번 주 한 줄

(가장 중요한 의미 한 줄. 1~2문장.)

## 🔥 이번 주 인사이트

### 1. (제목)

(본문 1~2문단. "무슨 일이 / 의미 / 다음 액션" 흐름.)

### 2. (...)

### 3. (...)

(인사이트 3~5개. 진짜 의미 있는 패턴만.)

## 🚨 다음 주 액션

- 🔴/🟡/🟢 (액션) — 한 줄 이유

(액션 2~4개. 없으면 "이번 주는 알람 없음.")
"""
    try:
        client = anthropic.Anthropic(api_key=key)
        msg = client.messages.create(model=ANTHROPIC_MODEL, max_tokens=3000,
                                     messages=[{"role": "user", "content": prompt}])
        text = msg.content[0].text
        log(f"LLM 인사이트 생성 완료 ({len(text)} chars)")
        return text
    except Exception as e:
        log(f"[ERR] Claude API 실패: {e}")
        return None

# ─────────────────────────────────────────────────────────────
# Markdown 생성
# ─────────────────────────────────────────────────────────────

def build_markdown(monday, sunday, this_cf, prev_cf, ga4_pages, ga4_channels,
                   ga4_events, gsc_rows, clarity, four_week_history, llm_insights=None):
    iso_w = iso_week_str(monday)
    today = datetime.date.today().strftime("%Y-%m-%d")
    md = [f"# BluePad(bluepad.work) 주간 통계 ({iso_w}: {monday} ~ {sunday})\n"]
    md.append(f"> 자동 생성 · {today} · GA4 G-3PRY6YKV05\n")

    if llm_insights:
        md.append(llm_insights); md.append("")
    else:
        pv_str = ""
        if prev_cf and prev_cf["pv"]:
            pv_str = f"PV {(this_cf['pv']-prev_cf['pv'])/prev_cf['pv']*100:+.1f}%"
        md.append(f"## 🎯 이번 주 한 줄\n\nPV {this_cf['pv']}, UV {this_cf['uv']}. {pv_str}\n")

    md.append("## 📊 핵심 지표\n")
    md.append("| 지표 | 이번 주 | 전주 | 변화 |")
    md.append("|---|---|---|---|")
    def cmp_row(name, cur, prev, fmt="{}"):
        if prev:
            diff = (cur - prev) / prev * 100 if prev else 0
            arrow = "▲" if cur > prev else ("▼" if cur < prev else "─")
            return f"| {name} | {fmt.format(cur)} | {fmt.format(prev)} | {arrow} {diff:+.1f}% |"
        return f"| {name} | {fmt.format(cur)} | — | — |"
    md.append(cmp_row("PV", this_cf["pv"], prev_cf["pv"] if prev_cf else None))
    md.append(cmp_row("UV", this_cf["uv"], prev_cf["uv"] if prev_cf else None))
    md.append(cmp_row("요청", this_cf["req"], prev_cf["req"] if prev_cf else None))
    md.append(cmp_row("위협 차단", this_cf["threats"], prev_cf["threats"] if prev_cf else None))
    md.append("")

    md.append("## 📅 한 주 흐름\n")
    if this_cf["by_day"]:
        md.append("| 요일 | 날짜 | PV | UV | 위협 |")
        md.append("|---|---|---|---|---|")
        for day in this_cf["by_day"]:
            d = datetime.date.fromisoformat(day["date"])
            md.append(f"| {WEEKDAY_KR[d.weekday()]} | {day['date']} | {day['pv']} | {day['uv']} | {day['threats']} |")
        md.append("")

    if ga4_pages:
        md.append("## 🏆 인기 페이지 Top 10 (GA4)\n")
        md.append("| # | 페이지 | 사용자 | PV | 평균 체류 |")
        md.append("|---|---|---|---|---|")
        for i, p in enumerate(ga4_pages[:10], 1):
            md.append(f"| {i} | `{p.get('pagePath','?')}` | {p.get('activeUsers',0)} | "
                      f"{p.get('screenPageViews',0)} | {p.get('averageSessionDuration',0):.0f}초 |")
        md.append("")

    if ga4_events:
        md.append("## 🎯 전환·이벤트 (GA4)\n")
        md.append("| 이벤트 | 횟수 |")
        md.append("|---|---|")
        for e in ga4_events[:12]:
            md.append(f"| {e.get('eventName','?')} | {e.get('eventCount',0)} |")
        md.append("")

    if ga4_channels:
        md.append("## 🚪 유입 채널 (GA4)\n")
        md.append("| 채널 | Source | 세션 |")
        md.append("|---|---|---|")
        for c in ga4_channels[:8]:
            md.append(f"| {c.get('sessionDefaultChannelGroup','?')} | {c.get('sessionSource','?')} | {c.get('sessions',0)} |")
        md.append("")

    if gsc_rows:
        md.append("## 🔎 검색어 Top (Search Console)\n")
        md.append("| 검색어 | 클릭 | 노출 | CTR | 평균순위 |")
        md.append("|---|---|---|---|---|")
        for r in gsc_rows[:15]:
            q = (r.get("keys") or ["?"])[0]
            md.append(f"| {q} | {r.get('clicks',0):.0f} | {r.get('impressions',0):.0f} | "
                      f"{r.get('ctr',0)*100:.1f}% | {r.get('position',0):.1f} |")
        md.append("")

    if four_week_history:
        md.append("## 📈 4주 추세\n```")
        md.append(f"{'주차':<8} {'PV':>6} {'UV':>6} {'위협':>6}")
        for h in four_week_history:
            md.append(f"{h['week']:<8} {h['pv']:>6} {h['uv']:>6} {h['threats']:>6}")
        md.append("```\n")

    md.append("\n---\n*다음 리포트: 매주 월요일 자동 생성*\n")
    return "\n".join(md)

# ─────────────────────────────────────────────────────────────
# 메인
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--week", help="ISO 주차 (예: 2026-W25). 없으면 지난 주.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-clarity", action="store_true")
    parser.add_argument("--skip-gsc", action="store_true")
    args = parser.parse_args()

    monday, sunday = get_week_range(args.week)
    iso_w = iso_week_str(monday)
    log(f"=== 주간 리포트 시작: {iso_w} ({monday} ~ {sunday}) ===")

    cf_this = fetch_cloudflare(monday, sunday)
    this_cf = aggregate_cloudflare(cf_this)
    log(f"Cloudflare: PV={this_cf['pv']}, UV={this_cf['uv']}, 위협={this_cf['threats']}")

    prev_mon = monday - datetime.timedelta(days=7)
    cf_prev = fetch_cloudflare(prev_mon, prev_mon + datetime.timedelta(days=6))
    prev_cf = aggregate_cloudflare(cf_prev) if cf_prev else None

    ga4_batch = fetch_ga4_batch(monday, sunday, [
        ["pagePath"],
        ["sessionDefaultChannelGroup", "sessionSource"],
    ])
    if ga4_batch:
        ga4_pages, ga4_channels = ga4_batch
    else:
        ga4_pages = ga4_channels = None
    if ga4_pages:
        ga4_pages.sort(key=lambda x: x.get("screenPageViews", 0), reverse=True)
    if ga4_channels:
        ga4_channels.sort(key=lambda x: x.get("sessions", 0), reverse=True)

    ga4_events = fetch_ga4_events(monday, sunday)
    gsc_rows = None if args.skip_gsc else fetch_gsc(monday, sunday)
    clarity = None if args.skip_clarity else fetch_clarity(3)

    four_week_history = []
    for i in range(3, -1, -1):
        target_mon = monday - datetime.timedelta(days=7 * i)
        target_iso = iso_week_str(target_mon)
        if target_iso == iso_w:
            four_week_history.append({"week": iso_w, "pv": this_cf["pv"], "uv": this_cf["uv"], "threats": this_cf["threats"]})
        else:
            cf_t = fetch_cloudflare(target_mon, target_mon + datetime.timedelta(days=6))
            agg_t = aggregate_cloudflare(cf_t)
            four_week_history.append({"week": target_iso, "pv": agg_t["pv"], "uv": agg_t["uv"], "threats": agg_t["threats"]})

    llm_insights = generate_llm_insights(monday, sunday, this_cf, prev_cf, ga4_pages,
                                         None, ga4_channels, ga4_events, gsc_rows, clarity,
                                         four_week_history)

    md = build_markdown(monday, sunday, this_cf, prev_cf, ga4_pages, ga4_channels,
                        ga4_events, gsc_rows, clarity, four_week_history, llm_insights=llm_insights)

    if args.dry_run:
        print(md)
        log("dry-run 완료")
    else:
        ANALYTICS_DIR.mkdir(parents=True, exist_ok=True)
        out_path = ANALYTICS_DIR / f"{iso_w}.md"
        out_path.write_text(md, encoding="utf-8")
        log(f"저장 완료: {out_path}")
        print(f"OK: {out_path}")

if __name__ == "__main__":
    main()
