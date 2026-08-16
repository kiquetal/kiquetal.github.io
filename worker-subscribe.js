export default {
  async fetch(request, env, ctx) {
    const allowedOrigins = [
      "https://kiquetal.dev",
      "http://localhost:4321",
      "http://127.0.0.1:4321"
    ];
    
    const origin = request.headers.get("Origin");
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "https://kiquetal.dev",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const payload = await request.json();
      const { email, language = "en" } = payload;

      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const apiKey = env.RESEND_API_KEY;
      const audienceId = env.RESEND_AUDIENCE_ID;

      if (!apiKey || !audienceId) {
        return new Response(JSON.stringify({ error: "Missing Cloudflare Environment variables" }), { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // Add subscriber to Resend Audience/Contacts
      const resendResponse = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          unsubscribed: false,
          metadata: {
            language: language
          }
        }),
      });

      const responseData = await resendResponse.json();

      // If contact was added successfully, send welcome email
      if (resendResponse.ok) {
        ctx.waitUntil(sendWelcomeEmail(apiKey, email, language));
      }

      return new Response(JSON.stringify(responseData), {
        status: resendResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};

async function sendWelcomeEmail(apiKey, email, language) {
  const isEs = language === "es";

  const subject = isEs 
    ? "[SYSTEM_LOGS] Conexión establecida" 
    : "[SYSTEM_LOGS] Connection established";

  const html = `<!DOCTYPE html>
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
    .text { font-size: 12px; line-height: 1.8; color: #9CA3AF; margin-bottom: 20px; }
    .highlight { color: #3B82F6; }
    .btn { display: inline-block; border: 1px solid #3B82F6; background: rgba(59, 130, 246, 0.1); color: #3B82F6; text-decoration: none; padding: 12px 24px; font-size: 10px; font-weight: bold; letter-spacing: 0.2em; margin-top: 10px; }
    .footer { border-top: 1px solid #374151; padding-top: 20px; margin-top: 40px; font-size: 10px; color: #6B7280; text-align: center; }
    .footer a { color: #9CA3AF; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="https://kiquetal.dev" class="logo">KIQUETAL / SYSTEM_LOGS</a>
      <div class="subheader">${isEs ? "CONFIRMACIÓN DE NODO" : "NODE CONFIRMATION"}</div>
    </div>

    <div>
      <div class="section-title">${isEs ? "Conexión establecida ✓" : "Connection established ✓"}</div>
      <p class="text">
        ${isEs 
          ? `Tu nodo ha sido registrado en la red de telemetría. Recibirás transmisiones semanales cada <span class="highlight">miércoles</span> cuando se compilen nuevas entradas en el sistema.`
          : `Your node has been registered in the telemetry network. You will receive weekly broadcasts every <span class="highlight">Wednesday</span> when new entries are compiled into the system.`
        }
      </p>
      <p class="text">
        ${isEs
          ? "Temas: Arquitectura de sistemas distribuidos, Cloud Native, Seguridad, Ingeniería de resiliencia."
          : "Topics: Distributed systems architecture, Cloud Native, Security, Resilience engineering."
        }
      </p>
      <a href="https://kiquetal.dev/blog" class="btn">${isEs ? "EXPLORAR REGISTROS" : "EXPLORE LOGS"}</a>
    </div>

    <div class="footer">
      <p>${isEs ? "Recibirás transmisiones cada miércoles si hay nuevas entradas." : "You will receive broadcasts every Wednesday when new entries are available."}</p>
    </div>
  </div>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SYSTEM_LOGS <newsletter@kiquetal.dev>",
      to: email,
      subject: subject,
      html: html,
    }),
  });
}