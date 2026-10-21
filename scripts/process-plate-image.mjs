import sharp from "sharp";
import convertHeic from "heic-convert";

export const MAX_UPLOAD_BYTES = 10_000_000;
export const MAX_DECODED_PIXELS = 50_000_000;

function looksLikeHeic(input) {
  if (input.length < 12 || input.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = input.toString("ascii", 8, 12);
  return ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand);
}

export async function processPlateImage(input) {
  if (!Buffer.isBuffer(input) || input.length === 0 || input.length > MAX_UPLOAD_BYTES) {
    throw new Error("Choose an image smaller than 10 MB.");
  }

  // The standalone media process runs this decoder away from Next.js request workers.
  const source = looksLikeHeic(input)
    ? Buffer.from(await convertHeic({ buffer: input, format: "JPEG", quality: 0.9 }))
    : input;
  const decoder = sharp(source, { limitInputPixels: MAX_DECODED_PIXELS, failOn: "error" });
  const metadata = await decoder.metadata();
  const accepted = ["jpeg", "png", "webp"];
  if (!metadata.format || !accepted.includes(metadata.format) || !metadata.width || !metadata.height ||
    metadata.width * metadata.height > MAX_DECODED_PIXELS) {
    throw new Error("Choose a valid JPEG, PNG, WebP or HEIC image.");
  }

  const output = await sharp(source, { limitInputPixels: MAX_DECODED_PIXELS, failOn: "error" })
    .rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84, effort: 4 }).toBuffer({ resolveWithObject: true });
  return {
    bytes: output.data,
    mediaType: "image/webp",
    width: output.info.width,
    height: output.info.height,
  };
}
