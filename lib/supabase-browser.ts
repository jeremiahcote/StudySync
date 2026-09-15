import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type PublicConfigResponse = {
  url?: unknown;
  publicKey?: unknown;
  error?: unknown;
};

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabaseBrowserClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = fetch("/api/auth-config", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as PublicConfigResponse;

        if (!response.ok || typeof payload.url !== "string" || typeof payload.publicKey !== "string") {
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : "StudySync account security is not configured yet.",
          );
        }

        return createClient(payload.url, payload.publicKey, {
          auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true,
          },
        });
      })
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
  }

  return clientPromise;
}
