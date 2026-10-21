const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validateE2ePlan(plan) {
  const fields = ["authUserId", "plateUploadId", "invalidUploadId", "tableUploadId", "previewJobId"];
  if (plan?.version !== 1 || Object.keys(plan).sort().join() !== ["version", ...fields].sort().join()
    || fields.some(field => !uuid(plan[field])) || new Set(fields.map(field => plan[field])).size !== fields.length) {
    throw new Error("Invalid fixture plan");
  }
  return plan;
}

export function validateE2eResume(plan, records) {
  validateE2ePlan(plan);
  const fixture = records?.[1];
  if (records?.length !== 3 || records[0]?.event !== "started" || fixture?.event !== "fixtures_created"
    || records[2]?.event !== "failed" || (records[2].stage && records[2].stage !== "backend_check")
    || !uuid(fixture.ownerId) || !uuid(fixture.groupId)
    || Object.keys(plan).some(field => records[0].plan?.[field] !== plan[field])) {
    throw new Error("Only a verified pre-upload fixture failure may resume");
  }
  return { ownerId: fixture.ownerId, groupId: fixture.groupId };
}

// Every job operation and output path is checked, not only poll filtering.
export function createScopedPhotoBackend({ backend, expected, readJobs }) {
  const specs = new Map(expected.map(spec => [`${spec.kind}:${spec.id}`, { ...spec }]));
  if (!specs.size || specs.size > 4 || specs.size !== expected.length
    || expected.some(spec => !uuid(spec.id) || !uuid(spec.ownerId) || !["plate", "table", "preview"].includes(spec.kind)
      || (spec.kind === "table" && !uuid(spec.groupId))
      || (spec.kind === "preview" && (!uuid(spec.plateId) || !uuid(spec.sourceAssetId))))) throw new Error("Invalid job scope");
  const entries = new Map(), blocked = new Set();
  function checkJob(job) {
    const spec = specs.get(`${job.kind}:${job.id}`);
    const data = job.data;
    if (!spec || data?.id !== spec.id || !["pending", "processing", "ready", "failed"].includes(data.state)
      || (spec.kind === "preview" ? data.saver_id !== spec.ownerId || data.plate_id !== spec.plateId || data.source_asset_id !== spec.sourceAssetId
        : data.uploader_id !== spec.ownerId || data.staged_path !== `${spec.ownerId}/${spec.id}`
          || (spec.kind === "table" && data.group_id !== spec.groupId))) throw new Error("Job outside fixture scope");
    return spec;
  }
  function remember(job, entry) {
    if (!entry) return entry;
    const spec = checkJob(job);
    const bucket = spec.kind === "plate" ? "plate-media" : spec.kind === "table" ? "table-media" : "menu-previews";
    const prefix = spec.kind === "plate" ? "" : `${spec.kind === "table" ? spec.groupId : spec.ownerId}/`;
    const prior = entries.get(`${job.kind}:${job.id}`);
    if (entry.job_id !== spec.id || entry.kind !== spec.kind || !uuid(entry.asset_id) || entry.bucket !== bucket
      || entry.object_path !== `${prefix}${entry.asset_id}.webp`
      || (prior && (prior.asset_id !== entry.asset_id || prior.object_path !== entry.object_path))) throw new Error("Output outside fixture scope");
    entries.set(`${job.kind}:${job.id}`, { ...entry });
    return entry;
  }
  function checkEntry(entry) {
    const known = entries.get(`${entry.kind}:${entry.job_id}`);
    if (!known || entry.asset_id !== known.asset_id || entry.bucket !== known.bucket || entry.object_path !== known.object_path
      || entry.sha256 !== known.sha256 || entry.byte_count !== known.byte_count) throw new Error("Unknown fixture output");
  }
  return {
    async poll() {
      const jobs = await readJobs([...specs.values()]);
      if (!Array.isArray(jobs) || jobs.length !== specs.size || new Set(jobs.map(job => `${job.kind}:${job.id}`)).size !== specs.size) {
        throw new Error("Fixture queue incomplete");
      }
      jobs.forEach(checkJob);
      return { jobs: jobs.filter(job => ["pending", "processing"].includes(job.data.state)), counts: { blocked: blocked.size } };
    },
    async claim(job) { checkJob(job); return remember(job, await backend.claim(job)); },
    async prepare(job, meta) { checkJob(job); return remember(job, await backend.prepare(job, meta)); },
    async source(job) { checkJob(job); return backend.source(job); },
    async complete(job) { checkJob(job); return backend.complete(job); },
    async reject(job) { checkJob(job); return backend.reject(job); },
    async block(job, code) { checkJob(job); blocked.add(`${job.kind}:${job.id}`); return backend.block(job, code); },
    async output(entry) { checkEntry(entry); return backend.output(entry); },
    async upload(entry, bytes) { checkEntry(entry); return backend.upload(entry, bytes); },
    get entries() { return new Map([...entries].map(([key, value]) => [key, { ...value }])); },
  };
}
