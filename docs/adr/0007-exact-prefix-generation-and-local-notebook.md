# ADR 0007 — Exact-prefix generation, ancestry bundles and local notebook

- Status: Accepted
- Date: 24 August 2026

## Context

Phase 2 could commit one verified distribution. Repeating it safely requires three independent guarantees: the model must receive the exact committed token IDs rather than re-tokenised display text; an obsolete worker response must not advance a newer run; and a child/notebook record must not mutate or copy its ancestor evidence.

## Decision

Model inference accepts an optional exact `inputTokenIds` sequence. The pinned runtime constructs int64 `input_ids` and `attention_mask` tensors directly, reruns the full prefix and disposes input/output tensors after copying the final logits. Re-tokenising concatenated decoded text is not a generation primitive.

Every worker request and response carries:

- `generationId` — identity of the current run;
- monotonic `requestOrder` — identity within that run; and
- `workerEpoch` — invalidated by worker replacement/cancellation.

The pure controller accepts a capture only when all three fields match its pending request. Pause clears auto-advance before another selection; stop invalidates an in-flight result; cancel advances the worker epoch. KV-cache use is deferred until a separate exact-equivalence profile exists.

Branches are immutable trace nodes containing only divergent local steps plus `{ traceId, forkStep }` ancestry. Effective history resolution rejects missing/cyclic parents and incompatible identities. A portable schema 1.2 file is a bundle containing the selected trace, all required ancestors and every referenced payload once.

IndexedDB uses `traces`, `payloads` and `metadata` stores. A save replaces those stores in one read-write transaction after append-only and quota checks. Payload records carry reference counts. Deleting a parent with descendants is prevented; deleting a leaf decrements references and removes unreferenced bytes.

## Consequences

- Generation follows the recorded token sequence even where decode/re-tokenise would merge boundaries.
- Correctness initially costs full-prefix inference; throughput claims remain conservative.
- Stale work may finish inside a worker, but it cannot commit or start a successor request.
- Portable child files are self-contained without flattening lineage.
- Notebook writes are recoverable and deduplicated, while cross-device synchronisation and accounts remain out of scope.
