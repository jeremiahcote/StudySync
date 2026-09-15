import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { reminderPreferences } from "../../../db/schema";
import { requireUser } from "../../../lib/api-auth";

const reminderTimings = new Set(["morning", "day-before", "both"]);

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function routeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const detail =
    error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  const combined = `${message}\n${detail}`;

  if (combined.includes("no such table") || combined.includes('from "reminder_preferences"')) {
    return "Your reminder settings are not ready yet. Publish the next StudySync version to finish setting them up.";
  }

  if (combined.includes("Supabase user validation")) {
    return "StudySync could not verify your account. Please sign in again.";
  }

  return "StudySync could not save your reminder preferences. Please try again.";
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    if (!auth.user.email) {
      return Response.json(
        { error: "Your account needs an email address before reminders can be enabled." },
        { status: 400 },
      );
    }

    const payload = (await request.json()) as {
      emailEnabled?: unknown;
      emailTiming?: unknown;
      timezone?: unknown;
    };
    const emailEnabled = payload.emailEnabled === true;
    const emailTiming =
      typeof payload.emailTiming === "string" && reminderTimings.has(payload.emailTiming)
        ? (payload.emailTiming as "morning" | "day-before" | "both")
        : null;
    const timezone = typeof payload.timezone === "string" ? payload.timezone.trim() : "";

    if (!emailTiming) {
      return Response.json({ error: "Choose a valid reminder timing." }, { status: 400 });
    }

    if (!timezone || timezone.length > 100 || !isValidTimeZone(timezone)) {
      return Response.json({ error: "StudySync could not determine your time zone." }, { status: 400 });
    }

    const db = getDb();
    await db
      .insert(reminderPreferences)
      .values({
        userId: auth.user.id,
        email: auth.user.email,
        emailEnabled,
        emailTiming,
        timezone,
      })
      .onConflictDoUpdate({
        target: reminderPreferences.userId,
        set: {
          email: auth.user.email,
          emailEnabled,
          emailTiming,
          timezone,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });

    const [preferences] = await db
      .select()
      .from(reminderPreferences)
      .where(eq(reminderPreferences.userId, auth.user.id))
      .limit(1);

    return Response.json({ preferences });
  } catch (error) {
    return Response.json({ error: routeErrorMessage(error) }, { status: 500 });
  }
}
