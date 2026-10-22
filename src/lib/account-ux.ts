export type AuthMode = "signup" | "signin";

// Never display upstream messages: they may contain internals or account details.
export function authErrorMessage(cause: unknown, mode: AuthMode, verifying = false) {
  const error = cause && typeof cause === "object" ? cause as { code?: unknown; status?: unknown; name?: unknown } : {};
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "Too many attempts. Wait a few minutes before requesting or entering another code.";
  }
  if (error.name === "AuthRetryableFetchError" || error.name === "TypeError") return "Couldn’t connect. Check your connection and try again.";
  if (verifying) return "That code couldn’t be verified. Check the six digits, or request a new code if it has expired.";
  if (error.code === "email_address_invalid" || error.code === "validation_failed") return "Enter a valid email address and try again.";
  return mode === "signup"
    ? "Couldn’t create this account. Check that the Dinnerfolk owner has approved your email address, then try again. If it is already approved, ask the owner for help."
    : "Couldn’t send a sign-in code. Check your email address and try again. If you haven’t joined Dinnerfolk yet, choose Create account with an approved address.";
}

export function displayNameProblem(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Enter a display name.";
  if (Array.from(trimmed).length > 80) return "Use at most 80 characters.";
  if (/[\u0000-\u001f\u007f-\u009f]/.test(trimmed)) return "Use a name without control characters or line breaks.";
  return null;
}
