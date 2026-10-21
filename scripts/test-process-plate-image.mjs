import assert from "node:assert/strict";
import sharp from "sharp";
import { processPlateImage, MAX_UPLOAD_BYTES } from "./process-plate-image.mjs";

for (const format of ["jpeg", "png", "webp"]) {
  const input = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "red" } })
    [format]().toBuffer();
  const result = await processPlateImage(input);
  assert.equal(result.mediaType, "image/webp");
  assert.equal(result.width, 2048);
  assert.equal(result.height, 1024);
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  console.log(`PASS: ${format} processed into a bounded metadata-free WebP`);
}

const rotatedInput = await sharp({ create: { width: 1200, height: 600, channels: 3, background: "blue" } })
  .jpeg().withMetadata({ orientation: 6 }).toBuffer();
const rotated = await processPlateImage(rotatedInput);
assert.equal(rotated.width, 600);
assert.equal(rotated.height, 1200);
assert.equal((await sharp(rotated.bytes).metadata()).exif, undefined);
console.log("PASS: EXIF orientation applied before metadata stripping");

await assert.rejects(processPlateImage(Buffer.from("not an image")));
await assert.rejects(processPlateImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1)));
await assert.rejects(processPlateImage(Buffer.alloc(0)));
console.log("PASS: corrupt, empty and oversized inputs rejected");
