# Session 02 handover — verified live next-token slice

- Date: 24 August 2026
- Branch: `codex/phase-2-verified-live-trace`

## Result

Phase 2 now has a complete evidence chain from a pinned PyTorch source run to ONNX Runtime Web WASM, the browser worker boundary, exact TypeScript sampling, schema-valid JSON and deterministic replay.

For the pinned prompt `The night sky was`, the accepted runtime vector contains all 50,257 logits. With temperature `0.8`, top-k `40`, top-p `0.95` and seed `observatory-live-42`, it selects token ID `3223`, decoded as `" dark"`. Export/import replay recomputes the same sampler record and selection.

## Scientific boundary

| Surface                | Status               | Evidence and permitted claim                                              |
| ---------------------- | -------------------- | ------------------------------------------------------------------------- |
| Source PyTorch fp32    | Golden reference     | Pinned model/revision, package environment, asset hashes and full vectors |
| WASM fp32              | Verified measured    | Exact tokenizer; accepted full-vocabulary errors/ranks/causal checks      |
| WASM int8              | Rejected measured    | Retained report; never offered to the exact live sampler                  |
| WebGPU fp16            | Measured, unverified | May be inspected; live trace commitment is disabled                       |
| Sampler/replay         | Exact derived        | Complete vector, deterministic PRNG state and recomputation               |
| Teaching fixture       | Illustrative         | Still the immediate no-download fallback                                  |
| Hidden state/attention | Unavailable          | No placeholder or proxy is shown                                          |

## Reproducibility chain

- Python `3.12.13`; PyTorch `2.6.0+cpu`; Transformers `4.49.0`; Optimum `1.24.0`; ONNX `1.17.0`; ONNX Runtime `1.20.1`.
- Source: `distilbert/distilgpt2@2290a62682d06624634c1f46a6ad5be0f47f38aa`; safetensors SHA-256 `e1ff18884359fe8beb795a5f414feb85a6ce3d929ad019c0d958c039d2b94a1b`.
- Browser: `Xenova/distilgpt2@a41c10485c18a64b6606729b6a082330cbd8f49e`; runtime `@huggingface/transformers@3.8.1` and `onnxruntime-web@1.22.0-dev.20250409-89f8206ba4`.
- Accepted fp32 ONNX SHA-256: `d605c4b3740df3960e8f84e4c5735af8d81d19105eb915b692272c08cc800b0c`.
- Rejected int8 ONNX SHA-256: `80b02da4fe266412bc49c9955a518151c50f9bac062f596a875068492a21f080`.
- Model and tokenizer sources declare Apache-2.0. The repository stores fixtures and metadata, not the large model weights.

## Numerical result

All four fp32 cases have exact token IDs and fragments, exact top-1, 50/50 top-50 overlap and 50/50 exact top-50 positions. Across cases:

- maximum absolute logit error: below `0.000077`;
- largest mean absolute logit error: below `0.000016`;
- maximum earlier-position change after final-token mutation: exactly `0`; and
- final-position mutation effect: non-zero in every case.

The rejected int8 graph had 36–45/50 top-50 overlap, top-1 failures for punctuation and Unicode, and earlier-position changes up to approximately `4.176`. The rejection is not hidden by a permissive tolerance.

## Recorded performance

These values are measurements from the Linux x64 Node 24 ONNX Runtime Web WASM harness in this workspace, not universal browser/device claims:

| Measurement                   |                     Observed |
| ----------------------------- | ---------------------------: |
| fp32 asset                    |            327,825,716 bytes |
| fp32 session load             |                       3.31 s |
| warm hero inference           |                      27.9 ms |
| peak process RSS during suite |                  1,910.9 MiB |
| expanded one-step JSON        | 24,179,109 bytes / 23.06 MiB |
| gzip level-9 trace            |   1,155,791 bytes / 1.10 MiB |
| live-trace commit             |                       278 ms |
| serialisation                 |                       168 ms |
| import plus replay            |                       448 ms |
| measured heap delta           |         approximately 187 MB |

The app separately reports the current browser's load/inference duration and whether Cache Storage appeared warm or cold. Those per-device values are not promoted into this harness report.

## Product result

- WASM now loads fp32 and transfers its complete final-position `Float32Array` rather than a truncated top-N sample.
- The display still decodes only 50 leaders; exact sampling consumes the full vector.
- Trace schema 1.1 adds the measured vector SHA-256 and verification-profile ID, with an explicit 1.0 migration that supplies `null` rather than invented evidence.
- The trace dock commits, exports, imports and replays verified WASM traces. Unverified WebGPU captures cannot be committed.
- Model loading remains opt-in, cancellable by worker termination and recoverable through the unchanged instant teaching path.

## Verification

The ordinary gate now includes format, lint, strict types, deterministic demo fixtures, model-evidence re-hashing, full live-trace replay, unit/coverage tests and the production build. The large Chromium model smoke remains opt-in:

- 36/36 Vitest tests pass;
- 91.46% statement, 76.37% branch, 98.63% function and 92.27% line coverage;
- no known production dependency vulnerabilities at high severity or above;
- production main JS: 316.76 kB / 95.16 kB gzip;
- inference worker: 919.34 kB; and
- bundled ONNX Runtime WASM: 21.60 MB / 5.17 MB gzip.

```bash
RUN_LIVE_MODEL=1 pnpm exec playwright test tests/e2e/live-model.spec.ts
```

The opt-in test loads fp32, measures all logits, commits a trace, downloads it and imports/replays it. This workspace's sandbox did not permit a Chromium process to create its required socket, so browser execution must be recorded on a normal host or CI runner; no local browser result is claimed here.

## Phase 3 entry conditions

Before repeating live generation steps:

1. introduce a lossless content-addressed logit payload so a step does not duplicate 23 MiB of expanded derived records;
2. retain schema 1.1 import and prove the compact representation yields a canonical equivalent sampler result;
3. define a pause-safe generation state machine with stale-response IDs and cooperative cancellation;
4. resolve branch ancestry without copying ancestor payloads;
5. add IndexedDB quota/error handling before calling it a notebook; and
6. keep WebGPU outside verified commitment until it earns its own golden profile.

Do not widen into attention, hidden-state or semantic instruments before the multi-step branch loop is sound.
