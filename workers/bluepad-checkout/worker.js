// BluePad Checkout Worker (Paddle Billing)
// 결제 흐름: Paddle.js 오버레이 → webhook /paddle-webhook → /success?_ptxn=TXN_ID

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ── Paddle 웹훅 서명 검증 (HMAC-SHA256) ──
async function verifyPaddleWebhook(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = {};
  sigHeader.split(";").forEach((p) => {
    const eq = p.indexOf("=");
    if (eq !== -1) parts[p.slice(0, eq)] = p.slice(eq + 1);
  });
  const { ts, h1 } = parts;
  if (!ts || !h1) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${ts}:${rawBody}`)
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === h1;
}

async function getPaddleCustomerEmail(customerId, apiKey, environment = "live") {
  const base = environment === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
  const res = await fetch(`${base}/customers/${customerId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json();
  return data.data?.email || null;
}

async function logWebhookEvent(env, type, summary, severity = "info", environment = "live") {
  try {
    await env.DB.prepare(
      "INSERT INTO webhook_events (event_type, summary, severity, environment) VALUES (?, ?, ?, ?)"
    ).bind(type, summary, severity, environment).run();
  } catch (_) {}
}

async function handleAdjustment(env, data, environment = "live") {
  const action = data.action;
  const txnId = data.transaction_id;
  const adjId = data.id || "";
  const adjStatus = data.status || "";

  if (action === "refund" || action === "chargeback") {
    if (!txnId) {
      await logWebhookEvent(env, "adjustment.created", `${action} without transaction_id (adj=${adjId})`, "warn", environment);
      return;
    }
    const payment = await env.DB.prepare(
      "SELECT license_key, created_at FROM payments WHERE paddle_txn_id = ?"
    ).bind(txnId).first();
    if (!payment?.license_key) {
      await logWebhookEvent(env, "adjustment.created", `${action} but no license for txn=${txnId} (adj=${adjId})`, "warn", environment);
      return;
    }

    // 14일 환불 정책 위반 감지 (라이선스는 비활성화하되 로그로 추적)
    // 결제 후 14일 초과한 환불 요청 → Paddle support 분쟁 대응용 audit
    const REFUND_WINDOW_DAYS = 14;
    let daysSincePurchase = -1;
    try {
      const purchaseMs = new Date(String(payment.created_at).replace(" ", "T") + "Z").getTime();
      if (Number.isFinite(purchaseMs)) {
        daysSincePurchase = Math.floor((Date.now() - purchaseMs) / 86400000);
      }
    } catch (_) {}
    if (action === "refund" && daysSincePurchase > REFUND_WINDOW_DAYS) {
      await logWebhookEvent(env, "adjustment.created", `LATE REFUND (policy violation): txn=${txnId} days=${daysSincePurchase} window=${REFUND_WINDOW_DAYS} license=${payment.license_key}`, "critical", environment);
    }

    // 라이선스는 보수적으로 즉시 비활성화 (rejected 시 adjustment.updated에서 복구)
    await env.DB.prepare("UPDATE licenses SET active = 0 WHERE license_key = ?").bind(payment.license_key).run();
    await env.DB.prepare("DELETE FROM activations WHERE license_key = ?").bind(payment.license_key).run();

    // 결제 상태:
    //   refund(pending_approval) → 'refund_pending' (Paddle 검토 대기, 자금 미이동)
    //   chargeback(자동 created)   → 'refunded' (카드사 분쟁이라 이미 사실상 환불 확정)
    //   refund 즉시 approved 케이스 → 'refunded'
    const isPending = action === "refund" && adjStatus === "pending_approval";
    if (isPending) {
      await env.DB.prepare(
        "UPDATE payments SET status = 'refund_pending' WHERE paddle_txn_id = ? AND refunded = 0"
      ).bind(txnId).run();
    } else {
      await env.DB.prepare(
        "UPDATE payments SET refunded = 1, status = 'refunded', refunded_at = datetime('now') WHERE paddle_txn_id = ?"
      ).bind(txnId).run();
    }

    await logWebhookEvent(env, "adjustment.created", `${isPending ? "deactivate(pending refund)" : "deactivate+refunded"}: license=${payment.license_key} txn=${txnId} action=${action} status=${adjStatus}`, "warn", environment);
    return;
  }

  // 기타 action (chargeback_reverse, credit, credit_reverse, chargeback_warning 등):
  // 자동 재활성화는 위험하므로 수동 검토 — warn 로그로 알림
  await logWebhookEvent(env, "adjustment.created", `manual review needed: txn=${txnId || "?"} action=${action} adj=${adjId}`, "warn", environment);
}

/** adjustment.updated 처리: pending_approval → approved/rejected 전이 */
async function handleAdjustmentUpdated(env, data, environment = "live") {
  const action = data.action;
  const txnId = data.transaction_id;
  const adjId = data.id || "";
  const status = data.status || "";

  if (action !== "refund" || !txnId) {
    await logWebhookEvent(env, "adjustment.updated", `noop adj=${adjId} action=${action} status=${status} txn=${txnId || "?"}`, "info", environment);
    return;
  }

  const payment = await env.DB.prepare(
    "SELECT license_key, status FROM payments WHERE paddle_txn_id = ?"
  ).bind(txnId).first();

  if (status === "approved") {
    // 환불 확정 → refunded로 최종 마킹 (라이선스는 이미 비활성화 상태 유지)
    await env.DB.prepare(
      "UPDATE payments SET refunded = 1, status = 'refunded', refunded_at = datetime('now') WHERE paddle_txn_id = ?"
    ).bind(txnId).run();
    await logWebhookEvent(env, "adjustment.updated", `refund APPROVED: txn=${txnId} adj=${adjId} license=${payment?.license_key || "?"}`, "warn", environment);
    return;
  }

  if (status === "rejected") {
    // 환불 거부 → 자금 이동 없음. 비활성화된 라이선스 복구 + 상태 원복.
    if (payment?.license_key) {
      await env.DB.prepare("UPDATE licenses SET active = 1 WHERE license_key = ?").bind(payment.license_key).run();
    }
    await env.DB.prepare(
      "UPDATE payments SET refunded = 0, status = 'completed', refunded_at = NULL WHERE paddle_txn_id = ?"
    ).bind(txnId).run();
    await logWebhookEvent(env, "adjustment.updated", `refund REJECTED: license restored txn=${txnId} adj=${adjId} license=${payment?.license_key || "?"}`, "warn", environment);
    return;
  }

  await logWebhookEvent(env, "adjustment.updated", `unknown status: txn=${txnId} adj=${adjId} status=${status}`, "info", environment);
}

async function generateLicenseKey(env, email, environment = "live") {
  const url = env.LICENSE_API + "/api/admin/generate";
  const opts = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + env.LICENSE_ADMIN_SECRET,
    },
    body: JSON.stringify({ email, max_devices: 3, environment }),
  };
  const res = env.LICENSE_SERVICE
    ? await env.LICENSE_SERVICE.fetch(new Request(url, opts))
    : await fetch(url, opts);
  return res.json();
}

// ── Pages ──

function checkoutPage(cfg, isSandbox) {
  const token = escHtml(cfg.clientToken || "");
  const priceId = escHtml(cfg.priceId || "");
  const successUrl = `https://bluepad.work${cfg.basePath}/success`;
  const envBanner = isSandbox
    ? `<div style="background:#7c3aed;color:#fff;text-align:center;padding:8px;font-size:13px;font-weight:600;letter-spacing:.04em">SANDBOX 환경 — 실 결제 아님</div>`
    : "";
  const envInit = isSandbox ? `Paddle.Environment.set('sandbox');` : "";
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BluePad Pro - 구매</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,system-ui,sans-serif;background:#09090b;color:#fafafa;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:48px 40px;max-width:420px;width:100%;text-align:center}
.logo{font-size:24px;font-weight:800;letter-spacing:-0.03em;margin-bottom:8px}
.logo em{color:#155dfc;font-style:normal}
.sub{color:#a1a1aa;font-size:14px;margin-bottom:32px}
.price{font-size:48px;font-weight:800;letter-spacing:-0.04em;margin-bottom:4px}
.price span{font-size:20px;vertical-align:top;line-height:2.6}
.note{color:#52525b;font-size:13px;margin-bottom:32px}
.features{text-align:left;margin-bottom:32px;list-style:none}
.features li{padding:6px 0;font-size:13.5px;color:#a1a1aa}
.features li::before{content:'\\2713';color:#22c55e;font-weight:700;margin-right:10px}
.btn{display:block;width:100%;padding:14px;background:#155dfc;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:650;cursor:pointer;transition:background .15s}
.btn:hover{background:#3b7dff}
.btn:disabled{background:#27272a;cursor:not-allowed}
.methods{margin-top:12px;font-size:11px;color:#52525b}
.secure{margin-top:8px;font-size:11px;color:#3f3f46}
.legal{margin-top:16px;font-size:11px;color:#3f3f46;line-height:1.6}
.legal a{color:#52525b}
</style>
</head>
<body>
${envBanner}
<div class="card">
  <div class="logo">Blue<em>Pad</em> Pro</div>
  <div class="sub">마크다운 에디터 전체 기능 잠금 해제</div>
  <div class="price"><span>$</span>10.99</div>
  <div class="note">일회성 결제 &middot; 평생 업데이트 &middot; 3대 기기</div>
  <ul class="features">
    <li>탭 무제한</li>
    <li>테마 4종 전부</li>
    <li>집중 모드</li>
    <li>HTML / PDF 내보내기</li>
  </ul>
  <button class="btn" id="buyBtn" onclick="openCheckout()">결제하기</button>
  <div class="methods">카드 &middot; 카카오페이 &middot; 네이버페이 &middot; PayPal</div>
  <div class="secure">&#128274; Paddle 보안 결제</div>
  <div class="legal">
    &#128338; <strong>구매일로부터 14일 이내 무조건 환불 가능</strong> (사유 불문)<br>
    14일 경과 후엔 기술 결함 등 예외 사항에 한해 환불됩니다.<br>
    구매 전 <a href="https://bluepad.work/legal/eula.html" target="_blank">이용약관</a>을 확인해주세요.<br>
    상호: 비알피(BRP) | 대표: 윤동제 | 사업자: 511-32-01572
  </div>
</div>
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
<script>
${envInit}
Paddle.Initialize({ token: '${token}' });
function openCheckout() {
  document.getElementById('buyBtn').disabled = true;
  Paddle.Checkout.open({
    items: [{ priceId: '${priceId}', quantity: 1 }],
    settings: {
      successUrl: '${successUrl}',
      displayMode: 'overlay',
    },
    eventCallback: function(e) {
      // checkout.completed 시 명시적으로 _ptxn 추가하여 redirect
      // (Paddle.js의 자동 redirect는 일부 결제 수단에서 query 누락되는 케이스 있음)
      if (e.name === 'checkout.completed') {
        var d = e.data || {};
        var txnId = d.transaction_id || (d.transaction && d.transaction.id) || '';
        if (txnId) {
          window.location.replace('${successUrl}?_ptxn=' + encodeURIComponent(txnId));
        } else {
          window.location.replace('${successUrl}');
        }
      }
      if (e.name === 'checkout.closed') {
        document.getElementById('buyBtn').disabled = false;
      }
    }
  });
}
</script>
</body>
</html>`;
}

function successPage(licenseKey, email, txnId, createdAtUtc) {
  const safeKey = escHtml(licenseKey);
  const safeEmail = escHtml(email);
  const safeTxn = escHtml(txnId);
  // 환불 가능 기한: 결제일(UTC) + 14일을 한국 시간(YYYY-MM-DD)으로
  let refundDeadline = "";
  try {
    const startMs = new Date(String(createdAtUtc).replace(" ", "T") + "Z").getTime();
    if (Number.isFinite(startMs)) {
      const kst = new Date(startMs + 14 * 86400000 + 9 * 3600000);
      refundDeadline = kst.toISOString().slice(0, 10);
    }
  } catch (_) {}
  const refundLine = refundDeadline
    ? `<div class="info" style="font-size:12px;color:#71717a;margin-bottom:24px">환불 가능 기한: <strong style="color:#a1a1aa">${refundDeadline}</strong> (구매일로부터 14일)</div>`
    : "";
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>BluePad Pro - 완료</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,sans-serif;background:#09090b;color:#fafafa;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:48px 40px;max-width:480px;width:100%;text-align:center}.check{font-size:48px;margin-bottom:16px}h1{font-size:24px;font-weight:700;margin-bottom:8px}.sub{color:#a1a1aa;font-size:14px;margin-bottom:32px}.key-box{background:#09090b;border:1px solid #27272a;border-radius:10px;padding:20px;margin-bottom:24px}.key-label{font-size:12px;color:#52525b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em}.key-value{font-family:monospace;font-size:20px;font-weight:700;color:#22c55e;letter-spacing:0.02em;word-break:break-all;user-select:all}.info{font-size:13px;color:#52525b;margin-bottom:6px}.steps{text-align:left;margin-bottom:28px;list-style:none;counter-reset:step}.steps li{padding:6px 0;font-size:13.5px;color:#a1a1aa;counter-increment:step}.steps li::before{content:counter(step) ".";color:#155dfc;font-weight:700;margin-right:10px}.btn{display:inline-block;padding:12px 28px;background:#155dfc;color:#fff;border-radius:9px;text-decoration:none;font-size:14px;font-weight:600}.help{margin-top:20px;font-size:12px;color:#52525b}</style></head>
<body><div class="card">
  <div class="check">&#9989;</div>
  <h1>구매 완료!</h1>
  <div class="sub">BluePad Pro 라이선스가 발급되었습니다</div>
  <div class="key-box">
    <div class="key-label">License Key</div>
    <div class="key-value">${safeKey}</div>
  </div>
  <div class="info">이메일: ${safeEmail}</div>
  <div class="info" style="font-size:11px;color:#3f3f46;margin-bottom:8px">결제번호: ${safeTxn}</div>
  ${refundLine}
  <ol class="steps">
    <li>위 라이선스 키를 복사하세요</li>
    <li>BluePad &rarr; 설정 &rarr; 라이선스 활성화</li>
    <li>키를 붙여넣고 활성화</li>
  </ol>
  <a href="https://bluepad.work" class="btn">BluePad로 돌아가기</a>
  <div class="help">도움이 필요하시면 <a href="mailto:blueehdwp@gmail.com" style="color:#a1a1aa">blueehdwp@gmail.com</a>으로 문의해주세요.<br>결제번호를 함께 보내주시면 빠르게 처리해드립니다.</div>
</div></body></html>`;
}

function processingPage(txnId, retry) {
  const safeTxn = encodeURIComponent(txnId);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>BluePad - 처리 중</title>
<meta http-equiv="refresh" content="3;url=/success?_ptxn=${safeTxn}&retry=${retry + 1}">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,sans-serif;background:#09090b;color:#fafafa;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{text-align:center;max-width:400px;padding:40px}h1{font-size:22px;margin-bottom:12px}p{color:#a1a1aa;font-size:14px;line-height:1.8}.spinner{width:48px;height:48px;border:3px solid #27272a;border-top-color:#155dfc;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 24px}@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="card">
  <div class="spinner"></div>
  <h1>결제 처리 중...</h1>
  <p>잠시만 기다려주세요.<br>3초 후 자동으로 확인됩니다.</p>
</div></body></html>`;
}

function lookupPage() {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>BluePad - 라이선스 조회</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,sans-serif;background:#09090b;color:#fafafa;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.card{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:40px;max-width:480px;width:100%;text-align:center}.icon{font-size:40px;margin-bottom:12px}h1{font-size:22px;font-weight:700;margin-bottom:8px}.sub{color:#a1a1aa;font-size:13.5px;margin-bottom:24px;line-height:1.6}form{display:flex;flex-direction:column;gap:12px;margin-bottom:20px}input{padding:12px 14px;background:#09090b;border:1px solid #27272a;border-radius:9px;color:#fafafa;font-size:14px}input:focus{outline:none;border-color:#155dfc}button{padding:12px;background:#155dfc;color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer}button:hover{background:#3b7dff}button:disabled{background:#27272a;cursor:not-allowed}.result{margin:16px 0;padding:16px;background:#09090b;border:1px solid #27272a;border-radius:9px;font-family:monospace;font-size:18px;color:#22c55e;word-break:break-all;display:none}.result.show{display:block}.msg{color:#a1a1aa;font-size:13px;margin-top:12px}.help{margin-top:20px;font-size:12px;color:#52525b;line-height:1.7}.help a{color:#a1a1aa}</style></head>
<body><div class="card">
  <div class="icon">&#128270;</div>
  <h1>라이선스 키 조회</h1>
  <div class="sub">결제 후 자동 redirect가 누락된 경우 이메일로 키를 조회하실 수 있습니다.<br>최근 10분 이내 결제만 조회됩니다.</div>
  <form id="lookupForm" onsubmit="return doLookup(event)">
    <input type="email" id="emailInput" placeholder="결제 시 입력한 이메일" required autocomplete="email">
    <button type="submit" id="lookupBtn">조회</button>
  </form>
  <div class="result" id="result"></div>
  <div class="msg" id="msg"></div>
  <div class="help">
    조회되지 않으면 결제 시각과 결제 이메일을 <a href="mailto:blueehdwp@gmail.com">blueehdwp@gmail.com</a>으로 보내주세요.<br>
    <a href="https://bluepad.work">&larr; BluePad로 돌아가기</a>
  </div>
</div>
<script>
async function doLookup(e) {
  e.preventDefault();
  var email = document.getElementById('emailInput').value.trim();
  var btn = document.getElementById('lookupBtn');
  var result = document.getElementById('result');
  var msg = document.getElementById('msg');
  result.classList.remove('show');
  msg.textContent = '';
  btn.disabled = true;
  btn.textContent = '조회 중...';
  try {
    var res = await fetch('/buy/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });
    var data = await res.json();
    if (data.found) {
      result.textContent = data.license_key;
      result.classList.add('show');
      msg.textContent = '키를 BluePad 앱에 입력하여 활성화하세요.';
    } else {
      msg.textContent = '최근 10분 이내 결제 기록이 없습니다. 이메일을 다시 확인하거나 관리자에게 문의해주세요.';
    }
  } catch (err) {
    msg.textContent = '조회 실패. 잠시 후 다시 시도해주세요.';
  }
  btn.disabled = false;
  btn.textContent = '조회';
  return false;
}
</script>
</body></html>`;
}

function errorPage(title, message, ref) {
  const safeTitle = escHtml(title);
  const safeMsg = escHtml(message);
  const safeRef = ref ? escHtml(ref) : "";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>BluePad - 오류</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,sans-serif;background:#09090b;color:#fafafa;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{text-align:center;max-width:480px;padding:40px}.icon{font-size:48px;margin-bottom:16px}h1{font-size:24px;margin-bottom:12px}p{color:#a1a1aa;margin-bottom:8px;font-size:14px;line-height:1.6}.ref{font-family:monospace;color:#52525b;font-size:12px;margin-bottom:24px}a{color:#155dfc;text-decoration:none;font-weight:600}</style></head>
<body><div class="card">
  <div class="icon">&#9888;&#65039;</div>
  <h1>${safeTitle}</h1>
  <p>${safeMsg}</p>
  ${safeRef ? `<div class="ref">결제번호: ${safeRef}</div>` : ""}
  <p>문의: <a href="mailto:blueehdwp@gmail.com">blueehdwp@gmail.com</a></p>
  <p style="margin-top:16px"><a href="https://bluepad.work">&larr; BluePad로 돌아가기</a></p>
</div></body></html>`;
}

const CANCEL_PAGE = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>취소됨</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,sans-serif;background:#09090b;color:#fafafa;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{text-align:center;max-width:400px;padding:40px}h1{font-size:24px;margin-bottom:12px}p{color:#a1a1aa;margin-bottom:24px}a{color:#155dfc;text-decoration:none;font-weight:600}</style></head>
<body><div class="card"><h1>결제 취소됨</h1><p>언제든지 다시 시도하실 수 있습니다.</p><a href="https://bluepad.work">&larr; BluePad로 돌아가기</a></div></body></html>`;

// ── Main Handler ──

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 옛 *.workers.dev 도메인 → 신 도메인 영구 redirect (옛 MSI 1.8.0 이하 호환)
    // Paddle webhook은 이미 신 URL로 변경되었으므로 여기로 안 옴 (브라우저 트래픽만)
    if (url.hostname.endsWith(".workers.dev")) {
      const targetPath = url.pathname === "/" ? "/buy" : `/buy${url.pathname}`;
      return Response.redirect(`https://bluepad.work${targetPath}${url.search}`, 301);
    }

    // 환경 분기: /sandbox/buy* → sandbox, /buy* → live
    const isSandbox = url.pathname.startsWith("/sandbox/");
    const environment = isSandbox ? "sandbox" : "live";
    const path = url.pathname
      .replace(/^\/sandbox\/buy(\/|$)/, "/")
      .replace(/^\/buy(\/|$)/, "/");
    // 환경별 설정 — 미설정 시 live 값으로 폴백 (sandbox 미구성 단계)
    const cfg = isSandbox
      ? {
          webhookSecret: env.PADDLE_SANDBOX_WEBHOOK_SECRET,
          clientToken: env.PADDLE_SANDBOX_CLIENT_TOKEN,
          priceId: env.PADDLE_SANDBOX_PRICE_ID,
          apiKey: env.PADDLE_SANDBOX_API_KEY,
          basePath: "/sandbox/buy",
        }
      : {
          webhookSecret: env.PADDLE_WEBHOOK_SECRET,
          clientToken: env.PADDLE_CLIENT_TOKEN,
          priceId: env.PADDLE_PRICE_ID,
          apiKey: env.PADDLE_API_KEY,
          basePath: "/buy",
        };

    try {
      // 구매 페이지
      if (path === "/" || path === "/checkout") {
        return page(checkoutPage(cfg, isSandbox));
      }

      // Paddle 웹훅 수신
      if (path === "/paddle-webhook" && request.method === "POST") {
        const rawBody = await request.text();
        const sigHeader = request.headers.get("Paddle-Signature");

        const valid = await verifyPaddleWebhook(
          rawBody,
          sigHeader,
          cfg.webhookSecret
        );
        if (!valid) {
          return new Response("Unauthorized", { status: 401 });
        }

        const event = JSON.parse(rawBody);
        const eventType = event.event_type;

        // 비-completed 이벤트 핸들러들
        if (eventType !== "transaction.completed") {
          const d = event.data || {};

          // 환불 자동 처리
          if (eventType === "adjustment.created") {
            await handleAdjustment(env, d, environment);
          } else if (eventType === "adjustment.updated") {
            await handleAdjustmentUpdated(env, d, environment);
          }

          // 결제 관련 추적 (info)
          else if (eventType === "transaction.canceled") {
            await logWebhookEvent(env, eventType, `txn=${d.id} customer=${d.customer_id || "unknown"}`, "info", environment);
          } else if (eventType === "transaction.payment_failed") {
            await logWebhookEvent(env, eventType, `txn=${d.id} customer=${d.customer_id || "unknown"}`, "warn", environment);
          } else if (eventType === "transaction.updated") {
            // invoice_number가 completed 이후 늦게 생성/변경되는 경우 보강
            if (d.id && d.invoice_number) {
              await env.DB.prepare(
                "UPDATE payments SET invoice_number = ? WHERE paddle_txn_id = ? AND (invoice_number IS NULL OR invoice_number != ?)"
              ).bind(d.invoice_number, d.id, d.invoice_number).run();
            }
            await logWebhookEvent(env, eventType, `txn=${d.id} status=${d.status} invoice=${d.invoice_number || "-"}`, "info", environment);
          } else if (eventType === "transaction.revised") {
            await logWebhookEvent(env, eventType, `txn=${d.id} status=${d.status}`, "info", environment);
          }

          // 고객 정보 변경 (이메일 변경 추적) - info
          else if (eventType === "customer.updated") {
            await logWebhookEvent(env, eventType, `customer=${d.id} email=${d.email || ""}`, "info", environment);
          }

          // 정산 (info)
          else if (eventType === "payout.created") {
            await logWebhookEvent(env, eventType, `payout=${d.id} amount=${d.amount} ${d.currency_code}`, "info", environment);
          } else if (eventType === "payout.paid") {
            await logWebhookEvent(env, eventType, `payout=${d.id} amount=${d.amount} ${d.currency_code} paid_at=${d.paid_at}`, "info", environment);
          }

          // 🚨 보안 핵심 이벤트 (severity 분류)
          else if (eventType === "api_key_exposure.created") {
            await logWebhookEvent(env, eventType, `SECURITY: API KEY EXPOSED: ${d.api_key_id || d.id || ""} — REVOKE IMMEDIATELY`, "critical", environment);
          } else if (eventType === "api_key.revoked") {
            await logWebhookEvent(env, eventType, `SECURITY: API key revoked: ${d.name || ""} (${d.id || ""})`, "warn", environment);
          } else if (eventType === "api_key.expired") {
            await logWebhookEvent(env, eventType, `API KEY EXPIRED: ${d.name || ""} (${d.id || ""})`, "critical", environment);
          } else if (eventType === "api_key.expiring") {
            await logWebhookEvent(env, eventType, `API key expiring: ${d.name || ""} (${d.id || ""}) expires_at=${d.expires_at || ""}`, "warn", environment);
          } else if (eventType === "api_key.created") {
            await logWebhookEvent(env, eventType, `new api_key: ${d.name || ""} (${d.id || ""})`, "info", environment);
          } else if (eventType === "api_key.updated") {
            await logWebhookEvent(env, eventType, `api_key updated: ${d.name || ""} (${d.id || ""})`, "info", environment);
          } else if (eventType === "client_token.created") {
            await logWebhookEvent(env, eventType, `new client_token: ${d.name || ""} (${d.id || ""})`, "info", environment);
          } else if (eventType === "client_token.updated") {
            await logWebhookEvent(env, eventType, `client_token updated: ${d.name || ""} (${d.id || ""})`, "info", environment);
          } else if (eventType === "client_token.revoked") {
            await logWebhookEvent(env, eventType, `SECURITY: client_token revoked: ${d.name || ""} (${d.id || ""})`, "warn", environment);
          }

          return new Response("OK", { status: 200 });
        }

        const txn = event.data;
        const txnId = txn.id;

        // 결제 금액 검증 — 음수/0/NaN 거부 (악의적 webhook 또는 데이터 오류 방어)
        const amountCents = parseInt(
          String(txn.payments?.[0]?.amount || "0"),
          10
        );
        if (!Number.isFinite(amountCents) || amountCents <= 0) {
          await logWebhookEvent(env, "transaction.completed", `invalid amount: ${amountCents} for txn=${txnId}`, "warn", environment);
          return new Response("OK", { status: 200 });
        }
        const amountDecimal = (amountCents / 100).toFixed(2);
        const currency = txn.currency_code || "USD";
        const invoiceNumber = txn.invoice_number || null;

        // 빠른 중복 체크 (race window 좁힘 — 최종 보장은 paddle_txn_id UNIQUE)
        const existing = await env.DB.prepare(
          "SELECT id, invoice_number FROM payments WHERE paddle_txn_id = ?"
        ).bind(txnId).first();
        if (existing) {
          // invoice_number가 늦게 도착했을 수 있으므로 보강 업데이트
          if (invoiceNumber && !existing.invoice_number) {
            await env.DB.prepare(
              "UPDATE payments SET invoice_number = ? WHERE id = ?"
            ).bind(invoiceNumber, existing.id).run();
          }
          return new Response("OK", { status: 200 });
        }

        // 고객 이메일 조회 (Sandbox는 sandbox-api.paddle.com 사용)
        let email = "unknown";
        try {
          if (txn.customer_id) {
            email =
              (await getPaddleCustomerEmail(txn.customer_id, cfg.apiKey, environment)) ||
              "unknown";
          }
        } catch (_) {}

        // 결제 기록 삽입 — UNIQUE(paddle_txn_id) + INSERT OR IGNORE로 중복 webhook race 완전 방어
        const insertRes = await env.DB.prepare(
          "INSERT OR IGNORE INTO payments (paddle_txn_id, paddle_customer_id, email, amount, currency, status, invoice_number, environment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(txnId, txn.customer_id || null, email, amountDecimal, currency, "captured", invoiceNumber, environment)
          .run();

        // INSERT 무시됨 = 동시 webhook이 이미 처리 → 라이선스 발급 단계 skip (중복 발급 방지)
        if (!insertRes.meta || insertRes.meta.changes === 0) {
          return new Response("OK", { status: 200 });
        }

        // 라이선스 생성 (환경별 접두사 BP- 또는 BPSB-)
        try {
          const license = await generateLicenseKey(env, email, environment);
          const licenseKey = license.license_key;
          await env.DB.prepare(
            "UPDATE payments SET license_key = ?, status = ? WHERE paddle_txn_id = ?"
          )
            .bind(licenseKey, "completed", txnId)
            .run();
        } catch (_) {
          await env.DB.prepare(
            "UPDATE payments SET status = ? WHERE paddle_txn_id = ?"
          )
            .bind("license_failed", txnId)
            .run();
        }

        return new Response("OK", { status: 200 });
      }

      // 라이선스 키 자가조회 (success 페이지 _ptxn 누락 fallback)
      // 보안: 최근 10분 이내 결제만 조회 가능 (이메일 brute force 윈도우 좁힘)
      if (path === "/lookup" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return new Response(JSON.stringify({ found: false, error: "invalid_email" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const payment = await env.DB.prepare(
          "SELECT license_key, paddle_txn_id FROM payments WHERE LOWER(email) = ? AND license_key IS NOT NULL AND status = 'completed' AND environment = ? AND created_at > datetime('now', '-10 minutes') ORDER BY id DESC LIMIT 1"
        ).bind(email, environment).first();

        await logWebhookEvent(env, "lookup", `email=${email} found=${!!payment} env=${environment}`, payment ? "info" : "warn", environment);

        if (!payment) {
          return new Response(JSON.stringify({ found: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({
          found: true,
          license_key: payment.license_key,
          txn_id: payment.paddle_txn_id,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 결제 완료 콜백 (Paddle이 ?_ptxn=TXN_ID 추가)
      if (path === "/success") {
        const txnId = url.searchParams.get("_ptxn");
        const retry = parseInt(url.searchParams.get("retry") || "0", 10);

        // _ptxn 없을 때: 자동 redirect 누락 케이스 → 이메일 조회 폼 표시
        if (!txnId) {
          return page(lookupPage());
        }

        const payment = await env.DB.prepare(
          "SELECT license_key, email, status, created_at FROM payments WHERE paddle_txn_id = ?"
        )
          .bind(txnId)
          .first();

        if (!payment) {
          // 웹훅 아직 미도착 — 최대 10회 재시도 (3초 간격, 총 30초)
          if (retry < 10) {
            return page(processingPage(txnId, retry));
          }
          return page(
            errorPage(
              "처리 지연",
              "결제는 완료되었으나 라이선스 발급이 지연되고 있습니다. 1분 후 이 페이지를 새로고침하시면 키가 표시됩니다. 5분 이상 지연되면 결제번호와 함께 문의해주세요.",
              txnId
            )
          );
        }

        if (payment.status === "license_failed") {
          return page(
            errorPage(
              "라이선스 발급 실패",
              "결제는 완료되었으나 라이선스 발급에 실패했습니다. 아래 결제번호와 함께 문의해주시면 즉시 수동 발급해드립니다.",
              txnId
            )
          );
        }

        return page(successPage(payment.license_key, payment.email, txnId, payment.created_at));
      }

      // 결제 취소
      if (path === "/cancel") {
        return page(CANCEL_PAGE);
      }

      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      try {
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        await env.DB.prepare(
          "INSERT INTO error_logs (worker, path, error, ip) VALUES (?, ?, ?, ?)"
        )
          .bind("checkout", path, String(err).substring(0, 500), ip)
          .run();
      } catch (_) {}
      return page(
        errorPage("내부 오류", "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."),
        500
      );
    }
  },
};
