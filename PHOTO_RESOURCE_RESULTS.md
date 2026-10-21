# Photo resource benchmark — 2026-10-14

Owner requested resource testing. Ran offline synthetic image processing with the installed Node v24.21.0/sharp 0.35.5 on this ARM64 Mac. No application code/configuration changed, no live queue/database/network/Storage/erasure action, and no dependency installed. Inputs, outputs and raw metrics remain in `/private/tmp/plates-photo-benchmark-9w2Xkn`; do not remove them without exact approval.

## Results

Subsequent owner browser report, 2026-10-14: two genuine HEIC uploads (portrait and landscape, approximately 2 MB each) worked without issues. This provides local functional acceptance for those files, not HEIC memory/CPU measurements. The benchmark table below remains JPEG/PNG-only; hosted Linux and wider HEIC sizing remain pending.

Every case processes an input through the existing decoder thread and then creates a Menu preview. A fresh process measures each scenario; fixture generation runs in a different process and is excluded from measurements. Existing 384/64 MB JS-heap limits, 30-second decoder timeout and asynchronous thread termination are retained. Supabase SDK module overhead is included without creating a client or contacting a backend.

| Synthetic workload | Input | Peak whole-process RAM (MiB) | Wall time incl. preview/local IO | CPU time |
| --- | --- | ---: | ---: | ---: |
| Detailed JPEG, 12 MP | 8.46 MB, quality 85 | 180.8 | 0.84 s | 0.92 s |
| Detailed JPEG, 48 MP | 8.22 MB, quality 20 | 169.5 | 0.77 s | 0.87 s |
| Screenshot PNG, 4.6 MP | 23 KB | 115.4 | 0.33 s | 0.39 s |
| Six sequential 48 MP JPEGs plus six previews | Same 8.22 MB input repeated | 241.4 | 4.89 s | 5.45 s |
| Patterned PNG at 50 MP limit | 5.28 MB | 212.5 | 0.77 s | 0.86 s |

Peak is OS-reported process high-water resident memory, including native allocations and decoder threads, not just JS heap. Values include process startup. MiB means 1,048,576 bytes; fixture MB sizes use 1,000,000 bytes. CPU time can exceed wall time because native code can run across threads.

Warm baseline memory was 48–54 MiB. After the six-photo batch it was 193 MiB immediately and 119 MiB after one second. This brief drop is not proof of leak-free long-term operation. Reported baseline CPU excludes real queue polling; it must not be used as a full-worker monthly bill estimate.

The deliberately noisy 12 MP JPEG became a 1.61 MB display WebP and a 50 KB preview. The 48 MP JPEG became a 1.18 MB display image and an 11 KB preview. The large PNG became a 1.21 MB display image and a 9 KB preview. Synthetic patterns are not predictions of ordinary phone-photo compression ratios or visual quality.

## Interpretation and limits

- A 512 MB worker is a plausible first hosted test target for sequential JPEG/PNG processing; measured peaks do not currently justify defaulting to a 2 GB worker. This is preliminary evidence, not a capacity guarantee or provider selection.
- HEIC was not measured. No genuine user-photo files were used, including the owner's 9.2 MB photo. Supported input WebP and worst-case variants remain outside this run. Pixel count alone did not predict peak memory: JPEG decoding can take a different path from PNG decoding.
- The benchmark loads the SDK and real processing thread but does not reproduce all main-worker imports, clients, Storage Blob/ArrayBuffer copies, RPC/polling overhead, cleanup jobs or hosted Linux allocator behaviour. The app and worker have separate memory needs when hosted as separate services; website memory is unmeasured.
- Mac processing speed does not predict a shared/limited hosted CPU. No real 512 MB memory boundary, long-duration workload, simultaneous-account burst, crash/retry, corrupt/oversize rejection or browser upload was tested by this benchmark. The owner separately reported oversized rejection and other browser cases passing.
- Retained fixture generation is deterministic and isolated from measurements; its own high memory/CPU use is not an application workload. Six sequential transformations plus previews represent a local burst model, not a real multi-account upload test.

## Checks and retained evidence

`node --check scripts/benchmark-photo-resources.mjs` and focused `./node_modules/.bin/eslint scripts/benchmark-photo-resources.mjs` passed before the initial run and after adding the large-PNG case. Initial benchmark and large-PNG extension exited zero; assertions checked accepted input sizes, output photo/preview dimensions, photo WebP headers and preview byte limit. Existing processors were not modified. No full app build/typecheck needed or run for this isolated internal benchmark.

Raw evidence:

- `/private/tmp/plates-photo-benchmark-9w2Xkn/results.json`: initial fixture/runtime details and four workloads.
- `/private/tmp/plates-photo-benchmark-9w2Xkn/png-50mp-results.json`: maximum-pixel PNG extension.
- Same folder: separate scenario JSON, synthetic source images and processed/preview outputs. All preserved.

To repeat later, from `/Users/roryjohnson/dev/plates`, with the owner's command authorisation, run `node scripts/benchmark-photo-resources.mjs`. It creates a new retained folder and uses CPU/RAM to generate/test synthetic inputs; no live data is touched. Then `node scripts/benchmark-photo-resources.mjs --large-png NEW_BENCHMARK_FOLDER` adds the PNG case. Replace `NEW_BENCHMARK_FOLDER` with the exact folder printed by that run. File creation refuses overwrite; do not rerun the extension in a completed folder.

## Ordered next sizing work

1. Measure separately agreed genuine phone-photo inputs and a genuine HEIC fixture when available; test additional supported formats and longer sequential batches if those introduce an unresolved sizing concern.
2. Scope a safe full-worker idle/transfer measurement that cannot claim cleanup or mutate real accounts. Do not start the existing general worker casually: it contains deletion queues as well as image jobs. Website resource usage needs separate measurement.
3. Choose an initial hosted test configuration, then repeat representative cases on Linux under the actual memory/CPU limit with reviewed job recovery. Hosted setup requires separate explicit approval.
4. Combine measured app/worker memory and active/idle CPU, monthly photo/preview storage and image delivery with current provider rates. Total ceiling is £10–£20/month, not a spending target. No hosted cost or free-tier sufficiency is proved by the decoder benchmark.
