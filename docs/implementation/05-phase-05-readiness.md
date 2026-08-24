# Phase 5 readiness — public release evidence

- Status: Draft implementation contract
- Depends on: merged Phases 1–4 and the integration-hardening baseline on `main`
- Target outcome: a dependable public portfolio and learning instrument whose support claims are
  backed by recorded evidence

## Readiness result

Phase 4 completes the product boundary required for release work: the instant teaching path is
coherent, the verified local path is replayable and branch-centred, optional instruments fail
honestly, and guided completion is predicate-based. Phase 5 should freeze interpretability breadth
and prove that this product is accessible, resilient, deployable and understandable.

The launch target is demo-first static HTTPS with optional verified fp32 WASM. WebGPU inspection is
experimental, and hidden-state, attention, logit-lens and semantic views remain unavailable. A
public release does not require every browser to download or run the 327.8 MB graph; it does require
every supported visitor to reach a useful experiment or a precise fallback.

## Release evidence vocabulary

| Result  | Meaning                                                              |
| ------- | -------------------------------------------------------------------- |
| passed  | Criterion met by the named method and environment                    |
| failed  | Criterion ran and did not meet its threshold                         |
| blocked | Criterion could not run because a named prerequisite was unavailable |
| not-run | No evidence was gathered                                             |

Only `passed` satisfies a launch-blocking criterion. Missing device access, unsupported APIs and
network restrictions are recorded as blocked/not-run, never silently treated as support.

Proposed [ADR 0009](../adr/0009-release-evidence-profile.md) defines the checked manifest and
release-candidate binding.

## Launch paths and support claims

| Path                       | Launch role       | Minimum public claim                                       |
| -------------------------- | ----------------- | ---------------------------------------------------------- |
| illustrative teaching path | required          | loads quickly; full branch/reflection experiment works     |
| verified fp32 WASM         | supported desktop | exact accepted profile where measured capability permits   |
| fp16 WebGPU                | experimental      | inspection-only, explicitly unverified                     |
| secondary instruments      | unavailable       | reason, method gate, zero allocation and limitation remain |

No release copy may describe the current WebGPU path as verified or imply that unavailable
instruments are coming during the session.

## Bounded work packages

### 5A — Acceptance ledger and release candidate

- map every criterion in document 07 to a stable release-evidence ID;
- classify launch-blocking versus advisory criteria with written reasons;
- create a machine-checkable manifest schema and checked example;
- bind all evidence to one release-candidate commit and dependency lock;
- include commands, environments, artefacts, measured values and limitations; and
- add a release summary generator that cannot turn blocked/not-run into pass.

Exit: the repository can answer exactly which criteria passed, failed or lack evidence for the
candidate commit.

### 5B — WCAG 2.2 AA and assistive interaction

- complete keyboard-only prompt → pause → intervene → branch → compare → reflect → save;
- verify focus order, visible focus, disclosure controls, range/select semantics and file input;
- run automated accessibility checks on welcome, workbench, live/unavailable, branch and notebook
  states;
- manually review headings, landmarks, table captions, live regions and error announcements;
- measure text/control/evidence-mark contrast and review target sizes at 200% zoom;
- test reduced motion and forced-colour/high-contrast behaviour; and
- record a screen-reader smoke with one desktop combination, naming untested combinations.

Exit: no critical/serious automated findings, every launch flow is keyboard-completable, and manual
results are attached to the candidate.

### 5C — Responsive and browser/device matrix

- automate demo and fixture-worker paths in Chromium, Firefox and WebKit where the runner supports
  them;
- exercise desktop, 1280×720, tablet and 360×800 mobile viewports;
- verify horizontal data overflow, dense table alternatives and reduced-authoring mobile mode;
- measure real fp32 WASM only on environments able to run the opt-in profile;
- record a physical Android Chrome smoke and a real Safari/macOS result if devices are available;
- state `blocked` or `not-run` for unavailable physical environments; and
- generate the public matrix from evidence rather than a hand-maintained promise.

Exit: every published browser/path cell links to a result; capability fallback reaches a useful
experiment without WebGPU.

### 5D — Performance, memory and offline resilience

- retain current bundle budgets as initial guardrails: application JavaScript ≤125 KiB gzip,
  application CSS ≤10 KiB gzip and worker JavaScript ≤1 MiB uncompressed;
- measure demo first content, interactive readiness and long tasks on a named mid-range profile;
- run ten load/predict/dispose or fixture generation cycles and investigate retained growth above
  32 MiB after settling;
- verify stop/cancel/model-switch invalidation and tensor/session disposal;
- exercise the 32 MiB import limit, quota preflight, atomic failure and parent deletion protection;
- test first visit, warm-cache revisit and offline revisit separately; and
- record model download/cold inference as optional-path measurements, not demo-path regressions.

Exit: no unbounded lifecycle growth, corrupt partial notebook state or unsupported offline claim;
budget exceptions require measured justification.

### 5E — Static deployment, security, privacy and licences

- decide the smallest static host that can supply HTTPS, required headers, immutable hashed assets
  and an explicit content-security policy;
- decide whether pinned model assets remain third-party cached or are mirrored with licence and
  integrity metadata;
- verify CSP, worker, WASM, model-fetch and download/import behaviour on the deployed origin;
- add dependency, source, model, tokenizer, font and image licence notices;
- publish privacy wording consistent with no analytics, accounts or prompt telemetry;
- review dependency audit findings and document accepted residual risk; and
- add a deployment smoke and rollback/reproducibility note without creating a backend.

Exit: the deployed candidate matches the tested commit, has an honest asset/privacy statement and
does not weaken local-first behaviour.

### 5F — Public handback and two-minute experiment

- capture current desktop and mobile screenshots plus one short hero-loop recording;
- test the first-visit Force the runner-up path with five representative learners if practical;
- record time to first branch, task completion, recovery points and the learner's explanation of
  model output versus sampler choice;
- treat confusion as product evidence and fix launch-blocking comprehension failures;
- publish measured/derived/interventional/unavailable status and known limitations; and
- prepare a concise release runbook, changelog and rollback check.

Exit: a new visitor can complete the first experiment in about two minutes and describe the manual
override without calling it hidden model intent; deviations are documented rather than discarded.

## Initial release budgets

The current production build is already inside the proposed static budgets (approximately 109 KiB
application JS gzip, 6.8 KiB CSS gzip and 922 KiB worker JavaScript before Phase 5 changes). These
are regression guardrails, not claims about load time.

| Resource/behaviour               | Initial gate                                      |
| -------------------------------- | ------------------------------------------------- |
| app JavaScript                   | ≤125 KiB gzip                                     |
| app CSS                          | ≤10 KiB gzip                                      |
| inference worker JavaScript      | ≤1 MiB uncompressed                               |
| portable import                  | existing 32 MiB pre-parse limit                   |
| secondary capture                | unavailable; zero allocation                      |
| repeated-session retained growth | investigate >32 MiB after ten settled cycles      |
| optional model                   | 327.8 MB disclosed before user-initiated download |

Timing and heap thresholds are accepted only after the measurement harness and reference device are
named. Do not invent a universal millisecond budget from CI hardware.

## Evidence matrix

| Area                | Automated evidence                             | Required manual evidence                        |
| ------------------- | ---------------------------------------------- | ----------------------------------------------- |
| exact core          | unit, coverage, fixtures, replay               | scientific copy review                          |
| accessibility       | axe-style scans, keyboard E2E, contrast script | focus/read order, screen-reader and zoom review |
| browsers            | Chromium/Firefox/WebKit fixture paths          | physical Android and Safari where available     |
| performance         | build budgets, trace limits, lifecycle harness | named-device cold/warm observations             |
| deployment/security | header/CSP/smoke checks                        | host/asset/licence decision review              |
| learning value      | task-event timings without telemetry           | consented moderated first-use sessions          |

## Release blockers

- a launch flow cannot be completed by keyboard;
- demo/live/unverified/unavailable status becomes ambiguous;
- a branch or reflection fails export/import/replay or local notebook round-trip;
- static deployment requires relaxed security that is not documented;
- a supported-path browser/device cell lacks evidence;
- demo first use triggers the 327.8 MB download without explicit action;
- a serious dependency or licence issue lacks a reviewed disposition; or
- the release summary represents blocked/not-run as passed.

## Deliberate non-goals

- schema 1.3 or a new instrumented model export;
- enabling hidden states, attention, probes or projections;
- accounts, analytics, prompt telemetry, collaboration or a backend;
- modern-model support, 3D visualisation or course-authoring infrastructure;
- universal WebGPU support; and
- a custom deployment/control plane for one static application.

## Recommended implementation order

1. 5A evidence manifest and current acceptance mapping.
2. 5B keyboard/accessibility fixes while source changes are still cheap.
3. 5C multi-browser/responsive automation and recorded gaps.
4. 5D lifecycle/offline/build budgets.
5. 5E deployed-origin security, assets and licences.
6. 5F screenshots, recording, first-use sessions and release handback.

Phase 5 is ready to begin once the release-candidate evidence format and launch-blocking criterion
classification receive review. Feature additions should wait until after the public release
evidence is complete.
