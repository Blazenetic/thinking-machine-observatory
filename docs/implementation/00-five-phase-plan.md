# Five-phase implementation plan

Status date: 24 August 2026

The governing rule is to deepen the hero loop—observe, intervene, branch and compare—before widening the product. Each phase must leave a coherent, runnable instrument.

## Phase 1 — Exact foundation and teaching vertical slice

**Status: complete in draft PR**

Outcome:

- pnpm/TypeScript monorepo with strict package boundaries;
- exact sampler mathematics and serialisable xoshiro128\*\* PRNG state;
- versioned immutable trace schema and deterministic fixture generation;
- responsive Probability Spectrometer, Calibration Rail, mechanical selection explanation and Branch Chamber;
- forcing, suppression, parameter changes, branch export and comparison;
- eight guided experiment definitions;
- pinned experimental DistilGPT2 worker adapter;
- CI, unit/coverage tests and Playwright hero-loop tests.

Exit evidence:

- 28 unit/integration tests pass;
- exact-core line coverage exceeds 90%;
- three browser hero-loop/responsive tests pass;
- production static build succeeds;
- visual evidence and two schema-valid trace fixtures are checked in.

Integrity boundary: the default ten-candidate logits are visibly illustrative. No hidden state, attention or semantic projection is fabricated.

## Phase 2 — Verified live next-token slice

**Status: complete in draft PR**

Outcome: one pinned DistilGPT2 prompt produces reference-matched tokenizer IDs and full-vocabulary logits in-browser, then uses the existing exact sampler and trace schema.

Work:

1. Pin the source model, tokenizer, ONNX assets, exporter/runtime versions and SHA-256 hashes.
2. Produce Python/source-framework golden fixtures for at least three prompts, including punctuation and Unicode.
3. Verify tokenizer IDs exactly and logits/ranks within an explicit dtype/backend tolerance.
4. Transfer or retain the complete vocabulary distribution at the worker boundary; remove the top-N sampling prohibition only when mathematically valid.
5. Decode selected tokens through the pinned tokenizer and commit live steps into schema-valid traces.
6. Record download, cold/warm load, inference, memory and trace-size measurements on Chromium/WASM and WebGPU where available.
7. Add cancellation, asset-cache status and clear recovery for download/inference failures.

Exit gate: a live trace replays to the same selection and passes golden comparisons. The illustrative path remains as instant fallback.

Exit evidence:

- four source-framework prompt fixtures with exact token IDs/fragments and 50,257 fp32 logits each;
- fp32 WASM: 50/50 exact top-rank positions on every prompt, maximum absolute error below `0.000077`, zero causal-prefix error;
- int8 WASM rejected with its failed ranks and causal-prefix behaviour retained as evidence;
- the pinned hero vector selects token `3223` (`" dark"`) after exact sampling and survives JSON import/replay unchanged;
- one-step expanded trace measured at 23.06 MiB JSON / 1.10 MiB gzip, establishing the Phase 3 compact-storage gate.

## Phase 3 — Multi-step generation and branch DAG

**Status: readiness drafted; implementation next**

Outcome: the branch workflow becomes the product’s operational centre rather than a one-step demonstration.

Work:

- advance one token, run continuously, pause before/after selection and cancel safely;
- generate several steps on baseline and child traces;
- resolve ancestry without duplicating ancestor payloads;
- fork from any compatible historical step;
- add change-seed, greedy, suppress, force and prior-token interventions;
- synchronise comparisons from the shared ancestor;
- validate import/export/replay and compatibility warnings;
- introduce IndexedDB notebook storage with quota handling.

Entry gate: replace repeated expanded 50,257-candidate records with a content-addressed, lossless logit payload while preserving schema 1.1 import and exact sampler replay. The Phase 2 measurement shows that naively repeating the expanded record would add roughly 23 MiB and substantial heap use per step.

Exit gate: force the runner-up, run both futures for several tokens, locate the first divergence, export, import and replay without ancestor mutation.

## Phase 4 — Honest instruments and guided laboratory

**Status: planned; capability-gated**

Outcome: secondary instruments teach from real supported outputs.

Work:

- exact token specimen byte/boundary view;
- layer telescope only after a purpose-built export passes golden verification;
- attention interferometer with causal-mask checks and an adjacent limitation statement;
- optional logit lens labelled Probed with method/version provenance;
- semantic neighbours plus a separately labelled projection;
- executable observation predicates and notebook reflections for all eight experiments;
- accessible data/table alternatives for every dense visual.

Exit gate: each displayed datum declares its evidence class and provenance; unsupported outputs have an honest unavailable state.

## Phase 5 — Public release quality

**Status: planned**

Outcome: a dependable public portfolio and learning instrument.

Work:

- WCAG 2.2 AA keyboard, focus, contrast, target-size and live-region review;
- reduced-motion and mobile playback/reduced-authoring modes;
- cross-browser/device capability matrix based on measured results;
- memory lifecycle, trace-size, cache quota and offline-revisit tests;
- static HTTPS deployment, security headers/CSP and model-asset hosting decision;
- complete licences, asset manifests, reproducibility notes and public limitations;
- presentation screenshots/recording and user testing of the two-minute first experiment.

Exit gate: acceptance document 07 passes with recorded evidence, not assumed support.

## Risks kept active

| Risk                                                | Current control                                         | Next evidence needed                          |
| --------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| Browser export/runtime disagrees with reference     | Only fp32 WASM passed; int8/WebGPU remain isolated      | Re-run profiles on every model/runtime change |
| Truncated top-N is mistaken for a full distribution | 50,257 logits cross the verified worker boundary        | Compact lossless Phase 3 payload              |
| Visual polish outruns scientific truth              | Fixture/live/rejected status is persistent in UI/schema | Integrity review of every new instrument      |
| Worker/model bundle harms first use                 | Instant teaching path; 327.8 MB model is opt-in         | Cross-device browser measurements             |
| Secondary instruments expand scope                  | Capability-gated Phase 4                                | Verified export outputs and learning value    |
| Monorepo becomes platform overhead                  | No task runner or backend; source exports remain simple | Reassess only if build graph becomes slow     |
