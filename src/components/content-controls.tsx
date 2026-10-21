"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MentionInput } from "@/components/mention-input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ConfirmRemove } from "@/components/plates/confirm-remove";
import { createClient } from "@/lib/supabase/browser";
import { normaliseLinks, formError } from "@/lib/form-ux";
import { CharacterCount, useActionNotice, useDraftExit } from "@/components/form-feedback";
import { contributionProblem } from "@/lib/content-ux";
import { submitWithShortcut } from "@/lib/submit-shortcut";
import { OPTIONAL_LINKS } from "@/lib/ui-copy";

const fieldClass = "mt-2 w-full rounded-md border border-input bg-card px-3 py-3";
const buttonClass = "min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60";

function message(cause: unknown) {
  return formError(cause);
}

async function editableMentions(body: string) {
  const ids = [...new Set([...body.matchAll(/@\[([0-9a-f-]{36})\]/g)].map(match => match[1]))];
  const names = new Map<string, string>();
  const client = createClient();
  for (let start = 0; start < ids.length; start += 100) {
    const { data, error } = await client.rpc("resolve_mentions", { p_ids: ids.slice(start, start + 100) });
    if (error) throw error;
    for (const person of data ?? []) names.set(person.profile_id, person.username);
  }
  return body.replace(/@\[([0-9a-f-]{36})\]/g, (_, id: string) => names.has(id) ? `@${names.get(id)}` : "[Former member]");
}

export function EditedLabel({ editedAt }: { editedAt?: string | null }) {
  return editedAt ? <span className="ml-2 text-meta text-muted-foreground">Edited</span> : null;
}

export function TableContentControls({ id, groupId, kind, body: originalBody, links, question,
  updatedAt, canEdit, canRemove, hasPhotos = false, placement = "corner", authorName = "this member" }: {
  id: string; groupId: string; kind: "message" | "request" | "plate_share" | "reply";
  body: string; links: unknown; question?: string; updatedAt: string; canEdit: boolean; canRemove: boolean; hasPhotos?: boolean; placement?: "inline" | "corner"; authorName?: string;
}) {
  const router = useRouter();
  const announce = useActionNotice();
  const [mode, setMode] = useState<"edit" | "remove" | null>(null);
  const [body, setBody] = useState("");
  const [questionDraft, setQuestionDraft] = useState(question ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const pending = useRef(false);
  const exit = useDraftExit(mode === "edit" && dirty, busy);
  const expected = useRef(updatedAt);
  const urls = Array.isArray(links) ? links.filter((link): link is string => typeof link === "string") : [];
  const label = kind === "plate_share" ? "share" : kind === "request" ? "question" : kind;
  const editTitle = `Edit ${kind === "plate_share" ? "share note" : kind === "request" ? "question" : kind}`;
  if (!canEdit && !canRemove) return null;

  async function edit() {
    expected.current = updatedAt;
    setBusy(true); setError("");
    try { setBody(await editableMentions(originalBody)); setQuestionDraft(question ?? ""); setDirty(false); setMode("edit"); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    const parsed = normaliseLinks(String(fields.get("links") ?? ""));
    if (parsed.error) { setError(parsed.error); return; }
    const nextLinks = parsed.links;
    const problem = contributionProblem(kind, body, nextLinks, hasPhotos);
    if (problem) { setError(problem); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      const client = createClient();
      const result = kind === "reply"
        ? await client.rpc("edit_table_reply", { p_reply_id: id, p_expected_updated_at: expected.current, p_body: body.trim(), p_links: nextLinks })
        : await client.rpc("edit_table_content", { p_entry_id: id, p_expected_updated_at: expected.current,
          p_body: body.trim(), p_links: nextLinks, p_question: kind === "request" ? String(fields.get("question") ?? "").trim() : null });
      if (result.error) throw result.error;
      setDirty(false); setMode(null); announce("Changes saved."); router.refresh();
    } catch (cause) { setError(message(cause)); }
    finally { pending.current = false; setBusy(false); }
  }

  async function remove() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = kind === "reply"
        ? await createClient().rpc("remove_table_reply", { p_reply_id: id, p_expected_updated_at: expected.current })
        : await createClient().rpc("remove_table_content", { p_entry_id: id, p_expected_updated_at: expected.current });
      if (result.error) throw result.error;
      setMode(null); router.refresh();
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  const editor = mode === "edit" ? <form autoComplete="off" onKeyDown={submitWithShortcut} onSubmit={save} onChange={() => { setError(""); setDirty(true); }} className="mt-3 space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">{editTitle}</h3>
      {kind === "request" && <label className="block text-sm font-medium">Question
        <input name="question" value={questionDraft} onChange={event => setQuestionDraft(event.target.value)} readOnly={busy} required maxLength={500} className={fieldClass} />
      </label>}
      {kind === "request" && <CharacterCount value={questionDraft} max={500} />}
      <label className="block text-sm font-medium">{kind === "request" ? "Supporting context (optional)" : kind === "plate_share" ? "Share note (optional)" : "Text (optional with links or photos)"}
        <MentionInput groupId={groupId} value={body} onChange={setBody} readOnly={busy} className={fieldClass} />
      </label>
      <CharacterCount value={body} max={20000} />
      <label className="block text-sm font-medium">{OPTIONAL_LINKS}
        <textarea name="links" defaultValue={urls.join("\n")} readOnly={busy} rows={2} className={fieldClass} />
      </label>
      <p className="text-xs text-muted-foreground">Existing photos stay attached.</p>
      <div className="flex gap-3"><button disabled={busy} className={buttonClass}>{busy ? "Saving…" : "Save changes"}</button>
        <button type="button" disabled={busy} onClick={() => exit.requestExit(() => { setMode(null); setError(""); })} className="text-sm underline">Cancel</button></div>
    </form> : null;

  return <div className={placement === "inline" ? "shrink-0" : "absolute right-3 top-3"}>
    <DropdownMenu><DropdownMenuTrigger asChild><IconButton label={`${label} options`} icon={<MoreHorizontal aria-hidden />} disabled={busy} /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48">
      {canEdit && <DropdownMenuItem onSelect={() => { void edit(); }}>Edit {kind === "plate_share" ? "share note" : label}</DropdownMenuItem>}
      {canRemove && <DropdownMenuItem className="text-destructive" onSelect={() => { expected.current = updatedAt; setMode("remove"); setError(""); }}>{canEdit ? `Remove ${label}` : `Remove ${label} as Table Admin`}</DropdownMenuItem>}
    </DropdownMenuContent></DropdownMenu>
    <ConfirmRemove kind={mode === "remove" ? kind === "request" ? "request-remove" : kind === "plate_share" ? "share-remove" : kind === "reply" ? canEdit ? "reply-own" : "reply-admin" : canEdit ? "message-own" : "message-admin" : null} who={authorName} pending={busy} error={error || undefined} onConfirm={() => { void remove(); }} onCancel={() => { setMode(null); setError(""); }} />
    <Sheet open={mode === "edit" || Boolean(error && !mode)} onOpenChange={open => { if (!open && !busy) exit.requestExit(() => { setMode(null); setError(""); }); }}><SheetContent><SheetTitle className="font-display text-lg font-bold">{mode === "edit" ? editTitle : "Options unavailable"}</SheetTitle><SheetDescription className="mt-2 text-sm text-muted-foreground">Update your own words. Existing photos stay attached.</SheetDescription>{editor}{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}</SheetContent></Sheet>
    {exit.dialog}
    {busy && !mode && <p role="status" className="sr-only">Preparing editor…</p>}
  </div>;
}

export function UnpublishPlateControl({ plateId, revision, onEdit, canUnpublish = true, disabled = false }: { plateId: string; revision: number; onEdit?: () => void; canUnpublish?: boolean; disabled?: boolean }) {
  const router = useRouter();
  const announce = useActionNotice();
  const expected = useRef(revision);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function unpublish() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const { error } = await createClient().rpc("unpublish_plate", { p_plate_id: plateId, p_expected_revision: expected.current });
      if (error) throw error;
      announce("Plate unpublished. Existing Menu copies won’t change.");
      router.push("/feed"); router.refresh();
    } catch (cause) { setError(message(cause)); setBusy(false); }
  }
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild><IconButton label="Plate options" icon={<MoreHorizontal aria-hidden />} disabled={disabled || busy} /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48">
      {onEdit && <DropdownMenuItem onSelect={onEdit}>Edit Plate</DropdownMenuItem>}
      {canUnpublish && <DropdownMenuItem className="text-destructive" onSelect={() => { expected.current = revision; setError(""); setConfirming(true); }}>Unpublish Plate</DropdownMenuItem>}
    </DropdownMenuContent></DropdownMenu>
    <ConfirmRemove kind={confirming ? "plate-unpublish" : null} pending={busy} error={error || undefined} onConfirm={() => { void unpublish(); }} onCancel={() => { setConfirming(false); setError(""); }} />
  </>;
}
