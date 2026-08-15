10 — Build Handover and Decision Log

Implementation sequence, current decisions, risks and handback expectations

# Purpose

This document hands the package to an implementation agent and records the current boundary between established direction, recommendations and open questions. It should be updated after each major build session.

# Agent operating instructions

* Read the entire package before coding.  
* Inspect the actual runtime and repository; do not assume a library can expose hidden states or attention.  
* Start with a vertical feasibility spike and preserve evidence.  
* Make low-risk decisions autonomously and record material trade-offs.  
* Do not stop at planning: implement, test, run and visually inspect the application.  
* When blocked, deliver the strongest coherent working subset and document the exact blocker and next experiment.  
* Never fabricate a measurement to complete a visual panel.

# First three build sessions

| Session | Primary outcome | Handback evidence |
| :---- | :---- | :---- |
| 1 — Instrument spike | Pinned tokenizer/model produces verified logits and at least one instrumented output in-browser | Golden comparison, timing, memory and compatibility notes |
| 2 — Hero vertical slice | Prompt → pre-selection pause → exact sampler → token → saved trace | Working UI, sampler tests and replay fixture |
| 3 — Branch chamber | Force or suppress candidate, create child, run both, compare first divergence | E2E test, trace lineage and recorded demonstration |

# Established project direction

* Personal public-facing learning and portfolio project.  
* Interactive laboratory rather than passive diagram.  
* Intervention and branching are the defining interaction.  
* Local-first inference and trace storage.  
* Scientific integrity and provenance must be visible.  
* No mandatory backend or account for the first build.  
* Observatory visual identity should be distinctive, restrained and functional.

# Recommended decisions

| Decision | Recommendation | Reason |
| :---- | :---- | :---- |
| Initial model | DistilGPT2-class six-layer model | Tractable instrumentation and understandable scale |
| Execution | Instrumented ONNX Runtime Web worker | Direct graph control and WebGPU/WASM options |
| Tokenizer/assets | Use Transformers.js/tokenizer utilities selectively | Avoid unnecessary reinvention |
| Frontend | Vite \+ React \+ TypeScript | Fast build path and mature visualisation ecosystem |
| Persistence | IndexedDB \+ versioned JSON export | Local-first notebook and replay |
| Context | 64 default; 128 experimental | Bound memory and trace volume |
| Rendering | HTML/SVG first; Canvas/WebGL for dense plots | Accessibility and performance |
| Deployment | Static HTTPS | WebGPU/worker requirements without backend overhead |

# Open questions

* Which exact model export and quantisation offers the best correctness/performance balance?  
* Which hidden states and attention tensors can be exposed on WebGPU without unacceptable cost?  
* Should full attention be captured only on demand or through a separate graph?  
* Which dimensionality-reduction method best supports semantic learning in-browser?  
* What trace-size ceiling should trigger summary-only capture?  
* Which browsers receive full live mode at initial release?  
* Is a tuned-lens probe worth including in MVP+ or should it remain a documented stretch goal?  
* What licence/hosting approach is best for model assets and public static deployment?

# Decision log template

| ID | Decision | Status | Evidence/Reason | Consequences |
| :---- | :---- | :---- | :---- | :---- |
| D-001 | Intervention \+ branching is the hero loop | Accepted | Core product differentiation | Prioritise trace lineage before secondary visuals |
| D-002 | Evidence classes are product-wide | Accepted | Scientific honesty | Schema and UI carry provenance |
| D-003 | DistilGPT2-class initial target | Recommended | Size and inspectability | Verify export before final lock |
| D-004 | Instrumented ONNX primary runtime | Recommended | Need explicit graph outputs | Maintain adapter boundary |
| D-005 | Exact model/export choice | Open | Feasibility spike required | Blocks performance budget |

# Risk register

| Risk | Likelihood | Impact | Owner response |
| :---- | :---- | :---- | :---- |
| Instrument outputs fail on browser backend | Medium | High | Reduce outputs, separate graphs or change model |
| Prototype becomes visual mock-up | Medium | High | Require live vertical slice before polish |
| Scientific claims overreach | Medium | High | Evidence taxonomy, copy review and integrity tests |
| WebGPU excludes users | High | Medium | WASM and verified demo traces |
| Scope expands into interpretability platform | Medium | Medium | Use expansion gates and deliberate non-goals |
| Model download harms first use | High | Medium | Instant demonstration path and clear progress |

# Repository handback checklist

* Application runs locally from documented commands.  
* Production build succeeds.  
* Live and demonstration modes are clearly distinguished.  
* Model/export provenance and licences are documented.  
* Golden fixtures and sampler tests pass.  
* Hero-loop end-to-end test passes.  
* Trace schema and sample files are present.  
* Known limitations name unsupported instruments and browsers.  
* Screenshots/video show the current product honestly.  
* Next-session brief names the smallest high-value next change.

# Director review prompts

* Does the branch chamber feel like the heart of the product?  
* Is the experience educational before it becomes technically overwhelming?  
* Which instrument creates the strongest “I understand this now” moment?  
* Are measured facts and approximations visually unmistakable?  
* Does the observatory identity feel special without getting in the way?  
* What should be cut to make the first public version coherent?  
* What evidence would justify adding a backend, modern model or deeper probe?

# Expected final agent report

Summarise what was built, how to run it, what was verified, measured performance, supported modes, scientific limitations, known defects, decisions made, files changed and the recommended next build session. Include direct evidence for the hero workflow rather than only a feature list.