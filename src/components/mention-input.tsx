"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/browser";
type Member = { profile_id: string; username: string; display_name: string };
export function MentionInput({ groupId, value, onChange, name = "body", rows = 3, className, readOnly = false, isLocked = () => false, suggestionsAbove = false, sendOnEnter = false }: {
  groupId: string; value: string; onChange: (value: string) => void; name?: string; rows?: number; className?: string; readOnly?: boolean; isLocked?: () => boolean; suggestionsAbove?: boolean; sendOnEnter?: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [caret, setCaret] = useState(0);
  useEffect(() => {
    let disposed = false;
    const client = createClient();
    void Promise.all([
      client.rpc("table_mention_members", { p_group_id: groupId }),
      client.from("my_profile").select("id").maybeSingle(),
    ]).then(([members, profile]) => {
      if (!disposed && !members.error && !profile.error && profile.data) {
        const ownProfileId = profile.data.id;
        setMembers((members.data ?? []).filter((member: Member) => member.profile_id !== ownProfileId));
      }
    }).catch(() => { /* Typing remains available if suggestions cannot load. */ });
    return () => { disposed = true; };
  }, [groupId]);
  const listId = useId();
  const [selection, setSelection] = useState({ query: "", index: 0 });
  const [dismissed, setDismissed] = useState<number | null>(null);
  const match = value.slice(0, caret).match(/(?:^|[^A-Za-z0-9_@])@([A-Za-z0-9_]*)$/);
  const start = match ? caret - match[1].length - 1 : -1;
  const query = match?.[1] ?? "";
  const suggestions = !readOnly && start !== dismissed && match ? members.filter(member => member.username.toLowerCase().startsWith(query.toLowerCase())).slice(0, 8) : [];
  const active = Math.min(selection.query === query ? selection.index : 0, Math.max(0, suggestions.length - 1));
  function insert(member: Member) {
    if (readOnly || isLocked() || !match) return;
    const insertion = "@" + member.username + " ";
    onChange(value.slice(0, start) + insertion + value.slice(caret));
    setCaret(start + insertion.length);
    setDismissed(null);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + insertion.length, start + insertion.length); });
  }
  return <span className="relative block min-w-0">
    <Textarea ref={input} name={name} value={value} maxLength={20000} rows={rows} className={className}
      readOnly={readOnly} aria-busy={readOnly || undefined} role="combobox" aria-expanded={suggestions.length > 0}
      aria-controls={suggestions.length ? listId : undefined} aria-autocomplete="list"
      aria-activedescendant={suggestions.length ? listId + "-" + active : undefined}
      onChange={event => { if (readOnly || isLocked()) return; onChange(event.target.value); setCaret(event.target.selectionStart); setDismissed(null); }}
      onSelect={event => setCaret(event.currentTarget.selectionStart)}
      onKeyDown={event => {
        if (readOnly || isLocked() || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        if (suggestions.length) {
          if (event.key === "Escape") { event.preventDefault(); setDismissed(start); return; }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setSelection({query,index:(active + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length}); return;
          }
          if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); insert(suggestions[active]); return; }
        }
        if (event.key === "Enter" && !event.shiftKey && (sendOnEnter ? !event.altKey : event.metaKey || event.ctrlKey)) {
          event.preventDefault(); event.currentTarget.form?.requestSubmit();
        }
      }} />
    {suggestions.length > 0 && <ul id={listId} role="listbox" aria-label="Mention a Table member" className={"z-20 max-h-[min(40dvh,20rem)] overflow-y-auto rounded-lg border border-input bg-popover p-1 shadow-md " + (suggestionsAbove ? "absolute inset-x-0 bottom-full mb-2" : "mt-1")}>
      {suggestions.map((member,index) => <li key={member.profile_id} id={listId + "-" + index} role="option" aria-selected={active === index}><button type="button" tabIndex={-1} disabled={readOnly} className={"block min-h-11 w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent " + (active === index ? "bg-secondary" : "")} onMouseDown={event => event.preventDefault()} onClick={() => insert(member)}>@{member.username} · {member.display_name}</button></li>)}
    </ul>}
  </span>;
}
