/**
 * Cloudflare Worker: Subscriber Notification
 * 
 * Receives Resend webhook events (contact.created, contact.updated, contact.deleted)
 * Verifies Svix signature to ensure request is from Resend.
 * Sends a notification email to the site owner.
 * 
 * Secrets: RESEND_API_KEY, NOTIFY_EMAIL, WEBHOOK_SIGNING_SECRET
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const rawBody = await request.text();

    // Verify Svix webhook signature
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing webhook signature headers", { status: 401 });
    }

    const isValid = await verifyWebhookSignature(
      rawBody,
      svixId,
      svixTimestamp,
      svixSignature,
      env.WEBHOOK_SIGNING_SECRET
    );

    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    // Reject old timestamps (>5 minutes) to prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(svixTimestamp, 10);
    if (Math.abs(now - ts) > 300) {
      return new Response("Timestamp too old", { status: 401 });
    }

    try {
      const payload = JSON.parse(rawBody);
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

/**
 * Verify Svix webhook signature using Web Crypto API (native in CF Workers).
 * Resend signing secret format: "whsec_<base64-encoded-key>"
 */
async function verifyWebhookSignature(payload, msgId, timestamp, signatures, secret) {
  // Remove "whsec_" prefix and decode base64 key
  const secretBytes = base64ToUint8Array(secret.replace("whsec_", ""));

  // Create the signed content: "msg_id.timestamp.body"
  const signedContent = `${msgId}.${timestamp}.${payload}`;
  const encoder = new TextEncoder();

  // Import key for HMAC-SHA256
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign the content
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const expectedSignature = "v1," + uint8ArrayToBase64(new Uint8Array(signatureBytes));

  // Compare against all provided signatures (comma-separated)
  const providedSignatures = signatures.split(" ");
  return providedSignatures.some(sig => sig.trim() === expectedSignature);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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
