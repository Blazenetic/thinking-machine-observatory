# Local quality evidence

- Source candidate: `280734bd2bd367275bae376dec676c1b63581934`
- Environment: Node 24.19.0, pnpm 11.19.0, Linux x86_64 harness
- Observation date: 24 August 2026

## Passed commands

| Command                                | Result                                  |
| -------------------------------------- | --------------------------------------- |
| `pnpm check`                           | passed                                  |
| `pnpm test:coverage`                   | passed                                  |
| `pnpm audit --prod --audit-level high` | passed — no known vulnerabilities found |

`pnpm check` included formatting, lint, strict types, deterministic fixture checks, verified
full-vocabulary replay, compact-payload verification, Phase 3 and Phase 4 gates, Phase 5 evidence,
contrast and static-policy verification, 78 unit/integration tests, the production build and checked
bundle budgets.

## Coverage

| Metric     | Observed |
| ---------- | -------: |
| Statements |   86.33% |
| Branches   |   72.17% |
| Functions  |   93.75% |
| Lines      |   88.10% |

## Production budgets

| Asset                       |      Observed |           Limit | Result |
| --------------------------- | ------------: | --------------: | ------ |
| Application JavaScript gzip | 108,759 bytes |   128,000 bytes | passed |
| Application CSS gzip        |   6,901 bytes |    10,240 bytes | passed |
| Inference worker JavaScript | 922,478 bytes | 1,048,576 bytes | passed |

## Explicit block

The local Playwright browser installation did not run: the harness returned zero-byte or truncated
archives for the Playwright download. No local Chromium, Firefox, WebKit, offline, forced-colour or
keyboard journey is claimed. GitHub CI remains the candidate browser gate.
