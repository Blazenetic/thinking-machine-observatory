# Developer guide

The Observatory is a pnpm monorepo with a pure exact core and a thin browser orchestration layer.
The main engineering rule is simple: UI and runtime adapters consume scientific truth; they do not
invent it.

## First checkout

Use Node 24 and pnpm 11 as pinned by the repository.

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm check
pnpm test:coverage
pnpm e2e
```

If a browser or model asset cannot be installed, record the exact prerequisite failure. Do not
remove the project from the gate or claim the affected check passed.

## Route a change

| Change                                      | Start in                      | Verify with                                       |
| ------------------------------------------- | ----------------------------- | ------------------------------------------------- |
| evidence vocabulary or shared types         | `packages/domain`             | `pnpm typecheck && pnpm test`                     |
| sampler, probability or seeded selection    | `packages/sampler`            | focused Vitest, then `pnpm check`                 |
| schema, replay, compact payload or notebook | `packages/trace-schema`       | `pnpm payload:verify && pnpm test:coverage`       |
| instrument comparison/view model            | `packages/instruments`        | `pnpm phase4:verify`                              |
| experiment protocol or predicate            | `packages/experiments`        | `pnpm phase4:verify`                              |
| model identity, capability or worker flow   | `packages/inference-worker`   | fixtures, model evidence and focused worker tests |
| interaction, accessibility or layout        | `apps/observatory`            | unit tests plus relevant Playwright projects      |
| acceptance or deployment evidence           | `release-evidence`, `scripts` | `pnpm phase5:verify` and, after build, budgets    |

Do not reach across workspaces with relative imports. Add vocabulary to `domain`, calculations to
a pure package and runtime wiring behind the relevant public package API.

## Gate ladder

Use fast focused tests while iterating, then expand deliberately:

```bash
pnpm phase4:verify
pnpm phase5:verify
pnpm check
pnpm test:coverage
pnpm exec playwright test --project=chromium
pnpm e2e
```

`pnpm check` already runs formatting, lint, strict types, fixture hashes, live-trace replay, compact
payload verification, Phase 3–5 focused gates, all Vitest tests, the production build and bundle
budgets. Coverage and multi-browser Playwright remain separate so their results stay visible.

The 327.8 MB network-backed live-model smoke is opt-in:

```bash
RUN_LIVE_MODEL=1 pnpm exec playwright test tests/e2e/live-model.spec.ts
```

Run `pnpm model:verify` only when the pinned ONNX assets are available. A dependency update or model
name match is not fresh numerical evidence.

## Release-evidence workflow

Phase 5 separates the frozen source candidate from its later evidence commit. The manifest names
the source SHA and lockfile hash; this avoids asking a commit to contain its own hash. A later
documentation-only commit may follow without rebinding when it does not change the built app,
public support claims or accepted evidence artefacts.

When application behaviour, dependencies, generated assets or release claims change:

1. freeze a new source candidate;
2. run the local exact-core, coverage, build, audit and relevant browser gates;
3. update candidate-bound records with observed results only;
4. regenerate `release-evidence/summary.md` through `pnpm phase5:verify`; and
5. attach CI, deployment and manual artefacts to the exact candidate before tagging.

Only `passed` satisfies a launch-blocking criterion. A missing browser, physical device,
screen-reader, deployment or learner session stays `blocked` or `not-run`.

Any CI job that runs `pnpm phase5:verify` must fetch the manifest's source-candidate commit. The
default one-commit `actions/checkout` depth is insufficient once evidence and documentation commits
follow the candidate; use full history or fetch the named candidate explicitly.

## Documentation and handover

- Update `docs/user-guide.md` when a control, label, local-storage or privacy behaviour changes.
- Update `docs/architecture/README.md` in the same change as a package or integrity boundary.
- Add or supersede an ADR for a durable decision; do not rewrite accepted history silently.
- Update the current implementation handover with exact commands, measurements and limitations.
- Leave the branch, source-candidate SHA, evidence commit and worktree state unambiguous for the
  next developer or agent.

See [CONTRIBUTING](../CONTRIBUTING.md) for pull-request expectations and [AGENTS](../AGENTS.md) for
the non-negotiable scientific and replay invariants.
