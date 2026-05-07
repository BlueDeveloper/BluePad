// BluePad Checkout Worker
// 결제 흐름: / → /create-order → PayPal → /success (capture + license)

function getCorsHeaders(request) {
  const origin = request ? request.headers.get("Origin") : null;
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function json(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
  });
}

function page(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ── PayPal API ──

async function getAccessToken(env) {
  const auth = btoa(env.PAYPAL_CLIENT_ID + ":" + env.PAYPAL_SECRET);
  const res = await fetch(env.PAYPAL_API + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token;
}

async function createOrder(env, token) {
  const res = await fetch(env.PAYPAL_API + "/v2/checkout/orders", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: env.PRODUCT_PRICE },
          description: env.PRODUCT_NAME,
        },
      ],
      application_context: {
        return_url: "https://bluepad-checkout.blueehdwp.workers.dev/success",
        cancel_url: "https://bluepad-checkout.blueehdwp.workers.dev/cancel",
        brand_name: "BluePad",
        user_action: "PAY_NOW",
      },
    }),
  });
  return res.json();
}

async function captureOrder(env, token, orderId) {
  const res = await fetch(env.PAYPAL_API + "/v2/checkout/orders/" + orderId + "/capture", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
  });
  return res.json();
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

const CHECKOUT_PAGE = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BluePad Pro - Purchase</title>
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
.btn{display:block;width:100%;padding:14px;background:#155dfc;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:650;cursor:pointer;transition:background .15s;text-decoration:none}
.btn:hover{background:#3b7dff}
.secure{margin-top:16px;font-size:11px;color:#52525b}
.legal{margin-top:16px;font-size:11px;color:#3f3f46;line-height:1.6}
.legal a{color:#52525b}
</style>
</head>
<body>
<div class="card">
  <div class="logo">Blue<em>Pad</em> Pro</div>
  <div class="sub">Unlock all features of the markdown editor</div>
  <div class="price"><span>$</span>10.99</div>
  <div class="note">One-time payment &#183; Lifetime updates &#183; 3 devices</div>
  <ul class="features">
    <li>Unlimited tabs</li>
    <li>All 4 themes</li>
    <li>Focus mode</li>
    <li>HTML / PDF export</li>
  </ul>
  <a href="/create-order" class="btn">Pay with PayPal</a>
  <div class="secure">&#128274; Secure PayPal checkout</div>
  <div class="legal">
    &#x26A0; 디지털 상품 특성상 라이선스 활성화 후 환불이 제한될 수 있습니다.<br>
    구매 전 <a href="https://bluepad.work/legal/eula.html" target="_blank">이용약관</a>을 확인해주세요.<br>
    상호: 비알피(BRP) | 대표: 윤동제 | 사업자: 511-32-01572
  </div>
</div>
</body>
</html>`;

function successPage(licenseKey, email, orderId) {
  const safeKey = escHtml(licenseKey);
  const safeEmail = escHtml(email);
  const safeOrder = escHtml(orderId);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>BluePad Pro - Complete</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,sans-serif;background:#09090b;color:#fafafa;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:48px 40px;max-width:480px;width:100%;text-align:center}.check{font-size:48px;margin-bottom:16px}h1{font-size:24px;font-weight:700;margin-bottom:8px}.sub{color:#a1a1aa;font-size:14px;margin-bottom:32px}.key-box{background:#09090b;border:1px solid #27272a;border-radius:10px;padding:20px;margin-bottom:24px}.key-label{font-size:12px;color:#52525b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em}.key-value{font-family:monospace;font-size:20px;font-weight:700;color:#22c55e;letter-spacing:0.02em;word-break:break-all;user-select:all}.email-info{font-size:13px;color:#52525b;margin-bottom:8px}.order-info{font-size:12px;color:#3f3f46;margin-bottom:24px}.steps{text-align:left;margin-bottom:28px;list-style:none;counter-reset:step}.steps li{padding:6px 0;font-size:13.5px;color:#a1a1aa;counter-increment:step}.steps li::before{content:counter(step) ".";color:#155dfc;font-weight:700;margin-right:10px}.btn{display:inline-block;padding:12px 28px;background:#155dfc;color:#fff;border-radius:9px;text-decoration:none;font-size:14px;font-weight:600}.help{margin-top:20px;font-size:12px;color:#52525b}</style></head>
<body><div class="card">
  <div class="check">&#9989;</div>
  <h1>Purchase Complete!</h1>
  <div class="sub">Your BluePad Pro license has been generated</div>
  <div class="key-box">
    <div class="key-label">License Key</div>
    <div class="key-value">${safeKey}</div>
  </div>
  <div class="email-info">Email: ${safeEmail}</div>
  <div class="order-info">Order: ${safeOrder}</div>
  <ol class="steps">
    <li>Copy the license key above</li>
    <li>Open BluePad &rarr; Settings &rarr; Activate License</li>
    <li>Paste the key and activate</li>
  </ol>
  <a href="https://bluepad.work" class="btn">Go to BluePad</a>
  <div class="help">Need help? Contact <a href="mailto:blueehdwp@gmail.com" style="color:#a1a1aa">blueehdwp@gmail.com</a><br>Please include your order ID for faster support.</div>
</div></body></html>`;
}

function errorPage(title, message, orderId) {
  const safeTitle = escHtml(title);
  const safeMsg = escHtml(message);
  const safeOrder = orderId ? escHtml(orderId) : "";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>BluePad - Error</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,sans-serif;background:#09090b;color:#fafafa;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{text-align:center;max-width:480px;padding:40px}.icon{font-size:48px;margin-bottom:16px}h1{font-size:24px;margin-bottom:12px}p{color:#a1a1aa;margin-bottom:8px;font-size:14px;line-height:1.6}.order{font-family:monospace;color:#52525b;font-size:12px;margin-bottom:24px}a{color:#155dfc;text-decoration:none;font-weight:600}</style></head>
<body><div class="card">
  <div class="icon">&#9888;&#65039;</div>
  <h1>${safeTitle}</h1>
  <p>${safeMsg}</p>
  ${safeOrder ? `<div class="order">Order ID: ${safeOrder}</div>` : ""}
  <p>문의: <a href="mailto:blueehdwp@gmail.com">blueehdwp@gmail.com</a></p>
  <p style="margin-top:16px"><a href="https://bluepad.work">&larr; Back to BluePad</a></p>
</div></body></html>`;
}

const CANCEL_PAGE = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Cancelled</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,sans-serif;background:#09090b;color:#fafafa;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{text-align:center;max-width:400px}h1{font-size:24px;margin-bottom:12px}p{color:#a1a1aa;margin-bottom:24px}a{color:#155dfc;text-decoration:none;font-weight:600}</style></head>
<body><div class="card"><h1>Payment Cancelled</h1><p>You can try again anytime.</p><a href="https://bluepad.work">&larr; Back to BluePad</a></div></body></html>`;

// ── Main Handler ──

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: getCorsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 구매 페이지
      if (path === "/" || path === "/checkout") {
        return page(CHECKOUT_PAGE);
      }

      // PayPal 주문 생성 → PayPal 승인 페이지로 리다이렉트
      if (path === "/create-order") {
        const token = await getAccessToken(env);
        const order = await createOrder(env, token);
        const approveUrl = order.links && order.links.find((l) => l.rel === "approve");
        if (approveUrl) {
          return Response.redirect(approveUrl.href, 303);
        }
        return page(errorPage("Order Creation Failed", "PayPal 주문 생성에 실패했습니다. 다시 시도해주세요."), 500);
      }

      // PayPal 결제 완료 콜백
      if (path === "/success") {
        const orderId = url.searchParams.get("token");
        if (!orderId) {
          return page(errorPage("Invalid Request", "주문 정보가 없습니다."), 400);
        }

        // ── FIX VULN-1: 리플레이 방지 — 이미 처리된 주문인지 확인 ──
        const existingPayment = await env.DB.prepare(
          "SELECT license_key, email FROM payments WHERE paypal_order_id = ?"
        ).bind(orderId).first();

        if (existingPayment) {
          // 이미 처리된 주문 → 기존 라이선스 키 다시 보여줌 (새 키 생성 안 함)
          return page(successPage(existingPayment.license_key, existingPayment.email, orderId));
        }

        // PayPal 캡처
        const token = await getAccessToken(env);
        const capture = await captureOrder(env, token, orderId);

        if (capture.status !== "COMPLETED") {
          return page(errorPage(
            "Payment Not Completed",
            "결제가 완료되지 않았습니다. 상태: " + (capture.status || "unknown"),
            orderId
          ), 400);
        }

        // ── FIX VULN-2: 결제 금액 검증 ──
        const captureData = capture.purchase_units?.[0]?.payments?.captures?.[0];
        const paidAmount = captureData?.amount?.value;
        const paidCurrency = captureData?.amount?.currency_code;

        if (paidAmount !== env.PRODUCT_PRICE || paidCurrency !== "USD") {
          // 금액 불일치 — 기록만 하고 라이선스 발급 안 함
          await env.DB.prepare(
            "INSERT INTO payments (paypal_order_id, email, amount, currency, status) VALUES (?, ?, ?, ?, 'amount_mismatch')"
          ).bind(orderId, capture.payer?.email_address || "unknown", paidAmount || "0", paidCurrency || "unknown").run();

          return page(errorPage(
            "Payment Verification Failed",
            "결제 금액이 일치하지 않습니다. 고객센터에 문의해주세요.",
            orderId
          ), 400);
        }

        const email = capture.payer?.email_address || "unknown";

        // ── FIX VULN-4: 캡처 성공 즉시 기록 (라이선스 생성 전) ──
        await env.DB.prepare(
          "INSERT INTO payments (paypal_order_id, email, amount, currency, status) VALUES (?, ?, ?, ?, 'captured')"
        ).bind(orderId, email, paidAmount, paidCurrency).run();

        // 라이선스 키 생성
        let licenseKey;
        try {
          const license = await generateLicenseKey(env, email);
          licenseKey = license.license_key;

          // 결제 기록에 라이선스 키 연결
          await env.DB.prepare(
            "UPDATE payments SET license_key = ?, status = 'completed' WHERE paypal_order_id = ?"
          ).bind(licenseKey, orderId).run();

        } catch (licenseErr) {
          // ── FIX VULN-4: 라이선스 생성 실패 시 복구 안내 ──
          await env.DB.prepare(
            "UPDATE payments SET status = 'license_failed' WHERE paypal_order_id = ?"
          ).bind(orderId).run();

          return page(errorPage(
            "License Generation Failed",
            "결제는 완료되었으나 라이선스 발급에 실패했습니다. 아래 주문번호를 포함하여 blueehdwp@gmail.com으로 문의해주세요. 즉시 수동 발급해드리겠습니다.",
            orderId
          ), 500);
        }

        return page(successPage(licenseKey, email, orderId));
      }

      // 결제 취소
      if (path === "/cancel") {
        return page(CANCEL_PAGE);
      }

      return json({ error: "not_found" }, 404, request);

    } catch (err) {
      return page(errorPage(
        "Internal Error",
        "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      ), 500);
    }
  },
};
