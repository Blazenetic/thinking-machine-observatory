# Session 01 handover — exact foundation

- Date: 24 August 2026
- Branch: `codex/foundation-vertical-slice`

## Result

The repository has moved from an implementation package to a running, modular product foundation. A user can inspect an illustrative candidate field, preview exact sampler changes, suppress or force a token, commit an immutable child trace, compare it with the baseline and export schema-valid JSON.

This is deliberately a strong Phase 1 rather than a claim that the complete MVP+ is finished.

## What is real now

- Temperature scaling, stable softmax, top-k, top-p boundary inclusion, renormalisation, entropy and selection intervals.
- Trace-owned xoshiro128\*\* state and deterministic seeded draws.
- Greedy, seeded, forced and suppressed selection records.
- Immutable trace creation, step append, fork, annotation, JSON validation and compatibility checks.
- Jensen–Shannon divergence over compatible final distributions.
- Worker/capability boundary and direct Transformers.js causal-model call.
- Responsive interactions, accessible labels, exact candidate table and reduced-motion CSS.

## Evidence status by surface

| Surface                              | Class/status           | Candid boundary                                                   |
| ------------------------------------ | ---------------------- | ----------------------------------------------------------------- |
| Default candidate logits             | Illustrative fixture   | Authored teaching values; not model measurements                  |
| Sampler stages and entropy           | Derived                | Exact within the declared complete ten-candidate universe         |
| Forced/suppressed branch             | Interventional         | Exact record of the user-controlled sampler change                |
| Branch divergence                    | Derived/Interventional | Distribution metric over the compatible fixture universe          |
| Local tokenizer/top logits           | Measured, unverified   | Genuine runtime capture; truncated top-N; exact sampling disabled |
| Hidden states/attention/semantic sky | Unavailable            | Not mocked or shown                                               |

## Pinned experimental live path

- Model/tokenizer repository: `Xenova/distilgpt2`
- Repository revision: `a41c10485c18a64b6606729b6a082330cbd8f49e`
- Runtime: `@huggingface/transformers@3.8.1`
- Backend/dtype: WASM `int8`; WebGPU `fp16`
- Execution boundary: dedicated module worker
- Current capture: prompt token IDs/fragments and top 1–200 final-position logits
- Verification: **not yet compared with a source-framework golden fixture**
- Asset hashes: **not yet recorded**, beyond the pinned repository revision

No numerical tolerance is accepted yet. Phase 2 must establish it per backend/dtype before the live path is called verified.

## Verification run

Observed in this workspace:

- strict TypeScript build: pass;
- ESLint with type-aware rules: pass;
- Vitest: 28/28 tests pass;
- exact-core coverage: 91.08% statements, 74.37% branches, 98.43% functions, 92.01% lines;
- production dependency audit: no known vulnerabilities;
- Playwright: 3/3 Chromium tests pass, covering runner-up branching, reversible suppression/calibration and 390 px mobile overflow;
- opt-in network smoke: pinned WASM model load, inference and 20-logit UI capture pass;
- production build: pass;
- main JS: approximately 308 kB / 92 kB gzip;
- CSS: approximately 25 kB / 5.6 kB gzip;
- inference worker: approximately 917 kB;
- bundled ONNX Runtime WASM: approximately 21.6 MB / 5.2 MB gzip.

These are build artefact sizes and local test results, not end-user network or inference performance measurements. The opt-in smoke proves that the browser path executes; it is not the source-framework numerical verification required by Phase 2.

## Repository decisions

- pnpm workspaces without Turborepo/Nx: accepted; the current graph does not justify another orchestrator.
- React/Vite shell with pure TypeScript scientific packages: accepted.
- Zod at the import/export boundary: accepted.
- Illustrative fixture plus isolated unverified live adapter: accepted for Phase 1 only.
- Static/local-first product with no backend or account: unchanged.

See the ADRs for consequences.

## Known limitations

- The default prompt and ten-candidate universe are locked and illustrative.
- The app generates only one committed counterfactual step; multi-token futures are Phase 3.
- Live top-N capture is incomplete and therefore cannot be sampled or replayed exactly.
- Trace export works; trace import, IndexedDB notebook storage and migrations beyond schema 1.0.0 do not.
- The local adapter has not completed the reference comparison, browser/device matrix or memory profiling.
- Attention, hidden-state, layerwise probe and semantic instruments are intentionally absent.
- Browser CI currently targets Chromium; Safari/Firefox support is not claimed.

## Smallest high-value next session

Create one verified live prediction fixture:

1. pin the reference Python and ONNX environments;
2. capture exact token IDs and full logits for “The night sky was”;
3. run the current browser adapter on the same assets;
4. compare top ranks and numeric error by dtype/backend;
5. carry the complete distribution through the exact sampler; and
6. export/replay one live trace.

Do not add attention, 3D, accounts or a backend before this gate passes.
