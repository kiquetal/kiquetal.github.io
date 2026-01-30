export default {
  async fetch(request, env, ctx) {
    const allowedOrigin = "https://kiquetal.dev";
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    // Verify Origin header for extra security
    const origin = request.headers.get("Origin");
    if (origin && origin !== allowedOrigin) {
      return new Response("Forbidden: Invalid Origin", { status: 403 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { 
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      const payload = await request.json();
      console.log("Received payload:", JSON.stringify(payload));
      
      const apiKey = env.RESEND_API_KEY;

      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY environment variable" }), { 
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          } 
        });
      }

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await resendResponse.json();
      console.log("Resend response:", JSON.stringify(data));

      return new Response(JSON.stringify({
        ...data,
        _debug_payload_sent: payload
      }), {
        status: resendResponse.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
  },
};
