import { env } from "cloudflare:workers";

export type SupabasePublicConfig = {
  url: string;
  publicKey: string;
};

export type SupabaseAuthUser = {
  id: string;
  email: string | null;
};

export type SupabaseUserResult =
  | { status: "authenticated"; user: SupabaseAuthUser }
  | { status: "unauthenticated"; user: null }
  | { status: "unconfigured"; user: null };

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const publicKey = (env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY)?.trim();

  if (!url || !publicKey) return null;

  return { url, publicKey };
}

export async function getSupabaseUser(request: Request): Promise<SupabaseUserResult> {
  const authorization = request.headers.get("authorization");
  const [scheme, token] = authorization?.trim().split(/\s+/, 2) ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return { status: "unauthenticated", user: null };
  }

  const config = getSupabasePublicConfig();
  if (!config) return { status: "unconfigured", user: null };

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.publicKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    return { status: "unauthenticated", user: null };
  }

  if (!response.ok) {
    throw new Error(`Supabase user validation failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    id?: unknown;
    email?: unknown;
  };

  if (typeof payload.id !== "string" || !payload.id) {
    return { status: "unauthenticated", user: null };
  }

  return {
    status: "authenticated",
    user: {
      id: payload.id,
      email: typeof payload.email === "string" ? payload.email : null,
    },
  };
}
