05 — Scientific Integrity and Interpretability Rules

What may be measured, derived, projected, probed and claimed

# Purpose

The Observatory earns trust by distinguishing what the model/runtime actually returned from what the application calculated, projected or inferred. Scientific integrity is part of the interface, data schema, tests and editorial voice—not a disclaimer page.

# Evidence classification

| Class | Definition | Examples | Required label |
| :---- | :---- | :---- |
| Measured | Returned directly by model/runtime or sampler | Token IDs, logits, attention weights, PRNG draw | M |
| Derived | Exactly calculated from measured data | Softmax probability, entropy, cosine similarity | D |
| Projected | Lossy transformation for viewing | PCA/UMAP coordinates, colour mapping | P |
| Probed | Interpretability method with assumptions | Logit lens, tuned lens, linear probe | R |
| Interventional | Result of controlled rerun or manipulation | Ablation, forced token, altered prompt | I |

Use an accessible icon, abbreviation and text label. Do not rely on colour. A datum may have a provenance chain—for example a projected view derived from measured embeddings—so method details should preserve that chain.

# Claims the product may make

* “This token had the highest model logit before sampling.”  
* “Temperature scaling flattened this candidate distribution.”  
* “Top-p removed candidates outside the retained cumulative-mass prefix.”  
* “The seeded random draw fell inside this token’s interval.”  
* “This two-dimensional map is a projection that preserves some relationships and loses others.”  
* “When this input token was changed and the model rerun, the next-token distribution changed by this measured amount.”

# Claims the product must not make

* “The model thought about this word.”  
* “This attention head proves which word caused the prediction.”  
* “This projection is the model’s semantic space.”  
* “A layerwise logit-lens guess is the exact belief held at that layer.”  
* “The model chose a token because it was more creative.”  
* “This single ablation identifies the complete cause.”

# Attention

Attention weights are real model outputs when correctly captured, but they are not automatically explanations of feature importance or causality. The interface must present them as a pattern of weighted information routing for a selected head/layer and include a nearby limitation note. A guided experiment should contrast an attention pattern with a controlled token ablation.

# Layerwise prediction views

* A basic logit lens applies the output unembedding to intermediate residual states; label it Probed.  
* A tuned lens uses learned transformations intended to improve layerwise decoding; it requires separate probe assets, training provenance and versioning.  
* Do not call either the model’s “thoughts”.  
* Show instability, calibration limitations and the exact method version.  
* If the model architecture or normalisation makes a probe inappropriate, disable it with an explanation.

# Counterfactual and ablation language

* Say “When we changed X and reran the model, Y changed”, not “X caused Y in all contexts”.  
* Keep all other controllable variables fixed and record them in the trace.  
* Distinguish token deletion, replacement, masking and embedding zeroing; they are different interventions.  
* Warn that an unnatural intervention may move the input off the model’s typical data distribution.  
* Prefer multiple related interventions over a single dramatic example.

# Selection explanation template

1. Identify the model output under examination.  
2. Report original candidate logit/score and rank.  
3. Show exact sampler transforms and eliminated candidates.  
4. Report probability after renormalisation.  
5. Report deterministic argmax, seeded random draw or manual override.  
6. Show the selected interval or rule.  
7. List user interventions and branch lineage.  
8. Optionally show probe/intervention evidence under separate labelled sections.  
9. Finish with “What this explains” and “What this does not explain”.

# Projection rules

* Name the method, input vectors, preprocessing, random seed and number of dimensions.  
* For PCA, report explained variance where meaningful.  
* For UMAP/t-SNE, warn that global distances and cluster shapes can be misleading.  
* Provide a nearest-neighbour table from the original high-dimensional vectors alongside the projection where feasible.  
* Do not allow arbitrary camera perspective to imply quantitative distance.

# Editorial voice

| Use | Avoid |
| :---- | :---- |
| observe, measure, calculate, project, probe, intervene | think, feel, want, know, realise |
| candidate distribution | possible thoughts |
| seeded random draw | the model’s whim |
| contextual representation | concept stored here |
| limitation, assumption, compatibility | magic, mind-reading, true reason |

# Integrity checks for release

* Every instrument declares its evidence class and method.  
* No demo trace is presented as live inference.  
* Every metric has a documented formula and version.  
* Model/tokenizer/quantisation identity is visible and exported.  
* Sampler explanations can be reconstructed from recorded values.  
* Projection and probe assets record seeds and provenance.  
* Attention cautions are present in the instrument and experiment, not hidden only in legal text.  
* Accessibility descriptions do not overstate what a visual encodes.

# Scientific red-team questions

* Could a reasonable learner mistake this visual metaphor for literal model structure?  
* Does the explanation imply causality from correlation or attention?  
* Could quantisation or backend tolerance change the displayed rank?  
* Are we comparing distributions defined over the same candidate universe?  
* Does a branch truly hold non-intervened variables constant?  
* Can the data lineage for this number be reproduced from a trace?  
* What would falsify the explanatory statement shown to the user?