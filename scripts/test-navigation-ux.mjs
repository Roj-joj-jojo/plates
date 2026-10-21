import assert from "node:assert/strict";
import { plateHeading, plateReturn, plateDestination, tableResultDestination } from "../src/lib/navigation-ux.ts";

assert.equal(plateHeading("\n Dinner\nSecond line"), "Dinner");
assert.equal(plateHeading("  ", "Recipe"), "Recipe");
assert.equal(Array.from(plateHeading("🍜".repeat(80))).length, 72);
assert.equal(plateHeading("Hello @[12345678-1234-1234-1234-123456789abc]"), "Hello @member");
for (const path of ["https://other.test/feed", "//other.test/feed", "/\\other.test/feed", "/account", "/tables/x", "/feed\n", ["/search"], undefined]) {
  assert.equal(plateReturn(path).href, "/feed");
}
const source = "/feed?before=2026-10-01T00%3A00%3A00Z&id=example#plate-source";
assert.equal(plateReturn(source).href, source);
assert.equal(plateReturn("/search?q=food&type=plates#plate-source").label, "Search results");
assert.equal(new URL(plateDestination("source", source), "https://plates.invalid").searchParams.get("returnTo"), source);
assert.equal(tableResultDestination("g", "message", "e", null), "/tables/g?entry=e#entry-e");
assert.equal(tableResultDestination("g", "request", "e", "r"), "/tables/g/requests/e?reply=r#reply-r");
assert.equal(tableResultDestination("g", "plate_share", "e", null), "/tables/g/discussion/e");
console.log("Navigation destination and title checks passed.");
