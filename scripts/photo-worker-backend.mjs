// The caller supplies a service client. This adapter has no deletion/erasure methods.
export function createPhotoBackend(client, runId) {
  async function rpc(name, args = {}) {
    const { data, error } = await client.rpc(name, { p_run_id: runId, ...args });
    if (error) throw new Error("Photo backend operation failed");
    return data;
  }
  const jobArgs = job => ({ p_kind: job.kind, p_job_id: job.id });
  async function download(bucket, path) {
    const { data, error } = await client.storage.from(bucket).download(path);
    if (error) {
      if (Number(error.statusCode ?? error.status) === 404) return null;
      throw new Error("Photo download unavailable");
    }
    return Buffer.from(await data.arrayBuffer());
  }
  return {
    poll: () => rpc("photo_worker_poll"),
    claim: job => rpc("photo_worker_claim", jobArgs(job)),
    prepare: (job, meta) => rpc("photo_worker_prepare", { ...jobArgs(job), p_sha256: meta.sha256,
      p_byte_count: meta.byte_count, p_width: meta.width, p_height: meta.height }),
    complete: job => rpc("photo_worker_complete", jobArgs(job)),
    reject: job => rpc("photo_worker_reject", jobArgs(job)),
    block: (job, code) => rpc("photo_worker_block", { ...jobArgs(job), p_code: code }),
    async source(job) {
      if (job.kind === "preview") {
        const { data, error } = await client.from("media_assets").select("object_path")
          .eq("id", job.data.source_asset_id).maybeSingle();
        if (error) throw new Error("Preview source unavailable");
        return data ? download("plate-media", data.object_path) : null;
      }
      return download(job.kind === "table" ? "table-staged-assets" : "staged-assets", job.data.staged_path);
    },
    output: entry => download(entry.bucket, entry.object_path),
    async upload(entry, bytes) {
      const { error } = await client.storage.from(entry.bucket).upload(entry.object_path, bytes,
        { contentType: "image/webp", upsert: false });
      if (error) throw new Error("Photo upload outcome requires review");
    },
    close: () => rpc("photo_worker_close"),
  };
}
