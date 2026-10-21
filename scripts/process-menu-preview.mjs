import sharp from "sharp";

export async function processMenuPreview(input) {
  if (!Buffer.isBuffer(input) || input.length === 0 || input.length > 10_000_000) {
    throw new Error("Menu preview source is invalid.");
  }
  const decoder = sharp(input, { limitInputPixels: 50_000_000, failOn: "error" });
  const metadata = await decoder.metadata();
  if (metadata.format !== "webp" || !metadata.width || !metadata.height ||
    metadata.width * metadata.height > 50_000_000) {
    throw new Error("Menu preview source must be a processed Plate photo.");
  }
  const output = await sharp(input, { limitInputPixels: 50_000_000, failOn: "error" })
    .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 }).toBuffer({ resolveWithObject: true });
  if (output.data.length > 3_000_000) throw new Error("Menu preview is too large.");
  return { bytes: output.data, width: output.info.width, height: output.info.height };
}
