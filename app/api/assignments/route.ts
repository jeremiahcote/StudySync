import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { assignments } from "../../../db/schema";
import { requireUser } from "../../../lib/api-auth";

function isValidDueAt(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;

  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute
  );
}

function routeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const detail =
    error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  const combined = `${message}\n${detail}`;

  if (combined.includes("no such table") || combined.includes('from "assignments"')) {
    return "Your assignment table is not ready yet. Publish the next StudySync version to finish setting it up.";
  }

  if (combined.includes("Supabase user validation")) {
    return "StudySync could not verify your account. Please sign in again.";
  }

  return "StudySync could not reach its saved assignments. Please try again.";
}

function publicAssignment<T extends { priority?: unknown }>(assignment: T) {
  const { priority: _priority, ...details } = assignment;
  void _priority;
  return details;
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    const rows = await db
      .select()
      .from(assignments)
      .where(eq(assignments.userId, auth.user.id))
      .orderBy(asc(assignments.completed), asc(assignments.dueAt), desc(assignments.id));

    return Response.json({ assignments: rows.map(publicAssignment) });
  } catch (error) {
    return Response.json({ error: routeErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const payload = (await request.json()) as {
      title?: unknown;
      course?: unknown;
      dueAt?: unknown;
      estimatedMinutes?: unknown;
    };

    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const course = typeof payload.course === "string" ? payload.course.trim() : "";
    const dueAt = typeof payload.dueAt === "string" ? payload.dueAt.trim() : "";
    const parsedMinutes = Number(payload.estimatedMinutes);
    const estimatedMinutes = Number.isFinite(parsedMinutes)
      ? Math.min(Math.max(Math.round(parsedMinutes), 5), 1440)
      : 60;

    if (!title || !course || !dueAt) {
      return Response.json(
        { error: "Add an assignment name, course, and due date." },
        { status: 400 },
      );
    }

    if (!isValidDueAt(dueAt)) {
      return Response.json({ error: "Enter a valid due date." }, { status: 400 });
    }

    const db = getDb();
    const [assignment] = await db
      .insert(assignments)
      .values({
        userId: auth.user.id,
        title,
        course,
        dueAt,
        estimatedMinutes,
      })
      .returning();

    return Response.json({ assignment: publicAssignment(assignment) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const payload = (await request.json()) as {
      id?: unknown;
      completed?: unknown;
      title?: unknown;
      course?: unknown;
      dueAt?: unknown;
      estimatedMinutes?: unknown;
    };
    const id = typeof payload.id === "number" ? payload.id : Number(payload.id);
    const detailFields = ["title", "course", "dueAt", "estimatedMinutes"] as const;
    const hasDetails = detailFields.some((field) => field in payload);
    const hasCompletion = typeof payload.completed === "boolean";

    if (!Number.isSafeInteger(id) || (!hasDetails && !hasCompletion)) {
      return Response.json(
        { error: "Choose a valid assignment and update at least one field." },
        { status: 400 },
      );
    }

    const updates: {
      title?: string;
      course?: string;
      dueAt?: string;
      estimatedMinutes?: number;
      completed?: boolean;
      updatedAt: ReturnType<typeof sql>;
    } = { updatedAt: sql`CURRENT_TIMESTAMP` };

    if (hasDetails) {
      const title = typeof payload.title === "string" ? payload.title.trim() : "";
      const course = typeof payload.course === "string" ? payload.course.trim() : "";
      const dueAt = typeof payload.dueAt === "string" ? payload.dueAt.trim() : "";
      const parsedMinutes = Number(payload.estimatedMinutes);
      const estimatedMinutes = Number.isFinite(parsedMinutes)
        ? Math.min(Math.max(Math.round(parsedMinutes), 5), 1440)
        : null;

      if (!title || !course || !dueAt || estimatedMinutes === null) {
        return Response.json(
          { error: "Add an assignment name, course, due date, and study time." },
          { status: 400 },
        );
      }
      if (!isValidDueAt(dueAt)) {
        return Response.json({ error: "Enter a valid due date and time." }, { status: 400 });
      }

      updates.title = title;
      updates.course = course;
      updates.dueAt = dueAt;
      updates.estimatedMinutes = estimatedMinutes;
    }

    if (hasCompletion) updates.completed = payload.completed as boolean;

    const db = getDb();
    const [assignment] = await db
      .update(assignments)
      .set(updates)
      .where(and(eq(assignments.id, id), eq(assignments.userId, auth.user.id)))
      .returning();

    if (!assignment) {
      return Response.json({ error: "That assignment could not be found." }, { status: 404 });
    }

    return Response.json({ assignment: publicAssignment(assignment) });
  } catch (error) {
    return Response.json({ error: routeErrorMessage(error) }, { status: 500 });
  }
}
