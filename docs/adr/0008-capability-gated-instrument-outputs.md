# ADR 0008 — Capability-gated secondary instrument outputs

- Status: Accepted
- Date: 24 August 2026

## Context

The accepted DistilGPT2 fp32 WASM profile verifies tokenizer output and final-position logits. The current graph does not expose verified hidden states or attention. Final logits cannot reconstruct those tensors, and an attractive visualisation is not evidence that an output is meaningful.

Phase 4 also introduces derived bytes, probes and projections whose provenance differs from direct model output. A single “live” badge would collapse those distinctions and encourage stronger claims than the implementation supports.

## Proposed decision

Add a typed, session-scoped capability declaration at the worker boundary. Each secondary instrument capability reports an explicit status, evidence class, verification profile, method version, limits and human-readable reason. The UI renders from this declaration and has a designed unavailable state; it does not infer support from model ID, device or tensor names.

A model-dependent capability becomes verified only when:

1. model, tokenizer, graph, exporter and runtime identities/hashes are pinned;
2. the candidate graph preserves the already accepted final logits within the named backend tolerance;
3. source-framework fixtures identify exact output axes, shapes and positions;
4. browser/runtime values pass dtype-appropriate comparisons;
5. capture and import limits are enforced before allocation; and
6. an accepted report is checked in beside any rejection evidence.

Measured coordinates remain separate from derived summaries. Logit-lens output is labelled Probed and records its normalisation/unembedding method. Two-dimensional layouts are labelled Projected and record method, seed and fit set. Token fragment UTF-8 bytes are Derived and are not described as original prompt byte offsets or tokenizer-internal merge bytes.

Optional captured tensors use typed content-addressed payloads only after a schema-version decision. Current-step transient inspection is the default; persistence is opt-in and bounded.

## Consequences

- Phase 4 can ship the token specimen bench and honest unavailable states before a new model export is accepted.
- Model switching cannot leave stale instrument support visible.
- Rejected exporters remain useful evidence and do not block the verified Phase 3 generation path.
- Instrument code must handle unavailable/unverified states as ordinary product states.
- Additional graph assets and tensors are admitted one capability at a time, making size and memory costs reviewable.
- The Observatory gains less visual breadth initially, but every enabled view has an auditable scientific meaning.

## Phase 4 resolution

The first accepted registry declares five session capabilities. Token specimens are verified under
`distilgpt2-tokenizer-specimens-v1`; hidden states, attention, logit lens and semantic projection
are unavailable and carry a zero-byte allocation limit. Model reload begins by clearing the prior
registry, and the worker supplies the replacement declaration only after the new session is ready.

The first candidate secondary-output profile is bounded to two layers, two heads, sixteen token
positions and 1 MiB before allocation. If a future export passes the independent gate, persisted
secondary tensors require schema 1.3; schema 1.2 is not widened implicitly. Logit-lens and semantic
vector definitions remain deliberately deferred.
