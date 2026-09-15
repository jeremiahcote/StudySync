import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { canvasConnections } from "../../../../db/schema";
import { requireUser } from "../../../../lib/api-auth";
import {
  canvasErrorResponse,
  fetchCanvasJson,
  getCanvasEncryptionSecret,
  encryptCanvasToken,
  normalizeCanvasBaseUrl,
  type CanvasUser,
} from "../../../../lib/canvas";

function publicConnection(connection: {
  baseUrl: string;
  canvasUserName: string | null;
  updatedAt: string;
}) {
  return {
    connected: true,
    baseUrl: connection.baseUrl,
    canvasUserName: connection.canvasUserName,
    updatedAt: connection.updatedAt,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    const [connection] = await db
      .select({
        baseUrl: canvasConnections.baseUrl,
        canvasUserName: canvasConnections.canvasUserName,
        updatedAt: canvasConnections.updatedAt,
      })
      .from(canvasConnections)
      .where(eq(canvasConnections.userId, auth.user.id))
      .limit(1);

    return Response.json({ connection: connection ? publicConnection(connection) : null });
  } catch (error) {
    return canvasErrorResponse(
      error,
      "StudySync could not load your Canvas connection.",
      { tableName: "canvas_connections" },
    );
  }
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
      baseUrl?: unknown;
      accessToken?: unknown;
    };
    const baseUrl = typeof payload.baseUrl === "string" ? normalizeCanvasBaseUrl(payload.baseUrl) : "";
    const accessToken = typeof payload.accessToken === "string" ? payload.accessToken.trim() : "";

    if (!accessToken || accessToken.length < 10) {
      return Response.json(
        { error: "Enter a valid Canvas access token." },
        { status: 400 },
      );
    }

    const profile = await fetchCanvasJson<CanvasUser>(baseUrl, "/api/v1/users/self", accessToken);
    const canvasUserId = profile.id === undefined || profile.id === null ? "" : String(profile.id);
    if (!canvasUserId) {
      return Response.json(
        { error: "Canvas did not return a valid user for that connection." },
        { status: 502 },
      );
    }

    const tokenCiphertext = await encryptCanvasToken(accessToken, secret);
    const db = getDb();
    await db
      .insert(canvasConnections)
      .values({
        userId: auth.user.id,
        baseUrl,
        canvasUserId,
        canvasUserName:
          profile.name ?? profile.short_name ?? profile.sortable_name ?? null,
        tokenCiphertext,
      })
      .onConflictDoUpdate({
        target: canvasConnections.userId,
        set: {
          baseUrl,
          canvasUserId,
          canvasUserName:
            profile.name ?? profile.short_name ?? profile.sortable_name ?? null,
          tokenCiphertext,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });

    return Response.json({
      connection: publicConnection({
        baseUrl,
        canvasUserName: profile.name ?? profile.short_name ?? profile.sortable_name ?? null,
        updatedAt: new Date().toISOString(),
      }),
    });
  } catch (error) {
    return canvasErrorResponse(
      error,
      "StudySync could not connect to Canvas.",
      { tableName: "canvas_connections" },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const db = getDb();
    await db.delete(canvasConnections).where(eq(canvasConnections.userId, auth.user.id));
    return Response.json({ disconnected: true });
  } catch (error) {
    return canvasErrorResponse(
      error,
      "StudySync could not disconnect Canvas.",
      { tableName: "canvas_connections" },
    );
  }
}
