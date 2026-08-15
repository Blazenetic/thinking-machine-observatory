02 — Product and Experience Specification

User journeys, information architecture and interaction behaviour

# Experience objective

Make an abstract numerical process feel observable and manipulable without pretending it is simple. The user should feel like an investigator operating a precise instrument, not a spectator watching an animation.

# Experience principles

* **Action before exposition.** Let the user change one variable and see a consequence before presenting extensive theory.  
* **Progressive disclosure.** Overview first; exact tensors, formulae and raw values are available when requested.  
* **Persistent provenance.** Evidence classification follows the datum wherever it appears.  
* **Linked inspection.** Hovering or selecting a token cross-highlights the corresponding positions and measurements across instruments.  
* **Reversible exploration.** Every intervention is a branch; the original trace stays intact.  
* **Calm density.** Expert information may be dense, but never chaotic.

# Information architecture

| Area | Role | Primary content |
| :---- | :---- | :---- |
| Welcome deck | Set expectations and test capability | Model choice, privacy, download, demo trace |
| Observation floor | Primary live workspace | Prompt, timeline, instrument dock, generation controls |
| Branch chamber | Compare counterfactuals | Trace DAG, pair selection, divergence and playback |
| Laboratory | Guided learning | Experiments, challenges, glossary and progress |
| Notebook | Retain findings | Saved traces, annotations, imports and exports |
| Instrument manual | Explain methods and limits | Evidence classes, formulae, model/runtime details |

# Primary workspace layout

* Top rail: model identity, execution backend, evidence legend, cache/download state and global help.  
* Prompt bench: editable prompt, preset examples, token count and run controls.  
* Generation timeline: tokens as a navigable sequence with branch markers and current prediction position.  
* Central instrument stage: one primary instrument at a time with linked miniature readouts from others.  
* Right calibration rail: sampler controls, candidate interventions and exact numerical state.  
* Bottom trace rail: playback, step controls, annotations, branch creation, comparison and export.

# First-use journey

1. Welcome with a 20-second statement: this app observes next-token prediction; it does not reveal thoughts.  
2. Run a capability test and offer either local model mode or instant demonstration mode.  
3. Load the prompt “The night sky was” and pause before the next token.  
4. Highlight the top candidates and invite the user to force the runner-up.  
5. Create the new branch automatically and run three tokens on both paths.  
6. Reveal the first divergence comparison and explain the evidence legend.  
7. Offer to continue freely or start the guided laboratory.

# Generation control states

| State | Meaning | Available actions |
| :---- | :---- | :---- |
| Idle | No active prediction | Edit prompt, load preset, import trace |
| Preparing | Tokenising/loading/caching | Cancel, inspect progress, switch to demo |
| Predicting | Model execution in progress | Pause after current inference |
| Pre-selection pause | Distribution exists; token not chosen | Inspect, change sampler, suppress, force, branch |
| Post-selection pause | Token chosen but continuation stopped | Explain selection, annotate, continue, branch |
| Comparing | Two traces are paired | Synchronise step, inspect divergence, swap focus |
| Unsupported/error | Live path unavailable | Read diagnosis, use WASM or demonstration trace |

# Intervention patterns

* **Calibrate without branching.** Preview how parameter changes reshape the current distribution; commit only when the user generates.  
* **Force candidate.** Choose a surviving or filtered candidate and record a manual override.  
* **Suppress candidate.** Set one or more candidates to negative infinity before filtering, with the intervention made explicit.  
* **Change prior token.** Fork from the selected historical step, replace a token or edit the prompt, then recompute descendants.  
* **Reroll.** Keep model output and sampler settings but advance or change the seed.  
* **Greedy counterfactual.** Create a deterministic branch using argmax from the same logits.

# Branch chamber behaviour

* Represent trace lineage as a top-down or left-to-right DAG; never duplicate the entire prompt visually for every branch.  
* The user selects any two compatible nodes or branch tips for comparison.  
* Synchronise by shared ancestor and generation step, not only absolute token index.  
* Show first token divergence, per-step Jensen–Shannon or KL-style distribution difference where valid, entropy delta and optional semantic distance.  
* Keep an explanation of metric limitations near the control that enables it.  
* Allow branch names, colours and annotations, but use a restrained palette and never encode meaning by colour alone.

# “Why did this token win?”

1. Show raw score/logit and original rank.  
2. Show the temperature transform and resulting probability.  
3. Show whether top-k retained or removed it.  
4. Show the cumulative mass boundary used by top-p.  
5. Show its probability after filtering and renormalisation.  
6. Show the seeded random draw and the token’s probability interval.  
7. Show manual suppression, forcing or selection overrides.  
8. Show layerwise likelihood evolution only as a probe, not a causal story.

# Guided laboratory UX

* A compact experiment card states the question and estimated interaction count, not a long lesson.  
* The application configures a reproducible starting trace.  
* One highlighted control at a time encourages a controlled experiment.  
* A live observation checklist is completed from actual trace conditions, not button clicks alone.  
* The learner writes or chooses an interpretation before seeing the concise explanation.  
* Every experiment ends with “What this does not prove”.

# Notebook and trace library

* Save locally by default; explain that prompts and traces remain on the device.  
* Display model build, schema version, branch count, prompt preview, created order and compatibility.  
* Support tags, free-text observations, duplicate-as-new-experiment, export and delete.  
* Import validates schema and asset compatibility before opening.  
* A replay mode locks editing until the user explicitly forks the trace.

# Responsive and accessible behaviour

* Laptop/desktop is the full authoring surface.  
* Tablet stacks calibration controls below the primary instrument and keeps comparison usable.  
* Mobile prioritises trace playback, candidate inspection and guided experiments; full dense editing may be labelled limited.  
* All controls have visible focus, accessible names and numeric keyboard entry.  
* Graph selections are mirrored in a navigable list or table.  
* Reduced-motion mode replaces animated transitions with immediate state changes and a clear update indicator.  
* Do not rely on hover, fine pointer control, colour or spatial position alone.

# Copy style

| Prefer | Avoid |
| :---- | :---- |
| “Selected by seeded sampling” | “The model decided” |
| “Projected into two dimensions” | “This is the embedding space” |
| “Attention weight for this head” | “This word caused the answer” |
| “The probability changed after temperature scaling” | “Creativity increased inside the model” |
| “This trace cannot be replayed with the current model build” | “Something went wrong” |

# Microcopy and explanation patterns

* Before live inference: state model size, approximate download, local-processing promise and fallback option.  
* Before an intervention: name exactly what will change and whether a branch will be created.  
* After selection: lead with the mechanical sampler result, then offer interpretation and limitations.  
* Before export: state what the trace contains, its schema/model compatibility and whether large tensor blocks are included.  
* On incompatibility: identify the mismatched asset or version and offer safe read-only inspection when possible.  
* On completion: invite the learner to record an observation rather than awarding a generic success badge.