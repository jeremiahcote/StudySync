import { getSupabaseUser, type SupabaseAuthUser } from "./supabase-auth";

export type RequiredUserResult =
  | { user: SupabaseAuthUser; response: null }
  | { user: null; response: Response };

export async function requireUser(request: Request): Promise<RequiredUserResult> {
  const auth = await getSupabaseUser(request);

  if (auth.status === "unconfigured") {
    return {
      user: null,
      response: Response.json(
        { error: "StudySync account security is not configured yet." },
        { status: 503 },
      ),
    };
  }

  if (auth.status === "unauthenticated") {
    return {
      user: null,
      response: Response.json(
        { error: "Sign in to access your private StudySync data." },
        { status: 401 },
      ),
    };
  }

  return { user: auth.user, response: null };
}
