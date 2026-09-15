import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  assignments,
  reminderPreferences,
  reminderSends,
  type Assignment,
  type ReminderPreference,
} from "../../../../db/schema";

type ReminderType = "morning" | "day-before";

type ReminderOccurrence = {
  type: ReminderType;
  reminderDate: string;
  dueDate: string;
};

type LocalDateTime = {
  date: string;
  hour: number;
};

const siteUrl = "https://studysync.studysync.workers.dev";

function isAuthorized(request: Request) {
  const authorization = request.headers.get("authorization");
  const [scheme, token] = authorization?.trim().split(/\s+/, 2) ?? [];
  const secret = env.REMINDER_CRON_SECRET?.trim();
  return Boolean(
    secret && scheme?.toLowerCase() === "bearer" && token && token === secret,
  );
}

function localDateTime(now: Date, timezone: string): LocalDateTime | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    if (!values.year || !values.month || !values.day || !values.hour) return null;
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      hour: Number(values.hour),
    };
  } catch {
    return null;
  }
}

function nextDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function dueDateKey(dueAt: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(dueAt);
  return match?.[1] ?? null;
}

function reminderOccurrence(
  preference: ReminderPreference,
  now: Date,
): ReminderOccurrence | null {
  const local = localDateTime(now, preference.timezone);
  if (!local) return null;

  if (
    (preference.emailTiming === "morning" || preference.emailTiming === "both") &&
    local.hour >= 8 &&
    local.hour < 12
  ) {
    return { type: "morning", reminderDate: local.date, dueDate: local.date };
  }

  if (
    (preference.emailTiming === "day-before" || preference.emailTiming === "both") &&
    local.hour >= 18 &&
    local.hour < 22
  ) {
    return {
      type: "day-before",
      reminderDate: local.date,
      dueDate: nextDate(local.date),
    };
  }

  return null;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function formatDueAt(dueAt: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(dueAt);
  if (!match) return dueAt;

  const [, year, month, day, hourValue, minute] = match;
  const hour = Number(hourValue);
  const displayHour = hour % 12 || 12;
  const suffix = hour >= 12 ? "PM" : "AM";
  const monthName = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
  return `${monthName} ${Number(day)}, ${year} at ${displayHour}:${minute} ${suffix}`;
}

function textForAssignments(
  reminderType: ReminderType,
  reminderAssignments: Assignment[],
) {
  const heading = reminderType === "morning" ? "due today" : "due tomorrow";
  const lines = reminderAssignments.map(
    (assignment) =>
      `- ${assignment.title} (${assignment.course}) — due ${formatDueAt(assignment.dueAt)}`,
  );
  return [
    `StudySync reminder: ${reminderAssignments.length} assignment${reminderAssignments.length === 1 ? "" : "s"} ${heading}.`,
    "",
    ...lines,
    "",
    `Open your planner: ${siteUrl}`,
  ].join("\n");
}

function htmlForAssignments(
  reminderType: ReminderType,
  reminderAssignments: Assignment[],
) {
  const heading = reminderType === "morning" ? "due today" : "due tomorrow";
  const items = reminderAssignments
    .map(
      (assignment) => `<li style="margin:0 0 14px;padding:0 0 14px;border-bottom:1px solid #d8e4e7;">
        <strong style="color:#173746;font-size:16px;">${escapeHtml(assignment.title)}</strong>
        <div style="margin-top:4px;color:#52717c;font-size:14px;">${escapeHtml(assignment.course)} · ${escapeHtml(formatDueAt(assignment.dueAt))}</div>
      </li>`,
    )
    .join("");

  return `<div style="margin:0;background:#f5faf9;padding:28px 16px;font-family:Arial,sans-serif;color:#173746;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d8e4e7;border-radius:18px;padding:28px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2f9584;">StudySync reminder</div>
      <h1 style="margin:10px 0 8px;font-size:26px;line-height:1.2;color:#102b3a;">Assignments ${heading}</h1>
      <p style="margin:0 0 22px;color:#66818c;font-size:15px;line-height:1.6;">Here are the assignments still on your planner.</p>
      <ul style="list-style:none;margin:0;padding:0;">${items}</ul>
      <a href="${siteUrl}" style="display:inline-block;margin-top:10px;padding:12px 18px;border-radius:10px;background:#0d2b3a;color:#ffffff;text-decoration:none;font-weight:700;">Open StudySync</a>
    </div>
  </div>`;
}

async function sendReminderEmail(
  email: string,
  reminderType: ReminderType,
  reminderAssignments: Assignment[],
) {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");

  const count = reminderAssignments.length;
  const heading = reminderType === "morning" ? "due today" : "due tomorrow";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL?.trim() || "StudySync <onboarding@resend.dev>",
      to: [email],
      subject: `StudySync reminder: ${count} assignment${count === 1 ? "" : "s"} ${heading}`,
      text: textForAssignments(reminderType, reminderAssignments),
      html: htmlForAssignments(reminderType, reminderAssignments),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the reminder email with status ${response.status}.`);
  }
}

async function alreadySent(
  userId: string,
  assignmentId: number,
  occurrence: ReminderOccurrence,
) {
  const db = getDb();
  const [send] = await db
    .select({ id: reminderSends.id })
    .from(reminderSends)
    .where(
      and(
        eq(reminderSends.userId, userId),
        eq(reminderSends.assignmentId, assignmentId),
        eq(reminderSends.reminderType, occurrence.type),
        eq(reminderSends.reminderDate, occurrence.reminderDate),
      ),
    )
    .limit(1);
  return Boolean(send);
}

async function recordSend(
  userId: string,
  assignmentId: number,
  occurrence: ReminderOccurrence,
) {
  const db = getDb();
  await db.insert(reminderSends).values({
    userId,
    assignmentId,
    reminderType: occurrence.type,
    reminderDate: occurrence.reminderDate,
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const now = new Date();
  const db = getDb();
  const preferences = await db
    .select()
    .from(reminderPreferences)
    .where(eq(reminderPreferences.emailEnabled, true));

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const preference of preferences) {
    const occurrence = reminderOccurrence(preference, now);
    if (!occurrence) {
      skipped += 1;
      continue;
    }

    const activeAssignments = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.userId, preference.userId),
          eq(assignments.completed, false),
        ),
      );
    const dueAssignments = activeAssignments.filter(
      (assignment) => dueDateKey(assignment.dueAt) === occurrence.dueDate,
    );
    const unsentAssignments: Assignment[] = [];

    for (const assignment of dueAssignments) {
      if (await alreadySent(preference.userId, assignment.id, occurrence)) {
        continue;
      }
      unsentAssignments.push(assignment);
    }

    if (!unsentAssignments.length) {
      skipped += 1;
      continue;
    }

    try {
      await sendReminderEmail(preference.email, occurrence.type, unsentAssignments);
      for (const assignment of unsentAssignments) {
        await recordSend(preference.userId, assignment.id, occurrence);
      }
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `StudySync reminder delivery failed for user ${preference.userId}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  return Response.json({ sent, skipped, failed, ranAt: now.toISOString() });
}
