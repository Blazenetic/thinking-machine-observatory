# Session 05 handover — Phase 5 public release quality

## Outcome

The Phase 5 source candidate is frozen at `ae9f7605a9cf613695c4363faa3e5250b67673a8`. It hardens the
Observatory for a public release without widening the interpretability surface.

Implemented:

- a 78-criterion acceptance ledger and JSON schemas;
- a candidate manifest, deterministic release summary and false-pass regression tests;
- keyboard, semantic, focus, target-size, reduced-motion, forced-colour, zoom, responsive and
  offline-revisit Playwright journeys across Chromium, Firefox and WebKit;
- a production-only same-origin offline shell;
- checked contrast and production bundle budgets;
- a static CSP/security-header contract and host-neutral rollback runbook prepared for Cloudflare
  Pages;
- project rights, third-party model/runtime notices and local-first privacy wording; and
- manual review plus privacy-preserving two-minute learner-study protocols.

Hidden states, attention, logit-lens probes and semantic projections remain unavailable. No schema
1.3 output or secondary tensor capture was introduced.

## Source/evidence boundary

The source candidate contains the implementation and evidence tooling. This later evidence commit
binds the manifest to the candidate SHA and its lockfile hash. That two-commit pattern avoids a
self-referential commit hash and makes reruns reviewable.

Only `passed` satisfies a launch-blocking criterion. A missing browser, physical device,
screen-reader, deployed origin or learner session remains `blocked` or `not-run` in the generated
summary.

## Local verification

- `pnpm check` passed;
- 78/78 Vitest tests passed;
- coverage passed at 86.33% statements, 72.17% branches, 93.75% functions and 88.10% lines;
- the full-vocabulary hero trace replayed token 3223 (`" dark"`) from 50,257 logits;
- compact payload verification retained all sampler fields at 98.89% less JSON than the expanded
  representation;
- application JavaScript measured 108,752 bytes gzip, CSS 6,901 bytes gzip and the worker 922,478
  bytes uncompressed, all within the Phase 5 limits; and
- `pnpm audit --prod --audit-level high` reported no known vulnerabilities.

## Browser verification

The local harness could not install Playwright browsers because its download was returned as a
zero-byte or truncated archive, so no local browser result is claimed. The exact source candidate
subsequently passed [GitHub CI run 28](https://github.com/Blazenetic/thinking-machine-observatory/actions/runs/32737565886)
with 33 passed journeys and six declared skips across Chromium, Firefox and WebKit. The skips cover
the opt-in live-model journey in all engines, non-Chromium forced-colour emulation and WebKit offline
automation. Physical Android, real Safari, screen-reader, deployed-origin and current screenshot
checks remain separate evidence records.

## Publication follow-up

A later documentation-only follow-up adds audience-specific user and developer guides, a
documentation map, fresh-agent start and handover rules, corrected three-engine Playwright setup,
and present-tense Phase 5/evidence wording. That change did not alter the built application,
dependency lock, evidence manifest or accepted release claims.

The first published quality job exposed a shallow-checkout integration issue: `phase5:verify`
correctly asks Git for the earlier candidate, but the default checkout contained only the PR head.
The quality job now fetches full history before verifying candidate ancestry and lockfile contents.

The first real three-engine runs then exposed ambiguous Playwright locators, a non-portable CSS
`zoom` simulation, an unreliable WebKit offline-reload driver path and a real React event-lifetime
crash while typing a reflection. The final candidate uses stable control IDs, a half-width reflow
proxy, direct cached-shell verification, an absolute versioned service-worker cache key and
synchronous reflection-value capture. Run 28 passed after those repairs. The machine decision still
remains conservative because the green automated run does not establish every live, manual or
handover criterion grouped in the browser evidence record.

## Release decision

Read `release-evidence/summary.md`, not this handover, for the machine-derived decision. The candidate
must not be tagged while any launch-blocking criterion is failed, blocked or not-run.

## Next bounded evidence work

1. Split and promote only the individual browser criteria directly established by CI run 28.
2. Capture current hero-loop screenshots or a recording from the exact source candidate.
3. Deploy that candidate to the prepared static host and run the header, offline and hero-loop
   smoke.
4. Complete a named desktop screen-reader smoke and available physical Android/Safari checks.
5. Run `first-branch-v1` with up to five representative learners and repair any comprehension
   blocker before tagging.
