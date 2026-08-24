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

Install Playwright's browser once with `pnpm exec playwright install chromium`. The network-backed local-model smoke is opt-in; see the README.

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

## Pull requests

Keep commits reviewable and use conventional prefixes such as `feat:`, `fix:`, `test:`, `docs:` and `chore:`. Complete the PR template with:

- the user-visible outcome;
- the evidence class and scientific boundary;
- commands actually run;
- screenshots or trace fixtures where behaviour is visual or serialised; and
- one bounded next slice.

If a test is deliberately excluded from normal CI because it is large, hardware-specific or network-backed, keep an opt-in command and record the last observed result in the session handover.
