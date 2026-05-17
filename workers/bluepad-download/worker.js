function mobileBlockedPage(lang) {
  const t = {
    ko: {
      title: "BluePad는 데스크톱 전용입니다",
      heading: "🖥️ 데스크톱 전용 앱",
      body: "BluePad는 Windows와 Linux 데스크톱용 마크다운 에디터입니다. 모바일·태블릿에서는 실행할 수 없습니다.",
      hint: "Windows 또는 Linux PC에서 이 페이지에 다시 접속하시거나, 아래 링크를 PC 브라우저에서 열어주세요.",
      link_url: "https://bluepad.work/ko/download/",
      link_label: "다운로드 페이지로 이동",
      copy_label: "다운로드 페이지 링크 복사",
      copied: "복사됨!",
    },
    ja: {
      title: "BluePadはデスクトップ専用です",
      heading: "🖥️ デスクトップ専用アプリ",
      body: "BluePadはWindowsとLinuxデスクトップ用のマークダウンエディタです。モバイル・タブレットでは実行できません。",
      hint: "WindowsまたはLinux PCで再度アクセスするか、下記リンクをPCブラウザで開いてください。",
      link_url: "https://bluepad.work/ja/download/",
      link_label: "ダウンロードページへ",
      copy_label: "ダウンロードページのリンクをコピー",
      copied: "コピーしました!",
    },
    en: {
      title: "BluePad is a desktop app",
      heading: "🖥️ Desktop-only app",
      body: "BluePad is a desktop markdown editor for Windows and Linux. It cannot run on mobile or tablet devices.",
      hint: "Please revisit this page on a Windows or Linux PC, or open the link below in a desktop browser.",
      link_url: "https://bluepad.work/en/download/",
      link_label: "Open download page",
      copy_label: "Copy download page link",
      copied: "Copied!",
    },
  }[lang] || null;
  const x = t || {
    title: "BluePad is a desktop app",
    heading: "🖥️ Desktop-only app",
    body: "BluePad is a desktop markdown editor for Windows and Linux.",
    hint: "Please revisit on a Windows or Linux PC.",
    link_url: "https://bluepad.work/en/download/",
    link_label: "Open download page",
    copy_label: "Copy link",
    copied: "Copied!",
  };
  const dlUrl = "https://bluepad.work/en/download/";
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${x.title}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,system-ui,'Segoe UI',sans-serif;background:#09090b;color:#fafafa;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;line-height:1.6}.card{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:36px 28px;max-width:440px;width:100%;text-align:center}.icon{font-size:48px;margin-bottom:16px}h1{font-size:20px;font-weight:700;margin-bottom:14px;color:#fafafa}p{font-size:14.5px;color:#a1a1aa;margin-bottom:14px}.hint{font-size:13px;color:#71717a;margin:20px 0 24px;padding:14px;background:#09090b;border-radius:9px;border:1px solid #27272a}.btn{display:block;padding:13px;background:#155dfc;color:#fff;border:none;border-radius:9px;font-size:14.5px;font-weight:600;text-decoration:none;margin-bottom:10px;cursor:pointer;width:100%}.btn.alt{background:#27272a;color:#a1a1aa}.btn:active{transform:translateY(1px)}#msg{font-size:13px;color:#22c55e;margin-top:8px;min-height:18px}</style></head>
<body><div class="card">
  <div class="icon">${x.heading.startsWith("🖥") ? "🖥️" : ""}</div>
  <h1>${x.heading}</h1>
  <p>${x.body}</p>
  <div class="hint">${x.hint}</div>
  <a href="${x.link_url}" class="btn">${x.link_label}</a>
  <button class="btn alt" onclick="navigator.clipboard.writeText('${dlUrl}').then(()=>{document.getElementById('msg').textContent='${x.copied}'})">${x.copy_label}</button>
  <div id="msg"></div>
</div></body></html>`;
}

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
    /^https?:\/\/tauri\.localhost$/.test(origin) ||
    /^tauri:\/\/localhost$/.test(origin) ||
    /^wry:\/\/localhost$/.test(origin)
  ) {
    allowOrigin = origin;
  } else {
    allowOrigin = "";
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Environment",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Update check endpoint
    if (url.pathname === "/update.json") {
      const object = await env.BUCKET.get("update.json");
      if (!object) {
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      const headers = new Headers(corsHeaders);
      headers.set("Content-Type", "application/json");
      headers.set("Cache-Control", "no-cache");
      return new Response(object.body, { headers });
    }

    // Update download (no key required - for app updater)
    if (url.pathname.startsWith("/update/download/")) {
      const fileName = url.pathname.replace("/update/download/", "");
      if (!fileName) {
        return new Response("Not Found", { status: 404, headers: corsHeaders });
      }
      const object = await env.BUCKET.get(fileName);
      if (!object) {
        return new Response("File not found", { status: 404, headers: corsHeaders });
      }
      const headers = new Headers(corsHeaders);
      headers.set("Content-Type", "application/octet-stream");
      headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
      if (object.size) {
        headers.set("Content-Length", object.size.toString());
      }
      return new Response(object.body, { headers });
    }

    // Download stats
    if (url.pathname === "/api/stats") {
      const result = await env.DB.prepare("SELECT COUNT(*) as count FROM downloads").first();
      return new Response(JSON.stringify({ downloads: result.count }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Sandbox MSI download — Admin 인증 필수 (?key=ADMIN_SECRET 또는 Authorization Bearer)
    // 일반 사용자는 받을 수 없도록 차단. 관리자 대시보드의 다운로드 버튼만 사용.
    if (url.pathname === "/sandbox/download") {
      const tokenFromHeader = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/, "");
      const tokenFromQuery = url.searchParams.get("key") || "";
      const provided = tokenFromHeader || tokenFromQuery;
      if (!env.ADMIN_SECRET || provided !== env.ADMIN_SECRET) {
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
      const fileName = "sandbox/BluePad-Sandbox-latest.msi";
      const object = await env.BUCKET.get(fileName);
      if (!object) {
        return new Response("Sandbox MSI not yet uploaded", { status: 404, headers: corsHeaders });
      }
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const userAgent = request.headers.get("User-Agent") || "unknown";
      const country = request.headers.get("CF-IPCountry") || "unknown";
      try {
        await env.DB.prepare(
          "INSERT INTO downloads (file_name, ip, user_agent, country, environment) VALUES (?, ?, ?, ?, 'sandbox')"
        ).bind(fileName, ip, userAgent, country).run();
      } catch (_) {}
      const headers = new Headers(corsHeaders);
      headers.set("Content-Type", "application/octet-stream");
      headers.set("Content-Disposition", `attachment; filename="BluePad-Sandbox-latest.msi"`);
      if (object.size) {
        headers.set("Content-Length", object.size.toString());
      }
      return new Response(object.body, { headers });
    }

    // File download (public)
    if (url.pathname.startsWith("/download/")) {
      const fileName = url.pathname.replace("/download/", "");
      if (!fileName) {
        return new Response("Not Found", { status: 404, headers: corsHeaders });
      }

      // 모바일/태블릿 차단 — Windows MSI는 데스크톱 전용. UA에 모바일 토큰 있고
      // bot/crawler가 아니면 안내 페이지 반환 (직접 URL 입력 우회도 차단).
      const ua = request.headers.get("User-Agent") || "";
      const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone|BlackBerry/i.test(ua);
      const isBot = /bot|spider|crawler|HeadlessChrome|GPTBot|ClaudeBot|Applebot/i.test(ua);
      if (isMobile && !isBot) {
        const al = (request.headers.get("Accept-Language") || "").toLowerCase();
        const lang = al.startsWith("ko") ? "ko" : (al.startsWith("ja") ? "ja" : "en");
        return new Response(mobileBlockedPage(lang), {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
        });
      }

      const object = await env.BUCKET.get(fileName);
      if (!object) {
        return new Response("File not found", { status: 404, headers: corsHeaders });
      }

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const userAgent = ua || "unknown";
      const country = request.headers.get("CF-IPCountry") || "unknown";
      await env.DB.prepare(
        "INSERT INTO downloads (file_name, ip, user_agent, country) VALUES (?, ?, ?, ?)"
      ).bind(fileName, ip, userAgent, country).run();

      const headers = new Headers(corsHeaders);
      headers.set("Content-Type", "application/octet-stream");
      headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
      if (object.httpMetadata?.contentType) {
        headers.set("Content-Type", object.httpMetadata.contentType);
      }
      if (object.size) {
        headers.set("Content-Length", object.size.toString());
      }
      return new Response(object.body, { headers });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
