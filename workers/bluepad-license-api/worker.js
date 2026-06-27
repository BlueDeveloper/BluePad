// BluePad License API Worker
// 라이선스 검증, 트라이얼, 관리자 기능, 환불 프로세스

// ── Rate Limiting (in-memory, worker 재시작 시 초기화됨) ──
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1분
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap) {
    const filtered = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (filtered.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, filtered);
  }
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

// ── Auth ──
async function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  // 길이 차이도 상수 시간으로 처리
  const maxLen = Math.max(aBuf.length, bBuf.length, 1);
  const padA = new Uint8Array(maxLen);
  const padB = new Uint8Array(maxLen);
  padA.set(aBuf);
  padB.set(bBuf);
  const key = await crypto.subtle.importKey("raw", padA, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig1 = new Uint8Array(await crypto.subtle.sign("HMAC", key, padA));
  const sig2 = new Uint8Array(await crypto.subtle.sign("HMAC", key, padB));
  let result = aBuf.length === bBuf.length ? 1 : 0;
  for (let i = 0; i < sig1.length; i++) result &= sig1[i] === sig2[i] ? 1 : 0;
  return result === 1;
}

// ── CORS ──
// Origin 화이트리스트 외에는 ACAO 헤더를 발급하지 않음.
// 서버-서버 호출(Origin 없음) 케이스도 보안상 ACAO 미발급 (브라우저만 CORS 검사하므로 차단 영향 없음).
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");
  let allowOrigin = "";
  if (origin && (
    /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
    /^https:\/\/bluepad\.work$/.test(origin) ||
    /^https:\/\/www\.bluepad\.work$/.test(origin) ||
    /^https?:\/\/tauri\.localhost$/.test(origin) ||
    /^tauri:\/\/localhost$/.test(origin) ||
    /^wry:\/\/localhost$/.test(origin)
  )) {
    allowOrigin = origin;
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Environment",
    "Vary": "Origin",
  };
}

function json(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
  });
}

// ── 문의 알림 메일 (Resend, 무도메인) ──
// MailChannels 무료 API 종료(2024)로 401 → Resend로 교체(2026-06-27). web3forms는 무료플랜이 서버사이드 호출
// 차단(403, Pro 필요)이라 부적합. Resend는 도메인 미인증이어도 발신 onboarding@resend.dev → '내 계정 메일'로는
// 발송 가능 → 알림 대상이 관리자 본인 메일이라 DNS 불필요. replyto에 문의자 메일을 넣어 관리자가 Gmail "답장"으로 회신.
// 키 없으면 ok:false(호출부에서 error_logs 기록, 티켓은 이미 저장됨).
async function notifyEmail(env, { subject, message, replyto, to = "blueehdwp@gmail.com" }) {
  if (!env.RESEND_API_KEY) return { ok: false, status: 0, error: "RESEND_API_KEY_missing" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "BluePad Support <onboarding@resend.dev>",
        to: [to],
        subject,
        text: message,
        ...(replyto ? { reply_to: replyto } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: body.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: String(e).slice(0, 200) };
  }
}

// ── License Key ──
// 환경별 키 접두사 — Live: "BP-", Sandbox: "BPSB-"
function generateKey(environment = "live") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const result = [];
  const randomValues = new Uint32Array(16);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 16; i++) {
    result.push(chars[randomValues[i] % chars.length]);
  }
  const segments = [];
  for (let s = 0; s < 4; s++) {
    segments.push(result.slice(s * 4, s * 4 + 4).join(""));
  }
  const prefix = environment === "sandbox" ? "BPSB-" : "BP-";
  return prefix + segments.join("-");
}

const LICENSE_KEY_REGEX = /^(BP|BPSB)-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
function validateLicenseKey(key) { return typeof key === "string" && LICENSE_KEY_REGEX.test(key); }
function envOfKey(key) { return typeof key === "string" && key.startsWith("BPSB-") ? "sandbox" : "live"; }
function validateDeviceId(id) { return typeof id === "string" && id.length > 0 && id.length <= 100; }
function validateDeviceName(name) { return name === undefined || name === null || (typeof name === "string" && name.length <= 200); }

function validateContentType(request) {
  const ct = (request.headers.get("Content-Type") || "").toLowerCase();
  return ct.startsWith("application/json");
}

// ── Admin Auth Helper ──
async function checkAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  return timingSafeEqual(auth, "Bearer " + env.ADMIN_SECRET);
}

// ── Main Handler ──
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: getCorsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "POST" && !validateContentType(request)) {
      return json({ error: "invalid_content_type" }, 415, request);
    }

    try {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 라이선스 검증 (앱에서 호출)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/validate" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        if (!checkRateLimit(ip)) return json({ valid: false, error: "rate_limited" }, 429, request);

        const { license_key, device_id, device_name } = await request.json();
        if (!license_key || !device_id) return json({ valid: false, error: "missing_fields" }, 400, request);
        if (!validateLicenseKey(license_key)) return json({ valid: false, error: "invalid_format" }, 400, request);
        if (!validateDeviceId(device_id)) return json({ valid: false, error: "invalid_device_id" }, 400, request);
        if (!validateDeviceName(device_name)) return json({ valid: false, error: "invalid_device_name" }, 400, request);

        const license = await env.DB.prepare(
          "SELECT * FROM licenses WHERE license_key = ? AND active = 1 AND COALESCE(refunded, 0) = 0"
        ).bind(license_key).first();
        if (!license) return json({ valid: false, error: "invalid_key" }, 403, request);

        const activations = await env.DB.prepare(
          "SELECT * FROM activations WHERE license_key = ?"
        ).bind(license_key).all();
        const existing = activations.results.find((a) => a.device_id === device_id);

        if (existing) {
          await env.DB.prepare(
            "UPDATE activations SET last_seen = datetime('now') WHERE license_key = ? AND device_id = ?"
          ).bind(license_key, device_id).run();
          return json({ valid: true, pro: true }, 200, request);
        }

        // Atomic INSERT with COUNT subquery — TOCTOU 방어
        // 동시 활성화로 max_devices 초과되는 race 차단 (단일 SQL에서 COUNT+INSERT 원자적)
        const insertRes = await env.DB.prepare(
          `INSERT INTO activations (license_key, device_id, device_name, environment)
           SELECT ?, ?, ?, ?
           WHERE (SELECT COUNT(*) FROM activations WHERE license_key = ?) < ?`
        ).bind(license_key, device_id, device_name || "Unknown", envOfKey(license_key), license_key, license.max_devices).run();

        if (!insertRes.meta || insertRes.meta.changes === 0) {
          // INSERT 미실행 = max_devices 초과 (또는 UNIQUE 충돌이지만 위에서 existing 체크함)
          const cnt = await env.DB.prepare(
            "SELECT COUNT(*) as c FROM activations WHERE license_key = ?"
          ).bind(license_key).first();
          return json({ valid: false, error: "device_limit", max: license.max_devices, current: cnt?.c || 0 }, 403, request);
        }
        return json({ valid: true, pro: true }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 라이선스 비활성화 (앱에서 호출)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/deactivate" && request.method === "POST") {
        const { license_key, device_id } = await request.json();
        if (!license_key || !device_id) return json({ error: "missing_fields" }, 400, request);
        if (!validateLicenseKey(license_key)) return json({ error: "invalid_format" }, 400, request);
        if (!validateDeviceId(device_id)) return json({ error: "invalid_device_id" }, 400, request);

        const activation = await env.DB.prepare(
          "SELECT id FROM activations WHERE license_key = ? AND device_id = ?"
        ).bind(license_key, device_id).first();
        if (!activation) return json({ error: "activation_not_found" }, 404, request);

        await env.DB.prepare(
          "DELETE FROM activations WHERE license_key = ? AND device_id = ?"
        ).bind(license_key, device_id).run();
        return json({ success: true }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 라이선스 생성
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/generate" && request.method === "POST") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);

        const { email, max_devices, environment } = await request.json();
        const env_ = environment === "sandbox" ? "sandbox" : "live";
        const key = generateKey(env_);
        await env.DB.prepare(
          "INSERT INTO licenses (license_key, email, max_devices, environment) VALUES (?, ?, ?, ?)"
        ).bind(key, email || null, max_devices || 3, env_).run();
        return json({ license_key: key, email, max_devices: max_devices || 3, environment: env_ }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 라이선스 목록
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/licenses" && request.method === "GET") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);

        // pagination — ?limit=&offset= (default 500)
        const url2 = new URL(request.url);
        const limit = Math.min(parseInt(url2.searchParams.get("limit") || "500", 10), 1000);
        const offset = Math.max(parseInt(url2.searchParams.get("offset") || "0", 10), 0);

        const [licenses, total] = await Promise.all([
          env.DB.prepare(
            "SELECT l.*, COUNT(a.id) as device_count FROM licenses l LEFT JOIN activations a ON l.license_key = a.license_key GROUP BY l.id ORDER BY l.created_at DESC LIMIT ? OFFSET ?"
          ).bind(limit, offset).all(),
          env.DB.prepare("SELECT COUNT(*) as c FROM licenses").first(),
        ]);
        return json({ licenses: licenses.results, total: total?.c || 0, limit, offset }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 라이선스 비활성화 (환불 시)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/deactivate" && request.method === "POST") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);

        const { license_key } = await request.json();
        if (!license_key) return json({ error: "missing_license_key" }, 400, request);

        await env.DB.prepare("UPDATE licenses SET active = 0, refunded = 1 WHERE license_key = ?").bind(license_key).run();
        await env.DB.prepare("DELETE FROM activations WHERE license_key = ?").bind(license_key).run();
        return json({ success: true }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 트라이얼 일수 조작
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/trial/adjust" && request.method === "POST") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);

        const { device_id, days_left } = await request.json();
        if (!device_id || days_left === undefined) return json({ error: "missing_fields" }, 400, request);
        if (typeof days_left !== "number" || !Number.isInteger(days_left) || days_left < 0 || days_left > 365) return json({ error: "invalid_days_left" }, 400, request);

        const trial = await env.DB.prepare("SELECT * FROM trials WHERE device_id = ?").bind(device_id).first();
        if (!trial) return json({ error: "trial_not_found" }, 404, request);

        // trial_start를 조작하여 남은 일수 변경
        const newStart = new Date(Date.now() - (14 - days_left) * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").split(".")[0];
        await env.DB.prepare("UPDATE trials SET trial_start = ? WHERE device_id = ?").bind(newStart, device_id).run();

        return json({ success: true, device_id, days_left, new_trial_start: newStart }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 결제 내역 조회
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/payments" && request.method === "GET") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);

        const payments = await env.DB.prepare(
          "SELECT * FROM payments ORDER BY created_at DESC LIMIT 500"
        ).all();
        return json({ payments: payments.results }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 환불 처리
      // paypal_order_id 또는 paddle_txn_id 둘 다 지원
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/refund" && request.method === "POST") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);

        const body = await request.json();
        const orderId = body.paypal_order_id || body.paddle_txn_id || body.order_id;
        if (!orderId) return json({ error: "missing_order_id" }, 400, request);

        // PayPal 또는 Paddle 결제 기록 조회
        let payment = await env.DB.prepare(
          "SELECT * FROM payments WHERE paypal_order_id = ?"
        ).bind(orderId).first();
        if (!payment) {
          payment = await env.DB.prepare(
            "SELECT * FROM payments WHERE paddle_txn_id = ?"
          ).bind(orderId).first();
        }

        if (!payment) return json({ error: "payment_not_found" }, 404, request);
        if (payment.refunded) return json({ error: "already_refunded", payment }, 400, request);
        if (!payment.license_key) return json({ error: "no_license_key", message: "이 결제에 연결된 라이선스가 없습니다.", payment }, 400, request);

        // 14일 환불 정책 — 기간 초과 시 force=1 명시적 우회 필요 (관리자 예외 처리용)
        const REFUND_WINDOW_DAYS = 14;
        const force = body.force === true || body.force === 1 || body.force === "1";
        let daysSincePurchase = 0;
        try {
          const purchaseMs = new Date(String(payment.created_at).replace(" ", "T") + "Z").getTime();
          if (Number.isFinite(purchaseMs)) {
            daysSincePurchase = Math.floor((Date.now() - purchaseMs) / 86400000);
          }
        } catch (_) {}
        if (daysSincePurchase > REFUND_WINDOW_DAYS && !force) {
          return json({
            error: "refund_window_expired",
            message: `구매 후 ${daysSincePurchase}일 경과 (정책: ${REFUND_WINDOW_DAYS}일). 기술 결함 등 예외 처리는 force=1로 재요청`,
            days_since_purchase: daysSincePurchase,
            window_days: REFUND_WINDOW_DAYS,
            payment,
          }, 400, request);
        }

        // 라이선스 비활성화 + 환불 플래그 (offline grace 캐싱된 라이선스 재활성화 차단)
        await env.DB.prepare(
          "UPDATE licenses SET active = 0, refunded = 1 WHERE license_key = ?"
        ).bind(payment.license_key).run();

        // 활성화 기록 삭제
        await env.DB.prepare(
          "DELETE FROM activations WHERE license_key = ?"
        ).bind(payment.license_key).run();

        // 결제 기록에 환불 표시 (id 기준으로 업데이트)
        await env.DB.prepare(
          "UPDATE payments SET refunded = 1, status = 'refunded', refunded_at = datetime('now') WHERE id = ?"
        ).bind(payment.id).run();

        const provider = payment.paddle_txn_id ? "Paddle" : "PayPal";
        return json({
          success: true,
          refunded_license: payment.license_key,
          email: payment.email,
          amount: payment.amount,
          provider,
          message: `라이선스가 비활성화되었습니다. ${provider} 대시보드에서 수동 환불을 진행해주세요.`
        }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 문의/티켓
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/support" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        if (!checkRateLimit(ip)) return json({ error: "rate_limited" }, 429, request);

        const { type, email, message, license_key } = await request.json();
        if (!type || !email || !message) return json({ error: "missing_fields" }, 400, request);
        if (typeof type !== "string" || type.length > 20) return json({ error: "type_too_long" }, 400, request);
        if (typeof email !== "string" || email.length > 200) return json({ error: "email_too_long" }, 400, request);
        if (typeof message !== "string" || message.length > 5000) return json({ error: "message_too_long" }, 400, request);
        if (license_key && (typeof license_key !== "string" || license_key.length > 30)) return json({ error: "license_key_too_long" }, 400, request);

        await env.DB.prepare(
          "INSERT INTO support_tickets (type, email, message, license_key) VALUES (?, ?, ?, ?)"
        ).bind(type, email, message, license_key || null).run();

        // 이메일 알림 (best-effort) — 실패해도 티켓은 이미 저장됨. 실패 시 error_logs 기록(관리자가 누락 파악).
        const typeMap = { refund: "환불 요청", bug: "버그 신고", feature: "기능 요청", feedback: "피드백", other: "기타 문의" };
        const mailRes = await notifyEmail(env, {
          subject: "[BluePad] " + (typeMap[type] || type) + " - " + email,
          replyto: email, // 관리자가 Gmail에서 바로 "답장"하면 문의자에게 전달됨
          message: "유형: " + (typeMap[type] || type) + "\n이메일: " + email + "\n라이선스: " + (license_key || "없음") + "\n\n내용:\n" + message + "\n\n---\n관리자: https://bluepad.work/admin/",
        });
        if (!mailRes.ok) {
          try {
            await env.DB.prepare(
              "INSERT INTO error_logs (worker, path, error, ip) VALUES (?, ?, ?, ?)"
            ).bind("license-api", "/api/support", `resend notify fail (HTTP ${mailRes.status}: ${mailRes.error}) ticket=${type}/${email}`, ip).run();
          } catch (_) {}
        }
        return json({ success: true }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 티켓 목록
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/tickets" && request.method === "GET") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);
        const tickets = await env.DB.prepare("SELECT * FROM support_tickets ORDER BY created_at DESC").all();
        return json({ tickets: tickets.results }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 트라이얼 목록
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/trials" && request.method === "GET") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);
        const trials = await env.DB.prepare("SELECT * FROM trials ORDER BY created_at DESC").all();
        return json({ trials: trials.results }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 트라이얼 등록/조회
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/trial" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        if (!checkRateLimit(ip)) return json({ error: "rate_limited" }, 429, request);

        const { device_id, device_name } = await request.json();
        if (!device_id || !validateDeviceId(device_id)) return json({ error: "invalid_device_id" }, 400, request);
        if (!validateDeviceName(device_name)) return json({ error: "invalid_device_name" }, 400, request);

        const existing = await env.DB.prepare(
          "SELECT trial_start FROM trials WHERE device_id = ?"
        ).bind(device_id).first();

        if (existing) {
          if (device_name) {
            await env.DB.prepare("UPDATE trials SET device_name = ? WHERE device_id = ?").bind(device_name, device_id).run();
          }
          // SQLite "YYYY-MM-DD HH:MM:SS"는 비표준 — 일부 JS 엔진에서 NaN 가능
          // 표준 ISO 8601("YYYY-MM-DDTHH:MM:SSZ")로 변환 후 파싱
          const isoStart = String(existing.trial_start).replace(" ", "T") + "Z";
          const startMs = new Date(isoStart).getTime();
          if (!Number.isFinite(startMs)) {
            return json({ trial_start: existing.trial_start, days_left: 0, expired: true, error: "invalid_trial_start" }, 200, request);
          }
          const elapsed = Date.now() - startMs;
          const daysLeft = Math.ceil((14 * 24 * 60 * 60 * 1000 - elapsed) / (24 * 60 * 60 * 1000));
          return json({ trial_start: existing.trial_start, days_left: Math.max(daysLeft, 0), expired: daysLeft <= 0 }, 200, request);
        }

        // 트라이얼 재가입 차단: 같은 IP에서 30일 내 다른 device_id로 등록된 trial이 있으면 거부.
        // device seed 파일 + localStorage 삭제로 device_id를 재생성해도 IP 기반 fingerprint로 차단.
        // 단 "unknown" IP는 검사 우회 가능하지만 일반 사용자에겐 발생하지 않음.
        if (ip !== "unknown") {
          const recent = await env.DB.prepare(
            "SELECT device_id FROM trials WHERE ip = ? AND trial_start >= datetime('now', '-30 days')"
          ).bind(ip).first();
          if (recent && recent.device_id !== device_id) {
            return json({ error: "trial_already_used", message: "This network already used a trial in the past 30 days." }, 403, request);
          }
        }

        // trials는 디바이스 단위로 한 번만 등록되므로 환경 컬럼은 디폴트 'live' 유지
        // (sandbox 검증용 트라이얼은 별도 API 호출자가 환경 명시한 경우만 sandbox로 마킹)
        const trialEnv = (request.headers.get("X-Environment") === "sandbox") ? "sandbox" : "live";
        await env.DB.prepare(
          "INSERT INTO trials (device_id, device_name, environment, ip) VALUES (?, ?, ?, ?)"
        ).bind(device_id, device_name || "Unknown", trialEnv, ip).run();
        return json({ trial_start: new Date().toISOString(), days_left: 14, expired: false }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 티켓 해결됨 표시 (답변 자체는 Gmail에서 직접 발송)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/reply" && request.method === "POST") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);

        // 고객 답변은 관리자가 Gmail "답장"으로 직접 발송(알림 메일의 replyto=문의자). 이 엔드포인트는 티켓을 해결됨 처리만 한다.
        const { ticket_id } = await request.json();
        if (!ticket_id) return json({ error: "missing_fields" }, 400, request);

        await env.DB.prepare("UPDATE support_tickets SET status = 'resolved' WHERE id = ?").bind(ticket_id).run();

        return json({ success: true }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 에러 로그 조회
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/errors" && request.method === "GET") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);
        const errors = await env.DB.prepare("SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 100").all();
        return json({ errors: errors.results }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: Webhook 이벤트 로그 (severity 필터 지원)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/webhook-events" && request.method === "GET") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);
        const url2 = new URL(request.url);
        const severity = url2.searchParams.get("severity");
        const eventType = url2.searchParams.get("type");
        const limit = Math.min(parseInt(url2.searchParams.get("limit") || "200", 10), 1000);

        const conds = [];
        const binds = [];
        if (severity) { conds.push("severity = ?"); binds.push(severity); }
        if (eventType) { conds.push("event_type = ?"); binds.push(eventType); }
        const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
        const sql = `SELECT * FROM webhook_events ${where} ORDER BY created_at DESC LIMIT ?`;
        binds.push(limit);

        const events = await env.DB.prepare(sql).bind(...binds).all();
        return json({ events: events.results, total: events.results.length }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 다운로드 내역 조회
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/downloads" && request.method === "GET") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);
        const downloads = await env.DB.prepare("SELECT * FROM downloads ORDER BY downloaded_at DESC LIMIT 500").all();
        return json({ downloads: downloads.results, total: downloads.results.length }, 200, request);
      }

      return json({ error: "not_found" }, 404, request);

    } catch (err) {
      try {
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        await env.DB.prepare("INSERT INTO error_logs (worker, path, error, ip) VALUES (?, ?, ?, ?)")
          .bind("license-api", url.pathname, String(err).substring(0, 500), ip).run();
      } catch {}
      return json({ error: "internal_error" }, 500, request);
    }
  },

  // 5시간마다 헬스체크 + 신규 유저 알림 (Cron Trigger)
  async scheduled(event, env) {
    // ── 헬스체크 ──
    // download worker(workers.dev)는 cron 내부 fetch가 일관되게 404 응답 (Cloudflare cross-worker
    // 라우팅 특성, 외부 curl로는 200 OK). bluepad.work 도메인 호출은 정상이라 download 헬스체크는
    // 제거 — 다운로드 카운트 증가로 살아있음 간접 확인 가능.
    const endpoints = [
      { name: "checkout", url: "https://bluepad.work/buy" },
      { name: "landing", url: "https://bluepad.work/" },
    ];
    for (const ep of endpoints) {
      try {
        // GET 사용 — cross-worker fetch의 HEAD가 일관되게 404 반환하는 이슈 회피
        const res = await fetch(ep.url, { method: "GET" });
        if (!res.ok) {
          await env.DB.prepare("INSERT INTO error_logs (worker, path, error, ip) VALUES (?, ?, ?, ?)")
            .bind("healthcheck", ep.name, `HTTP ${res.status}`, "cron").run();
        }
      } catch (err) {
        await env.DB.prepare("INSERT INTO error_logs (worker, path, error, ip) VALUES (?, ?, ?, ?)")
          .bind("healthcheck", ep.name, String(err).substring(0, 500), "cron").run();
      }
    }

    // ── 신규 유저 알림 ──
    // 마지막 체크 시각 (KV 없으므로 5시간 전 기준으로 계산)
    const since = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().replace("T", " ").split(".")[0];

    const newDownloads = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM downloads WHERE downloaded_at > ?"
    ).bind(since).first();

    const newTrials = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM trials WHERE created_at > ?"
    ).bind(since).first();

    const newPayments = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM payments WHERE created_at > ? AND status = 'completed'"
    ).bind(since).first();

    const dlCnt = newDownloads?.cnt || 0;
    const trialCnt = newTrials?.cnt || 0;
    const payCnt = newPayments?.cnt || 0;

    if (dlCnt > 0 || trialCnt > 0 || payCnt > 0) {
      const lines = [];
      if (payCnt > 0) lines.push(`💰 신규 결제: ${payCnt}건`);
      if (trialCnt > 0) lines.push(`🆕 신규 체험 사용자: ${trialCnt}명`);
      if (dlCnt > 0) lines.push(`📥 신규 다운로드: ${dlCnt}건`);

      const subject = payCnt > 0
        ? `[BluePad] 🎉 결제 발생! ${payCnt}건`
        : `[BluePad] 신규 활동 감지 (${lines.length}개 항목)`;

      try {
        await fetch("https://api.mailchannels.net/tx/v1/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: "blueehdwp@gmail.com", name: "BluePad Admin" }] }],
            from: { email: "noreply@bluepad.work", name: "BluePad 알림" },
            subject,
            content: [{
              type: "text/plain",
              value: `지난 5시간 내 신규 활동이 감지되었습니다.\n\n${lines.join("\n")}\n\n관리자 대시보드: https://bluepad.work/admin/`,
            }],
          }),
        });
      } catch {}
    }
  },
};
