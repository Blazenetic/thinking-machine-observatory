# ADR 0004 — Immutable, versioned trace records

- Status: Accepted
- Date: 24 August 2026

## Context

Counterfactual comparison is trustworthy only when an intervention cannot silently mutate its ancestor and when a selection can be reconstructed from recorded transforms and pseudo-random state.

## Decision

Use strict Zod validation. Schema 1.1 stores model/tokenizer identity, candidate-universe completeness, raw and transformed candidate records, filters, intervals, PRNG state, selection mode, evidence provenance, calculation versions and lineage. It adds the full-logit SHA-256 and verification-profile identity needed by verified live steps. Append, fork and annotate by returning new deeply frozen values.

Import migrates valid 1.0 records to 1.1 with both new evidence fields set to `null`; it never invents verification evidence.

Child traces reference the parent and fork step rather than duplicating ancestor steps.

## Consequences

- JSON import/export has an explicit compatibility boundary.
- Ancestor byte stability is testable.
- A child cannot be interpreted without resolving its ancestry once multi-step replay arrives.
- Future schema migrations must be explicit and may not silently reinterpret measurements.
- Expanded full-vocabulary records are intentionally retained for the Phase 2 proof. Phase 3 must adopt a separately versioned compact representation before repeating them across multi-step traces.
