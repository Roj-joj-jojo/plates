"use client";
import { ConversationDay, ConversationMeta, ConversationTimestamp } from "@/components/conversation-meta";
import { submitWithShortcut } from "@/lib/submit-shortcut";
import { conversationCount, startsConversationDay } from "@/lib/conversation-ux";

import Link from "next/link";
import { Fragment, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/browser";
import type { PlateComment, PlateInteractionSummary } from "@/lib/supabase/plate-interactions";
import { CharacterCount, useDraftExit, useTransientMessage } from "@/components/form-feedback";

function interactionError(code?: string) {
  return code === "40001" ? "This changed elsewhere. Refresh before trying again." :
    code === "42501" ? "This Plate or comment is no longer available to your account." :
    "Couldn’t save this change. Check your connection and try again.";
}

export function PlateInteractionControls({ summary, commentsHref }: { summary: PlateInteractionSummary; commentsHref?: string }) {
  const router = useRouter();
  const guard = useRef(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState("");
  async function changeLike() {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError("");
    try {
      const { error } = await createClient().rpc("set_plate_like", {
        p_plate_id: summary.plate_id, p_liked: !summary.liked, p_expected_version: summary.like_version,
      });
      if (error) { setError(interactionError(error.code)); return; }
      startTransition(() => router.refresh());
    } catch { setError(interactionError()); }
    finally { guard.current = false; setBusy(false); }
  }
  return <div className="min-w-0 space-y-2"><div className="flex flex-wrap items-center gap-1">
    <Button variant="ghost" className={summary.liked ? "bg-secondary text-link hover:bg-secondary" : "text-link hover:bg-muted"} aria-label={`${summary.liked ? "Unlike" : "Like"} Plate · ${conversationCount(summary.like_count, "like")}`} aria-pressed={summary.liked} aria-busy={busy || refreshing} title={summary.liked ? "Unlike Plate" : "Like Plate"} disabled={busy || refreshing} onClick={() => void changeLike()}>
      <Heart aria-hidden="true" fill={summary.liked ? "currentColor" : "none"} /><span aria-hidden="true">{summary.like_count}</span>
    </Button>
    <Link href={commentsHref ?? `/feed/${summary.plate_id}#comments`} aria-label={conversationCount(summary.comment_count, "active comment")} title="Open Plate comments" className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-link hover:bg-muted">
      <MessageCircle className="size-4" aria-hidden="true" /><span aria-hidden="true">{summary.comment_count}</span>
    </Link>
  </div>{error && <p role="alert" className="max-w-md text-sm text-destructive">{error}</p>}</div>;
}

function CommentCard({ comment, linked = false, pictureUrl }: { comment: PlateComment; linked?: boolean; pictureUrl?: string | null }) {
  const router = useRouter();
  const guard = useRef(false);
  const expected = useRef(comment.revision);
  const [mode, setMode] = useState<"edit" | "remove" | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState("");
  const pending = busy || refreshing;
  const exit = useDraftExit(mode === "edit" && body !== comment.body, pending);
  async function change(remove: boolean) {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError("");
    try {
      const client = createClient();
      const { error } = remove ? await client.rpc("remove_plate_comment", { p_comment_id: comment.id, p_expected_revision: expected.current }) :
        await client.rpc("edit_plate_comment", { p_comment_id: comment.id, p_expected_revision: expected.current, p_body: body });
      if (error) { setError(interactionError(error.code)); return; }
      setMode(null); startTransition(() => router.refresh());
    } catch { setError(interactionError()); }
    finally { guard.current = false; setBusy(false); }
  }
  return <li id={`comment-${comment.id}`} className={`scroll-mt-6 rounded-lg border border-border p-4 ${linked ? "bg-secondary" : "bg-card"}`}>
    {comment.state !== "available" ? <p className="text-sm text-muted-foreground">This comment was removed.</p> : <>
      <ConversationMeta person={{ profileId: comment.author_id, name: comment.author_name ?? "Former member", username: comment.author_username, pictureUrl }} editedAt={comment.edited_at} />
      {mode === "edit" ? <form onKeyDown={submitWithShortcut} className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); void change(false); }}>
        <label className="block text-sm font-semibold">Edit your comment
          <textarea value={body} onChange={event => { setBody(event.target.value); setError(""); }} readOnly={pending} required maxLength={2000} rows={3} className="mt-2 w-full rounded-md border border-input bg-card p-3 font-normal" />
        </label>
        <CharacterCount value={body} max={2000} />
        <div className="flex flex-wrap gap-3"><Button type="submit" disabled={pending || !body.trim()}>{pending ? "Saving…" : "Save changes"}</Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => exit.requestExit(() => { setMode(null); setError(""); })}>Cancel</Button></div>
      </form> : <p className="mt-3 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{comment.body}</p>}
      <ConversationTimestamp at={comment.created_at} editedAt={comment.edited_at} fullDate={linked} />
      {mode !== "edit" && <div className="mt-2 flex flex-wrap gap-3">
        {comment.can_edit && <Button variant="ghost" disabled={pending} onClick={() => { expected.current = comment.revision; setBody(comment.body); setError(""); setMode("edit"); }}>Edit</Button>}
        {comment.can_remove && <Button variant="ghost" disabled={pending} onClick={() => { expected.current = comment.revision; setError(""); setMode("remove"); }}>{comment.can_edit ? "Remove" : "Remove from your Plate"}</Button>}
      </div>}
    </>}
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    {exit.dialog}
    <AlertDialog open={mode === "remove"} onOpenChange={open => { if (!open && !pending) { setMode(null); setError(""); } }}>
      <AlertDialogContent><AlertDialogTitle>Remove this comment?</AlertDialogTitle>
        <AlertDialogDescription>Its text will be replaced by “This comment was removed.” This can’t be undone.</AlertDialogDescription>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={() => void change(true)}>{pending ? "Removing…" : "Remove comment"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </li>;
}

export function PlateComments({ plateId, comments, linkedComment, olderHref, olderPage, commentPictures = {}, newestHref }: {
  plateId: string; comments: PlateComment[]; linkedComment?: PlateComment | null; olderHref?: string; olderPage: boolean; commentPictures?: Record<string, string | null>; newestHref?: string;
}) {
  const router = useRouter();
  const requestId = useRef<string | null>(null);
  const guard = useRef(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [posted, setPosted] = useTransientMessage<boolean>(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guard.current || !body.trim()) return;
    guard.current = true; setBusy(true); setError(""); setPosted(false);
    requestId.current ??= crypto.randomUUID();
    try {
      const { error } = await createClient().rpc("create_plate_comment", { p_plate_id: plateId, p_client_request_id: requestId.current, p_body: body });
      if (error) { setError(interactionError(error.code)); return; }
      setBody(""); requestId.current = null; setPosted(true);
      startTransition(() => { router.replace(`/feed/${plateId}#comments`, { scroll: false }); router.refresh(); });
    } catch { setError(interactionError()); }
    finally { guard.current = false; setBusy(false); }
  }
  const linkedElsewhere = linkedComment && !comments.some(comment => comment.id === linkedComment.id);
  return <section id="comments" className="mt-6 scroll-mt-6 rounded-lg border border-border bg-card p-5 sm:p-6" aria-labelledby="comments-heading">
    <h2 id="comments-heading" className="font-display text-xl font-bold">Comments on this Plate</h2>
    <p className="mt-2 text-sm text-muted-foreground">Visible to people who can currently read the original Plate. Replies in private Tables stay separate.</p>
    <p className="mt-2 text-xs text-muted-foreground">Counts include active comments. Removed comments keep their place in the conversation and aren’t counted.</p>
    <form autoComplete="off" onKeyDown={submitWithShortcut} onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm font-semibold">Add a comment
        <textarea value={body} onChange={event => { setBody(event.target.value); requestId.current = null; setError(""); setPosted(false); }} readOnly={busy || refreshing} rows={3} required maxLength={2000}
          className="mt-2 w-full rounded-md border border-input bg-card p-3 font-normal" />
      </label>
      <CharacterCount value={body} max={2000} />
      <p className="text-xs text-muted-foreground">Text only</p>
      <Button type="submit" disabled={busy || refreshing || !body.trim()}>{busy ? "Posting…" : "Post comment"}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {posted && <p role="status" className="text-sm text-success">Comment posted.</p>}
    </form>
    {linkedElsewhere && linkedComment && <div className="mt-6"><h3 className="mb-3 font-semibold">Linked comment</h3><ul><CommentCard comment={linkedComment} linked pictureUrl={commentPictures[linkedComment.author_id ?? ""]} /></ul></div>}
    <p className="mt-6 text-sm font-semibold">{olderPage ? "Older comments" : "Newest comments first"}</p>
    <ul className="mt-3 space-y-3">{comments.map((comment, index) => <Fragment key={comment.id}>
      {startsConversationDay(comment.created_at, comments[index - 1]?.created_at) && <li><ConversationDay at={comment.created_at} /></li>}
      <CommentCard comment={comment} linked={comment.id === linkedComment?.id} pictureUrl={commentPictures[comment.author_id ?? ""]} />
    </Fragment>)}</ul>
    {comments.length === 0 && <p className="mt-3 text-sm text-muted-foreground">{olderPage ? "No older comments." : "No comments yet."}</p>}
    <nav aria-label="Comment pages" className="mt-4 flex flex-wrap gap-5">
      {olderPage ? <Link href={newestHref ?? `/feed/${plateId}#comments`} className="inline-flex min-h-11 items-center font-semibold text-link underline">Newest comments</Link> :
        <Button variant="link" disabled={refreshing} onClick={() => startTransition(() => router.refresh())}>{refreshing ? "Refreshing…" : "Refresh comments"}</Button>}
      {olderHref && <Link href={olderHref} className="inline-flex min-h-11 items-center font-semibold text-link underline">Older comments</Link>}
    </nav>
  </section>;
}
