/**
 * Cloudflare Worker: Subscriber Notification
 * 
 * Receives Resend webhook events (contact.created, contact.updated)
 * and sends a notification email to the site owner.
 * 
 * Secrets: RESEND_API_KEY, NOTIFY_EMAIL
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const payload = await request.json();
      const { type, data } = payload;

      if (!type || !data) {
        return new Response("Invalid payload", { status: 400 });
      }

      const email = data.email || "unknown";
      let subject = "";
      let body = "";

      switch (type) {
        case "contact.created":
          subject = `[+NODE] ${email} joined`;
          body = buildNotificationHtml({
            event: "NEW SUBSCRIBER",
            emoji: "✓",
            color: "#3B82F6",
            email,
            details: `Language: ${data.metadata?.language || "unknown"}`,
            timestamp: new Date().toISOString(),
          });
          break;

        case "contact.updated":
          const isUnsubscribe = data.unsubscribed === true;
          if (isUnsubscribe) {
            subject = `[-NODE] ${email} disconnected`;
            body = buildNotificationHtml({
              event: "UNSUBSCRIBED",
              emoji: "✗",
              color: "#F59E0B",
              email,
              details: "Contact has disconnected from the telemetry network.",
              timestamp: new Date().toISOString(),
            });
          } else {
            subject = `[~NODE] ${email} updated`;
            body = buildNotificationHtml({
              event: "CONTACT UPDATED",
              emoji: "~",
              color: "#6B7280",
              email,
              details: "Contact information was modified.",
              timestamp: new Date().toISOString(),
            });
          }
          break;

        case "contact.deleted":
          subject = `[✗NODE] ${email} removed`;
          body = buildNotificationHtml({
            event: "CONTACT DELETED",
            emoji: "✗",
            color: "#EF4444",
            email,
            details: "Contact was permanently removed.",
            timestamp: new Date().toISOString(),
          });
          break;

        default:
          return new Response(JSON.stringify({ status: "ignored", type }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
      }

      // Send notification to owner
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SYSTEM_LOGS <newsletter@kiquetal.dev>",
          to: env.NOTIFY_EMAIL,
          subject,
          html: body,
        }),
      });

      return new Response(JSON.stringify({ status: "notified", type, email }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

function buildNotificationHtml({ event, emoji, color, email, details, timestamp }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: monospace; background-color: #0A0C10; color: #E5E7EB; margin: 0; padding: 40px 20px; }
    .container { max-width: 500px; margin: 0 auto; border: 1px solid #1F2937; background-color: #111827; padding: 24px; }
    .header { font-size: 10px; color: #6B7280; letter-spacing: 0.2em; margin-bottom: 16px; text-transform: uppercase; }
    .event { font-size: 14px; color: ${color}; font-weight: bold; letter-spacing: 0.1em; margin-bottom: 12px; }
    .email { font-size: 16px; color: #FFFFFF; margin-bottom: 12px; }
    .details { font-size: 11px; color: #9CA3AF; margin-bottom: 16px; }
    .timestamp { font-size: 9px; color: #4B5563; border-top: 1px solid #1F2937; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">KIQUETAL / SUBSCRIBER EVENT</div>
    <div class="event">${emoji} ${event}</div>
    <div class="email">${email}</div>
    <div class="details">${details}</div>
    <div class="timestamp">${timestamp}</div>
  </div>
</body>
</html>`;
}
