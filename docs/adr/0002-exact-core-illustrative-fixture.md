# ADR 0002 — Exact core with an explicitly illustrative fixture

- Status: Accepted for Phase 1
- Date: 24 August 2026

## Context

The sampler and branch workflow can be implemented and verified before a browser model export passes golden-logit comparison. Presenting authored values as model measurements would breach the project’s scientific-integrity rules; waiting for every model risk would delay a useful vertical slice.

## Decision

Ship a complete ten-candidate teaching universe labelled `illustrative-demo`. Apply the production sampler, trace and comparison code to it. Keep model identity, runtime status and evidence class visible. Do not describe fixture logits or token boundaries as measured.

## Consequences

- Users can learn and test the entire intervention workflow immediately.
- Sampler and lineage engineering can progress independently of model assets.
- The default experience is not yet the final live-model claim.
- Phase 2 must replace—not relabel—the fixture with golden-verified captured data where live inference is presented.
