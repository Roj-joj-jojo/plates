import assert from "node:assert/strict";
import { normaliseLinks, photoSelectionProblem, formError } from "../src/lib/form-ux.ts";

assert.deepEqual(normaliseLinks(" food.com/recipe\n\nhttps://example.com/a?b=1#c ").links,
  ["https://food.com/recipe", "https://example.com/a?b=1#c"]);
assert.deepEqual(normaliseLinks(""), { links: [], error: "" });
for (const value of ["javascript:alert(1)", "data:text/html,x", "ftp://food.com", "//food.com", "not a link", "https://", "https://user:pass@food.com", "https://food.com/a b", "https://food.com\\evil", "https:food.com"]) {
  assert.match(normaliseLinks(value).error, /line 1/, value);
}
assert.match(normaliseLinks("https://food.com\n\nnot a link").error, /line 3/);
assert.match(normaliseLinks("https://bad_host.example").error, /line 1/);
assert.match(normaliseLinks("https://-bad.example").error, /line 1/);
assert.equal(normaliseLinks(Array(10).fill("food.com").join("\n")).links.length, 10);
assert.match(normaliseLinks(Array(11).fill("food.com").join("\n")).error, /at most 10/);
assert.match(normaliseLinks("https://food.com/" + "a".repeat(2048)).error, /too long/);
assert.equal(normaliseLinks("http://example.com").links[0], "http://example.com/");
const photo = { name: "photo.jpg", size: 10_000_000, type: "image/jpeg" };
assert.equal(photoSelectionProblem([photo], 6), "");
assert.equal(photoSelectionProblem([{ ...photo, name: "phone.HEIC", type: "" }], 4), "");
assert.match(photoSelectionProblem(Array(7).fill(photo), 6), /at most 6/);
assert.match(photoSelectionProblem(Array(5).fill(photo), 4), /at most 4/);
assert.match(photoSelectionProblem([{ ...photo, size: 10_000_001 }], 6), /10 MB/);
assert.match(photoSelectionProblem([{ ...photo, size: 0 }], 6), /10 MB/);
assert.match(photoSelectionProblem([{ ...photo, type: "text/plain" }], 6), /JPEG/);
assert.match(formError({ code: "40001", message: "backend diagnostic" }), /changed elsewhere/);
assert.doesNotMatch(formError({ code: "23514", message: "backend diagnostic" }), /backend diagnostic|changed elsewhere/);
assert.match(formError({ code: "42501" }), /no longer available/);
console.log("Form UX offline checks passed.");
