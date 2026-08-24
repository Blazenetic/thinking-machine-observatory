# Contributing to the Observatory

This is a learning project with a production-minded scientific core. Contributions should make the instrument more useful without making its claims less precise.

## Working principles

1. Deepen **observe → intervene → branch → compare** before adding a disconnected surface.
2. Keep measured, derived, projected, probed, interventional and illustrative data visibly distinct.
3. Prefer a small pure function and a durable trace record over logic hidden in a component.
4. Make unsupported capabilities explicit. Never fill a missing model output with plausible-looking data.
5. Leave the repository easier for the next contributor to understand and verify.

## Set up

Use the versions pinned by `.node-version` and `packageManager`.

```bash
pnpm install
pnpm dev
```

The ordinary local gate is:

```bash
pnpm check
pnpm test:coverage
pnpm e2e
```

Install Playwright's browser once with `pnpm exec playwright install chromium`. The network-backed local-model smoke and reproducibility environment are opt-in; see the README and `model-tools/README.md`.

## Dependency direction

- `domain` is dependency-free shared vocabulary.
- `sampler` owns deterministic scientific calculations and PRNG state.
- `trace-schema` owns validation, immutability, serialisation and lineage.
- `instruments` converts trace data into comparison and explanation view models.
- `inference-worker` owns runtime/model integration, never sampler truth.
- `apps/observatory` orchestrates interactions but does not reimplement core mathematics.

Do not introduce an upward import from a core package into React, Vite, ONNX or a browser worker.

## Building a vertical slice

A useful order is:

1. define or refine the domain vocabulary;
2. implement the pure calculation with edge-case tests;
3. record enough provenance and state for replay;
4. add the runtime adapter behind a typed boundary, if needed;
5. expose one coherent user action and an accessible exact-data alternative;
6. add browser evidence for the hero path; and
7. document the limitation and next verification gate.

Schema changes require an explicit version and migration decision. Model/runtime changes require pinned identities and fresh golden evidence; a dependency update alone does not establish numerical equivalence.

`pnpm fixtures:check` re-hashes the checked source/runtime vectors and re-evaluates the accepted rank/error gates without downloading model weights. `pnpm trace:verify:live` feeds the accepted 50,257-logit hero vector through the production sampler, JSON parser and replay engine. Run the heavyweight `pnpm model:verify` only with both pinned ONNX assets available.

On the Phase 3 readiness branch, `pnpm payload:verify` additionally proves that canonical float32-le/base64 encoding preserves the content address and every sampler field. The codec is a spike until schema 1.2 migration lands; do not write ad hoc payload references into schema 1.1 traces.

## Pull requests

Keep commits reviewable and use conventional prefixes such as `feat:`, `fix:`, `test:`, `docs:` and `chore:`. Complete the PR template with:

- the user-visible outcome;
- the evidence class and scientific boundary;
- commands actually run;
- screenshots or trace fixtures where behaviour is visual or serialised; and
- one bounded next slice.

If a test is deliberately excluded from normal CI because it is large, hardware-specific or network-backed, keep an opt-in command and record the last observed result in the session handover.
