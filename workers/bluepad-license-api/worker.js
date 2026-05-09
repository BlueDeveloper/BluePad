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
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");
  let allowOrigin = "";
  if (!origin) {
    allowOrigin = "*";
  } else if (
    /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
    /^https:\/\/bluepad\.work$/.test(origin) ||
    /^https:\/\/www\.bluepad\.work$/.test(origin) ||
    /^https?:\/\/tauri\.localhost$/.test(origin)
  ) {
    allowOrigin = origin;
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
  });
}

// ── License Key ──
function generateKey() {
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
  return "BP-" + segments.join("-");
}

const LICENSE_KEY_REGEX = /^BP-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
function validateLicenseKey(key) { return typeof key === "string" && LICENSE_KEY_REGEX.test(key); }
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
          "SELECT * FROM licenses WHERE license_key = ? AND active = 1"
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

        if (activations.results.length >= license.max_devices) {
          return json({ valid: false, error: "device_limit", max: license.max_devices, current: activations.results.length }, 403, request);
        }

        // Atomic insert with device limit check
        await env.DB.prepare(
          "INSERT INTO activations (license_key, device_id, device_name) VALUES (?, ?, ?)"
        ).bind(license_key, device_id, device_name || "Unknown").run();
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

        const { email, max_devices } = await request.json();
        const key = generateKey();
        await env.DB.prepare(
          "INSERT INTO licenses (license_key, email, max_devices) VALUES (?, ?, ?)"
        ).bind(key, email || null, max_devices || 3).run();
        return json({ license_key: key, email, max_devices: max_devices || 3 }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 라이선스 목록
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/licenses" && request.method === "GET") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);

        const licenses = await env.DB.prepare(
          "SELECT l.*, COUNT(a.id) as device_count FROM licenses l LEFT JOIN activations a ON l.license_key = a.license_key GROUP BY l.id ORDER BY l.created_at DESC"
        ).all();
        return json({ licenses: licenses.results }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 라이선스 비활성화 (환불 시)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/deactivate" && request.method === "POST") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);

        const { license_key } = await request.json();
        if (!license_key) return json({ error: "missing_license_key" }, 400, request);

        await env.DB.prepare("UPDATE licenses SET active = 0 WHERE license_key = ?").bind(license_key).run();
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
      // 관리자: 환불 처리 (NEW)
      // 정확한 매칭: paypal_order_id → license_key
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/refund" && request.method === "POST") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);

        const { paypal_order_id } = await request.json();
        if (!paypal_order_id) return json({ error: "missing_paypal_order_id" }, 400, request);

        // 결제 기록에서 라이선스 키 조회
        const payment = await env.DB.prepare(
          "SELECT * FROM payments WHERE paypal_order_id = ?"
        ).bind(paypal_order_id).first();

        if (!payment) return json({ error: "payment_not_found" }, 404, request);
        if (payment.refunded) return json({ error: "already_refunded", payment }, 400, request);
        if (!payment.license_key) return json({ error: "no_license_key", message: "이 결제에 연결된 라이선스가 없습니다.", payment }, 400, request);

        // 라이선스 비활성화
        await env.DB.prepare(
          "UPDATE licenses SET active = 0 WHERE license_key = ?"
        ).bind(payment.license_key).run();

        // 활성화 기록 삭제
        await env.DB.prepare(
          "DELETE FROM activations WHERE license_key = ?"
        ).bind(payment.license_key).run();

        // 결제 기록에 환불 표시
        await env.DB.prepare(
          "UPDATE payments SET refunded = 1, status = 'refunded', refunded_at = datetime('now') WHERE paypal_order_id = ?"
        ).bind(paypal_order_id).run();

        return json({
          success: true,
          refunded_license: payment.license_key,
          email: payment.email,
          amount: payment.amount,
          message: "라이선스가 비활성화되었습니다. PayPal에서 수동 환불을 진행해주세요."
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

        // 이메일 알림 (best-effort)
        const typeMap = { refund: "환불 요청", bug: "버그 신고", feature: "기능 요청", feedback: "피드백", other: "기타 문의" };
        try {
          await fetch("https://api.mailchannels.net/tx/v1/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: "blueehdwp@gmail.com", name: "BluePad Admin" }] }],
              from: { email: "noreply@bluepad.work", name: "BluePad Support" },
              subject: "[BluePad] " + (typeMap[type] || type) + " - " + email,
              content: [{
                type: "text/plain",
                value: "유형: " + (typeMap[type] || type) + "\n이메일: " + email + "\n라이선스: " + (license_key || "없음") + "\n\n내용:\n" + message + "\n\n---\n관리자: https://bluepad.work/admin/",
              }],
            }),
          });
        } catch {}
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
          const startMs = new Date(existing.trial_start + "Z").getTime();
          const elapsed = Date.now() - startMs;
          const daysLeft = Math.ceil((14 * 24 * 60 * 60 * 1000 - elapsed) / (24 * 60 * 60 * 1000));
          return json({ trial_start: existing.trial_start, days_left: Math.max(daysLeft, 0), expired: daysLeft <= 0 }, 200, request);
        }

        await env.DB.prepare(
          "INSERT INTO trials (device_id, device_name) VALUES (?, ?)"
        ).bind(device_id, device_name || "Unknown").run();
        return json({ trial_start: new Date().toISOString(), days_left: 14, expired: false }, 200, request);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 관리자: 티켓 답변 (이메일 발송)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (path === "/api/admin/reply" && request.method === "POST") {
        if (!await checkAdmin(request, env)) return json({ error: "unauthorized" }, 401, request);

        const { email, reply, ticket_id } = await request.json();
        if (!email || !reply) return json({ error: "missing_fields" }, 400, request);

        // MailChannels로 이메일 발송
        try {
          await fetch("https://api.mailchannels.net/tx/v1/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personalizations: [{ to: [{ email, name: email }] }],
              from: { email: "support@bluepad.work", name: "BluePad Support" },
              subject: "[BluePad] 문의 답변",
              content: [{
                type: "text/plain",
                value: reply + "\n\n---\nBluePad Support\nhttps://bluepad.work",
              }],
            }),
          });
        } catch {}

        // 티켓 상태 업데이트
        if (ticket_id) {
          await env.DB.prepare("UPDATE support_tickets SET status = 'resolved' WHERE id = ?").bind(ticket_id).run();
        }

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
    const endpoints = [
      { name: "download", url: "https://bluepad-download.blueehdwp.workers.dev/api/stats" },
      { name: "checkout", url: "https://bluepad-checkout.blueehdwp.workers.dev/" },
      { name: "landing", url: "https://bluepad.work/" },
    ];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep.url, { method: "HEAD" });
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
