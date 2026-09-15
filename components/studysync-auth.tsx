"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, KeyRound, LoaderCircle, Mail, ShieldCheck, UserRound } from "lucide-react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { StudySyncLogo } from "@/components/studysync-logo";

type AuthStatus = "loading" | "ready" | "error";

export type StudySyncAuthState = {
  status: AuthStatus;
  session: Session | null;
  client: SupabaseClient | null;
  error: string;
  passwordRecovery: boolean;
  finishPasswordRecovery: () => void;
  signOut: () => Promise<void>;
};

function readableAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "That email and password combination did not match. Try again or reset your password.";
  }
  if (normalized.includes("user already registered") || normalized.includes("already been registered")) {
    return "That email already has a StudySync account. Try signing in instead.";
  }
  if (normalized.includes("password should be at least")) {
    return "Choose a password with at least 8 characters.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirm your email from the message we sent, then sign in again.";
  }

  return message;
}

function isLocalPreview() {
  return (
    typeof window !== "undefined" &&
    ["terminal.local", "localhost", "127.0.0.1"].includes(window.location.hostname) &&
    new URLSearchParams(window.location.search).get("preview") === "1"
  );
}

function localPreviewSession(): Session {
  const timestamp = new Date().toISOString();
  return {
    access_token: "studysync-local-preview",
    refresh_token: "studysync-local-preview",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: "studysync-local-preview-user",
      aud: "authenticated",
      role: "authenticated",
      email: "student@example.com",
      email_confirmed_at: timestamp,
      phone: "",
      confirmation_sent_at: timestamp,
      confirmed_at: timestamp,
      last_sign_in_at: timestamp,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {
        first_name: "Jordan",
        last_name: "Student",
        studysync_course_colors: {
          "cs 401": "#62d2be",
          "biology 210": "#e8b84d",
          "history 120": "#e56b5d",
        },
      },
      identities: [],
      created_at: timestamp,
      updated_at: timestamp,
    },
  } as Session;
}

export function useStudySyncAuth(): StudySyncAuthState {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [error, setError] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    if (isLocalPreview()) {
      const previewTimer = window.setTimeout(() => {
        if (cancelled) return;
        setSession(localPreviewSession());
        setStatus("ready");
        setError("");
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(previewTimer);
      };
    }

    void getSupabaseBrowserClient()
      .then(async (supabase) => {
        if (cancelled) return;
        setClient(supabase);

        const sessionResult = await supabase.auth.getSession();
        if (sessionResult.error) throw sessionResult.error;
        if (cancelled) return;

        setSession(sessionResult.data.session);
        setStatus("ready");
        setError("");
        if (new URLSearchParams(window.location.search).get("reset") === "1") {
          setPasswordRecovery(true);
        }

        const authState = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (cancelled) return;
          setSession(nextSession);
          setStatus("ready");
          if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
        });
        subscription = authState.data.subscription;
      })
      .catch((authError) => {
        if (cancelled) return;
        setStatus("error");
        setError(
          authError instanceof Error
            ? authError.message
            : "StudySync account security could not be loaded.",
        );
      });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  function finishPasswordRecovery() {
    setPasswordRecovery(false);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("reset");
    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }

  async function signOut() {
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) throw signOutError;
  }

  return {
    status,
    session,
    client,
    error,
    passwordRecovery,
    finishPasswordRecovery,
    signOut,
  };
}

export function AuthLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf2f4] px-6 text-[#102b3a]">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-medium shadow-[0_12px_34px_rgb(16_43_58/8%)]">
        <LoaderCircle className="size-4 animate-spin text-[#2f9584]" />
        Loading your secure workspace…
      </div>
    </main>
  );
}

export function AuthConfigurationState({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf2f4] px-5 py-10 text-[#102b3a]">
      <Card className="w-full max-w-lg border-0 bg-white shadow-[0_18px_50px_rgb(16_43_58/10%)]">
        <CardHeader className="gap-4 px-6 pt-7 sm:px-8 sm:pt-9">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#0d2b3a] text-[#62d2be]">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <CardTitle className="text-2xl tracking-[-0.04em] text-[#173746]">
              StudySync is almost ready
            </CardTitle>
            <CardDescription className="mt-2 leading-6 text-[#78909b]">
              Account security still needs to be connected before planners can be opened.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-7 sm:px-8 sm:pb-9">
          <p className="rounded-xl border border-[#f5d293] bg-[#fff8e8] px-4 py-3 text-sm leading-6 text-[#80601e]">
            {message}
          </p>
          <p className="mt-4 text-xs leading-5 text-[#78909b]">
            This is a setup message, not a password error. Once the account provider is connected, this screen becomes the StudySync sign-in page.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export function AuthPanel() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [resetMode, setResetMode] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isSignUp = mode === "sign-up";

  function switchMode(nextMode: "sign-in" | "sign-up") {
    setMode(nextMode);
    setResetMode(false);
    setFirstName("");
    setLastName("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setNotice("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const supabase = await getSupabaseBrowserClient();

      if (resetMode) {
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/?reset=1`,
        });
        setNotice("If an account exists for that email, we’ll send a password reset link.");
        return;
      }

      if (isSignUp) {
        if (!firstName.trim() || !lastName.trim()) {
          throw new Error("Enter your first and last name.");
        }
        if (password !== confirmPassword) {
          throw new Error("The passwords do not match.");
        }
      }

      const result = isSignUp
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: window.location.origin,
              data: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
              },
            },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (result.error) throw result.error;

      if (isSignUp && !result.data.session) {
        setNotice("Check your email to confirm your account, then come back to sign in.");
      }
    } catch (authError) {
      setError(
        readableAuthError(
          authError instanceof Error ? authError.message : "We could not complete that request.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#edf2f4] px-4 py-5 text-[#102b3a] sm:px-6 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1120px] overflow-hidden rounded-[30px] bg-white shadow-[0_24px_70px_rgb(16_43_58/12%)] lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative hidden overflow-hidden bg-[#0d2b3a] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -right-24 -top-24 size-72 rounded-full border-[30px] border-[#62d2be]/10" />
          <div className="absolute -bottom-36 -left-24 size-80 rounded-full border-[36px] border-[#e8b84d]/10" />
          <div className="relative">
            <div className="flex items-start gap-4">
              <StudySyncLogo className="size-24 shadow-[0_12px_28px_rgb(98_210_190/16%)]" />
              <div className="pt-2">
                <p className="text-lg font-bold tracking-[-0.03em]">StudySync</p>
                <p className="mt-1 text-xs text-white/50">Your coursework, in sync</p>
              </div>
            </div>
            <div className="mt-24 max-w-sm">
              <p className="text-sm font-semibold text-[#62d2be]">A calmer way to plan</p>
              <h1 className="mt-3 text-4xl font-bold leading-[1.06] tracking-[-0.055em] xl:text-5xl">
                Keep the next deadline in view.
              </h1>
              <p className="mt-5 text-[15px] leading-7 text-white/60">
                Create a private planner for your coursework, then pick one clear next step.
              </p>
            </div>
          </div>
          <div className="relative flex items-center gap-2 text-xs text-white/45">
            <ShieldCheck className="size-4 text-[#62d2be]" />
            Passwords are protected by the account provider.
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-14 xl:px-20">
          <div className="w-full max-w-md">
            <div className="mb-9 lg:hidden">
              <div className="flex items-center gap-4">
                <StudySyncLogo className="size-16 shadow-[0_10px_22px_rgb(16_43_58/10%)]" />
                <div>
                  <p className="text-lg font-bold tracking-[-0.03em]">StudySync</p>
                  <p className="mt-1 text-xs text-[#78909b]">Your coursework, in sync</p>
                </div>
              </div>
            </div>

            {resetMode ? (
              <button
                type="button"
                onClick={() => {
                  setResetMode(false);
                  setError("");
                  setNotice("");
                }}
                className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[#2f9584] hover:text-[#176052]"
              >
                <ArrowLeft className="size-4" />
                Back to sign in
              </button>
            ) : null}

            <div>
              <p className="text-sm font-semibold text-[#2f9584]">{resetMode ? "Account recovery" : "Welcome to StudySync"}</p>
              <h2 className="mt-2 text-3xl font-bold tracking-[-0.05em] text-[#173746]">
                {resetMode ? "Reset your password." : isSignUp ? "Create your planner." : "Sign in to your planner."}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#78909b]">
                {resetMode
                  ? "Enter your email and we’ll send a secure reset link."
                  : isSignUp
                    ? "Your assignments will be private to your account."
                    : "Pick up where you left off, with your coursework in one place."}
              </p>
            </div>

            {!resetMode ? (
              <div className="mt-7 grid grid-cols-2 gap-1 rounded-xl bg-[#edf2f4] p-1">
                <button
                  type="button"
                  onClick={() => switchMode("sign-in")}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${!isSignUp ? "bg-white text-[#173746] shadow-sm" : "text-[#78909b] hover:text-[#52717c]"}`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("sign-up")}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${isSignUp ? "bg-white text-[#173746] shadow-sm" : "text-[#78909b] hover:text-[#52717c]"}`}
                >
                  Create account
                </button>
              </div>
            ) : null}

            <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
              {isSignUp && !resetMode ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="auth-first-name" className="text-[#52717c]">First name</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ab0b7]" />
                      <Input
                        id="auth-first-name"
                        required
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="First"
                        className="h-11 border-[#d8e4e7] pl-10 text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auth-last-name" className="text-[#52717c]">Last name</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ab0b7]" />
                      <Input
                        id="auth-last-name"
                        required
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="Last"
                        className="h-11 border-[#d8e4e7] pl-10 text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="auth-email" className="text-[#52717c]">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ab0b7]" />
                  <Input
                    id="auth-email"
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="h-11 border-[#d8e4e7] pl-10 text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                  />
                </div>
              </div>

              {!resetMode ? (
                <div className="space-y-2">
                  <Label htmlFor="auth-password" className="text-[#52717c]">Password</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ab0b7]" />
                    <Input
                      id="auth-password"
                      required
                      minLength={8}
                      type="password"
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      className="h-11 border-[#d8e4e7] pl-10 text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                    />
                  </div>
                </div>
              ) : null}

              {isSignUp && !resetMode ? (
                <div className="space-y-2">
                  <Label htmlFor="auth-confirm-password" className="text-[#52717c]">Confirm password</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ab0b7]" />
                    <Input
                      id="auth-confirm-password"
                      required
                      minLength={8}
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repeat your password"
                      className="h-11 border-[#d8e4e7] pl-10 text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                    />
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="rounded-xl border border-[#f29f95] bg-[#fff1ef] px-3 py-2.5 text-sm leading-5 text-[#a93e35]" role="alert">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="rounded-xl border border-[#a9d9cf] bg-[#eefbf7] px-3 py-2.5 text-sm leading-5 text-[#287568]" role="status">
                  {notice}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={busy}
                className="h-11 w-full rounded-xl bg-[#0d2b3a] font-semibold text-white hover:bg-[#173f50]"
              >
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {busy ? "Working…" : resetMode ? "Send reset link" : isSignUp ? "Create account" : "Sign in"}
                {!busy ? <ArrowRight className="size-4" /> : null}
              </Button>
            </form>

            {!resetMode && !isSignUp ? (
              <button
                type="button"
                onClick={() => {
                  setResetMode(true);
                  setError("");
                  setNotice("");
                }}
                className="mt-5 w-full text-center text-sm font-semibold text-[#2f9584] hover:text-[#176052]"
              >
                Forgot your password?
              </button>
            ) : null}

            <p className="mt-8 text-center text-xs leading-5 text-[#9ab0b7]">
              StudySync never stores your password or your email in its planner database.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export function PasswordResetPanel({
  client,
  onComplete,
}: {
  client: SupabaseClient;
  onComplete: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      setNotice("Your password has been updated.");
    } catch (updateError) {
      setError(
        readableAuthError(
          updateError instanceof Error ? updateError.message : "We could not update your password.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf2f4] px-5 py-10 text-[#102b3a]">
      <Card className="w-full max-w-lg border-0 bg-white shadow-[0_18px_50px_rgb(16_43_58/10%)]">
        <CardHeader className="gap-4 px-6 pt-7 sm:px-8 sm:pt-9">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#edf8f6] text-[#2f9584]">
            <KeyRound className="size-6" />
          </div>
          <div>
            <CardTitle className="text-2xl tracking-[-0.04em] text-[#173746]">Choose a new password.</CardTitle>
            <CardDescription className="mt-2 leading-6 text-[#78909b]">
              Use at least 8 characters, then return to your private planner.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-7 sm:px-8 sm:pb-9">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="reset-password" className="text-[#52717c]">New password</Label>
              <Input
                id="reset-password"
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="h-11 border-[#d8e4e7] text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm-password" className="text-[#52717c]">Confirm new password</Label>
              <Input
                id="reset-confirm-password"
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your password"
                className="h-11 border-[#d8e4e7] text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
              />
            </div>

            {error ? (
              <p className="rounded-xl border border-[#f29f95] bg-[#fff1ef] px-3 py-2.5 text-sm leading-5 text-[#a93e35]" role="alert">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="rounded-xl border border-[#a9d9cf] bg-[#eefbf7] px-3 py-2.5 text-sm leading-5 text-[#287568]" role="status">
                {notice}
              </p>
            ) : null}

            {notice ? (
              <Button type="button" onClick={onComplete} className="h-11 w-full rounded-xl bg-[#0d2b3a] font-semibold text-white hover:bg-[#173f50]">
                Return to planner
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl bg-[#0d2b3a] font-semibold text-white hover:bg-[#173f50]">
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {busy ? "Updating…" : "Update password"}
                {!busy ? <ArrowRight className="size-4" /> : null}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
