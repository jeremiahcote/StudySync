import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { canvasConnections } from "../../../../db/schema";
import { requireUser } from "../../../../lib/api-auth";
import {
  canvasErrorResponse,
  decryptCanvasToken,
  fetchCanvasCollection,
  getCanvasEncryptionSecret,
  type CanvasCourse,
} from "../../../../lib/canvas";

export async function GET(request: Request) {
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
      return Response.json({ error: "Connect Canvas before choosing classes." }, { status: 404 });
    }

    const token = await decryptCanvasToken(connection.tokenCiphertext, secret);
    const rows = await fetchCanvasCollection<CanvasCourse>(
      connection.baseUrl,
      "/api/v1/courses?enrollment_state=active&per_page=100",
      token,
    );

    const courses = rows
      .filter((course) => course.id !== undefined && course.id !== null && course.workflow_state !== "deleted")
      .map((course) => ({
        id: String(course.id),
        name: course.name?.trim() || course.course_code?.trim() || `Canvas course ${course.id}`,
        courseCode: course.course_code?.trim() || null,
      }))
      .sort((first, second) => first.name.localeCompare(second.name));

    return Response.json({ courses });
  } catch (error) {
    return canvasErrorResponse(
      error,
      "StudySync could not load your Canvas classes.",
      { connected: true, tableName: "canvas_connections" },
    );
  }
}
