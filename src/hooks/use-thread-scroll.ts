"use client";
import * as React from "react";
const NEAR_BOTTOM = 80;
type Anchor = { id: string; offset: number };
type Options = {
  initialTargetId?: string;
  navigationTargetId?: string;
  /** Change to navigate to the same target again. */
  navigationKey?: string | number;
  /** Explicit LIVE arrivals for windows without overlapping IDs. Never history IDs. */
  arrivingIds?: readonly string[];
};
/** IDs oldest first. Attach ref to scroller, contentRef to list; messages need data-message-id.
 * Key the thread on Table ID, never message data. Snapshot before list changes with
 * captureBeforeUpdate; scroll/resize also maintain the visible-message snapshot.
 */
export function useThreadScroll(ids: readonly string[], options: Options = {}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const pinned = React.useRef(true);
  const previousIds = React.useRef<readonly string[]>([]);
  const anchor = React.useRef<Anchor | null>(null);
  const initialised = React.useRef(false);
  const pendingTarget = React.useRef<string | null>(null);
  const previousNavigation = React.useRef<{ id?: string; key?: string | number } | null>(null);
  const highlightTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlighted = React.useRef<HTMLElement | null>(null);
  const [unseen, setUnseen] = React.useState(0);

  const captureBeforeUpdate = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + el.clientTop;
    const bottom = top + el.clientHeight;
    const visible = Array.from(el.querySelectorAll<HTMLElement>("[data-message-id]")).find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.bottom > top && rect.top < bottom;
    });
    anchor.current = visible ? { id: visible.dataset.messageId!, offset: visible.getBoundingClientRect().top - top } : null;
  }, []);

  const restoreAnchor = React.useCallback(() => {
    const el = ref.current;
    const saved = anchor.current;
    if (!el || !saved) return;
    const node = el.querySelector<HTMLElement>('[data-message-id="' + CSS.escape(saved.id) + '"]');
    if (!node) return; // Window lost its anchor: preserve the remaining position.
    const top = el.getBoundingClientRect().top + el.clientTop;
    el.scrollTop += node.getBoundingClientRect().top - top - saved.offset;
  }, []);

  const toBottom = React.useCallback((smooth = false) => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pinned.current = true;
    pendingTarget.current = null;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduced ? "smooth" : "auto" });
    setUnseen(0);
    captureBeforeUpdate();
  }, [captureBeforeUpdate]);

  /** Returns false if missing. Caller loads via existing authorised data path;
   * pending navigation completes when the target is rendered. */
  const navigateToMessage = React.useCallback((id: string): boolean => {
    const el = ref.current;
    pendingTarget.current = id;
    if (!el) return false;
    const target = el.querySelector<HTMLElement>('[data-message-id="' + CSS.escape(id) + '"]');
    if (!target) return false;
    const top = el.getBoundingClientRect().top + el.clientTop;
    el.scrollTop += target.getBoundingClientRect().top - top - (el.clientHeight - target.getBoundingClientRect().height) / 2;
    pendingTarget.current = null;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    if (pinned.current) setUnseen(0);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlighted.current?.removeAttribute("data-mention-target");
    highlighted.current = target;
    target.setAttribute("data-mention-target", "true");
    highlightTimer.current = setTimeout(() => {
      target.removeAttribute("data-mention-target");
      highlighted.current = null;
    }, 1800);
    captureBeforeUpdate();
    return true;
  }, [captureBeforeUpdate]);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const before = previousIds.current;
    previousIds.current = [...ids];
    const previous = previousNavigation.current;
    const navigationChanged = options.navigationTargetId &&
      (!previous || previous.id !== options.navigationTargetId || previous.key !== options.navigationKey);
    previousNavigation.current = { id: options.navigationTargetId, key: options.navigationKey };
    if (navigationChanged) pendingTarget.current = options.navigationTargetId!;
    if (!initialised.current) {
      if (!ids.length) return;
      initialised.current = true;
      const targetId = pendingTarget.current ?? options.initialTargetId;
      if (targetId) navigateToMessage(targetId);
      else toBottom();
      captureBeforeUpdate();
      return;
    }
    const seen = new Set(before);
    const oldLast = before[before.length - 1];
    const lastIndex = oldLast === undefined ? -1 : ids.indexOf(oldLast);
    // Arbitrary UUIDs cannot establish chronology in a fully replaced window.
    const arrivals = options.arrivingIds
      ? ids.filter((id) => options.arrivingIds!.includes(id) && !seen.has(id))
      : lastIndex >= 0 ? ids.slice(lastIndex + 1).filter((id) => !seen.has(id)) : [];
    if (pendingTarget.current && navigateToMessage(pendingTarget.current)) return;
    if (pinned.current && !pendingTarget.current) toBottom();
    else {
      restoreAnchor();
      if (arrivals.length) setUnseen((count) => count + arrivals.length);
    }
    captureBeforeUpdate();
  }, [ids, options.initialTargetId, options.navigationTargetId, options.navigationKey, options.arrivingIds,
    captureBeforeUpdate, restoreAnchor, navigateToMessage, toBottom]);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const previousOverflowAnchor = el.style.overflowAnchor;
    el.style.overflowAnchor = "none";
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
      if (pinned.current) setUnseen(0);
      captureBeforeUpdate();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(() => {
      if (pinned.current && !pendingTarget.current) el.scrollTop = el.scrollHeight;
      else restoreAnchor();
      captureBeforeUpdate();
    });
    observer.observe(el);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
      el.style.overflowAnchor = previousOverflowAnchor;
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlighted.current?.removeAttribute("data-mention-target");
    };
  }, [captureBeforeUpdate, restoreAnchor]);
  const cancelNavigation = React.useCallback(() => {
    pendingTarget.current = null;
    captureBeforeUpdate();
  }, [captureBeforeUpdate]);
  const jumpToLatest = React.useCallback(() => toBottom(true), [toBottom]);
  const scrollToBottomNow = React.useCallback(() => toBottom(), [toBottom]);
  return { ref, contentRef, unseen, captureBeforeUpdate, navigateToMessage, cancelNavigation, jumpToLatest, scrollToBottomNow };
}
