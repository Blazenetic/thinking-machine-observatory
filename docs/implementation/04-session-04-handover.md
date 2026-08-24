# Session 04 handover — capability-gated instruments

Status date: 24 August 2026

## Outcome

Phase 4 is implemented as an honest instrument release. The verified tokenizer now powers a deep
token specimen bench; the current graph's absent intermediate outputs are first-class unavailable
states; and the guided laboratory evaluates trace evidence instead of awarding completion for
clicks.

The Phase 3 sampler, exact-prefix generation, compact schema and branch semantics are unchanged.
No hidden state, attention matrix, probe distribution or semantic vector was inferred from final
logits.

## Implemented slices

### Token specimen bench

- synchronises prompt, committed generation and pending selection specimens to the active trace;
- preserves exact position, token ID and decoded fragment;
- makes spaces, tabs, line breaks, controls, Unicode and replacement characters visible;
- derives UTF-8 bytes with `decoded-fragment-utf8-v1` and displays hexadecimal, decimal and code
  point forms;
- states that fragment bytes are not original prompt offsets or tokenizer merge symbols; and
- provides a keyboard-readable table plus tab-separated copyable alternative.

Prompt records retain their checked byte arrays through schema 1.2 export/import. The bench derives
the displayed bytes again and can identify a mismatch instead of treating a stored array as a new
measurement.

### Session capability registry

The worker returns five declarations after model load. The hook clears the old registry before a
model switch so stale support cannot survive:

| Capability          | Status      | Evidence                              | Allocation                     |
| ------------------- | ----------- | ------------------------------------- | ------------------------------ |
| token specimens     | verified    | Measured IDs/fragments; Derived bytes | 128 tokens, 256 bytes/fragment |
| hidden states       | unavailable | Measured if admitted                  | 0 bytes                        |
| attention           | unavailable | Measured if admitted                  | 0 bytes                        |
| logit lens          | unavailable | Probed if admitted                    | 0 bytes                        |
| semantic projection | unavailable | Projected if admitted                 | 0 bytes                        |

Each unavailable card includes its profile, method, limits, reason and adjacent scientific
limitation. Loading the accepted logits graph does not silently promote any secondary instrument.

### Feasibility and schema decisions

[`instrument-capability-report.json`](../../model-tools/verification/instrument-capability-report.json)
records the current adapter output inventory, accepted final-logit profile and rejected secondary
admission. A future candidate profile may retain at most two layers, two heads, sixteen token
positions and 1 MiB, with shape multiplication checked before allocation.

Schema 1.2 remains the exact logits/ancestry format. Persisted secondary tensors require an explicit
schema 1.3 design and migration. The first logit-lens normalisation/unembedding definition and the
semantic vector source are deferred rather than unnamed.

### Guided laboratory and reflections

- all eight experiments are protocol version 1;
- predicates consume trace and capability facts and return `observed`, `pending` or `blocked`;
- the attention and probe experiments remain useful blocked protocols while their outputs are
  unavailable;
- saving text never changes predicate completion;
- reflection notes include experiment ID, version and measured status; and
- compact annotations append immutably, round-trip through ancestry export and are covered by the
  notebook's existing no-removal/no-mutation rule.

## Verification

Ordinary gates:

```bash
pnpm phase4:verify
pnpm check
pnpm test:coverage
pnpm e2e
```

The checked capability verifier requires logits to remain the sole accepted graph output, one
verified token profile, four unavailable zero-allocation declarations, the fixed candidate budget
and the schema 1.3 decision.

Local unit, formatting, lint, strict type and production build gates pass. This sandbox did not
contain a Playwright Chromium executable and did not permit downloading one, so no local browser
result is claimed; the GitHub Chromium job is the authoritative browser gate for this commit.

Local evidence before publication:

- 67/67 unit and integration tests;
- 86.13% statements, 70.95% branches, 93.57% functions and 87.85% lines;
- deterministic trace fixtures, full-vocabulary live replay, compact payload and capability report
  checks pass; and
- the production Vite build succeeds.

## Deliberately deferred

- purpose-built hidden-state or attention ONNX export;
- source/runtime secondary-output golden fixtures;
- logit-lens and semantic vector method selection;
- schema 1.3 tensor payload records; and
- all release-surface work assigned to Phase 5.

## Next session

Prepare Phase 5 around release evidence rather than additional interpretability breadth. Preserve
the capability gates, run accessibility and browser/device measurements, test memory/offline
lifecycle, make the deployment and asset-hosting decision, complete public licensing/limitations
and validate the two-minute first experiment with recorded evidence.
