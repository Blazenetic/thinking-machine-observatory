# The Thinking Machine Observatory

**Observe. Intervene. Compare.**

A local-first scientific instrument for inspecting next-token prediction, changing the sampler and preserving counterfactual branches as immutable traces.

![The Thinking Machine Observatory welcome deck](docs/evidence/session-01-welcome.png)

## Current foundation

The repository now contains a working Phase 1 vertical slice:

- an exact, deterministic sampler with temperature, top-k, top-p, greedy mode, suppression, forcing and xoshiro128\*\* seeded selection;
- a versioned JSON trace schema with immutable append, fork, annotation, validation and compatibility operations;
- candidate tables, entropy, selection explanations and Jensen–Shannon branch comparison;
- a responsive React observatory that can force the runner-up, suppress candidates, commit child traces and export JSON;
- all eight guided experiment definitions from the design package;
- an experimental worker adapter for pinned local DistilGPT2 top-logit capture; and
- unit, coverage and Playwright hero-loop tests in CI.

The default score field is intentionally labelled **illustrative**. Its ten candidate logits are a teaching fixture, not model output. The sampler calculations and branch records are exact within that declared universe. The live model adapter returns real runtime values but remains **unverified** and cannot yet enter exact replay.

## Run it

Requirements: Node.js 24+ and pnpm 11+.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

```bash
pnpm check          # formatting, lint, strict types, fixtures, unit tests and build
pnpm test:coverage  # exact-core coverage thresholds
pnpm build          # static production bundle
pnpm e2e            # Playwright hero-loop and responsive checks
```

Playwright requires its Chromium build once per development machine:

```bash
pnpm exec playwright install chromium
```

## Try the hero loop

1. Inspect the locked “The night sky was” teaching fixture.
2. Change temperature, top-k, top-p, mode or seed without mutating the baseline.
3. Suppress a candidate or choose **Force runner-up branch**.
4. Commit the preview as an immutable child trace.
5. Compare selection, entropy and Jensen–Shannon divergence in the Branch Chamber.
6. Export the selected schema-valid trace as JSON.

## Architecture

The browser application consumes small packages rather than owning scientific logic itself.

| Workspace                   | Responsibility                                                       |
| --------------------------- | -------------------------------------------------------------------- |
| `apps/observatory`          | React shell, observatory design system and interaction orchestration |
| `packages/domain`           | Dependency-free scientific and trace vocabulary                      |
| `packages/sampler`          | Pure deterministic sampler and trace-owned PRNG                      |
| `packages/trace-schema`     | Zod schema, validation, JSON, immutability and lineage               |
| `packages/instruments`      | Probability view models, comparisons and selection explanations      |
| `packages/experiments`      | Versionable guided experiment registry                               |
| `packages/inference-worker` | Typed worker protocol, capability detection and model adapter        |
| `fixtures/traces`           | Deterministic schema examples checked for drift in CI                |
| `model-tools`               | Verification and export boundary for the next phase                  |

The dependency direction is deliberate: UI and runtimes depend on the exact core; the exact core never depends on React, ONNX or a visual renderer.

## Scientific status

| Path                                | Source                                                 | Status                  | Allowed use                                                 |
| ----------------------------------- | ------------------------------------------------------ | ----------------------- | ----------------------------------------------------------- |
| Teaching fixture                    | Ten authored candidate logits                          | Illustrative            | Exact sampler learning, branching and replay demonstrations |
| Sampler and metrics                 | Pure TypeScript calculations                           | Exact and tested        | Derived values and deterministic replay                     |
| Local DistilGPT2 adapter            | `Xenova/distilgpt2` at pinned revision `a41c10485c18…` | Measured but unverified | Inspect top-N tokenizer/logit capture only                  |
| Hidden states, attention and probes | Not implemented                                        | Unavailable             | Never simulated or inferred                                 |

The interface uses Measured, Derived, Projected, Probed and Interventional evidence labels. It does not claim to reveal thought, intent, consciousness or a complete causal explanation.

## Local model path

The optional worker uses `@huggingface/transformers@3.8.1`, the pinned DistilGPT2-compatible repository above, `int8` on WASM and `fp16` on WebGPU. Loading may fetch hundreds of megabytes. Prompts remain in the browser and no inference service is called.

This adapter deliberately returns an incomplete top-N capture. Exact sampling remains disabled until Phase 2 carries the complete vocabulary distribution through the worker, records asset hashes and passes golden tokenizer/logit comparisons against a reference runtime.

The large, network-backed smoke is opt-in and intentionally excluded from ordinary CI:

```bash
RUN_LIVE_MODEL=1 pnpm exec playwright test tests/e2e/live-model.spec.ts
```

## Privacy and storage

- No account or backend is required.
- No analytics or prompt telemetry is present.
- Model files use the browser/runtime cache.
- Trace JSON is downloaded only when the user explicitly exports it.
- IndexedDB notebook persistence is planned, not silently implied by this foundation.

## Documentation

- [Five-phase implementation plan](docs/implementation/00-five-phase-plan.md)
- [Contribution workflow](CONTRIBUTING.md)
- [Session 01 handover](docs/implementation/01-session-01-handover.md)
- [Architecture decisions](docs/adr)
- [Model verification boundary](model-tools/README.md)
- [Original product and architecture package](docs/00-project-overview-and-directors-brief.md)

## Next high-value slice

Turn the experimental live adapter into a verified full-vocabulary vertical slice: one pinned prompt must produce reference-matched tokenizer IDs and logits, then pass through the existing exact sampler into a replayable trace. That strengthens the project’s core claim without expanding into secondary instruments too early.
