import { env } from "cloudflare:workers";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class CanvasInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasInputError";
  }
}

export class CanvasConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasConfigurationError";
  }
}

export class CanvasApiError extends Error {
  status: number;

  constructor(status: number) {
    super("Canvas API request failed.");
    this.name = "CanvasApiError";
    this.status = status;
  }
}

export type CanvasPage<T> = {
  data: T;
  nextUrl: string | null;
};

export type CanvasCourse = {
  id?: string | number;
  name?: string | null;
  course_code?: string | null;
  workflow_state?: string | null;
};

export type CanvasAssignment = {
  id?: string | number;
  name?: string | null;
  due_at?: string | null;
  course_id?: string | number | null;
  published?: boolean | null;
};

export type CanvasUser = {
  id?: string | number;
  name?: string | null;
  short_name?: string | null;
  sortable_name?: string | null;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new CanvasConfigurationError("Canvas encryption is configured incorrectly.");
  }

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importEncryptionKey(secret: string) {
  const rawKey = base64ToBytes(secret);
  if (rawKey.length !== 32) {
    throw new CanvasConfigurationError(
      "Canvas encryption is configured incorrectly. Use a base64-encoded 32-byte key.",
    );
  }

  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function getCanvasEncryptionSecret() {
  const secret = env.CANVAS_TOKEN_ENCRYPTION_KEY?.trim();
  return secret || null;
}

export async function encryptCanvasToken(token: string, secret: string) {
  const key = await importEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(token),
  );

  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptCanvasToken(ciphertext: string, secret: string) {
  const [version, ivBase64, encryptedBase64] = ciphertext.split(".");
  if (version !== "v1" || !ivBase64 || !encryptedBase64) {
    throw new CanvasConfigurationError("The saved Canvas connection needs to be reconnected.");
  }

  const key = await importEncryptionKey(secret);
  const iv = base64ToBytes(ivBase64);
  const encrypted = base64ToBytes(encryptedBase64);

  try {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return decoder.decode(decrypted);
  } catch {
    throw new CanvasConfigurationError("The saved Canvas connection needs to be reconnected.");
  }
}

export function normalizeCanvasBaseUrl(value: string) {
  const input = value.trim();
  if (!input) throw new CanvasInputError("Enter your school’s Canvas URL.");

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new CanvasInputError("Enter a complete Canvas URL, including https://.");
  }

  if (url.protocol !== "https:") {
    throw new CanvasInputError("Canvas connections must use an https:// URL.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new CanvasInputError("Enter only the base Canvas URL, without a username, query, or fragment.");
  }
  if (!url.hostname) throw new CanvasInputError("Enter a valid Canvas URL.");

  return `${url.origin}/`;
}

function canvasUrl(baseUrl: string, value: string) {
  const base = new URL(baseUrl);
  const url = new URL(value, base);
  if (url.origin !== base.origin) {
    throw new CanvasApiError(502);
  }
  return url;
}

function nextPageUrl(linkHeader: string | null, baseUrl: string) {
  if (!linkHeader) return null;

  const links = linkHeader.split(",");
  for (const link of links) {
    const match = link.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/i);
    if (!match || !match[2].split(/\s+/).includes("next")) continue;

    const next = canvasUrl(baseUrl, match[1]);
    return next.toString();
  }

  return null;
}

export async function fetchCanvasPage<T>(baseUrl: string, value: string, token: string): Promise<CanvasPage<T>> {
  const url = canvasUrl(baseUrl, value);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      redirect: "error",
    });
  } catch {
    throw new CanvasApiError(503);
  }

  if (!response.ok) throw new CanvasApiError(response.status);

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    throw new CanvasApiError(502);
  }

  return {
    data,
    nextUrl: nextPageUrl(response.headers.get("link"), baseUrl),
  };
}

export async function fetchCanvasJson<T>(baseUrl: string, value: string, token: string) {
  const page = await fetchCanvasPage<T>(baseUrl, value, token);
  return page.data;
}

export async function fetchCanvasCollection<T>(baseUrl: string, value: string, token: string) {
  const items: T[] = [];
  let nextUrl: string | null = value;
  let pages = 0;

  while (nextUrl && pages < 20) {
    const page: CanvasPage<T[]> = await fetchCanvasPage<T[]>(baseUrl, nextUrl, token);
    if (!Array.isArray(page.data)) throw new CanvasApiError(502);
    items.push(...page.data);
    nextUrl = page.nextUrl;
    pages += 1;
  }

  if (nextUrl) throw new CanvasApiError(413);
  return items;
}

export function canvasErrorResponse(
  error: unknown,
  fallback: string,
  options?: { connected?: boolean; tableName?: string },
) {
  if (error instanceof CanvasInputError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof CanvasConfigurationError) {
    return Response.json({ error: error.message }, { status: 503 });
  }

  if (error instanceof CanvasApiError) {
    if (error.status === 401 || error.status === 403) {
      return Response.json(
        {
          error: options?.connected
            ? "Canvas rejected the saved connection. Reconnect Canvas and try again."
            : "Canvas rejected that access token. Check the URL and token, then try again.",
        },
        { status: 400 },
      );
    }
    if (error.status === 404) {
      return Response.json(
        { error: "We could not find Canvas at that URL. Check your school’s Canvas address." },
        { status: 400 },
      );
    }
    if (error.status === 413) {
      return Response.json(
        { error: "That Canvas account has more assignments than one import can process at once." },
        { status: 413 },
      );
    }
    if (error.status === 429) {
      return Response.json(
        { error: "Canvas is temporarily rate-limiting requests. Wait a moment and try again." },
        { status: 429 },
      );
    }
    return Response.json(
      { error: "Canvas could not be reached right now. Check the connection and try again." },
      { status: 502 },
    );
  }

  const message = error instanceof Error ? `${error.message}\n${error.cause instanceof Error ? error.cause.message : ""}` : "";
  if (options?.tableName && message.includes("no such table")) {
    return Response.json(
      { error: "Canvas storage is not ready yet. Publish the next StudySync version to finish setting it up." },
      { status: 503 },
    );
  }

  return Response.json({ error: fallback }, { status: 500 });
}
