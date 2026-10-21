"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Bookmark, SendHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { MentionInput } from "@/components/mention-input";
import { SavedMenuItem } from "@/components/menu-item-actions";
import { PhotoSelection } from "@/components/photo-selection";
import { CharacterCount, useActionNotice, useDraftExit, useTransientMessage } from "@/components/form-feedback";
import { formError, normaliseLinks } from "@/lib/form-ux";
import { submitWithShortcut } from "@/lib/submit-shortcut";
import { OPTIONAL_LINKS, PLATE_UPDATED } from "@/lib/ui-copy";

const fieldClass = "mt-2 w-full rounded-md border border-input bg-card px-3 py-3";
const buttonClass = "min-h-11 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60";

function errorMessage(cause: unknown) {
  return formError(cause);
}

async function uploadPlateImages(files: File[], onProgress: (message: string) => void) {
  if (files.length > 6) throw new Error("Choose at most six photos.");
  const client = createClient();
  const ids: string[] = [];
  for (const [index, file] of files.entries()) {
    if (file.size === 0 || file.size > 10_000_000) throw new Error("Each photo must be under 10 MB.");
    onProgress(`Uploading photo ${index + 1} of ${files.length}…`);
    const { data: intents, error: intentError } = await client.rpc("request_plate_upload");
    if (intentError) throw intentError;
    const intent = intents?.[0];
    if (!intent) throw new Error("Couldn’t prepare this photo.");
    const { error: uploadError } = await client.storage.from("staged-assets")
      .upload(intent.staged_path, file, { upsert: false, contentType: "application/octet-stream" });
    if (uploadError) throw uploadError;
    onProgress(`Processing photo ${index + 1} of ${files.length}…`);
    let readyId: string | null = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { data: state, error: stateError } = await client.from("media_upload_intents")
        .select("state, asset_id, error_message").eq("id", intent.intent_id).single();
      if (stateError) throw stateError;
      if (state.state === "failed") throw new Error(state.error_message ?? "Photo processing failed.");
      if (state.state === "ready") { readyId = state.asset_id; break; }
    }
    if (!readyId) throw new Error("Photo processing is taking too long. Check that the local media worker is running.");
    ids.push(readyId);
  }
  return ids;
}

async function uploadTableImages(files: File[], groupId: string,
  onProgress: (message: string) => void) {
  if (files.length > 4) throw new Error("Choose at most four photos.");
  const client = createClient();
  const ids: string[] = [];
  for (const [index, file] of files.entries()) {
    if (file.size === 0 || file.size > 10_000_000) throw new Error("Each photo must be under 10 MB.");
    onProgress(`Uploading photo ${index + 1} of ${files.length}…`);
    const { data: intents, error: intentError } = await client.rpc("request_table_upload", {
      p_group_id: groupId,
    });
    if (intentError) throw intentError;
    const intent = intents?.[0];
    if (!intent) throw new Error("Couldn’t prepare this Table photo.");
    const { error: uploadError } = await client.storage.from("table-staged-assets")
      .upload(intent.staged_path, file, { upsert: false, contentType: "application/octet-stream" });
    if (uploadError) throw uploadError;
    onProgress(`Processing photo ${index + 1} of ${files.length}…`);
    let readyId: string | null = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { data: state, error: stateError } = await client.from("table_upload_intents")
        .select("state, asset_id, error_message").eq("id", intent.intent_id).single();
      if (stateError) throw stateError;
      if (state.state === "failed") throw new Error(state.error_message ?? "Photo processing failed.");
      if (state.state === "ready") { readyId = state.asset_id; break; }
    }
    if (!readyId) throw new Error("Photo processing is taking too long. Check that the local media worker is running.");
    ids.push(readyId);
  }
  return ids;
}

export function CreatePlateForm({ categories, imageUploadsReady = false }: {
  categories: { id: string; label: string }[]; imageUploadsReady?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const inFlight = useRef(false);
  const prepared = useRef<{ key: string; ids: string[] } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const body = String(fields.get("body") ?? "").trim();
    const parsed = normaliseLinks(String(fields.get("links") ?? ""));
    if (parsed.error) { setError(parsed.error); return; }
    if (!body && !parsed.links.length && files.length === 0) { setError("Add some text, a link or a photo."); return; }
    inFlight.current = true; setBusy(true); setError("");
    try {
      const fileKey = files.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join("|");
      const attachmentIds = prepared.current?.key === fileKey ? prepared.current.ids
        : await uploadPlateImages(files, setProgress);
      prepared.current = { key: fileKey, ids: attachmentIds };
      setProgress("Adding Plate…");
      const { data, error: rpcError } = await createClient().rpc("publish_plate", {
        p_category_id: String(fields.get("category")), p_body: body,
        p_links: parsed.links, p_tags: [], p_attachment_ids: attachmentIds,
      });
      if (rpcError) throw rpcError;
      router.push(`/feed/${data}`);
      router.refresh();
    } catch (cause) { setError(errorMessage(cause)); } finally { inFlight.current = false; setBusy(false); setProgress(""); }
  }
  return <form onKeyDown={submitWithShortcut} onSubmit={submit} onChange={event => { if (!(event.target instanceof HTMLInputElement && event.target.type === "file")) setError(""); }} className="mt-6 space-y-4 rounded-lg border border-border bg-card p-6">
    <fieldset disabled={busy} className="space-y-4">
    <h2 className="font-display text-lg font-bold">Add a Plate</h2>
    <label className="block text-sm font-medium">Category
      <select name="category" required className={fieldClass}>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
      </select>
    </label>
    <label className="block text-sm font-medium">Plate text (optional with links or photos)
      <textarea name="body" value={body} onChange={event => setBody(event.target.value)} maxLength={20000} rows={4} className={fieldClass} />
    </label>
    <CharacterCount value={body} max={20000} />
    <label className="block text-sm font-medium">{OPTIONAL_LINKS}
      <textarea name="links" rows={2} placeholder="food.com/recipe" className={fieldClass} />
    </label>
    {imageUploadsReady && <PhotoSelection files={files} limit={6} busy={busy} onError={setError} onChange={next => { setFiles(next); setError(""); prepared.current = null; }} />}
    <button disabled={busy || categories.length === 0} className={buttonClass}>{busy ? "Adding…" : "Add a Plate"}</button>
    </fieldset>
    {progress && <p role="status" className="text-sm text-muted-foreground">{progress}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}

export function EditPlateForm({ plateId, revision, categoryId, body: initialBody,
  links: initialLinks, tags, categories, attachmentIds = [], embedded = false, onSaved, onCancel }: {
  plateId: string; revision: number; categoryId: string; body: string;
  links: unknown; tags: unknown; categories: { id: string; label: string }[]; attachmentIds?: string[];
  embedded?: boolean; onSaved?: () => void; onCancel?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const links = Array.isArray(initialLinks)
    ? initialLinks.filter((link): link is string => typeof link === "string") : [];
  const [body, setBody] = useState(initialBody);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useTransientMessage<string>("");
  const inFlight = useRef(false);
  const exit = useDraftExit(dirty, busy);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const fields = new FormData(event.currentTarget);
    const body = String(fields.get("body") ?? "").trim();
    const parsed = normaliseLinks(String(fields.get("links") ?? ""));
    if (parsed.error) { setError(parsed.error); return; }
    const nextLinks = parsed.links;
    if (!body && nextLinks.length === 0 && attachmentIds.length === 0) { setError("Keep some text, a link or a photo on the Plate."); return; }
    if (nextLinks.length > 10) { setError("Use at most 10 links."); return; }
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const { error: rpcError } = await createClient().rpc("edit_plate", {
        p_plate_id: plateId, p_expected_revision: revision,
        p_category_id: String(fields.get("category")), p_body: body,
        p_links: nextLinks, p_tags: Array.isArray(tags) ? tags : [], p_attachment_ids: attachmentIds,
      });
      if (rpcError) throw rpcError;
      setDirty(false); setNotice(PLATE_UPDATED);
      onSaved?.(); router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally { inFlight.current = false; setBusy(false); }
  }
  const editor = <form onKeyDown={submitWithShortcut} onSubmit={submit} onChange={() => { setError(""); setNotice(""); setDirty(true); }} className="mt-5 space-y-4">
      <h2 className="font-display text-plate-title">Edit Plate</h2>
      <p className="text-sm text-muted-foreground">Your photos stay attached. Table shares show these changes; earlier Menu saves keep their saved copy.</p>
      <label className="block text-sm font-medium">Category
        <select name="category" defaultValue={categoryId} disabled={busy} required className={fieldClass}>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Plate text (optional with links or photos)
        <textarea name="body" autoFocus={embedded} value={body} onChange={event => setBody(event.target.value)} readOnly={busy} rows={5} maxLength={20000} className={fieldClass} />
      </label>
      <CharacterCount value={body} max={20000} />
      <label className="block text-sm font-medium">{OPTIONAL_LINKS}
        <textarea name="links" defaultValue={links.join("\n")} readOnly={busy} rows={Math.max(2, links.length)} className={fieldClass} />
      </label>
      <div className="flex flex-wrap gap-3"><button disabled={busy} className={buttonClass}>{busy ? "Saving changes…" : "Save changes"}</button>
        {onCancel && <Button type="button" variant="outline" disabled={busy} onClick={() => exit.requestExit(onCancel)}>Cancel</Button>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-success">{notice}</p>}
      {exit.dialog}
    </form>;
  return embedded ? editor : <details className="mt-6 rounded-lg border border-border bg-card p-6">
    <summary className="cursor-pointer text-lg font-semibold">Edit your Plate</summary>{editor}
  </details>;
}

export function CreateTableForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) return;
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await createClient().rpc("create_group", { p_name: name });
      if (rpcError) throw rpcError;
      router.push(`/tables/${data}`);
      router.refresh();
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
    <h2 className="text-lg font-semibold">Create a Table</h2>
    <label className="block text-sm font-medium">Table name
      <input name="name" required maxLength={100} className={fieldClass} />
    </label>
    <button disabled={busy} className={buttonClass}>{busy ? "Creating…" : "Create Table"}</button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}

export function SharePlateForm({ plateId, groups, embedded = false, onBusyChange }: { plateId: string; groups: { id: string; name: string }[]; embedded?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const router = useRouter();
  const [mentionGroup, setMentionGroup] = useState(groups[0]?.id ?? "");
  const [note, setNote] = useState("");
  const requestId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const groupId = String(fields.get("group"));
    const body = String(fields.get("body") ?? "").trim();
    requestId.current ??= crypto.randomUUID();
    setBusy(true); setError("");
    onBusyChange?.(true);
    try {
      const { data, error: rpcError } = await createClient().rpc("share_plate", {
        p_group_id: groupId, p_plate_id: plateId, p_client_request_id: requestId.current,
        p_body: body, p_links: [], p_attachment_ids: [],
      });
      if (rpcError) throw rpcError;
      router.push(`/tables/${groupId}/discussion/${data}`);
      router.refresh();
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); onBusyChange?.(false); }
  }
  if (groups.length === 0) return <p className="mt-6 text-sm text-muted-foreground">Create a Table before sharing this Plate.</p>;
  return <form onKeyDown={submitWithShortcut} onSubmit={submit} onChange={() => { requestId.current = null; setError(""); }} className={embedded ? "mt-6 space-y-4" : "mt-6 space-y-4 rounded-lg border border-border bg-card p-6"}>
    {!embedded && <h2 className="font-display text-lg font-bold">Share to a Table</h2>}
    <label className="block text-sm font-medium">Table
      <select name="group" value={mentionGroup} disabled={busy} onChange={event => setMentionGroup(event.target.value)} className={fieldClass}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
    </label>
    <label className="block text-sm font-medium">Add a note (optional)
      <MentionInput groupId={mentionGroup} value={note} onChange={value => { requestId.current = null; setNote(value); }} readOnly={busy} rows={2} className={fieldClass} />
    </label>
    <CharacterCount value={note} max={20000} />
    <button disabled={busy} className={buttonClass}>{busy ? "Sharing…" : "Share to Table"}</button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}

export function PostTableMessageForm({ groupId, photoUploadsReady = false, compact = false }: {
  groupId: string; photoUploadsReady?: boolean; compact?: boolean;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  const prepared = useRef<{ key: string; ids: string[] } | null>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileCount = files.length;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [posted, setPosted] = useTransientMessage<boolean>(false);
  const [progress, setProgress] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || (!body.trim() && files.length === 0)) return;
    inFlight.current = true;

    setBusy(true); setError(""); setPosted(false);
    try {
      requestId.current ??= crypto.randomUUID();
      const fileKey = files.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join("|");
      const attachmentIds = prepared.current?.key === fileKey ? prepared.current.ids
        : await uploadTableImages(files, groupId, setProgress);
      prepared.current = { key: fileKey, ids: attachmentIds };
      setProgress("Posting message…");
      const { error: rpcError } = await createClient().rpc("post_message", {
        p_group_id: groupId, p_client_request_id: requestId.current,
        p_body: body.trim(), p_links: [], p_attachment_ids: attachmentIds,
      });
      if (rpcError) throw rpcError;
      requestId.current = null;
      prepared.current = null;
      setFiles([]);
      setBody("");
      setPosted(true);
      router.refresh();
      window.dispatchEvent(new CustomEvent("plates:message-posted", { detail: groupId }));
    } catch (cause) { setError(errorMessage(cause)); } finally { inFlight.current = false; setBusy(false); setProgress(""); }
  }
  const photos = photoUploadsReady && <PhotoSelection files={files} limit={4} busy={busy} compact={compact} onError={setError} onChange={next => { if (inFlight.current) return; setFiles(next); prepared.current = null; requestId.current = null; setError(""); setPosted(false); }} />;
  if (compact) return <form autoComplete="off" onSubmit={submit} className="border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] thread:px-6">
    <div className="mx-auto max-w-thread">
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        {photos}
        <label className="min-w-0 flex-1"><span className="sr-only">Message this Table</span><MentionInput sendOnEnter groupId={groupId} value={body} onChange={value => { if (inFlight.current) return; setBody(value); requestId.current = null; setPosted(false); setError(""); }} readOnly={busy} isLocked={() => inFlight.current} suggestionsAbove rows={1} className="max-h-36 min-h-11 resize-none field-sizing-content"/></label>
        <Button disabled={busy || (!body.trim() && fileCount === 0)}><SendHorizontal aria-hidden/>{busy ? "Sending…" : "Send"}</Button>
      </div>
      {body.length >= 19000 && <CharacterCount value={body} max={20000} />}
      <p className="mt-1 text-meta text-muted-foreground">{busy ? progress || "Sending your message…" : "Enter to send. Shift + Enter for a new line. Type @ to mention someone."}</p>
      <p className="mt-1 text-meta text-muted-foreground">Only Table members can read this chat, including people added later.</p>
      {posted && <p role="status" className="mt-1 text-meta text-success">Message sent.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error} Your message and photo selection are still here.</p>}
    </div>
  </form>;
  // Firefox can restore a previous button state before React hydrates.
  return <form autoComplete="off" onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
    <p className="text-sm text-muted-foreground">Only Table members can read this chat, including people added later.</p>
    <label className="block text-sm font-semibold">Message this Table
      <MentionInput sendOnEnter groupId={groupId} value={body} readOnly={busy} isLocked={() => inFlight.current} onChange={(value) => { if (inFlight.current) return; setBody(value); requestId.current = null; setPosted(false); setError(""); }} rows={3} className={fieldClass} />
      <p className="text-xs text-muted-foreground">Enter to send. Shift + Enter for a new line. Type @ to mention someone.</p>
    </label>
    <CharacterCount value={body} max={20000} />
    {photos}
    <button disabled={busy || (!body.trim() && fileCount === 0)} className={buttonClass}>{busy ? progress || "Posting…" : "Post message"}</button>
    {posted && <p role="status" className="text-sm text-success">Message posted to this Table.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}

export function CreateRequestForm({ groupId, expanded = false }: { groupId: string; expanded?: boolean }) {
  const router = useRouter();
  const [context, setContext] = useState("");
  const [question, setQuestion] = useState("");
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const fields = new FormData(event.currentTarget);
    const question = String(fields.get("question") ?? "").trim();
    const context = String(fields.get("context") ?? "").trim();
    if (!question) { setError("Add a question."); return; }
    inFlight.current = true;
    requestId.current ??= crypto.randomUUID();
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await createClient().rpc("post_table_request", {
        p_group_id: groupId, p_client_request_id: requestId.current,
        p_question: question, p_context: context, p_links: [], p_attachment_ids: [],
      });
      if (rpcError) throw rpcError;
      router.push(`/tables/${groupId}/requests/${data}`);
      router.refresh();
    } catch (cause) { setError(errorMessage(cause)); } finally { inFlight.current = false; setBusy(false); }
  }
  return <details open={expanded || undefined} className="mt-4 rounded-lg border bg-card p-4">
    <summary className="cursor-pointer text-lg font-semibold">Ask this Table a question</summary>
    <p className="mt-3 text-sm text-muted-foreground">Your question and replies stay in this private Table. Members added later can read them. Save a question to Menu as a Request to revisit it.</p>
    <form onKeyDown={submitWithShortcut} onSubmit={submit} onChange={() => { requestId.current = null; setError(""); }} className="mt-5 space-y-4">
      <label className="block text-sm font-medium">Question
        <input name="question" value={question} onChange={event => setQuestion(event.target.value)} readOnly={busy} required maxLength={500} className={expanded ? "mt-2 w-full rounded-md border border-input bg-card px-3 py-3" : fieldClass} />
      </label>
      <CharacterCount value={question} max={500} />
      <label className="block text-sm font-medium">Supporting context (optional)
        <MentionInput groupId={groupId} name="context" value={context} onChange={setContext} readOnly={busy} rows={3} className={expanded ? "mt-2 w-full rounded-md border border-input bg-card px-3 py-3" : fieldClass} />
      </label>
      <CharacterCount value={context} max={20000} />
      <button disabled={busy} className={expanded ? "min-h-11 rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-hover disabled:opacity-60" : buttonClass}>{busy ? "Posting…" : "Post question"}</button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  </details>;
}

export function SaveRequestButton({ requestId, saved }: { requestId: string; saved: boolean }) {
  const router = useRouter();
  const announce = useActionNotice();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const { error: rpcError } = await createClient().rpc("save_table_request", {
        p_request_entry_id: requestId,
      });
      if (rpcError) throw rpcError;
      setDone(true);
      announce("Request saved to Menu. Open it there to revisit the Table discussion.");
      router.refresh();
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  if (saved || done) return <SavedMenuItem kind="request" sourceId={requestId} />;
  return <div className="mt-5">
    <Button type="button" variant="outline" onClick={save} disabled={busy || saved || done} className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left">
      {busy ? "Saving…" : saved || done ? "Saved to your Menu" : "Save Request to Menu"}
    </Button>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </div>;
}

export function ReplyForm({ threadId, groupId, tableName, aboutPlate = false, photoUploadsReady = false }: {
  threadId: string; groupId: string; tableName?: string; aboutPlate?: boolean; photoUploadsReady?: boolean;
}) {
  const router = useRouter();
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const prepared = useRef<{ key: string; ids: string[] } | null>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileCount = files.length;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [notice, setNotice] = useTransientMessage<string>("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || (!body.trim() && files.length === 0)) return;
    inFlight.current = true;
    requestId.current ??= crypto.randomUUID();
    setBusy(true); setError(""); setNotice("");
    try {
      const fileKey = files.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join("|");
      const attachmentIds = prepared.current?.key === fileKey ? prepared.current.ids
        : await uploadTableImages(files, groupId, setProgress);
      prepared.current = { key: fileKey, ids: attachmentIds };
      setProgress("Posting reply…");
      const { error: rpcError } = await createClient().rpc("reply_to_thread", {
        p_thread_id: threadId, p_client_request_id: requestId.current,
        p_body: body.trim(), p_links: [], p_attachment_ids: attachmentIds,
      });
      if (rpcError) throw rpcError;
      requestId.current = null;
      prepared.current = null;
      setFiles([]);
      setBody("");
      setNotice("Reply posted.");
      router.refresh();
    } catch (cause) { setError(errorMessage(cause)); } finally { inFlight.current = false; setBusy(false); setProgress(""); }
  }
  // Keep restored browser state from overriding the initial disabled button.
  return <form autoComplete="off" onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
    <p className="text-sm text-muted-foreground">Only members of {tableName ?? "this Table"} can read these replies, including people added later.{aboutPlate ? " This doesn’t comment on the original Plate." : ""}</p>
    <label className="block text-sm font-semibold">Reply to this Table
      <MentionInput groupId={groupId} value={body} readOnly={busy} isLocked={() => inFlight.current} onChange={(value) => { setBody(value); requestId.current = null; setError(""); setNotice(""); }} rows={3} className={fieldClass} />
    </label>
    <CharacterCount value={body} max={20000} />
    {photoUploadsReady && <PhotoSelection files={files} limit={4} busy={busy} onError={setError} onChange={next => { setFiles(next); prepared.current = null; requestId.current = null; setError(""); setNotice(""); }} />}
    <button disabled={busy || (!body.trim() && fileCount === 0)} className={buttonClass}>{busy ? progress || "Posting…" : "Post reply"}</button>
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}

export function SavePlateButton({ plateId, revision, shareId, saved, sourceSaved = false, hasPhotos = false, compact = false }: {
  plateId: string; revision: number; shareId?: string; saved: boolean; sourceSaved?: boolean;
  hasPhotos?: boolean; compact?: boolean;
}) {
  const announce = useActionNotice();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  async function save() {
    if (busy) return;
    setBusy(true); setError(""); setProgress("");
    try {
      const client = createClient();
      let previewAssetId: string | null = null;
      if (hasPhotos && !saved) {
        setProgress("Preparing your private Menu photos…");
        const gallery = await client.rpc("request_menu_gallery", {
          p_plate_id: plateId, p_expected_revision: revision,
        });
        const legacy = gallery.error && ["PGRST202", "42883"].includes(gallery.error.code)
          ? await client.rpc("request_menu_preview", { p_plate_id: plateId, p_expected_revision: revision }) : null;
        const requestError = legacy ? legacy.error : gallery.error;
        if (requestError) throw requestError;
        const jobIds: string[] = legacy ? (legacy.data ? [legacy.data] : []) :
          ((gallery.data ?? []) as Array<{ job_id: string; image_position: number }>)
            .sort((a, b) => a.image_position - b.image_position).map(row => row.job_id);
        if (!jobIds.length || jobIds.length > 6 || new Set(jobIds).size !== jobIds.length) throw new Error("Couldn’t prepare the Menu photos.");
        for (let attempt = 0; attempt < 60; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const { data: jobs, error: jobError } = await client.from("menu_preview_jobs")
            .select("id, state, preview_asset_id, error_message").in("id", jobIds);
          if (jobError) throw jobError;
          if (!jobs || jobs.length !== jobIds.length) throw new Error("Couldn’t read the Menu photo processing status.");
          const failed = jobs.find(job => job.state === "failed");
          if (failed) throw new Error(failed.error_message ?? "Menu photo processing failed.");
          if (jobs.every(job => job.state === "ready" && job.preview_asset_id)) {
            previewAssetId = jobs.find(job => job.id === jobIds[0])!.preview_asset_id; break;
          }
        }
        if (!previewAssetId) throw new Error("Menu photos are taking too long. Check that the photo worker is running.");
      }
      setProgress("Saving Plate…");
      const { error: rpcError } = await client.rpc("save_plate", {
        p_plate_id: plateId, p_expected_revision: revision,
        p_source_share_id: shareId ?? null, p_preview_asset_id: previewAssetId,
      });
      if (rpcError) throw rpcError;
      setDone(true);
      announce(shareId && saved ? "Discussion added to your saved Plate." : "Saved to your Menu.");
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); setProgress(""); }
  }
  const alreadySaved = shareId ? sourceSaved : saved;
  const label = shareId
    ? sourceSaved ? "Discussion linked to saved Plate"
      : saved ? "Link this Table discussion to your saved Plate" : "Save Plate with this Table discussion"
    : saved ? "Already in your Menu" : "Save Plate to Menu";
  const toolbar = compact && !shareId;
  if (alreadySaved || done) return <SavedMenuItem kind="plate" sourceId={plateId} compact={toolbar} />;
  return <div className={compact ? "mt-2" : "mt-5"}>
    <Button type="button" variant={toolbar ? "ghost" : "outline"} onClick={save} disabled={busy || alreadySaved} aria-label={toolbar ? label : undefined} aria-busy={busy} title={label} className={`h-auto min-h-11 max-w-full whitespace-normal py-2 text-left ${toolbar ? "text-link" : ""}`}>
      {toolbar && <Bookmark aria-hidden="true" />}{busy ? "Saving…" : toolbar ? "Save" : label}
    </Button>
    {busy && progress && <p role="status" className="mt-2 max-w-xs text-xs text-muted-foreground">{progress}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </div>;
}
