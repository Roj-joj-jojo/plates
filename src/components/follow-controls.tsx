"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { CharacterCount, useActionNotice, useDraftExit } from "@/components/form-feedback";
import { submitWithShortcut } from "@/lib/submit-shortcut";

function useSocialAction() {
  const router = useRouter();
  const guard = useRef(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState("");
  async function run(name: string, args: Record<string, unknown>) {
    if (guard.current) return false;
    guard.current = true; setBusy(true); setError("");
    try {
      const { error: rpcError } = await createClient().rpc(name, args);
      if (rpcError) {
        setError(rpcError.code === "40001" ? "This changed elsewhere. Refresh and try again." : "Couldn’t save this change. Please try again.");
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } catch { setError("Couldn’t connect. Please try again."); return false; }
    finally { guard.current = false; setBusy(false); }
  }
  return { run, busy: busy || refreshing, error, clearError: () => setError("") };
}

export function FollowButton({ profileId, state, version, isPrivate }: {
  profileId: string; state: string; version: number; isPrivate: boolean;
}) {
  const action = useSocialAction();
  const [confirm, setConfirm] = useState(false);
  const active = state === "approved" || state === "pending";
  async function change(follow: boolean) {
    if (await action.run("set_follow", { p_author_id: profileId, p_follow: follow, p_expected_version: version })) setConfirm(false);
  }
  return <div className="space-y-2">
    <Button variant={active ? "outline" : "default"} disabled={action.busy}
      onClick={() => active ? setConfirm(true) : void change(true)}>
      {action.busy ? "Saving…" : state === "approved" ? "Following" : state === "pending" ? "Requested" : isPrivate ? "Request to follow" : "Follow"}
    </Button>
    {action.error && <p role="alert" className="max-w-xs text-sm text-destructive">{action.error}</p>}
    <AlertDialog open={confirm} onOpenChange={open => { if (!action.busy) setConfirm(open); }}>
      <AlertDialogContent>
        <AlertDialogTitle>{state === "pending" ? "Cancel follow request?" : "Unfollow this person?"}</AlertDialogTitle>
        <AlertDialogDescription>{state === "pending" ? "You can send another request later." : "Their Plates will leave your Feed. Saved Menu copies stay. For a private account, following again needs approval."}</AlertDialogDescription>
        {action.error && <p role="alert" className="text-sm text-destructive">{action.error}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={action.busy}>Keep {state === "pending" ? "request" : "following"}</AlertDialogCancel>
          <Button disabled={action.busy} onClick={() => void change(false)}>{action.busy ? "Saving…" : state === "pending" ? "Cancel request" : "Unfollow"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

export function FollowerControls({ id, version, pending }: { id: string; version: number; pending: boolean }) {
  const action = useSocialAction();
  const announce = useActionNotice();
  const [confirm, setConfirm] = useState(false);
  async function respond(accept: boolean) {
    if (await action.run("respond_follow", { p_edge_id: id, p_accept: accept, p_expected_version: version })) { setConfirm(false); announce(accept ? "Follow request accepted." : pending ? "Follow request declined." : "Follower removed."); }
  }
  return <div className="space-y-2"><div className="flex flex-wrap gap-2">
    {pending && <Button disabled={action.busy} onClick={() => void respond(true)}>{action.busy ? "Saving…" : "Accept"}</Button>}
    <Button variant="outline" disabled={action.busy} onClick={() => pending ? void respond(false) : setConfirm(true)}>{pending ? "Decline" : "Remove follower"}</Button>
    </div>{action.error && <p role="alert" className="text-sm text-destructive">{action.error}</p>}
    <AlertDialog open={confirm} onOpenChange={open => { if (!action.busy) setConfirm(open); }}><AlertDialogContent>
      <AlertDialogTitle>Remove this follower?</AlertDialogTitle>
      <AlertDialogDescription>They will stop following you. If your account is private, they lose access to your original Plates. Copies already saved to Menu stay.</AlertDialogDescription>
      {action.error && <p role="alert" className="text-sm text-destructive">{action.error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={action.busy}>Cancel</AlertDialogCancel><Button disabled={action.busy} onClick={() => void respond(false)}>{action.busy ? "Saving…" : "Remove follower"}</Button></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </div>;
}

export function PrivacySettings({ isPrivate, version, bio }: { isPrivate: boolean; version: number; bio: string }) {
  const action = useSocialAction();
  const [confirm, setConfirm] = useState(false);
  const announce = useActionNotice();
  return <><ProfileBio bio={bio} version={version} /><section className="mt-6 rounded-lg border bg-card p-6">
    <h2 className="font-display text-lg font-bold">Account privacy</h2>
    <p className="mt-2 text-sm text-muted-foreground">{isPrivate ? "Private: only approved followers can see your Plates." : "Open: people signed in to Plates can discover your Plates and follow you."} Tables always have their own private membership.</p>
    <Button className="mt-4" variant="outline" disabled={action.busy} onClick={() => setConfirm(true)}>Make account {isPrivate ? "open" : "private"}</Button>
    {action.error && <p role="alert" className="mt-3 text-sm text-destructive">{action.error}</p>}
    <AlertDialog open={confirm} onOpenChange={open => { if (!action.busy) setConfirm(open); }}><AlertDialogContent>
      <AlertDialogTitle>Make your account {isPrivate ? "open" : "private"}?</AlertDialogTitle>
      <AlertDialogDescription>{isPrivate ? "Anyone signed in will be able to see your Plates. Pending follow requests will become followers." : "Only you and approved followers will be able to see your Plates. Existing followers stay approved. You can remove them from your Followers list. Your name, username and profile photo stay discoverable."} Copies already saved to Menu stay. Your Tables are unchanged.</AlertDialogDescription>
      {action.error && <p role="alert" className="text-sm text-destructive">{action.error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={action.busy}>Cancel</AlertDialogCancel>
        <Button disabled={action.busy} onClick={async () => {
          if (await action.run("set_my_privacy", { p_private: !isPrivate, p_expected_version: version })) { setConfirm(false); announce(`Account is now ${isPrivate ? "open" : "private"}.`); }
        }}>{action.busy ? "Saving…" : "Make " + (isPrivate ? "open" : "private")}</Button>
      </AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </section></>;
}

function ProfileBio({ bio, version }: { bio: string; version: number }) {
  const action = useSocialAction();
  const announce = useActionNotice();
  const [draft, setDraft] = useState<string | null>(null);
  const expected = useRef(version);
  const dirty = draft !== null && draft !== bio;
  const exit = useDraftExit(dirty, action.busy);
  return <section className="mt-6 rounded-lg border bg-card p-6"><h2 className="font-display text-lg font-bold">Profile bio</h2>
    <form className="mt-4 space-y-3" onKeyDown={submitWithShortcut} onSubmit={async event => {
      event.preventDefault();
      if (await action.run("set_my_bio", { p_bio: draft ?? bio, p_expected_version: expected.current })) { setDraft(null); announce("Bio saved."); }
    }}>
      <label className="block text-sm font-semibold">About you (optional)
        <textarea name="bio" rows={3} maxLength={160} value={draft ?? bio} onChange={event => { if (draft === null) expected.current = version; setDraft(event.target.value); action.clearError(); }} readOnly={action.busy} className="mt-2 w-full rounded-md border border-input bg-card p-3 font-normal" />
      </label><CharacterCount value={draft ?? bio} max={160} />
      <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={action.busy || !dirty} type="submit">{action.busy ? "Saving…" : "Save bio"}</Button>
        {dirty && <Button variant="ghost" type="button" disabled={action.busy} onClick={() => exit.requestExit(() => { setDraft(null); action.clearError(); })}>Cancel</Button>}</div>
      {action.error && <p role="alert" className="text-sm text-destructive">{action.error}</p>}
    </form>{exit.dialog}
  </section>;
}
