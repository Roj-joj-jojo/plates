"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { PictureAvatar } from "@/components/picture-avatar";
import { Button } from "@/components/ui/button";
import { useTransientMessage } from "@/components/form-feedback";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
export type TablePerson = { profile_id: string; username: string | null; display_name: string; role?: string; is_me?: boolean };
const field = "mt-2 block w-full min-h-11 rounded-md border border-input bg-card p-3";
const button = "min-h-11 rounded-md bg-primary hover:bg-primary-hover px-4 py-2 text-primary-foreground disabled:opacity-50";

function MemberPicker({ selected, onChange, disabled, currentProfileId, existingIds = [], onFindingChange }: {
  selected: TablePerson[]; onChange: (people: TablePerson[]) => void; disabled: boolean;
  currentProfileId?: string; existingIds?: string[]; onFindingChange?: (finding: boolean) => void;
}) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [finding, setFinding] = useState(false);
  const pending = useRef(false);
  async function findPerson() {
    if (disabled || pending.current || !username.trim()) return;
    pending.current = true; setFinding(true); onFindingChange?.(true); setError("");
    try {
      const { data, error } = await createClient().rpc("find_table_user", { p_username: username.trim() });
      const person = data?.[0] as TablePerson | undefined;
      if (error) { setError("Couldn’t look up this account. Please try again."); return; }
      if (!person) { setError("No active account found with that username."); return; }
      if (person.profile_id === currentProfileId) { setError("You’re already included. Choose someone else."); return; }
      if (existingIds.includes(person.profile_id)) { setError("This person is already a member of this Table."); return; }
      if (selected.some(item => item.profile_id === person.profile_id)) { setError("This person is already selected."); return; }
      if (selected.length >= 50) { setError("Choose at most 50 people at a time."); return; }
      onChange([...selected, person]); setUsername("");
    } catch { setError("Couldn’t find this account. Try again."); }
    finally { pending.current = false; setFinding(false); onFindingChange?.(false); }
  }
  return <div className="space-y-3">
    <label className="block text-sm">Add by exact username<input className={field} value={username} onChange={event => { setUsername(event.target.value); setError(""); }} disabled={disabled || finding} placeholder="@sam_cooks" onKeyDown={event => {
      if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void findPerson(); }
    }} /></label>
    <button type="button" disabled={disabled || finding || !username.trim()} className="min-h-11 text-sm font-semibold text-link underline disabled:opacity-50" onClick={() => void findPerson()}>{finding ? "Finding…" : "Select person"}</button>
    <ul className="space-y-2">{selected.map(person => <li key={person.profile_id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-secondary p-3 text-sm">
      <span className="min-w-0 break-words">@{person.username} · {person.display_name}</span><button type="button" className="min-h-11 text-link underline disabled:opacity-50" disabled={disabled || finding} aria-label={`Deselect ${person.username}`} onClick={() => { setError(""); onChange(selected.filter(item => item.profile_id !== person.profile_id)); }}>Deselect</button>
    </li>)}</ul>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

export function CreateTableWithMembers({ currentProfileId }: { currentProfileId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<TablePerson[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finding, setFinding] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending.current || finding) return; pending.current = true; setBusy(true); setError("");
    let navigating = false;
    try {
      const { data, error } = await createClient().rpc("create_table_with_members", { p_name: name.trim(), p_profile_ids: selected.map(person => person.profile_id) });
      if (error) { setError("Couldn’t create the Table. Check the selected accounts and try again."); return; }
      navigating = true; router.push(`/tables/${data}`); router.refresh();
    } catch { setError("Couldn’t create the Table. Try again."); }
    finally { if (!navigating) { pending.current = false; setBusy(false); } }
  }
  return <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-border bg-card p-6">
    <h2 className="font-display text-lg font-bold">Table details</h2>
    <label className="block text-sm">Table name<input required maxLength={100} disabled={busy} className={field} value={name} onChange={event => { setName(event.target.value); setError(""); }} /></label>
    <MemberPicker selected={selected} onChange={people => { setSelected(people); setError(""); }} disabled={busy} currentProfileId={currentProfileId} onFindingChange={setFinding} />
    <p className="text-sm text-muted-foreground">Selected people are added immediately and can see the Table’s full conversation history. You’ll be its first Admin.</p>
    <button disabled={busy || finding} className={button}>{busy ? "Creating…" : "Create Table"}</button>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </form>;
}

type MemberAction =
  | { kind: "promote" | "demote" | "remove" | "handover"; person: TablePerson }
  | { kind: "add"; people: TablePerson[] }
  | { kind: "leave" }
  | { kind: "choose-departure" }
  | { kind: "close"; memberIds: string[] };

function personName(person: TablePerson) {
  return person.display_name + (person.username ? ` (@${person.username})` : "");
}

function actionCopy(action: MemberAction, tableName: string) {
  switch (action.kind) {
    case "promote": return { title: `Make ${personName(action.person)} an Admin?`, body: `They’ll be able to manage members and remove contributions in ${tableName}.`, button: "Make Admin" };
    case "demote": return { title: `Remove Admin rights from ${personName(action.person)}?`, body: `They’ll stay in ${tableName} as a member. Their contributions will remain.`, button: "Remove Admin rights" };
    case "remove": return { title: `Remove ${personName(action.person)} from ${tableName}?`, body: "They’ll lose Table access. Their contributions will remain.", button: "Remove member" };
    case "handover": return { title: `Make ${personName(action.person)} Admin and leave?`, body: `They’ll manage ${tableName}. You’ll lose access; your contributions will remain.`, button: "Assign Admin and leave" };
    case "add": return { title: `Add ${action.people.length === 1 ? personName(action.people[0]) : `${action.people.length} people`} to ${tableName}?`, body: "They’ll join immediately and can see the full earlier conversation.", button: "Add to Table" };
    case "leave": return { title: `Leave ${tableName}?`, body: "You’ll lose Table access. Your contributions will remain.", button: "Leave Table" };
    case "close": return { title: `Close ${tableName} and leave?`, body: `All ${action.memberIds.length} ${action.memberIds.length === 1 ? "member" : "members"} will lose access. Content is preserved, but the Table closes for everyone.`, button: "Close Table and leave" };
    case "choose-departure": return { title: "You’re the last Admin", body: `Choose someone to manage ${tableName} before leaving, or close the Table for everyone.`, button: "" };
  }
}

export function TableMembers({ groupId, tableName, members, pictureUrls = {} }: { groupId: string; tableName: string; members: TablePerson[]; pictureUrls?: Record<string, string | null> }) {
  const router = useRouter();
  const me = members.find(person => person.is_me);
  const admin = me?.role === "owner";
  const adminCount = members.filter(person => person.role === "owner").length;
  const lastAdmin = admin && adminCount === 1;
  // Role changes must not move the action buttons under the pointer.
  const orderedMembers = [...members].sort((a, b) => (a.username ?? a.display_name).localeCompare(b.username ?? b.display_name, "en-GB", { sensitivity: "base" }) || a.profile_id.localeCompare(b.profile_id));
  const [selected, setSelected] = useState<TablePerson[]>([]);
  const eligibleSelected = selected.filter(person => !members.some(member => member.profile_id === person.profile_id));
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [finding, setFinding] = useState(false);
  const [message, setMessage] = useTransientMessage<string>("");
  const [error, setError] = useState("");
  const [action, setAction] = useState<MemberAction | null>(null);
  const [replacement, setReplacement] = useState("");
  const pending = useRef(false);
  const origin = useRef<HTMLButtonElement | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const busy = submitting || refreshing;
  const copy = action ? actionCopy(action, tableName) : null;

  function openAction(next: MemberAction, trigger: HTMLButtonElement) {
    if (busy || pending.current) return;
    origin.current = trigger; setMessage(""); setError(""); setReplacement(""); setAction(next);
  }
  function chooseDeparture(next: MemberAction) {
    setError(""); setAction(next);
    requestAnimationFrame(() => cancel.current?.focus());
  }
  function refresh() { startRefresh(() => router.refresh()); }
  async function confirm() {
    if (!action || action.kind === "choose-departure" || busy || pending.current) return;
    const chosen = action; // Keep the exact person/action fixed through refresh and retries.
    pending.current = true; setSubmitting(true); setError("");
    try {
      const client = createClient();
      const latest = await client.rpc("table_members", { p_group_id: groupId });
      if (latest.error) throw latest.error;
      const current = (latest.data ?? []) as TablePerson[];
      const actor = current.find(person => person.is_me);
      if (!actor || (chosen.kind !== "leave" && actor.role !== "owner")) {
        setError("Your Table access has changed. Cancel and refresh before trying again."); refresh(); return;
      }
      if ("person" in chosen) {
        const target = current.find(person => person.profile_id === chosen.person.profile_id);
        if (!target || target.role !== chosen.person.role) {
          setError("This person’s membership or role changed. Cancel and review the member list."); refresh(); return;
        }
      }
      const currentLastAdmin = actor.role === "owner" && current.filter(person => person.role === "owner").length === 1;
      if ((chosen.kind === "leave" && currentLastAdmin) || (["handover", "close"].includes(chosen.kind) && !currentLastAdmin)) {
        setError("The Admin list changed. Cancel and choose how to leave again."); refresh(); return;
      }
      if (chosen.kind === "close" && (current.length !== chosen.memberIds.length || current.some(person => !chosen.memberIds.includes(person.profile_id)))) {
        setError("The member list changed. Cancel and review everyone affected before closing."); refresh(); return;
      }
      let name: string, args: Record<string, unknown>, success: string;
      switch (chosen.kind) {
        case "promote": case "demote":
          name = "set_table_admin"; args = { p_profile_id: chosen.person.profile_id, p_admin: chosen.kind === "promote" };
          success = chosen.kind === "promote" ? `${personName(chosen.person)} is now an Admin.` : `Admin rights removed from ${personName(chosen.person)}.`; break;
        case "remove":
          name = "remove_table_member"; args = { p_profile_id: chosen.person.profile_id }; success = `${personName(chosen.person)} removed from the Table.`; break;
        case "add": {
          const additions = chosen.people.filter(person => !current.some(member => member.profile_id === person.profile_id));
          if (!additions.length) {
            setSelected([]); setAction(null); setMessage("These people are already members. No changes were needed."); refresh(); return;
          }
          name = "add_table_members"; args = { p_profile_ids: additions.map(person => person.profile_id) };
          success = "The selected people now have Table access, including anyone already added by another Admin."; break;
        }
        case "leave": name = "leave_table"; args = {}; success = ""; break;
        case "handover": name = "leave_table"; args = { p_replacement_id: chosen.person.profile_id }; success = ""; break;
        case "close": name = "leave_table"; args = { p_close: true }; success = ""; break;
      }
      const result = await client.rpc(name, { p_group_id: groupId, ...args });
      if (result.error) throw result.error;
      if (chosen.kind === "add") setSelected([]);
      setAction(null); setMessage(success);
      if (["leave", "handover", "close"].includes(chosen.kind)) router.replace("/tables");
      refresh();
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
      setError(code === "23514" ? "This change is no longer available. Keep an active Admin, and check that the selected accounts are still active."
        : code === "42501" ? "Your Table permissions have changed. Cancel and refresh to review them."
          : code === "40001" ? "The Table changed elsewhere. Cancel and review it before trying again."
            : "Couldn’t make this change. Please try again. The selected action hasn’t changed.");
    } finally { pending.current = false; setSubmitting(false); }
  }

  return <div ref={container} tabIndex={-1}>
    {message && <p role="status" className="mt-5 text-sm text-success">{message}</p>}
    <ul aria-label="Table members" className="mt-6 space-y-3">{orderedMembers.map(person => <li key={person.profile_id} className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3"><PictureAvatar name={person.display_name} url={pictureUrls[person.profile_id]} className="shrink-0" />
        <p className="min-w-0 break-words font-semibold">{person.display_name} {person.username && <span className="font-normal text-muted-foreground">@{person.username}</span>} {person.is_me && "· You"}</p>
      </div>
      <p className="mt-1 text-sm">{person.role === "owner" ? "Admin" : "Member"}</p>
      {admin && <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <button disabled={busy || (person.role === "owner" && adminCount === 1)} className="min-h-11 text-link underline disabled:opacity-40" onClick={event => openAction({ kind: person.role === "owner" ? "demote" : "promote", person: { ...person } }, event.currentTarget)}>{person.role === "owner" ? "Remove Admin rights" : "Make Admin"}</button>
        {!person.is_me && <button disabled={busy} className="min-h-11 text-destructive underline disabled:opacity-50" onClick={event => openAction({ kind: "remove", person: { ...person } }, event.currentTarget)}>Remove from Table</button>}
      </div>}
      {admin && person.role === "owner" && adminCount === 1 && <p className="mt-2 text-sm text-muted-foreground">Make someone else an Admin before removing these Admin rights. To leave without a replacement, use Leave Table and close the Table for everyone.</p>}
    </li>)}</ul>
    {admin && <section className="mt-8 rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-xl font-bold">Add people</h2>
      <MemberPicker selected={eligibleSelected} onChange={people => { setSelected(people); setMessage(""); }} disabled={busy} currentProfileId={me?.profile_id} existingIds={members.map(person => person.profile_id)} onFindingChange={setFinding} />
      <p className="my-4 text-sm">They’ll join immediately and can see earlier conversation.</p>
      <Button disabled={busy || finding || eligibleSelected.length === 0} onClick={event => openAction({ kind: "add", people: eligibleSelected.map(person => ({ ...person })) }, event.currentTarget)}>Add selected people</Button>
    </section>}
    <button disabled={busy} className="mt-8 min-h-11 text-destructive underline disabled:opacity-50" onClick={event => openAction({ kind: lastAdmin ? "choose-departure" : "leave" }, event.currentTarget)}>Leave Table</button>
    <AlertDialog open={Boolean(action)} onOpenChange={open => { if (!open && !pending.current) { setAction(null); setError(""); } }}>
      {action && copy && <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" onCloseAutoFocus={event => {
        event.preventDefault();
        if (origin.current?.isConnected && !origin.current.disabled) origin.current.focus(); else container.current?.focus();
      }}>
        <AlertDialogHeader><AlertDialogTitle>{copy.title}</AlertDialogTitle><AlertDialogDescription>{copy.body}</AlertDialogDescription></AlertDialogHeader>
        {action.kind === "add" && action.people.length > 1 && <ul className="space-y-2 text-sm">{action.people.map(person => <li key={person.profile_id}>{personName(person)}</li>)}</ul>}
        {action.kind === "choose-departure" && <label className="block text-sm">New Admin<select className={field} value={replacement} onChange={event => setReplacement(event.target.value)}>
          <option value="">Choose a member</option>{orderedMembers.filter(person => !person.is_me).map(person => <option key={person.profile_id} value={person.profile_id}>{personName(person)}</option>)}
        </select></label>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {submitting && <p role="status" className="sr-only">Updating Table…</p>}
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancel} disabled={submitting}>Cancel</AlertDialogCancel>
          {action.kind === "choose-departure" ? <>
            <Button disabled={!replacement} onClick={() => {
              const person = members.find(member => member.profile_id === replacement && !member.is_me);
              if (person) chooseDeparture({ kind: "handover", person: { ...person } });
            }}>Assign Admin and leave</Button>
            <Button variant="destructive" onClick={() => chooseDeparture({ kind: "close", memberIds: members.map(person => person.profile_id) })}>Close Table and leave</Button>
          </> : <Button variant={action.kind === "add" || action.kind === "promote" ? "default" : "destructive"} disabled={busy} onClick={() => void confirm()}>{submitting ? "Updating…" : copy.button}</Button>}
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </div>;
}
