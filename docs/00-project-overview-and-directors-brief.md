00 — Project Overview and Director’s Brief

The Thinking Machine Observatory

The Thinking Machine Observatory is an interactive scientific instrument for observing, interrupting and replaying next-token prediction in a genuinely small language model. It should teach real transformer concepts while remaining visually arresting enough to stand as a public portfolio project.

# Director’s recommendation

Build an ambitious MVP+ around one hero interaction: pause before token selection, inspect the measured candidate distribution, intervene, branch the generation and compare the divergent futures. This is the project’s identity; every other feature should strengthen it.

# Project thesis

* **Not another transformer diagram.** The Observatory is an experiment environment, not a passive animated explainer.  
* **The model is real.** Tokenisation, inference, logits and sampling must run locally where supported.  
* **Intervention creates understanding.** Users learn by changing prompts, candidates, seeds and decoding controls, then observing consequences.  
* **Beauty serves inquiry.** The interface feels like a precise scientific observatory, not a generic AI dashboard.  
* **Scientific honesty is visible.** Every datum is labelled as Measured, Derived, Projected, Probed or Interventional.

# Primary audiences

| Audience | Need | Design response |
| :---- | :---- | :---- |
| Curious technical learner | Understand how text becomes a probability distribution | Progressive disclosure and guided experiments |
| Developer or AI practitioner | Inspect decoding behaviour and traces | Exact values, exportable JSON and deterministic replay |
| Teacher or communicator | Demonstrate concepts without hand-waving | Presentation mode, saved experiments and integrity labels |
| Public visitor | Experience something memorable quickly | A compelling default trace and a two-minute first experiment |

# The hero loop

1. Enter or choose a prompt.  
2. Generate until the system pauses immediately before a token is selected.  
3. Inspect tokenisation, candidate logits, probabilities, entropy, layer evolution and attention evidence.  
4. Change temperature, top-k, top-p or seed; suppress, force or manually choose a candidate.  
5. Commit the intervention as a new branch.  
6. Run both branches and compare where their token distributions and continuations diverge.  
7. Annotate the result, save the trace and replay it deterministically.

# MVP+ scope

* A locally executed DistilGPT2-class model with WebGPU acceleration and a WASM-compatible fallback path.  
* Token specimen tray with token IDs, decoded fragments, byte boundaries and hover-linked positions.  
* Layer telescope showing selected hidden-state and layerwise candidate evolution where the model export supports it.  
* Attention interferometer with head/layer selection and explicit interpretability caveats.  
* Probability spectrometer covering logits, ranks, softmax probabilities, entropy and sampling filters.  
* Intervention console for temperature, top-k, top-p, seed, suppression, forcing and manual selection.  
* Branch chamber with a generation DAG, comparison metrics and side-by-side future playback.  
* Versioned trace save/export/import with deterministic sampling metadata.  
* Eight guided experiments and an evidence classification system.  
* Capability detection, bundled demonstration traces and graceful degradation.

# Deliberate non-goals

* No conversational assistant, account system, cloud inference requirement or social feed in the first build.  
* No claim to reveal consciousness, chain-of-thought or a complete causal account of model behaviour.  
* No large contemporary model if it prevents meaningful instrumentation or a smooth first-use experience.  
* No ornamental 3D scene that obscures data, damages accessibility or consumes the entire performance budget.  
* No backend unless a later public sharing or collaborative feature proves it necessary.

# Starting decisions

| Area | Starting decision | Status |
| :---- | :---- | :---- |
| Model | DistilGPT2 or a compatible six-layer GPT-2 derivative | Recommended; verify export feasibility |
| Runtime | Instrumented ONNX Runtime Web worker; Transformers.js/tokenizer utilities where helpful | Recommended |
| Frontend | Vite, React, TypeScript | Recommended |
| State | Small typed store plus immutable trace/event records | Recommended |
| Storage | IndexedDB for model/trace caches; JSON export | Recommended |
| Rendering | HTML for controls; Canvas/WebGL for dense plots only | Recommended |
| Deployment | Static HTTPS site with no mandatory backend | Recommended |

# Definition of success

* A first-time visitor can complete a meaningful intervention experiment within two minutes.  
* A technical user can verify exactly how a selected token passed through sampler filters and random selection.  
* The same saved trace replays to the same result on the same supported model build.  
* The app clearly distinguishes measurements from projections, probes and explanatory language.  
* The interface remains usable without WebGPU through fallback inference or demonstration traces.  
* The finished prototype feels like one coherent instrument rather than a gallery of disconnected panels.

# Recommended build sequence

1. Prove the inference and instrumentation spike before polishing the shell.  
2. Implement deterministic sampler mathematics and trace capture with tests.  
3. Build the probability spectrometer and token specimen tray.  
4. Create branch creation, replay and comparison as the central workflow.  
5. Add layer, attention and semantic views only from available real outputs.  
6. Integrate guided experiments, integrity labels and explanations.  
7. Complete the observatory visual system, accessibility, performance and release QA.

# How to use this package

Begin with 01 — Grok 4.6 Master Build Prompt. The other documents are authoritative supporting context. When a tension appears, preserve scientific integrity and the intervention/branching loop first, then use engineering and design judgement to simplify without reducing the project to a mock-up.