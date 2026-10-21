import assert from "node:assert/strict";
import { webAddressParts, contributionProblem } from "../src/lib/content-ux.ts";
import { conversationDate, conversationStamp, shortDateTime } from "../src/lib/conversation-ux.ts";
import { submitWithShortcut } from "../src/lib/submit-shortcut.ts";

const samples = [
  "Try https://example.com/recipe, then www.example.org.",
  "(https://example.com/a_(b)).",
  "javascript:alert(1) data:text/html,x ftp://example.com //example.com",
  "javascript:https://example.com and user@www.example.com",
  "https://user:password@example.com and https://example.com\\bad",
  '<script>alert(1)</script> https://example.com?q=1&b=2',
  "No links here", "", "https://example.com/" + "a".repeat(2050),
];
for (const sample of samples) {
  const parts = webAddressParts(sample);
  assert.equal(parts.map(part => part.text).join(""), sample, "Text/punctuation must survive unchanged");
  for (const part of parts.filter(part => part.href)) {
    const url = new URL(part.href);
    assert(["http:", "https:"].includes(url.protocol));
    assert.equal(url.username, ""); assert.equal(url.password, "");
  }
}
assert.deepEqual(webAddressParts(samples[0]).filter(part => part.href).map(part => part.href), ["https://example.com/recipe", "https://www.example.org/"]);
assert.equal(webAddressParts(samples[1]).find(part => part.href).text, "https://example.com/a_(b)");
for (const sample of samples.slice(2, 5)) assert.equal(webAddressParts(sample).filter(part => part.href).length, 0);
assert.equal(webAddressParts(samples[8]).some(part => part.href), false);
for (const kind of ["message", "reply"]) {
  assert.match(contributionProblem(kind, " \n", [], false), /Add text or a link/);
  assert.equal(contributionProblem(kind, "text", [], false), "");
  assert.equal(contributionProblem(kind, "", ["https://example.com"], false), "");
  assert.equal(contributionProblem(kind, "", [], true), "", "Attached photos permit an empty body");
}
for (const kind of ["request", "plate_share"]) assert.equal(contributionProblem(kind, "", [], false), "", "Supporting context/share note is optional");
assert.equal(conversationDate("2026-06-01T23:30:00Z", "2026-06-02"), "Today");
assert.equal(conversationDate("2026-06-01T23:30:00Z", "2026-06-03"), "2 Jun 2026");
assert.equal(conversationDate("2026-06-01T23:30:00Z"), "2 Jun 2026", "SSR uses a deterministic date before hydration");
assert.equal(conversationDate("invalid", "2026-06-02"), "Date unavailable");
assert.equal(shortDateTime("2026-10-25T00:30:20Z"), "25 Oct 2026 · 01:30");
assert.equal(shortDateTime("2026-10-25T01:30:50Z"), "25 Oct 2026 · 01:30");
assert.notEqual(conversationStamp("2026-10-25T00:30:20Z").full, conversationStamp("2026-10-25T01:30:50Z").full);
assert.equal(conversationDate("2026-10-20T22:59:59Z", "2026-10-21"), "20 Oct 2026");
assert.equal(conversationDate("2026-10-20T23:00:00Z", "2026-10-21"), "Today");

// Minimal DOM event doubles exercise real shortcut guards without a new browser/test dependency.
globalThis.HTMLTextAreaElement = class { readOnly = false; disabled = false; };
let submits = 0;
const button = { disabled: false };
function event(overrides = {}) {
  return { defaultPrevented: false, key: "Enter", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, repeat: false,
    nativeEvent: { isComposing: false }, target: new HTMLTextAreaElement(),
    currentTarget: { querySelector: () => button, requestSubmit: () => { submits++; } },
    preventDefault() { this.defaultPrevented = true; }, ...overrides };
}
submitWithShortcut(event()); submitWithShortcut(event({ metaKey: false, ctrlKey: true }));
assert.equal(submits, 2);
for (const overrides of [{ metaKey: false }, { defaultPrevented: true }, { repeat: true }, { shiftKey: true }, { altKey: true },
  { nativeEvent: { isComposing: true } }, { nativeEvent: { keyCode: 229 } }, { target: {} },
  { target: Object.assign(new HTMLTextAreaElement(), { readOnly: true }) }]) submitWithShortcut(event(overrides));
button.disabled = true; submitWithShortcut(event());
assert.equal(submits, 2, "Plain Enter, composition, nested handling and unavailable forms never submit");
console.log("Follow-up URL safety, empty-edit, London-date and shortcut checks passed.");
