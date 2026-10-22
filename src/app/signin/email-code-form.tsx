"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";
import { authErrorMessage, displayNameProblem, type AuthMode } from "@/lib/account-ux";
import { Button } from "@/components/ui/button";
import { BrandWordmark } from "@/components/brand-wordmark";

export function EmailCodeForm({ restricted }: { restricted: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);

  function chooseMode(nextMode: AuthMode) {
    if (pending.current || mode === nextMode) return;
    setMode(nextMode);
    setSent(false);
    setCode("");
    setMessage("");
    setError("");
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const name = displayName.trim();
    if (mode === "signup" && displayNameProblem(name)) {
      setError(displayNameProblem(name)!);
      return;
    }

    pending.current = true; setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: mode === "signup"
          ? { shouldCreateUser: true, data: { display_name: name } }
          : { shouldCreateUser: false },
      });
      if (authError) throw authError;
      setSent(true);
      setCode("");
      setMessage("Check your email for the code, then enter it below.");
    } catch (cause) {
      setError(authErrorMessage(cause, mode));
    } finally {
      pending.current = false; setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true);
    setError("");
    setMessage("");
    let navigating = false;
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (authError) throw authError;
      navigating = true;
      router.replace("/feed");
      router.refresh();
    } catch (cause) {
      setError(authErrorMessage(cause, mode, true));
    } finally {
      if (!navigating) { pending.current = false; setBusy(false); }
    }
  }

  return (
    <><BrandWordmark className="w-[210px]" />
    <h1 className="mt-6 font-display text-3xl font-bold sm:text-4xl">{mode === "signup" ? "Join Dinnerfolk" : "Welcome back"}</h1>
    <p className="mt-3 text-base leading-7 text-muted-foreground">{restricted
      ? "Dinnerfolk is open to invited email addresses. Create an account with an approved address, or sign in to your existing account."
      : "Create an account or sign in with an email code."}</p>
    <section className="mt-6 rounded-xl border border-border bg-card p-6 sm:p-8" aria-label={mode === "signup" ? "Create account" : "Sign in"}>
      <div className="flex flex-wrap gap-1 rounded-lg bg-secondary p-1" role="group" aria-label="Account action">
        <button type="button" onClick={() => chooseMode("signup")} aria-pressed={mode === "signup"} disabled={busy}
          className={`min-h-11 flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          Create account
        </button>
        <button type="button" onClick={() => chooseMode("signin")} aria-pressed={mode === "signin"} disabled={busy}
          className={`min-h-11 flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mode === "signin" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          Sign in
        </button>
      </div>

      <form onSubmit={sendCode} className="mt-6 space-y-4">
        {mode === "signup" && (
          <label className="block text-sm font-medium">
            Display name
            <input type="text" name="displayName" autoComplete="nickname" required maxLength={80}
              value={displayName} onChange={(event) => { setDisplayName(event.target.value); setError(""); }} disabled={busy || sent}
              className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-3" />
          </label>
        )}
        <label className="block text-sm font-medium">
          Email address
          <input type="email" name="email" autoComplete="email" required value={email}
            onChange={(event) => { setEmail(event.target.value); setError(""); }} disabled={busy || sent}
            className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-3" />
        </label>
        {!sent ? (
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </Button>
        ) : (
          <button type="button" disabled={busy} onClick={() => { setSent(false); setCode(""); setMessage(""); setError(""); }}
            className="text-sm font-semibold text-link underline">
            Change email or request a new code
          </button>
        )}
      </form>

      {sent && (
        <form onSubmit={verifyCode} className="mt-6 space-y-4 border-t border-border pt-6">
          <label className="block text-sm font-medium">
            Six-digit code
            <input type="text" name="code" inputMode="numeric" autoComplete="one-time-code" required
              pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => { setCode(event.target.value); setError(""); }}
              disabled={busy} className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-3" />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Checking…" : "Verify and continue"}
          </Button>
        </form>
      )}

      {message && <p role="status" className="mt-5 text-sm text-success">{message}</p>}
      {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
    </section></>
  );
}
