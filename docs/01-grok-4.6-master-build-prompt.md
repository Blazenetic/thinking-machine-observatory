01 — Grok 4.6 Master Build Prompt

Ambitious implementation brief for Grok Build Mode

# Master instruction

You are the lead product designer, frontend architect, browser-ML engineer, visualisation specialist and implementation owner for The Thinking Machine Observatory. Build the strongest coherent working prototype you can. Exercise ambitious judgement, make sensible decisions without waiting for permission, and document material assumptions. Do not merely produce plans or attractive static panels: implement and verify the product.

# Mission

Create a public-quality interactive laboratory where a user can observe a small language model performing next-token prediction, pause before selection, intervene in the decoding process, branch the future and compare the resulting generations. The experience must combine authentic local inference, educational clarity, scientific honesty and a distinctive observatory-grade visual identity.

# Read before building

1. Read every document in this package.  
2. Extract non-negotiables, recommendations, open decisions and acceptance criteria.  
3. Inspect the repository and available environment before selecting dependencies.  
4. Write a short implementation plan and risk register into the repository, then begin building immediately.  
5. Prefer a running vertical slice over speculative platform infrastructure.

# Non-negotiable product truths

* The hero feature is intervention plus branching counterfactual generation.  
* A genuinely small model runs locally when the browser supports it.  
* The app exposes real sampler values: logits or candidate scores, ranks, probabilities, filter membership, seeded random draw and selected interval.  
* Saved traces are versioned, exportable and replayable.  
* Measured, Derived, Projected, Probed and Interventional data are visibly distinguished.  
* Any explanatory approximation is labelled; never present attention as a definitive causal explanation.  
* The app offers a functional fallback when WebGPU is unavailable.  
* The result must be polished, responsive, accessible and testable—not a prototype made only of mock data.

# Creative direction

Treat the model as a vast, quiet scientific instrument. Use smoked glass, blackened metal, warm instrument ivory, spectral cyan, sodium amber and rare warning red. Controls should feel calibrated; transitions should feel deliberate and mechanical. Avoid glowing brains, generic node webs, gradient fog, random glass cards, excessive neon and meaningless motion.

* Working title: The Thinking Machine Observatory.  
* Subtitle: An interactive laboratory for next-token prediction.  
* Working line: Observe. Intervene. Compare.  
* Use a technical grotesk for controls, a readable humanist face for explanations and tabular numerals for measurements.  
* Visual density may increase in expert views, but every screen must retain hierarchy and calm.

# Core experience

1. **Observe.** A prompt becomes tokens, passes through the instrumented model and produces a next-token distribution.  
2. **Pause.** Generation stops before sampling so the live candidate field can be inspected.  
3. **Intervene.** The user changes a decoding parameter, suppresses a candidate, forces the runner-up, alters a prior token or changes the seed.  
4. **Branch.** The intervention creates a child trace while the original remains intact.  
5. **Compare.** The user runs both futures and inspects token, distribution, entropy and semantic divergence.  
6. **Explain.** The application explains the mechanics of selection without inventing model intentions.  
7. **Record.** The experiment is annotated, saved, exported and replayed.

# Required instruments

| Instrument | Required behaviour |
| :---- | :---- |
| Token Specimen Tray | Token text, IDs, byte/character boundaries, position and cross-highlighting |
| Semantic Sky | Clearly labelled projection of embeddings or contextual representations; nearest-neighbour inspection |
| Layer Telescope | Layer selector, residual/hidden-state summaries and layerwise candidate evolution where supported |
| Attention Interferometer | Head/layer view, causal mask, token links and caution that attention is not explanation |
| Probability Spectrometer | Top candidates, logits, probabilities, ranks, entropy, filtering and final intervals |
| Intervention Console | Temperature, top-k, top-p, seed, suppression, forcing, manual choice and reset |
| Branch Chamber | Immutable generation DAG, parent/child comparison, playback and divergence metrics |
| Laboratory Notebook | Guided experiments, user notes, observations, trace import/export and replay |

# Functional requirements

* Capability test WebGPU, WASM, storage and model compatibility at startup.  
* Show model download size, progress, cache state and expected device limitations.  
* Run inference in a worker so controls and animations remain responsive.  
* Own the seeded PRNG and sampling implementation so traces record exact selection mechanics.  
* Allow generation to advance one token, run continuously, pause before sampling and pause after selection.  
* Support deterministic greedy mode and seeded stochastic mode.  
* Support temperature, top-k and top-p individually and in combination with exact order documented.  
* Record raw top-N candidate logits or scores, derived probabilities, filters and selection metadata per step.  
* Create branches without mutating ancestors.  
* Compare two compatible traces step-by-step and highlight first divergence.  
* Export and import versioned JSON with schema validation and compatibility warnings.  
* Include curated demo traces so the core experience remains available without model execution.

# Recommended technical strategy

* Start with DistilGPT2 or a compatible small GPT-2 architecture: six layers, twelve heads and manageable browser memory.  
* Use a custom ONNX export with selected hidden states, attention outputs and final logits exposed as graph outputs. Do not assume runtime APIs can retrieve arbitrary intermediate tensors.  
* Use ONNX Runtime Web directly for the instrumented execution path. Use Transformers.js and its tokenizer package selectively for model acquisition, tokenisation or fallback utilities.  
* Keep the initial context window at 64 or 128 tokens and cap captured attention/candidate data.  
* Use React and TypeScript with strict domain types, a Web Worker inference boundary, IndexedDB caching and static HTTPS deployment.  
* Prefer Canvas or WebGL for dense plots and HTML/SVG for accessible controls and labels.  
* Isolate model adapters so a later compact modern model can expose only the measurements it truly supports.

# Trace contract

A trace is an immutable experiment record, not a screenshot of UI state. It must contain model identity and asset hashes, tokenizer identity, prompt token IDs, generation steps, sampler configuration, seed/PRNG state, captured measurements, interventions, lineage, timestamps or monotonic ordering, schema version and compatibility metadata. Large tensors should be optional, compressed or separately referenced.

# Scientific integrity rules

* Measured means returned directly by the model or sampler.  
* Derived means exactly computed from measured values.  
* Projected means a lossy dimensionality reduction or visual mapping.  
* Probed means an interpretability method such as a logit lens with assumptions.  
* Interventional means a rerun after a controlled change.  
* Never describe a token as selected because the model wanted, believed or reasoned something.  
* A “Why did this token win?” panel must explain the mechanical selection path: original rank, temperature transformation, filter survival, renormalised probability, random draw, probability interval and manual overrides.  
* Attention visualisation must link to an accessible caution and, where feasible, contrast attention with token ablation.

# Guided laboratory

Implement the eight guided experiments from document 06\. Each experiment needs a question, setup, one or more controlled actions, observable measurements, a concise interpretation, an integrity note and a completion state. Make the first experiment usable before the model has fully downloaded by using a bundled trace if necessary.

# Quality bar

* No blank panels, fake graphs or permanently hard-coded numbers in the primary live path.  
* Every loading, unsupported, empty and error state is intentionally designed.  
* Keyboard-only navigation and reduced-motion mode work.  
* Important graphs have readable text summaries or equivalent data tables.  
* Responsive layout supports a laptop as the primary canvas and a useful tablet/mobile read-only or reduced mode.  
* Mathematical transforms and sampler behaviour have unit tests; experimental workflows have end-to-end tests.  
* Performance budgets and browser/device limits are documented with actual measurements.

# Implementation phases

| Phase | Outcome | Exit gate |
| :---- | :---- | :---- |
| 0 — Feasibility spike | One prompt produces real logits and selected instrument outputs | Measured tensors verified against a reference runtime |
| 1 — Vertical slice | Prompt → pause → sampler → selected token → trace | Deterministic replay passes |
| 2 — Branch chamber | Force/suppress/change seed and compare futures | Ancestor immutability and divergence tests pass |
| 3 — Observatory instruments | Token, probability, layer, attention and semantic views | All views distinguish evidence classes |
| 4 — Guided laboratory | Experiments, notebook and demo traces | New user completes first experiment |
| 5 — Release polish | Design system, accessibility, performance, deployment | Acceptance plan passes |

# Autonomy and decision policy

* Make low-risk design and implementation choices yourself.  
* If an output cannot be measured faithfully, substitute a clearly labelled approximation or omit it; never fabricate it.  
* If the recommended model export is blocked, build the exact sampler/branch vertical slice using the closest compatible small model and preserve the adapter boundary.  
* If WebGPU support is unreliable, retain WASM and demonstration traces rather than removing local inference.  
* Prefer a smaller working scientific instrument over a broad mock observatory.  
* Record decisions, trade-offs and unresolved risks in the repository.

# Required repository deliverables

* Working application and production build.  
* README with setup, supported browsers, privacy model, limitations and architecture overview.  
* Architecture decision records for model/runtime, instrumentation, trace schema and renderer choices.  
* Model export/reproducibility scripts or precise instructions, plus licences and checksums.  
* Schema definitions and sample trace fixtures.  
* Unit, integration and end-to-end tests.  
* Accessibility and performance notes.  
* A project handover describing what is real, approximate, incomplete and recommended next.

# Definition of done

The prototype is done only when a user can run or load a real trace, pause before selection, inspect the candidate field, create a controlled branch, run both futures, compare the divergence, save the experiment and understand which displays are measured versus approximate. The deployed experience must survive unsupported hardware gracefully and the repository must let another engineer reproduce the model and tests.

# Begin now

Do not ask for approval on reversible implementation details. Begin with the feasibility spike, keep the running application intact, and surface only decisions that materially change the scientific or product direction.

## First handback must include

* The exact model, tokenizer, export, runtime and quantisation tested.  
* A reproducible command or workflow for producing the instrumented assets.  
* Golden token/logit comparisons and the accepted numerical tolerance.  
* Observed model download, first-load, inference, memory and trace-size measurements.  
* A working screen recording or screenshots of prompt → pause → intervention → branch → comparison.  
* A candid list of which panels use live measured data, derived values, projections, probes or demonstration traces.  
* The smallest next build step that strengthens the hero loop.