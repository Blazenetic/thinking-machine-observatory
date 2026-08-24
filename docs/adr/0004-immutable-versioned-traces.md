# ADR 0004 — Immutable, versioned trace records

- Status: Accepted
- Date: 24 August 2026

## Context

Counterfactual comparison is trustworthy only when an intervention cannot silently mutate its ancestor and when a selection can be reconstructed from recorded transforms and pseudo-random state.

## Decision

Use schema version `1.0.0` with strict Zod validation. Store model/tokenizer identity, candidate-universe completeness, raw and transformed candidate records, filters, intervals, PRNG state, selection mode, evidence provenance, calculation versions and lineage. Append, fork and annotate by returning new deeply frozen values.

Child traces reference the parent and fork step rather than duplicating ancestor steps.

## Consequences

- JSON import/export has an explicit compatibility boundary.
- Ancestor byte stability is testable.
- A child cannot be interpreted without resolving its ancestry once multi-step replay arrives.
- Future schema migrations must be explicit and may not silently reinterpret measurements.
