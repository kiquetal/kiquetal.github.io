/**
 * Cloudflare Worker: Newsletter Broadcaster
 * 
 * Receives blog post metadata from GitHub Actions (Wednesday cron),
 * checks KV state to determine if the post is new, and if so,
 * creates and sends a broadcast via Resend Broadcast API.
 * 
 * KV Namespace binding: NEWSLETTER_STATE
 * Secrets: RESEND_API_KEY, RESEND_SEGMENT_ID, NEWSLETTER_SECRET
 */

const KV_KEY = "newsletter:last_sent_slug";

export default {
  async fetch(request, env, ctx) {
    // Only accept POST
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Verify shared secret (GitHub Action must send this header)
    const authHeader = request.headers.get("X-Newsletter-Secret");
    if (!authHeader || authHeader !== env.NEWSLETTER_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const payload = await request.json();
      const { slug, titleEn, titleEs, excerptEn, excerptEs, postUrl } = payload;

      if (!slug || !titleEn || !postUrl) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: slug, titleEn, postUrl" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check KV state — was this post already sent?
      const lastSentSlug = await env.NEWSLETTER_STATE.get(KV_KEY);

      if (lastSentSlug === slug) {
        return new Response(
          JSON.stringify({ status: "skipped", reason: "Post already sent", slug }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Build the email HTML
      const emailHtml = buildEmailHtml({ titleEn, titleEs, excerptEn, excerptEs, postUrl });

      // Create and send broadcast via Resend Broadcast API
      // Uses segment_id (what you see in the Resend UI as "Segment ID")
      const resendRes = await fetch("https://api.resend.com/broadcasts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          segment_id: env.RESEND_SEGMENT_ID,
          from: "SYSTEM_LOGS <newsletter@kiquetal.dev>",
          subject: `[SYSTEM_LOGS] ${titleEn}`,
          html: emailHtml,
          name: `Weekly: ${slug}`,
          send: true, // Create and send immediately
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        return new Response(
          JSON.stringify({ error: "Resend Broadcast API error", status: resendRes.status, details: errBody }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }

      const resendData = await resendRes.json();

      // Update KV state with the sent slug
      await env.NEWSLETTER_STATE.put(KV_KEY, slug);

      return new Response(
        JSON.stringify({ status: "sent", slug, broadcastId: resendData.id }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};

/**
 * Builds the bilingual newsletter email HTML.
 * Supports Resend contact properties like {{{contact.first_name|there}}}
 */
function buildEmailHtml({ titleEn, titleEs, excerptEn, excerptEs, postUrl }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: monospace; background-color: #0A0C10; color: #E5E7EB; margin: 0; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; border: 1px solid #1F2937; background-color: #111827; padding: 30px; }
    .header { border-bottom: 1px solid #374151; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 16px; font-weight: bold; letter-spacing: 0.2em; color: #FFFFFF; text-decoration: none; }
    .subheader { font-size: 11px; color: #3B82F6; letter-spacing: 0.1em; margin-top: 5px; }
    .section-title { font-style: italic; font-size: 20px; color: #FFFFFF; margin: 20px 0 10px 0; }
    .text { font-size: 12px; line-height: 1.6; color: #9CA3AF; margin-bottom: 20px; }
    .btn { display: inline-block; border: 1px solid #3B82F6; background: rgba(59, 130, 246, 0.1); color: #3B82F6; text-decoration: none; padding: 12px 24px; font-size: 10px; font-weight: bold; letter-spacing: 0.2em; margin-top: 10px; }
    .divider { margin: 40px 0; border-top: 1px dashed #374151; }
    .footer { border-top: 1px solid #374151; padding-top: 20px; margin-top: 40px; font-size: 10px; color: #6B7280; text-align: center; }
    .footer a { color: #9CA3AF; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="https://kiquetal.dev" class="logo">KIQUETAL / SYSTEM_LOGS</a>
      <div class="subheader">WEEKLY BROADCAST — NEW ENTRY COMPILED</div>
    </div>

    <div>
      <div class="section-title">New Entry: "${titleEn}"</div>
      <p class="text">${excerptEn || "A new systems entry has been compiled."}</p>
      <a href="${postUrl}" class="btn">READ ENTRY (EN)</a>
    </div>

    <div class="divider"></div>

    <div>
      <div class="section-title">Nueva Entrada: "${titleEs || titleEn}"</div>
      <p class="text">${excerptEs || "Se ha compilado un nuevo registro del sistema."}</p>
      <a href="${postUrl}" class="btn">LEER ENTRADA (ES)</a>
    </div>

    <div class="footer">
      <p>You received this because you subscribed to telemetry broadcasts from kiquetal.dev.</p>
      <p>Recibiste este correo porque estás suscrito a las emisiones de kiquetal.dev.</p>
      <p style="margin-top: 15px;">
        <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe / Darse de baja</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
