07 — Acceptance Criteria and Test Plan

Functional, mathematical, scientific, accessibility and release gates

# Release principle

Acceptance is evidence that the Observatory works as an instrument. Visual polish cannot compensate for fake measurements, and correct mathematics cannot compensate for an unusable or inaccessible experience.

# Launch-blocking functional criteria

* A user can load a compatible local model or immediately open a bundled verified trace.  
* A prompt is tokenised and produces a real next-token candidate field.  
* Generation can pause before sampling.  
* Temperature, top-k, top-p and seed affect the sampler according to documented rules.  
* A candidate can be suppressed or forced and the intervention remains visible in lineage.  
* A child branch does not mutate its ancestor.  
* Two compatible branches can be compared from their shared ancestor.  
* A trace exports, validates, imports and replays with the same selected tokens.  
* Every instrument and explanation exposes evidence classification.  
* Unsupported hardware receives a useful fallback rather than a dead end.

# Mathematical unit tests

| Area | Required tests |
| :---- | :---- |
| Stable softmax | Large logits do not overflow; probabilities are finite and sum to one |
| Temperature | T=1 identity; lower T sharpens; higher T flattens; invalid T rejected |
| Top-k | k=1 retains argmax; k\>=vocabulary retains all; ties follow documented stable order |
| Top-p | Boundary rule, minimum one candidate, p=1 retains all, invalid p rejected |
| Renormalisation | Survivor probabilities sum to one after every filter combination |
| Seeded draw | Known seed yields fixture sequence; interval boundaries are deterministic |
| Entropy | Known distributions match reference values; zero probabilities handled |
| Divergence | Compatible distribution inputs only; zero and identical cases handled |

# Model correctness tests

* Tokenizer IDs and decoded fragments match the pinned reference tokenizer.  
* Final logits match source-framework golden fixtures within an explicit dtype/backend tolerance.  
* Promoted hidden/attention outputs match the reference export for selected fixtures.  
* Causal masking and sequence position semantics are verified.  
* Quantised builds are evaluated separately; traces never imply numerical identity with full precision.  
* Model, tokenizer and runtime hashes are captured and displayed.

# Trace and replay tests

* Schema validation rejects missing required fields and unknown breaking versions.  
* Export/import preserves prompt IDs, sampler state, PRNG state, interventions and lineage.  
* Replay reproduces selected tokens for golden traces.  
* Branch creation uses the correct parent and fork step.  
* Ancestor content remains byte-stable after descendant changes.  
* Compatibility warnings appear for different model/tokenizer/calculation versions.  
* Migrations are explicit, tested and never silently reinterpret measurements.

# End-to-end scenarios

1. First visit: choose demonstration mode, complete Force the runner-up and save the branch.  
2. Supported desktop: download/cache model, enter prompt, pause, inspect and sample five tokens.  
3. Deterministic comparison: run greedy and seeded stochastic branches, then locate first divergence.  
4. Intervention: suppress the top candidate, verify explanation and export trace.  
5. Replay: import a known trace, replay it, fork at step three and annotate the result.  
6. Fallback: deny WebGPU, use WASM or demo trace and still complete a guided experiment.  
7. Error recovery: interrupt download/inference, recover without corrupting cached model or trace.

# Visual and interaction acceptance

* Current token, step, selected instrument and evidence class are always identifiable.  
* Candidate ranking and probability values remain legible at normal laptop size.  
* Scale changes and filtered candidates are explicit.  
* Branch lineage clearly shows the intervention point and selected comparison tips.  
* No major view is a placeholder, decorative chart or unlabelled approximation.  
* Loading, empty, unsupported, stale and error states are intentionally designed.  
* Reduced-motion mode removes nonessential animation.

# Accessibility acceptance

* Keyboard-only user can complete prompt → pause → intervene → branch → compare → save.  
* Focus order follows the instrument workflow and focus is always visible.  
* Controls expose accessible names, current values, ranges and error messages.  
* Charts have equivalent readable values or summaries.  
* Colour is never the only evidence-class, rank, branch or error cue.  
* Text and controls meet WCAG 2.2 AA contrast and target-size expectations where applicable.  
* Live updates are announced without overwhelming screen-reader users.

# Performance and resilience

| Check | Pass condition |
| :---- | :---- |
| Main thread | No sustained blocking during model execution or tensor processing |
| Capability detection | Completes before risky allocations and explains chosen mode |
| Cancellation | Model load and prediction can be cancelled safely |
| Memory lifecycle | Repeated experiments do not show unbounded tensor/session growth |
| Cache quota | Failure is handled with clear recovery and no broken notebook |
| Offline revisit | Cached model or bundled traces remain usable where deployment permits |
| Large trace | App warns, truncates optional capture or offers compressed export |

# Browser/device matrix

* Current Chromium desktop with WebGPU: full target.  
* Current Chromium without WebGPU: WASM or demo path.  
* Firefox/Safari: capability-tested support level documented from real results, not assumed.  
* Android tablet/phone: demonstration and reduced instrument modes tested.  
* Low-memory device: preflight warning and safe model-size/context limits.

# Scientific-integrity acceptance

* Attention is never labelled as causal importance.  
* Projection method and limitations are visible.  
* Probe outputs are labelled Probed and versioned.  
* Demo versus live inference is unmistakable.  
* Selection explanations reconstruct the recorded sampler process.  
* Interventions list exactly what changed and what remained fixed.  
* No user-facing copy anthropomorphises the model’s internal state.

# Release handback

Provide test results, supported-browser evidence, performance measurements, known limitations, screenshots or recordings of the hero loop, sample trace fixtures and a concise statement of which instruments are Measured, Derived, Projected, Probed or Interventional.