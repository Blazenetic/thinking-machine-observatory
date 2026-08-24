# Observatory agent guide

This file is the operating contract for humans and coding agents working in this repository. Read
it with `README.md`, `docs/architecture/README.md` and the most recent implementation handover
before changing code.

## Mission

Deepen the **observe → intervene → branch → compare** learning loop without overstating what the
model or instrument exposes. Correctness, provenance and replayability take priority over feature
count.

## Fresh-session start

1. Read this file, `README.md`, `docs/architecture/README.md` and the newest file in
   `docs/implementation`.
2. Inspect `git status --short --branch`, the recent log and the pull request before assuming the
   handover still matches the branch.
3. Read `release-evidence/summary.md` and `manifest.json` before making a release-readiness claim.
4. Install with `pnpm install --frozen-lockfile`; use the pinned Node 24 and pnpm 11 toolchain.
5. Identify whether the task changes the frozen source candidate, adds evidence for it or only
   improves repository guidance. Do not silently mix those scopes.

Use `docs/developer-guide.md` for task routing and commands. A clean worktree is not proof that the
remote branch or PR is current; verify both before publishing.

## Non-negotiable invariants

1. Keep illustrative, measured, derived, projected, probed and interventional evidence visibly
   distinct.
2. Only the pinned fp32 WASM profile may create a verified live trace. It requires the exact model,
   runtime, tokenizer asset and all 50,257 vocabulary logits.
3. WebGPU stays unverified and inspection-only. The int8 graph stays rejected. Hidden states,
   attention, logit-lens and semantic projection stay unavailable until a separate versioned
   evidence profile is accepted.
4. Never reconstruct, simulate or infer a missing model tensor from final logits.
5. Sampling is pure and deterministic. Preserve the exact token-ID prefix and recorded xoshiro128**
   cursor; do not decode and re-tokenise continuation text.
6. Committed trace steps, lineage and annotations are append-only. Compact payloads are canonical
   float32 little-endian bytes addressed by SHA-256.
7. Worker replies are accepted only when generation ID, request order and worker epoch match the
   active request.
8. Limits and unavailable states are results, not errors to hide. Record a blocked or unrun check
   honestly.

If a requested change conflicts with an invariant, stop and write an ADR or readiness proposal
instead of silently weakening the boundary.

## Repository map and dependency direction

| Area                        | Owns                                                          | May depend on                |
| --------------------------- | ------------------------------------------------------------- | ---------------------------- |
| `packages/domain`           | Shared scientific vocabulary                                  | Nothing                      |
| `packages/sampler`          | Exact sampler, metrics and PRNG                               | `domain`                     |
| `packages/trace-schema`     | Validation, replay, compact bundles and notebook              | `domain`, `sampler`          |
| `packages/instruments`      | Pure display/comparison view models                           | `domain`                     |
| `packages/experiments`      | Versioned learning protocols and predicates                   | `domain`                     |
| `packages/inference-worker` | Runtime capabilities, typed worker protocol and model adapter | `domain`                     |
| `apps/observatory`          | React interaction orchestration                               | Public package APIs          |
| `model-tools`               | Independent source/runtime evidence                           | Pinned external environments |

Do not import React, Vite, ONNX, browser workers or IndexedDB into the exact core. Do not bypass a
package API with a relative cross-workspace import.

## Change sequence

1. Identify the evidence class, user outcome and integrity boundary.
2. Put vocabulary in `domain` and calculations in a pure package before wiring UI state.
3. Add an executable regression test for every repaired invariant or new calculation.
4. Version schema, protocol or verification changes explicitly. Add an ADR for a durable or
   difficult-to-reverse decision.
5. Add one coherent accessible UI path and an exact-data alternative when the visual is not enough.
6. Update present-tense architecture documentation and the current handover.
7. Run the ordinary gate and report heavyweight or device-specific checks separately.

## Commands

Use Node 24 and pnpm 11 as pinned by the repository.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test:coverage
pnpm e2e
```

Useful focused gates:

```bash
pnpm fixtures:check
pnpm trace:verify:live
pnpm payload:verify
pnpm phase4:verify
pnpm phase5:verify
pnpm phase5:budgets
pnpm build
```

`RUN_LIVE_MODEL=1 pnpm exec playwright test tests/e2e/live-model.spec.ts` downloads and executes the
large pinned model path and is deliberately opt-in. `pnpm model:verify` requires the pinned ONNX
assets. Do not claim either ran unless it actually completed.

## Definition of done

- Formatting, lint, strict TypeScript, fixtures, replay gates, tests and production build pass.
- Coverage remains above the checked thresholds; new boundary logic has a regression test.
- Browser behaviour has Playwright coverage or an explicit environment limitation.
- Release claims resolve through `release-evidence/manifest.json`; blocked and not-run evidence are
  never counted as passed.
- No evidence status was promoted by UI state, a model name or a self-declared trace field.
- Documentation describes the current implementation, not just the intended design.
- The pull request states the user outcome, scientific boundary, observed commands and one bounded
  next slice.

## Handover contract

Leave the next human or agent an exact branch, source-candidate SHA, evidence-commit SHA where
applicable, commands actually observed and a clean/dirty worktree statement. Separate passed,
failed, blocked and not-run checks. Name missing browser binaries, model assets, hardware or
deployment access as prerequisites rather than weakening a gate or implying that it passed.

If a post-candidate documentation change alters application behaviour, public support claims or an
accepted evidence artefact, treat it as a new candidate input and rebind the evidence. Navigation,
contributor guidance and historical handover corrections may follow the evidence commit when they
do not change the built application or its release claims.
