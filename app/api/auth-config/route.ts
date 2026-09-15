import { getSupabasePublicConfig } from "../../../lib/supabase-auth";

export function GET() {
  const config = getSupabasePublicConfig();

  if (!config) {
    return Response.json(
      { error: "StudySync account security is not configured yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(config, {
    headers: { "Cache-Control": "no-store" },
  });
}
