03 — Visual Design and Interaction System

A scientific-observatory design language without generic AI aesthetics

# Design premise

The Observatory is a working scientific place after dark: precise, quiet, tactile and slightly mysterious. It should borrow the confidence of astronomical instruments and laboratory controls without imitating a retro prop panel. Visual character comes from hierarchy, material restraint, typography, calibrated light and meaningful motion.

# Anti-slop constraints

* No glowing artificial brain, neural-network sphere or generic node-web hero.  
* No full-screen purple/blue gradient, glass-card grid or decorative particles without data meaning.  
* No inflated marketing copy, fake real-time counters or unexplained “AI insight” badges.  
* No excessive border radii, identical cards or every surface floating independently.  
* No movement that continues after the state has settled.  
* No 3D if it reduces legibility, accessibility or model performance.

# Palette

| Token | Suggested value | Use |
| :---- | :---- | :---- |
| Night | \#080B0E | Primary environment |
| Instrument black | \#11161B | Panels and rails |
| Warm ivory | \#E8E1D2 | Primary text and engraved labels |
| Spectral cyan | \#54D6E8 | Measured data, focus and live signal |
| Sodium amber | \#E2A64A | Derived/probed state and caution |
| Signal red | \#E35D5B | Errors, destructive action, hard limits |
| Steel | \#6F7A82 | Secondary labels and inactive structure |
| Hairline | \#263038 | Rules, grids and panel boundaries |

Treat these as design starting tokens, not immutable branding. Validate contrast and tune perceptual brightness in context. Evidence classes also require text/icon labels; colour is supplementary.

# Typography

* Controls and headings: a restrained technical grotesk with clear numerals and excellent small-size rendering.  
* Explanations: a highly readable humanist sans or serif used sparingly for longer teaching text.  
* Measurements: tabular numerals and monospaced token IDs where alignment improves comparison.  
* Use uppercase only for short instrument labels; avoid long uppercase paragraphs.  
* Keep labels literal: Logit, Probability, Rank, Entropy, Temperature, Seed and Evidence class.

# Spatial system

* Use one dominant stage, one calibration rail and one trace rail; do not tile eight equal cards.  
* The primary instrument receives the largest visual area and changes with the current question.  
* Secondary instruments appear as compact readouts that can be promoted to the stage.  
* Keep shared token selection visible across panels through a stable locator, not repeated animations.  
* Reserve empty space around the current measurement so dense data has somewhere to breathe.

# Instrument component language

| Component | Visual character | Interaction cue |
| :---- | :---- | :---- |
| Dials/sliders | Fine scale, current value, safe range and reset mark | Drag, arrow keys and exact entry |
| Spectrometer bars | Thin aligned candidates with rank and mass | Hover/focus links token everywhere |
| Token specimens | Tactile labelled fragments, not pills everywhere | Select, compare and fork |
| Layer telescope | Vertical depth axis with controlled cross-section | Scrub layer or play once |
| Attention view | Matrix/arcs chosen for the question | Head/layer selectors and caution |
| Branch chamber | Clear lineage, shared ancestor and paired tips | Select two, then compare |
| Evidence mark | Shape \+ abbreviation \+ tooltip | Opens method and limitation |

# Data visualisation rules

* Use common scales and stable ordering when comparing two distributions.  
* Never animate a scale change without making the new scale explicit.  
* Show exact values on focus and useful aggregates by default.  
* Probability bars must share a zero baseline; cumulative top-p mass must be visibly distinct from individual probability.  
* Layer evolution uses consistent candidate colours/labels only for the selected comparison set.  
* Embedding views show projection method, variance or neighbourhood caveat and selectable dimensionality.  
* Attention matrices preserve token order and causal masking; arc views are optional and capped to avoid clutter.  
* Every dense chart offers a text/data alternative.

# Motion system

* Inference: a brief travelling signal or progressive instrument activation tied to real stage completion.  
* Sampling: candidate field contracts after filtering, then the seeded draw resolves once.  
* Branch creation: the new lineage separates from the exact intervention point.  
* Comparison: changes reveal from the shared ancestor outward.  
* Transitions last only long enough to preserve object continuity; typical range 160–450 ms.  
* Reduced-motion mode removes travel and parallax while preserving state-change announcements.

# Depth and 3D

Use depth as a selective instrument metaphor, not as the navigation model. A subtle WebGL semantic sky or layer tunnel can be effective, but controls, explanations and exact values should remain accessible HTML. If 3D competes with inference resources or fails on low-power devices, fall back to a 2D projection without losing the experiment.

# States and feedback

* Loading shows asset name, download size, progress, cache decision and cancel/switch-to-demo actions.  
* Unsupported hardware explains what is missing and offers the best viable mode.  
* A stale comparison is marked when one branch has not been recomputed after a configuration change.  
* Manual interventions are visually persistent in the trace; never hide them after the token appears.  
* Errors include a concise diagnosis, recovery action and copyable technical detail.

# Landing composition

1. A restrained title block and one-sentence scientific promise.  
2. A live or recorded probability instrument already in motion only until it settles.  
3. Two choices: Run locally or Explore a demonstration trace.  
4. A compact integrity statement: “This instrument shows measurements, derived values and labelled approximations—not thoughts.”  
5. Browser/device readiness and expected model download shown before commitment.

# Design review questions

* Can the user identify the current token, current step and evidence class at a glance?  
* Is every animation connected to a real state transition?  
* Does one instrument clearly dominate the current task?  
* Can a keyboard user reach, operate and understand the same controls?  
* Would the experience still make sense in monochrome or reduced motion?  
* Does the design look credible beside a real scientific visualisation rather than only beside AI landing pages?

# Design handback deliverables

* A token sheet covering colour, type, spacing, hairlines, elevation, focus and evidence-class marks.  
* Responsive compositions for welcome, observation, branch comparison, laboratory and notebook states.  
* Component states for loading, disabled, focused, selected, filtered, forced, stale, incompatible and error.  
* Motion timings and reduced-motion equivalents tied to real application events.  
* Chart specifications with scales, legends, text alternatives and comparison behaviour.  
* A short design rationale showing how the final interface avoids the anti-slop constraints.