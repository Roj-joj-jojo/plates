import type { KeyboardEvent } from "react";

// Multiline writing forms share this shortcut. MentionInput handles its own keys first.
export function submitWithShortcut(event: KeyboardEvent<HTMLFormElement>) {
  if (event.defaultPrevented || event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.repeat || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || target.readOnly || target.disabled) return;
  const submit = event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
  if (!submit || submit.disabled) return;
  event.preventDefault();
  event.currentTarget.requestSubmit(submit);
}
