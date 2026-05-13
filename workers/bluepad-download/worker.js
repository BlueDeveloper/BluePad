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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
      const object = await env.BUCKET.get(fileName);
      if (!object) {
        return new Response("File not found", { status: 404, headers: corsHeaders });
      }

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const userAgent = request.headers.get("User-Agent") || "unknown";
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
