declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    SUPABASE_ANON_KEY?: string;
    CANVAS_TOKEN_ENCRYPTION_KEY?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    REMINDER_CRON_SECRET?: string;
  }
}
