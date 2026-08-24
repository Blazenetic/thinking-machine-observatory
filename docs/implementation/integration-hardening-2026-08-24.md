# Phase 1–4 integration hardening handover — 2026-08-24

## Outcome

The implemented phase stack is consolidated on `main` and the integrated tree has been audited as a
whole rather than as isolated stacked diffs.

| Phase                                      | Pull request | Main merge |
| ------------------------------------------ | ------------ | ---------- |
| 1 — exact Observatory foundation           | #2           | `2583aa1`  |
| 2 — verified full-vocabulary live trace    | #3           | `d0aa4dc`  |
| 3 — multi-step branch Observatory          | #4           | `721a113`  |
| 4 — capability-gated instrument laboratory | #5           | `9edca9c`  |

Draft PR #6 remains a documentation-only Phase 5 release-evidence contract. It is based directly on
`main` and must not be described as implemented.

## Integrated audit findings repaired

- Live admission now requires the accepted DistilGPT2 vocabulary size, not a self-declared smaller
  complete universe.
- Token-specimen capability admission now checks the pinned tokenizer asset hash as well as the
  model identity.
- Worker output validates tensor shape, single-batch expectation, finite final logits and positive
  top-N requests before reporting a capture.
- Sampler interventions reject negative, duplicate and out-of-universe token IDs.
- Compact imports reject incomplete candidate universes and negative token IDs.
- File imports enforce the 32 MiB limit before calling `File.text()`.
- Portable downloads attach the anchor and defer object-URL revocation for broader browser safety.
- Trace selection invalidates a pending capture so evidence from one prefix cannot be previewed on
  another trace.
- Guided experiment disclosure state survives React re-renders.
- IndexedDB writes are serialised to prevent lost updates from overlapping saves or deletes.

Every repaired boundary has a focused regression test where the behaviour is testable outside a
browser process.

## Documentation added

- root `AGENTS.md` with repository invariants, dependency rules and verification commands;
- canonical present-tense architecture map;
- runtime, worker, generation and failure flows; and
- trace schema, replay, payload and persistence integrity documentation.

## Validation baseline

Observed before the hardening changes:

- `pnpm check` passed;
- 67/67 Vitest tests passed;
- coverage was 86.13% statements, 70.95% branches, 93.57% functions and 87.85% lines;
- all fixture, full-vocabulary replay, compact payload and Phase 4 capability gates passed; and
- the production build was 109.18 KiB app JavaScript gzip, 6.75 KiB CSS gzip and 921.77 KiB worker
  JavaScript uncompressed.

The ordinary Chromium suite could not launch locally because this harness denies Chromium's Unix
socket creation. This is an environment limitation, not a test failure claim; the exact Phase 4
head passed GitHub's quality and Chromium CI jobs before merge.

Observed after hardening:

- `pnpm check` passed with 71/71 tests;
- coverage passed at 86.33% statements, 72.17% branches, 93.75% functions and 88.10% lines;
- all fixture, live-trace, compact-payload and capability gates passed; and
- the production build remained inside the proposed Phase 5 budgets at 109.57 KiB app JavaScript
  gzip, 6.75 KiB CSS gzip and 922.47 KiB worker JavaScript uncompressed.

## Next fresh session

Implement Phase 5 from draft PR #6 after syncing it with the hardened `main`. Keep the scope on
release evidence rather than new interpretability breadth:

1. machine-checkable acceptance ledger;
2. accessibility and reduced-motion evidence;
3. Chromium, Firefox, WebKit and available physical-device results;
4. bundle, memory, cancellation, quota and offline-revisit budgets;
5. static HTTPS deployment, CSP/headers, licences and privacy confirmation; and
6. public handback evidence and first-use study.

The four secondary tensor instruments remain unavailable throughout that phase.
