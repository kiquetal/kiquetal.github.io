/**
 * Cloudflare Worker: Publish Reminder
 * 
 * Runs weekly via cron trigger. Checks the RSS feed for the latest post date.
 * If no post has been published in the last 2 weeks, sends a reminder email.
 * Continues reminding weekly with escalating urgency until a new post appears.
 * 
 * Cron schedule: "0 12 */5 * *" (every 5 days at 12:00 UTC)
 * 
 * KV Namespace binding: REMINDER_STATE
 * Secrets: RESEND_API_KEY, NOTIFY_EMAIL
 */

const KV_LAST_REMINDER = "reminder:last_sent";
const KV_REMINDER_COUNT = "reminder:count";
const BLOG_RSS_URL = "https://kiquetal.dev/rss.xml";
const INACTIVITY_THRESHOLD_DAYS = 15; // 15 days before first reminder

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkAndRemind(env));
  },

  // Also support manual trigger via HTTP for testing
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("POST to trigger reminder check manually", { status: 405 });
    }

    const authHeader = request.headers.get("X-Reminder-Secret");
    if (!authHeader || authHeader !== env.REMINDER_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const result = await checkAndRemind(env);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
};

async function checkAndRemind(env) {
  const latestPostDate = await getLatestPostDate();

  if (!latestPostDate) {
    return { status: "error", reason: "Could not fetch RSS feed" };
  }

  const now = new Date();
  const daysSinceLastPost = Math.floor((now - latestPostDate) / (1000 * 60 * 60 * 24));

  // If within threshold, reset reminder count and skip
  if (daysSinceLastPost < INACTIVITY_THRESHOLD_DAYS) {
    await env.REMINDER_STATE.put(KV_REMINDER_COUNT, "0");
    return { status: "ok", daysSinceLastPost, reason: "Within threshold, no reminder needed" };
  }

  // Get current reminder count
  const countStr = await env.REMINDER_STATE.get(KV_REMINDER_COUNT) || "0";
  const reminderCount = parseInt(countStr, 10) + 1;

  // Send reminder
  await sendReminder(env, daysSinceLastPost, reminderCount, latestPostDate);

  // Update state
  await env.REMINDER_STATE.put(KV_REMINDER_COUNT, String(reminderCount));
  await env.REMINDER_STATE.put(KV_LAST_REMINDER, now.toISOString());

  return { status: "reminded", daysSinceLastPost, reminderCount };
}

async function getLatestPostDate() {
  try {
    const res = await fetch(BLOG_RSS_URL);
    if (!res.ok) return null;

    const xml = await res.text();

    // Extract the first <pubDate> from RSS (most recent post)
    const pubDateMatch = xml.match(/<pubDate>([^<]+)<\/pubDate>/);
    if (pubDateMatch) {
      return new Date(pubDateMatch[1]);
    }

    // Fallback: try <dc:date> or <updated> for Atom feeds
    const dateMatch = xml.match(/<(?:dc:date|updated)>([^<]+)<\/(?:dc:date|updated)>/);
    if (dateMatch) {
      return new Date(dateMatch[1]);
    }

    return null;
  } catch {
    return null;
  }
}

async function sendReminder(env, daysSinceLastPost, reminderCount, lastPostDate) {
  const urgency = getUrgency(reminderCount);
  const weeksInactive = Math.floor(daysSinceLastPost / 7);

  const subject = `${urgency.prefix} ${daysSinceLastPost} days since last post`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: monospace; background-color: #0A0C10; color: #E5E7EB; margin: 0; padding: 40px 20px; }
    .container { max-width: 500px; margin: 0 auto; border: 1px solid ${urgency.borderColor}; background-color: #111827; padding: 24px; }
    .header { font-size: 10px; color: #6B7280; letter-spacing: 0.2em; margin-bottom: 16px; text-transform: uppercase; }
    .alert { font-size: 14px; color: ${urgency.color}; font-weight: bold; letter-spacing: 0.1em; margin-bottom: 12px; }
    .stats { font-size: 12px; color: #9CA3AF; margin-bottom: 8px; }
    .message { font-size: 12px; line-height: 1.8; color: #9CA3AF; margin: 20px 0; padding: 16px; border-left: 2px solid ${urgency.color}; }
    .footer { font-size: 9px; color: #4B5563; border-top: 1px solid #1F2937; padding-top: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">KIQUETAL / PUBLISH REMINDER</div>
    <div class="alert">${urgency.emoji} ${urgency.title}</div>
    <div class="stats">Days since last post: <strong style="color: #FFFFFF;">${daysSinceLastPost}</strong></div>
    <div class="stats">Weeks inactive: <strong style="color: #FFFFFF;">${weeksInactive}</strong></div>
    <div class="stats">Last published: <strong style="color: #FFFFFF;">${lastPostDate.toISOString().split('T')[0]}</strong></div>
    <div class="stats">Reminder #: <strong style="color: #FFFFFF;">${reminderCount}</strong></div>
    <div class="message">${urgency.message}</div>
    <div class="footer">This reminder will stop once a new post appears in the RSS feed.</div>
  </div>
</body>
</html>`;

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
      html,
    }),
  });
}

function getUrgency(reminderCount) {
  if (reminderCount === 1) {
    return {
      prefix: "[REMINDER]",
      emoji: "⚡",
      title: "TIME TO PUBLISH",
      color: "#3B82F6",
      borderColor: "#1F2937",
      message: "15 days without a new entry. Your subscribers are waiting. Draft something — even a short post counts.",
    };
  } else if (reminderCount === 2) {
    return {
      prefix: "[REMINDER ×2]",
      emoji: "⚠️",
      title: "INACTIVITY WARNING",
      color: "#F59E0B",
      borderColor: "#92400E",
      message: "20 days of silence. Momentum is hard to rebuild. Pick a topic from your drafts or write about what you learned this week.",
    };
  } else if (reminderCount === 3) {
    return {
      prefix: "[REMINDER ×3]",
      emoji: "🔥",
      title: "CRITICAL INACTIVITY",
      color: "#EF4444",
      borderColor: "#991B1B",
      message: "25 days without publishing. Your system is going cold. Ship something today — imperfect beats absent.",
    };
  } else {
    return {
      prefix: `[REMINDER ×${reminderCount}]`,
      emoji: "💀",
      title: "SYSTEM OFFLINE",
      color: "#EF4444",
      borderColor: "#991B1B",
      message: `${reminderCount * 5 + 10} days overdue. Just open your editor and write for 20 minutes. No excuses. The network needs signal.`,
    };
  }
}
