import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { assignments, canvasConnections } from "../../../../db/schema";
import { requireUser } from "../../../../lib/api-auth";
import {
  canvasErrorResponse,
  decryptCanvasToken,
  fetchCanvasCollection,
  getCanvasEncryptionSecret,
  type CanvasAssignment,
  type CanvasCourse,
} from "../../../../lib/canvas";

const courseListPath = "/api/v1/courses?enrollment_state=active&per_page=100";

function courseLabel(course: CanvasCourse) {
  return course.course_code?.trim() || course.name?.trim() || `Canvas course ${course.id}`;
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const secret = getCanvasEncryptionSecret();
    if (!secret) {
      return Response.json(
        { error: "Canvas connections are not configured on this StudySync deployment yet." },
        { status: 503 },
      );
    }

    const payload = (await request.json()) as {
      mode?: unknown;
      courseIds?: unknown;
    };
    const mode = payload.mode === "all" || payload.mode === "selected" ? payload.mode : "";
    const courseIds = Array.isArray(payload.courseIds)
      ? payload.courseIds.filter((courseId): courseId is string => typeof courseId === "string" && courseId.trim().length > 0)
      : [];

    if (!mode) {
      return Response.json(
        { error: "Choose all classes or select specific classes." },
        { status: 400 },
      );
    }
    if (mode === "selected" && !courseIds.length) {
      return Response.json(
        { error: "Choose at least one Canvas class to import." },
        { status: 400 },
      );
    }

    const db = getDb();
    const [connection] = await db
      .select({
        baseUrl: canvasConnections.baseUrl,
        tokenCiphertext: canvasConnections.tokenCiphertext,
      })
      .from(canvasConnections)
      .where(eq(canvasConnections.userId, auth.user.id))
      .limit(1);

    if (!connection) {
      return Response.json({ error: "Connect Canvas before importing assignments." }, { status: 404 });
    }

    const token = await decryptCanvasToken(connection.tokenCiphertext, secret);
    const courses = await fetchCanvasCollection<CanvasCourse>(connection.baseUrl, courseListPath, token);
    const activeCourses = courses.filter(
      (course) => course.id !== undefined && course.id !== null && course.workflow_state !== "deleted",
    );
    const selectedIds = new Set(courseIds.map((courseId) => courseId.trim()));
    const coursesToImport = mode === "all"
      ? activeCourses
      : activeCourses.filter((course) => selectedIds.has(String(course.id)));

    if (!coursesToImport.length) {
      return Response.json(
        { error: "None of those classes are available in your active Canvas courses." },
        { status: 400 },
      );
    }

    const existingRows = await db
      .select({ id: assignments.id, canvasAssignmentId: assignments.canvasAssignmentId })
      .from(assignments)
      .where(eq(assignments.userId, auth.user.id));
    const existingByCanvasId = new Map(
      existingRows
        .filter((assignment) => assignment.canvasAssignmentId)
        .map((assignment) => [assignment.canvasAssignmentId!, assignment.id]),
    );

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const course of coursesToImport) {
      const canvasCourseId = String(course.id);
      const canvasAssignments = await fetchCanvasCollection<CanvasAssignment>(
        connection.baseUrl,
        `/api/v1/courses/${encodeURIComponent(canvasCourseId)}/assignments?per_page=100&order_by=due_at`,
        token,
      );

      for (const canvasAssignment of canvasAssignments) {
        const canvasAssignmentId =
          canvasAssignment.id === undefined || canvasAssignment.id === null
            ? ""
            : String(canvasAssignment.id);
        const title = canvasAssignment.name?.trim() || "";
        const dueAt = canvasAssignment.due_at?.trim() || "";

        if (!canvasAssignmentId || !title || !dueAt || Number.isNaN(Date.parse(dueAt))) {
          skipped += 1;
          continue;
        }
        if (canvasAssignment.published === false) {
          skipped += 1;
          continue;
        }

        const existingId = existingByCanvasId.get(canvasAssignmentId);
        const courseName = courseLabel(course);
        if (existingId) {
          await db
            .update(assignments)
            .set({
              title,
              course: courseName,
              dueAt,
              canvasCourseId,
            })
            .where(and(eq(assignments.id, existingId), eq(assignments.userId, auth.user.id)));
          updated += 1;
        } else {
          const [assignment] = await db
            .insert(assignments)
            .values({
              userId: auth.user.id,
              title,
              course: courseName,
              dueAt,
              estimatedMinutes: 60,
              completed: false,
              canvasAssignmentId,
              canvasCourseId,
            })
            .returning({ id: assignments.id });
          if (assignment) {
            existingByCanvasId.set(canvasAssignmentId, assignment.id);
            imported += 1;
          }
        }
      }
    }

    return Response.json({
      imported,
      updated,
      skipped,
      courses: coursesToImport.length,
    });
  } catch (error) {
    return canvasErrorResponse(
      error,
      "StudySync could not import assignments from Canvas.",
      { connected: true, tableName: "canvas_connections" },
    );
  }
}
