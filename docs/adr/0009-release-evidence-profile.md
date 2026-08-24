# ADR 0009 — Public release evidence profile

- Status: Accepted
- Date: 24 August 2026

## Context

The Observatory already has strong mathematical and deterministic replay gates, but a public
release also makes claims about accessibility, browser support, resilience, privacy, asset
licensing and first-use comprehension. A green Chromium CI run cannot establish all of those
claims. Conversely, an unavailable physical device or optional model path must not be disguised as
a pass.

Release evidence needs the same provenance discipline as model evidence: named environment,
method, result, artefact and limitation. The release should remain static and local-first; this
process must not become a bespoke deployment platform.

## Decision

Create one checked release-evidence manifest tied to the release-candidate commit. Each criterion
records:

- stable criterion ID and acceptance-document reference;
- severity: `launch-blocking`, `advisory` or `not-applicable` with reason;
- result: `passed`, `failed`, `blocked` or `not-run`;
- automated or manual method and exact command/protocol version;
- browser, browser version, operating system, device class and relevant capabilities;
- measured values and declared thresholds where quantitative;
- paths or URLs for reports, screenshots, recordings and trace fixtures; and
- limitation, reviewer and observation date.

Only `passed` satisfies a launch-blocking criterion. `Blocked` and `not-run` remain useful negative
evidence but cannot be collapsed into pass. Automated evidence is regenerated from the exact
release candidate; manual evidence identifies its environment and may be carried forward only when
the affected source, dependency and deployment inputs are unchanged.

The manifest separates support by path:

1. instant illustrative teaching path;
2. verified fp32 WASM path;
3. experimental WebGPU inspection path; and
4. explicitly unavailable secondary instruments.

The public support matrix states only measured results. WebGPU is not a launch requirement because
the verified WASM and instant demo paths carry the product's core learning loop.

User-study notes contain no prompt telemetry and no unnecessary personal data. Consent, participant
code and synthesised observations are recorded separately from any raw recording. Deployment stays
static HTTPS unless a launch-blocking requirement proves a minimal service is necessary.

## Consequences

- The release decision becomes reviewable rather than a collection of optimistic checklist marks.
- Browser/device gaps remain visible and can narrow the support statement without blocking a useful
  demo-first release.
- Phase 5 adds test fixtures, measurement scripts and documentation, not new interpretability
  breadth.
- The repository gains some evidence maintenance, but avoids a dashboard, account system or custom
  release platform.
- A release tag is blocked by any failed, blocked or not-run launch criterion unless the criterion
  is explicitly reclassified with a reviewed reason.
