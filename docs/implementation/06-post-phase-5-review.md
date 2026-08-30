# Post-Phase-5 engineering review

Review of source candidate `ae9f7605a9cf613695c4363faa3e5250b67673a8`. Evidence and
documentation on this follow-up commit do not change the built application. The candidate remains
**NOT READY**.

This is a quality and confidence review, not a feature sprint. App, package, fixture and browser
suite files were left frozen so GitHub CI [run 28](https://github.com/Blazenetic/thinking-machine-observatory/actions/runs/32737565886)
stays a valid browser artefact.

## Scope

| Focus                        | Method                                                                  |
| ---------------------------- | ----------------------------------------------------------------------- |
| Evidence integrity           | Ledger, manifest, verifier, CI artefacts and the 78 TMO criteria        |
| Determinism and replay       | Sampler, compact 1.2, legacy 1.1 replay, live admission, golden vectors |
| Offline, keyboard, a11y, e2e | Service worker, Playwright specs, CSS focus rules, control naming       |
| Architecture vs dependencies | Workspace `package.json` files versus architecture diagrams             |
| Documentation consistency    | README, guides, AGENTS, architecture, handover, manual ledger           |
| Bundle, CSP, static release  | `_headers`, `verify-static-release`, Vite preview, budgets              |

## Verdict

The scientific core is strong. Exact-core gates, compact replay, capability admission and the
release-evidence _machinery_ do what they claim. The remaining launch decision was being held down
in part by an evidence-grouping defect: 29 unlike criteria sat in one `blocked` record even after
run 28 established a subset of the illustrative path.

This follow-up splits that record conservatively, tightens the verifier so a later commit cannot
quietly mutate the frozen app, and records the defects that still require a new source candidate.

| Metric          | Bound Phase 5 evidence commit | This follow-up |
| --------------- | ----------------------------: | -------------: |
| Passed          |                            38 |             51 |
| Failed          |                             0 |              0 |
| Blocked         |                            29 |             16 |
| Not run         |                            11 |             11 |
| Launch blockers |                            35 |             22 |
| Decision        |                     NOT READY |      NOT READY |

Only `passed` counts. Thirteen illustrative or exact-core criteria moved from `blocked` to
`passed` because existing tests already established them. Sixteen blocked and eleven not-run
criteria were left unresolved on purpose.

## Verified strengths

1. **Evidence classes stay distinct.** Teaching logits are authored, WASM logits are measured, WebGPU
   is inspection-only, int8 is rejected, secondary tensors are unavailable. Admission in
   [`apps/observatory/src/data/live.ts`](../../apps/observatory/src/data/live.ts) refuses
   self-declared `verified` captures that miss the pinned identities.
2. **Sampler is pure and serialisable.** xoshiro128\*\*, stable softmax, temperature / top-k / top-p,
   force and suppress all live in [`packages/sampler/src/index.ts`](../../packages/sampler/src/index.ts)
   with no UI or ONNX import.
3. **Compact 1.2 replay is the honest live path.** Payloads are canonical float32-le bytes addressed
   by SHA-256. Compact replay feeds the recorded `prngStateBefore` into `runSampler`
   ([`packages/trace-schema/src/compact.ts`](../../packages/trace-schema/src/compact.ts) around the
   `replayCompactGenerationStep` call). Token-prefix continuity is enforced on append and validate.
4. **Exact-core hero vector is pinned.** `pnpm trace:verify:live` now also asserts selected token
   `3223` / `" dark"` rather than only logging it. The 50,257-logit fixture hash is checked against
   the accepted WASM report.
5. **Worker replies are identity-gated.** Generation ID, request order and worker epoch must match
   ([`packages/inference-worker/src/generation-controller.ts`](../../packages/inference-worker/src/generation-controller.ts)).
6. **Release machinery cannot count blocked as passed.** `summariseRelease` treats only `passed` as
   success. Duplicate criterion coverage is rejected. Passing measurements that miss thresholds are
   rejected. The generated [`release-evidence/summary.md`](../../release-evidence/summary.md) is
   compared byte-for-byte with a fresh render.
7. **CI run 28 is a real three-engine artefact.** 33 passed journeys, six declared skips, Playwright
   1.62.1, Chromium / Firefox / WebKit. Skips are named: live-model in all engines, forced-colour
   outside Chromium, WebKit offline automation.
8. **Static-release policy is checked from source.** CSP, COOP, Permissions-Policy, referrer, nosniff,
   hashed-asset immutability and service-worker no-store fragments are required by
   [`scripts/verify-static-release.ts`](../../scripts/verify-static-release.ts). Bundle budgets
   passed on the candidate (JS gzip 108,752; CSS gzip 6,901; worker 922,478).
9. **Dependency direction is mostly honest.** `domain` has no runtime deps. `instruments` and
   `experiments` depend only on `domain` at runtime. `onnxruntime-web` is a _devDependency_ of
   `inference-worker` (golden path), not a production bundle import.

## Concrete defects and risks

### Evidence integrity

**Grouping hole (fixed here).** [`EV-LOCAL-BROWSER-BLOCKED`](../../release-evidence/manifest.json)
previously covered 29 criteria, including journeys run 28 actually asserted (hero loop, named
controls, table captions, reduced motion, 24px targets, Chromium/Firefox cached shell, interrupted
fixture load) and journeys it did not (live DistilGPT2, WebGPU-denied fallback, current screenshots,
complete tab order). One blocked record is valid negative evidence; it is not a way to hide a green
run. It also is not a way to promote criteria the run did not establish.

**Pass/limitation contradiction (fixed here).** A `passed` record could previously say the work
“remains blocked”. The verifier now rejects that phrasing.

**Source-candidate drift (fixed here).** `phase5:verify` checked that the named SHA existed and that
the lockfile hash matched, but a later commit could still edit `apps/` or `packages/` without
rebinding. The verifier now requires the candidate to be an ancestor of `HEAD` and forbids drift on
`SOURCE_CANDIDATE_PATHS`.

**TMO-FUNC-001 wording.** The criterion asks for “a bundled _verified_ trace”. The promoted evidence
is the _illustrative_ teaching fixture opening immediately. That matches the user outcome and ADR
0002, but not the word “verified”. Owner decision: reword the criterion, or keep it blocked until a
bundled verified compact fixture ships.

**TMO-FUNC-003 placement.** Pause-before-sampling is a generation-controller unit invariant, not a
browser observation. Moving it onto `EV-LOCAL-EXACT-CORE` is more honest than leaving it inside the
browser blob.

### Determinism and replay

These stay in frozen packages. They are next-candidate work, not silent patches.

1. **Schema 1.1 `replayGenerationStep` ignores the recorded PRNG cursor.**
   [`packages/trace-schema/src/index.ts`](../../packages/trace-schema/src/index.ts) calls
   `runSampler(candidates, config, interventions)` with no fourth argument, so every expanded step
   reseeds from `config.seed`. Compact 1.2 replay _does_ pass `prngStateBefore`.
   `parsePortableTraceJson` requires this seed-based replay to succeed before 1.0/1.1 migration.
   Consequence: multi-step 1.1 traces that continued a cursor cannot import through the portable
   path, even when compact conversion itself knows how to read `selection.draw.stateBefore`. This is
   a false-fail / missing-migration hole, not a silent wrong-token pass: a continued-cursor 1.1
   record would fail canonical comparison against a seed replay.
2. **Compact validation does not chain PRNG cursors across steps.** Token-prefix continuity is
   checked ([`validateCompactTraceBundle`](../../packages/trace-schema/src/compact.ts)). Consecutive
   `prngStateAfter` → next `prngStateBefore` is not, unless the step itself recorded a seed reset.
   A well-behaved UI passes the cursor; a crafted bundle could start each step from an unrelated
   legal cursor and still validate.
3. **Expanded live admission trusts `logitsSha256`.**
   [`assertAcceptedCapture`](../../apps/observatory/src/data/live.ts) checks identities and
   vocabulary size but does not hash `capture.logits`. Compact create _does_ compare
   `inference.logitsSha256` to the canonical payload hash when a hash is supplied. The production
   compact path is therefore stricter than the 1.1 `createLiveTrace` helper used by the verifier.
4. **Browser runtime and golden runtime are different programs.** The worker loads
   `@huggingface/transformers` ([`packages/inference-worker/src/index.ts`](../../packages/inference-worker/src/index.ts)).
   `verify-golden.mjs` runs `onnxruntime-web` directly plus the Transformers.js tokenizer. The
   identity string claims both. Accepted numerical evidence is the WASM report, not the string. A
   future Transformers.js bump can change the bundled ORT without `package.json` showing it as a
   production dependency.
5. **Locale-dependent labels.** Display strings used `toLocaleString()` (now removed from the live
   verifier script). Frozen UI copy such as `Complete 10-candidate teaching universe` is authored
   and stable.

### Offline, keyboard, accessibility, Playwright

Frozen app defects; documented, not patched.

1. **Navigation is cache-first, not network-first.**
   [`apps/observatory/public/service-worker.js`](../../apps/observatory/public/service-worker.js)
   answers `navigate` with `caches.match(APP_SHELL_URL)` then fetch. Architecture previously said
   the opposite. A stale shell can survive a deploy until `CACHE_NAME` (`observatory-shell-v4`)
   changes and the worker updates.
2. **`registerOfflineShell` does not set `updateViaCache: 'none'`.** Combined with Vite preview
   ignoring `_headers`, local preview can serve a cached worker even though Cloudflare is told
   `no-store` for `/service-worker.js`.
3. **Offline Playwright never reloads.**
   [`tests/e2e/release-quality.spec.ts`](../../tests/e2e/release-quality.spec.ts) proves
   `caches.match('/')`, `fetch('/')` while `context.setOffline(true)`, and an in-session
   runner-up branch. It does not `page.reload()` under offline. TMO-RES-006 is therefore passed
   only as a cached-shell + in-session branch, with that limitation on the record. WebKit is
   skipped.
4. **Skip target has no focus ring.** `#observation-floor` is `tabIndex={-1}`. Focus outlines are
   limited to `button/input/textarea/summary/a:focus-visible` in
   [`apps/observatory/src/styles.css`](../../apps/observatory/src/styles.css). Keyboard skip lands
   on an unoutlined section.
5. **Row Force/Suppress names collide.** Spectrometer buttons expose accessible names `Force` /
   `Suppress` without the token ([`ProbabilitySpectrometer.tsx`](../../apps/observatory/src/components/ProbabilitySpectrometer.tsx)).
   The parent `article` is labelled; the controls are not unique. Playwright already has to use
   `.first()`.
6. **`role="listitem"` on a `button`.**
   [`LiveModelPanel.tsx`](../../apps/observatory/src/components/LiveModelPanel.tsx) trace tips are
   buttons inside `role="list"`. That is an invalid ARIA pairing.
7. **Keyboard activation ≠ keyboard workflow.** The release-quality spec focuses named controls and
   presses Enter. It does not tab through prompt → pause → intervene → branch → compare → save.
   TMO-A11Y-001 and TMO-A11Y-002 stay blocked.
8. **Fixture worker is not DistilGPT2.** [`tests/e2e/phase-3.spec.ts`](../../tests/e2e/phase-3.spec.ts)
   installs a synthetic 50,257-logit worker. Useful for protocol and compact round-trip. It must
   not, and does not, promote TMO-E2E-002 or TMO-FUNC-002.

### Architecture versus dependency graph

| Claim in docs                                          | Actual                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App → views → domain; trace → sampler → domain         | App also depends on `sampler`, `instruments`, `experiments`, `inference-worker`, `trace-schema` and `domain` directly ([`apps/observatory/package.json`](../../apps/observatory/package.json)). `demo.ts` and `live.ts` call `runSampler`. Allowed by the public-API rule; the old mermaid omitted it. |
| Instruments and experiments lumped as “Views”          | Separate packages, both domain-only at runtime. `instruments` uses `sampler` only as a test `devDependency`.                                                                                                                                                                                           |
| Worker runtime is Transformers.js + ORT                | Production import is Transformers.js. ORT is the golden/Node `devDependency`.                                                                                                                                                                                                                          |
| Source candidate freezes “policy and evidence tooling” | Two-commit pattern allows `scripts/`, `docs/` and `release-evidence/` to follow. Freeze set is now explicit in code.                                                                                                                                                                                   |

No illegal reverse import (core → React/Vite/ONNX) was found.

### Documentation consistency

1. User guide steps 3–4 told learners to **Force runner-up branch** and then **Commit branch 1**.
   `forceRunnerUp` already commits ([`App.tsx`](../../apps/observatory/src/App.tsx)).
2. [`github-ci-browser.md`](../../release-evidence/reports/github-ci-browser.md) still described the
   grouped browser record as blocked after run 28.
3. Manual review listed keyboard workflow and dependency audit as `not-run` even though CI keyboard
   activation and `pnpm audit --prod --audit-level high` exist. Audit is candidate-bound passed
   evidence; complete keyboard tab-order is not.
4. README “next slice” still said “freeze the Phase 5 source candidate”. That freeze already
   happened.
5. Architecture release-boundary described network-first navigation.

### Bundle, CSP, static release

1. **`_headers` is a Cloudflare Pages contract, not a Vite contract.**
   [`apps/observatory/vite.config.ts`](../../apps/observatory/vite.config.ts) does not emit those
   headers on `vite preview`. `verify-static-release` reads the source file. Deployed-origin smoke
   remains not-run (TMO-HAND-007’s cousin: the policy file passed; the live URL did not).
2. **CSP allows `'unsafe-inline'` styles** for probability-bar widths. Scripts stay `'self'` plus
   `'wasm-unsafe-eval'`. That is declared, not accidental.
3. **`connect-src` permits Hugging Face.** Required for the model path. The service worker correctly
   does not intercept those requests.
4. Budgets have headroom. No evidence they were gamed. This sandbox rebuilt the unchanged app and
   observed application-JS gzip **108,783** bytes versus the candidate-bound **108,752**. CSS gzip
   (6,901) and worker bytes (922,478) matched. The 31-byte gzip delta is treated as a harness zlib
   difference, not a source change; `release-evidence/reports/bundle-budget.json` was not rewritten.

## Fixes implemented in this change

Frozen paths (`apps/`, `packages/`, `fixtures/`, `tests/`, lockfile, Playwright/Vitest configs)
were not modified.

| Change                                                                             | Why                                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Split CI Playwright evidence into illustrative / offline-shell / interrupt records | Promote only what run 28 asserted                                                    |
| Keep 16 criteria blocked with a precise leftover record                            | Do not hide live-model, visual-inspection, tab-order, screenshot, WebGPU-denied gaps |
| Move TMO-FUNC-003 onto exact-core                                                  | Pause-before-selection is a unit invariant                                           |
| Require `$schema`, `operatingSystem`, `deviceClass`                                | Match the JSON Schema the file already declared                                      |
| Reject passed limitations that still say “remains blocked”                         | Stop contradictory records                                                           |
| Ancestor + `SOURCE_CANDIDATE_PATHS` drift check                                    | Two-commit pattern becomes mechanical                                                |
| Assert hero token 3223 / `" dark"` in `trace:verify:live`                          | Gate the pinned selection, do not only print it                                      |
| Locale-stable live-verifier label                                                  | Avoid `toLocaleString()` in a checked script                                         |
| Architecture, user-guide, README, AGENTS, manual ledger, CI browser report         | Match the code and the split evidence                                                |
| This review                                                                        | Owner-decision log                                                                   |

## Remaining owner decisions

### Do not tag this candidate

22 launch-blocking criteria are still unresolved. A useful public demo is not the same thing as a
launch-ready support statement.

### Evidence still required (no app change)

| Item                                              | Criteria                         | Prerequisite                                             |
| ------------------------------------------------- | -------------------------------- | -------------------------------------------------------- |
| Opt-in live DistilGPT2 journey                    | TMO-E2E-002, TMO-FUNC-002        | `RUN_LIVE_MODEL=1`, ~328 MB, named machine               |
| Current hero screenshots / recording              | TMO-HAND-005                     | Exact candidate URL or local production build            |
| Deployed-origin header + offline + hero smoke     | related HAND / RES               | Cloudflare (or equivalent) URL                           |
| Named desktop screen-reader smoke                 | TMO-A11Y-007                     | VoiceOver / NVDA / ORCA + notes, no prompt telemetry     |
| Physical Android / real Safari                    | TMO-BROWSER-003, TMO-BROWSER-004 | Devices                                                  |
| WebGPU-denied fallback as its own cell            | TMO-E2E-006, TMO-BROWSER-002     | Chromium launch flag or permission deny                  |
| Import known live trace, fork at step 3, annotate | TMO-E2E-005                      | Verified compact fixture, not the Playwright fake worker |
| Named-device long-task and ten-cycle heap         | TMO-RES-001, TMO-RES-004         | Measurement protocol                                     |
| Learner study `first-branch-v1`                   | HAND / product                   | Consent protocol already written                         |
| Reword or re-block TMO-FUNC-001                   | TMO-FUNC-001                     | Criterion text vs teaching fixture                       |

### Next source candidate (app / package / test changes)

Do these together, then rebind and re-run browsers. Mixing them into this evidence commit would
invalidate run 28.

1. Pass `prngStateBefore` into schema 1.1 `replayGenerationStep`, or stop advertising 1.1 as a
   multi-step replay format.
2. Enforce compact PRNG cursor chaining unless `seedReset` is set.
3. Hash `capture.logits` inside `assertAcceptedCapture`.
4. Navigation: network-first with cache fallback, and `updateViaCache: 'none'`.
5. Offline Playwright: `page.reload()` under `setOffline(true)` on Chromium/Firefox; keep WebKit
   skipped until the driver is honest.
6. Unique Force/Suppress accessible names; drop `role="listitem"` from buttons; outline the skip
   target.
7. Keyboard tab-order journey that does not `.focus()` mid-flow.
8. Decide whether Transformers.js’s bundled ORT must be pinned in production `package.json` or
   whether the golden Node path remains a separate, named method.
9. Optional: serve `_headers` in Vite preview so local static smoke matches Cloudflare.

### Out of scope until a new evidence profile

Hidden states, attention, logit-lens, semantic projection, schema 1.3, WebGPU-as-verified, int8.

## Handover

- Branch: `review/post-phase-5-evidence-integrity`
- Source candidate: `ae9f7605a9cf613695c4363faa3e5250b67673a8` (unchanged)
- Previous evidence commit: `ec71872` / merge `307ecb3`
- Browser artefact: CI run 28, Playwright 1.62.1, 33 passed / 6 skipped
- This change: evidence, verifier, documentation only
- Decision: **NOT READY** (51 passed, 0 failed, 16 blocked, 11 not-run, 22 launch blockers)
