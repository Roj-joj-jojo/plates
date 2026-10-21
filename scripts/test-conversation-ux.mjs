import assert from "node:assert/strict";
import { conversationStamp, startsConversationDay, conversationCount } from "../src/lib/conversation-ux.ts";

assert.equal(conversationStamp("2026-06-01T23:30:00Z").dayKey, "2026-06-02");
assert.equal(conversationStamp("2026-01-01T23:30:00Z").dayKey, "2026-01-01");
assert.equal(conversationStamp("2026-10-25T00:30:00Z").time, "01:30");
assert.equal(conversationStamp("2026-10-25T01:30:00Z").time, "01:30");
assert.notEqual(conversationStamp("2026-10-25T00:30:00Z").full, conversationStamp("2026-10-25T01:30:00Z").full);
assert.equal(startsConversationDay("2026-06-01T23:30:00Z", "2026-06-01T22:30:00Z"), true);
assert.equal(startsConversationDay("2026-06-02T01:30:00Z", "2026-06-01T23:30:00Z"), false);
assert.equal(startsConversationDay("2026-10-17T20:00:00Z"), true);
assert.equal(conversationStamp("invalid").dayKey, "unknown");
assert.equal(conversationCount(1, "reply", "replies"), "1 reply");
assert.equal(conversationCount(2, "reply", "replies"), "2 replies");
assert.equal(conversationCount(0, "active comment"), "0 active comments");
assert.equal(conversationCount(1, "member"), "1 member");
console.log("Conversation formatting checks passed.");
