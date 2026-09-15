import application from "./index.js";

function fetchApplication(request, env, ctx) {
  return application.fetch(request, env, ctx);
}

export default {
  fetch: fetchApplication,

  async scheduled(_controller, env, ctx) {
    const secret = env.REMINDER_CRON_SECRET?.trim();
    if (!secret) {
      console.error("REMINDER_CRON_SECRET is not configured.");
      return;
    }

    const response = await fetchApplication(
      new Request("https://studysync.internal/api/reminders/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      }),
      env,
      ctx,
    );

    if (!response.ok) {
      console.error(`StudySync reminder job returned HTTP ${response.status}.`);
    }
  },
};
