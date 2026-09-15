import { env } from "cloudflare:workers";
import { requireUser } from "../../../../lib/api-auth";

const siteUrl = "https://studysync.studysync.workers.dev";

function routeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("Supabase user validation")) {
    return "StudySync could not verify your account. Please sign in again.";
  }
  return "StudySync could not send a test email. Please try again.";
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    if (!auth.user.email) {
      return Response.json(
        { error: "Your account needs an email address before a test email can be sent." },
        { status: 400 },
      );
    }

    const apiKey = env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      return Response.json(
        { error: "Email delivery is not configured on this StudySync deployment yet." },
        { status: 503 },
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL?.trim() || "StudySync <onboarding@resend.dev>",
        to: [auth.user.email],
        subject: "StudySync test reminder",
        text: `StudySync email reminders are connected.\n\nThis is a test email from your reminder settings.\n\nOpen your planner: ${siteUrl}`,
        html: `<div style="margin:0;background:#f5faf9;padding:28px 16px;font-family:Arial,sans-serif;color:#173746;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d8e4e7;border-radius:18px;padding:28px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2f9584;">StudySync</div>
            <h1 style="margin:10px 0 8px;font-size:26px;line-height:1.2;color:#102b3a;">Email reminders are connected</h1>
            <p style="margin:0 0 22px;color:#66818c;font-size:15px;line-height:1.6;">This test confirms that StudySync can send reminder emails to your account.</p>
            <a href="${siteUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0d2b3a;color:#ffffff;text-decoration:none;font-weight:700;">Open StudySync</a>
          </div>
        </div>`,
      }),
    });

    if (!response.ok) {
      return Response.json(
        { error: "Resend did not accept the test email. Check your Resend sender and recipient setup." },
        { status: 502 },
      );
    }

    return Response.json({ sent: true });
  } catch (error) {
    return Response.json({ error: routeErrorMessage(error) }, { status: 500 });
  }
}
