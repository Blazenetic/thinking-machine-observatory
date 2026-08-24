# Session 03 handover — multi-step generation and branch DAG

- Date: 24 August 2026
- Branch: `codex/phase-3-readiness`

## Result

Phase 3 is implemented as the operational centre of the Observatory. The verified WASM path can pause on a complete distribution, apply force/suppress/greedy/seed interventions, commit a compact step, continue from the exact token-ID prefix, run repeatedly, fork a historical selection, compare the first divergence, save locally and round-trip a portable ancestry bundle.

The illustrative hero loop remains immediate and unchanged. WebGPU remains inspection-only. No attention, hidden-state, probe, semantic-projection or KV-cache claim has been introduced.

## Exactness chain

1. The worker receives exact committed token IDs and constructs int64 runtime inputs directly.
2. Every complete 50,257-logit vector is encoded as canonical little-endian float32 bytes and keyed by SHA-256.
3. The compact step records configuration, interventions, selection, decoded display specimens and explicit PRNG state before/after; expanded candidate stages are recomputed.
4. Sampled steps continue from the preceding `stateAfter`. A changed seed is an explicit reset; greedy/forced steps preserve the cursor.
5. Import checks byte/count limits, canonical base64, finite values, content hashes, ancestry and deterministic replay in that order.
6. A step commits only after capture and compact construction succeed.

## Schema 1.2 and compatibility

The portable file is an ancestor-complete bundle:

- `traces` contains immutable trace nodes and local divergent steps;
- `payloads` is a SHA-256 map with no duplicated tensor bytes;
- `rootTraceId` selects the exported tip; and
- `exportedAt` records bundle creation.

Schema 1.0 first migrates to 1.1 with `null` verification fields. A replayable 1.0/1.1 root then migrates to 1.2 only after its full expanded sampler record recomputes exactly. Legacy children without their ancestor fail with a missing-ancestry diagnostic rather than being flattened or trusted.

Implemented import ceilings:

| Resource                    |     Limit |
| --------------------------- | --------: |
| JSON bytes                  |    32 MiB |
| payloads                    |       256 |
| total float32 values        | 4,000,000 |
| traces                      |       128 |
| total steps                 |     1,024 |
| local steps per trace       |       256 |
| decoded candidates per step |       200 |

## Controller and cancellation

The pure controller covers `idle`, `inferring`, `paused-before-selection`, `committing`, `complete` and `error`. `autoAdvance` is orthogonal state. Generation ID, request order and worker epoch cross the typed worker boundary and stale responses are ignored.

Model switch/cancel terminates the worker. Stop invalidates the pending response while allowing the current inference to finish; the loaded session becomes ready again without committing stale data. Input and output tensors are disposed after their values are copied. Initial multi-step correctness reruns the full prefix.

## Branch and notebook policy

- Forks may target any committed compatible historical step.
- A child stores only the divergent step(s); effective history resolves through its parent and fork position.
- Cycles, missing parents, incompatible identities, non-contiguous order and incorrect prefixes are rejected.
- The UI's historical alternative action is recorded as a forced prior-token intervention.
- IndexedDB separates traces, payloads and metadata, with append-only checks and payload reference counts.
- Quota preflight and transaction failure leave the prior notebook state intact.
- Parent deletion is prevented while descendants exist.

## Verification

- 61/61 Vitest tests pass across 11 files.
- Exact-core coverage passes at 85.73% statements, 70.50% branches, 92.78% functions and 87.10% lines.
- The dedicated Phase 3 gate covers five cursor-continuous steps without a model, stale responses, historical forks, compact/legacy replay, notebook atomicity and accepted live construction.
- Formatting, ESLint and strict TypeScript pass.
- Phase 2 fixture hashes, accepted/rejected backend reports, live hero replay and compact-payload equivalence remain green.
- Production build succeeds; main JS is approximately 356 kB / 105 kB gzip, worker 920 kB and ONNX Runtime WASM 21.60 MB / 5.17 MB gzip.
- A deterministic verified-fixture worker Playwright journey covers multi-step advance, historical fork, notebook save, export and import. The opt-in network-backed test covers the same boundary with the real fp32 asset.

This workspace still could not run Chromium because browser network/socket launch requires a permission not granted to the container. The browser tests are checked and intended for GitHub CI or a normal host; no local Chromium pass is claimed.

## Phase 4 boundary

Phase 4 should begin with the exact token specimen byte/boundary instrument, then admit other instruments one capability at a time. Attention and hidden-state views require a purpose-built export, source-framework golden fixtures, causal-mask/shape checks, bounded capture and an adjacent limitation statement. Unsupported outputs remain explicitly unavailable.
