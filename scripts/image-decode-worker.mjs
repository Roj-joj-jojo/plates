import { parentPort } from "node:worker_threads";
import { processPlateImage } from "./process-plate-image.mjs";
import { processMenuPreview } from "./process-menu-preview.mjs";

parentPort.on("message", async (input) => {
  try {
    const bytes = Buffer.from(input.bytes);
    const result = input.kind === "menu-preview"
      ? await processMenuPreview(bytes) : await processPlateImage(bytes);
    parentPort.postMessage({ ok: true, ...result });
  } catch (error) {
    parentPort.postMessage({ ok: false,
      message: error instanceof Error ? error.message : "Image processing failed" });
  }
});
