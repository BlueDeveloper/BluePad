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

async function getPaddleCustomerEmail(customerId, apiKey) {
  const res = await fetch(`https://api.paddle.com/customers/${customerId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json();
  return data.data?.email || null;
}

async function logWebhookEvent(env, type, summary) {
  try {
    await env.DB.prepare(
      "INSERT INTO error_logs (worker, path, error, ip) VALUES (?, ?, ?, ?)"
    ).bind("checkout", "webhook", `[${type}] ${summary}`, "paddle").run();
  } catch (_) {}
}

async function handleAdjustment(env, data) {
  const action = data.action;
  if (action !== "refund" && action !== "chargeback") return;
  const txnId = data.transaction_id;
  if (!txnId) return;

  const payment = await env.DB.prepare(
    "SELECT license_key FROM payments WHERE paddle_txn_id = ?"
  ).bind(txnId).first();
  if (!payment?.license_key) return;

  await env.DB.prepare(
    "UPDATE licenses SET active = 0 WHERE license_key = ?"
  ).bind(payment.license_key).run();
  await env.DB.prepare(
    "DELETE FROM activations WHERE license_key = ?"
  ).bind(payment.license_key).run();
  await env.DB.prepare(
    "UPDATE payments SET refunded = 1, status = 'refunded', refunded_at = datetime('now') WHERE paddle_txn_id = ?"
  ).bind(txnId).run();

  await logWebhookEvent(env, "adjustment.created", `auto-refund: license=${payment.license_key} txn=${txnId} action=${action}`);
}

async function generateLicenseKey(env, email) {
  const url = env.LICENSE_API + "/api/admin/generate";
  const opts = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + env.LICENSE_ADMIN_SECRET,
    },
    body: JSON.stringify({ email, max_devices: 3 }),
  };
  const res = env.LICENSE_SERVICE
    ? await env.LICENSE_SERVICE.fetch(new Request(url, opts))
    : await fetch(url, opts);
  return res.json();
}

// ── Pages ──

function checkoutPage(env) {
  const token = escHtml(env.PADDLE_CLIENT_TOKEN || "");
  const priceId = escHtml(env.PADDLE_PRICE_ID || "");
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
    &#x26A0; 디지털 상품 특성상 라이선스 활성화 후 환불이 제한될 수 있습니다.<br>
    구매 전 <a href="https://bluepad.work/legal/eula.html" target="_blank">이용약관</a>을 확인해주세요.<br>
    상호: 비알피(BRP) | 대표: 윤동제 | 사업자: 511-32-01572
  </div>
</div>
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
<script>
Paddle.Initialize({ token: '${token}' });
function openCheckout() {
  document.getElementById('buyBtn').disabled = true;
  Paddle.Checkout.open({
    items: [{ priceId: '${priceId}', quantity: 1 }],
    settings: {
      successUrl: 'https://bluepad-checkout.blueehdwp.workers.dev/success',
      displayMode: 'overlay',
    },
    eventCallback: function(e) {
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

function successPage(licenseKey, email, txnId) {
  const safeKey = escHtml(licenseKey);
  const safeEmail = escHtml(email);
  const safeTxn = escHtml(txnId);
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
  <div class="info" style="font-size:11px;color:#3f3f46;margin-bottom:24px">결제번호: ${safeTxn}</div>
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
    const path = url.pathname;

    try {
      // 구매 페이지
      if (path === "/" || path === "/checkout") {
        return page(checkoutPage(env));
      }

      // Paddle 웹훅 수신
      if (path === "/paddle-webhook" && request.method === "POST") {
        const rawBody = await request.text();
        const sigHeader = request.headers.get("Paddle-Signature");

        const valid = await verifyPaddleWebhook(
          rawBody,
          sigHeader,
          env.PADDLE_WEBHOOK_SECRET
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
            await handleAdjustment(env, d);
          } else if (eventType === "adjustment.updated") {
            await logWebhookEvent(env, eventType, `adj=${d.id} action=${d.action} status=${d.status} txn=${d.transaction_id}`);
          }

          // 결제 관련 추적
          else if (eventType === "transaction.canceled") {
            await logWebhookEvent(env, eventType, `txn=${d.id} customer=${d.customer_id || "unknown"}`);
          } else if (eventType === "transaction.payment_failed") {
            await logWebhookEvent(env, eventType, `txn=${d.id} customer=${d.customer_id || "unknown"}`);
          } else if (eventType === "transaction.updated") {
            await logWebhookEvent(env, eventType, `txn=${d.id} status=${d.status}`);
          } else if (eventType === "transaction.revised") {
            await logWebhookEvent(env, eventType, `txn=${d.id} status=${d.status}`);
          }

          // 고객 정보 변경 (이메일 변경 추적)
          else if (eventType === "customer.updated") {
            await logWebhookEvent(env, eventType, `customer=${d.id} email=${d.email || ""}`);
          }

          // 정산
          else if (eventType === "payout.created") {
            await logWebhookEvent(env, eventType, `payout=${d.id} amount=${d.amount} ${d.currency_code}`);
          } else if (eventType === "payout.paid") {
            await logWebhookEvent(env, eventType, `payout=${d.id} amount=${d.amount} ${d.currency_code} paid_at=${d.paid_at}`);
          }

          // 🚨 보안 핵심 이벤트
          else if (eventType === "api_key_exposure.created") {
            await logWebhookEvent(env, eventType, `🚨🚨 SECURITY: API KEY EXPOSED: ${d.api_key_id || d.id || ""} — REVOKE IMMEDIATELY`);
          } else if (eventType === "api_key.revoked") {
            await logWebhookEvent(env, eventType, `🚨 SECURITY: API key revoked: ${d.name || ""} (${d.id || ""})`);
          } else if (eventType === "api_key.expired") {
            await logWebhookEvent(env, eventType, `🚨 API KEY EXPIRED: ${d.name || ""} (${d.id || ""})`);
          } else if (eventType === "api_key.expiring") {
            await logWebhookEvent(env, eventType, `⚠️ API key expiring: ${d.name || ""} (${d.id || ""}) expires_at=${d.expires_at || ""}`);
          } else if (eventType === "api_key.created") {
            await logWebhookEvent(env, eventType, `[SECURITY] new api_key: ${d.name || ""} (${d.id || ""})`);
          } else if (eventType === "api_key.updated") {
            await logWebhookEvent(env, eventType, `[SECURITY] api_key updated: ${d.name || ""} (${d.id || ""})`);
          } else if (eventType === "client_token.created") {
            await logWebhookEvent(env, eventType, `[SECURITY] new client_token: ${d.name || ""} (${d.id || ""})`);
          } else if (eventType === "client_token.updated") {
            await logWebhookEvent(env, eventType, `[SECURITY] client_token updated: ${d.name || ""} (${d.id || ""})`);
          } else if (eventType === "client_token.revoked") {
            await logWebhookEvent(env, eventType, `🚨 SECURITY: client_token revoked: ${d.name || ""} (${d.id || ""})`);
          }

          return new Response("OK", { status: 200 });
        }

        const txn = event.data;
        const txnId = txn.id;

        // 중복 처리 방지
        const existing = await env.DB.prepare(
          "SELECT id FROM payments WHERE paddle_txn_id = ?"
        )
          .bind(txnId)
          .first();
        if (existing) {
          return new Response("OK", { status: 200 });
        }

        // 고객 이메일 조회
        let email = "unknown";
        try {
          if (txn.customer_id) {
            email =
              (await getPaddleCustomerEmail(txn.customer_id, env.PADDLE_API_KEY)) ||
              "unknown";
          }
        } catch (_) {}

        // 결제 금액 (Paddle은 센트 단위 문자열)
        const amountCents = parseInt(
          String(txn.payments?.[0]?.amount || "0"),
          10
        );
        const amountDecimal = (amountCents / 100).toFixed(2);
        const currency = txn.currency_code || "USD";

        // 결제 기록 삽입
        await env.DB.prepare(
          "INSERT INTO payments (paddle_txn_id, email, amount, currency, status) VALUES (?, ?, ?, ?, ?)"
        )
          .bind(txnId, email, amountDecimal, currency, "captured")
          .run();

        // 라이선스 생성
        try {
          const license = await generateLicenseKey(env, email);
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

      // 결제 완료 콜백 (Paddle이 ?_ptxn=TXN_ID 추가)
      if (path === "/success") {
        const txnId = url.searchParams.get("_ptxn");
        const retry = parseInt(url.searchParams.get("retry") || "0", 10);

        if (!txnId) {
          return page(errorPage("잘못된 요청", "결제 정보를 찾을 수 없습니다."), 400);
        }

        const payment = await env.DB.prepare(
          "SELECT license_key, email, status FROM payments WHERE paddle_txn_id = ?"
        )
          .bind(txnId)
          .first();

        if (!payment) {
          // 웹훅 아직 미도착 — 최대 5회 재시도 (3초 간격)
          if (retry < 5) {
            return page(processingPage(txnId, retry));
          }
          return page(
            errorPage(
              "처리 지연",
              "결제는 완료되었으나 라이선스 발급에 시간이 걸리고 있습니다. 잠시 후 이 페이지를 새로고침하거나 아래 이메일로 문의해주세요.",
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

        return page(successPage(payment.license_key, payment.email, txnId));
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
