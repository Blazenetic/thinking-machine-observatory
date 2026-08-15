06 — Guided Experiments and Learning Content

Eight controlled experiments for learning by intervention

# Learning strategy

Teach through controlled experiments. Each experiment begins with a prediction question, changes one main variable, records observable evidence and ends with a concise interpretation plus “what this does not prove”. The system should validate actual trace conditions rather than awarding completion for button clicks.

# Experiment 1 — Temperature without mysticism

* **Question:** How does temperature reshape a fixed logit distribution?  
* **Setup:** Load one captured prediction and hold logits, top-k, top-p and seed constant.  
* **Action:** Compare T \= 0.5, 1.0 and 1.5 before drawing a token.  
* **Observe:** Top probability, entropy, rank stability and filtered mass.  
* **Takeaway:** Temperature rescales logits before softmax; it changes distribution sharpness, not model knowledge.  
* **Does not prove:** That high temperature is inherently creative or low temperature is truthful.

# Experiment 2 — The nucleus boundary

* **Question:** Which candidates survive top-p and why can the candidate count change?  
* **Setup:** Use a moderately uncertain distribution and disable top-k.  
* **Action:** Move top-p between 0.5, 0.8, 0.95 and 1.0.  
* **Observe:** Sorted cumulative mass, boundary candidate and renormalised probabilities.  
* **Takeaway:** Top-p retains a variable-size prefix based on cumulative probability.  
* **Does not prove:** That removed tokens were impossible under the model.

# Experiment 3 — Same model, different dice

* **Question:** What changes when only the random seed changes?  
* **Setup:** Same prompt, model, logits and sampler settings.  
* **Action:** Run three seeded branches.  
* **Observe:** The first sampled divergence and later compounding differences.  
* **Takeaway:** Stochastic decoding can create different futures from the same model distribution.  
* **Does not prove:** That the model itself changed between branches.

# Experiment 4 — A single-token butterfly effect

* **Question:** How can one prompt token alter future distributions?  
* **Setup:** Choose two prompts differing by one token or punctuation mark.  
* **Action:** Generate matched seeded branches and compare stepwise.  
* **Observe:** Tokenisation, first distribution change, entropy and semantic divergence.  
* **Takeaway:** Small input changes can alter contextual representations and compound across generation.  
* **Does not prove:** That all small edits always cause large effects.

# Experiment 5 — Force the runner-up

* **Question:** What future appears if the second-ranked token is manually selected?  
* **Setup:** Pause at a prediction with a clear top two.  
* **Action:** Keep the original branch; force the runner-up in a child branch; run both.  
* **Observe:** Shared ancestor, manual override mark and subsequent candidate fields.  
* **Takeaway:** A locally plausible alternate token can redirect the continuation.  
* **Does not prove:** That the alternate future was the model’s hidden intention.

# Experiment 6 — When certainty forms

* **Question:** How does candidate concentration evolve across layers?  
* **Setup:** Enable the supported layerwise probe for one position.  
* **Action:** Scrub from embedding/residual input through the final layer.  
* **Observe:** Probe rank, entropy and instability across layers.  
* **Takeaway:** A probe can show how decodable candidate information changes through depth.  
* **Does not prove:** That each layer literally holds a settled next-token belief.

# Experiment 7 — Attention is not importance

* **Question:** Does a high attention weight identify the input token most causally important to the output?  
* **Setup:** Choose one head/layer and a token with conspicuous attention.  
* **Action:** Compare attention with several controlled token replacements or ablations.  
* **Observe:** Attention pattern versus measured output-distribution changes.  
* **Takeaway:** Attention and interventional sensitivity answer different questions.  
* **Does not prove:** That ablation alone gives a complete causal explanation.

# Experiment 8 — Tokenisation surprises

* **Question:** Why do spaces, punctuation and uncommon words become unexpected tokens?  
* **Setup:** Use paired examples with leading spaces, capitalisation, emoji, punctuation and rare words.  
* **Action:** Inspect token IDs, decoded fragments and byte boundaries.  
* **Observe:** Different token counts and boundaries before inference begins.  
* **Takeaway:** The model receives token IDs, not words as humans naturally segment them.  
* **Does not prove:** That a token maps cleanly to one human concept.

# Challenge progression

| Level | Challenge | Evidence of completion |
| :---- | :---- | :---- |
| Observer | Identify which sampler stage removed a candidate | Correct filter and trace step selected |
| Operator | Create a deterministic and stochastic branch | Two compatible child traces with documented difference |
| Analyst | Locate the first distribution divergence | Correct shared ancestor and step |
| Sceptic | Find a visual that is projected or probed | Correct evidence class and limitation stated |
| Experimentalist | Design a controlled prompt intervention | One primary variable changed and observation saved |

# Experiment authoring schema

id, title, learningObjective, prerequisiteCapabilities  
startingTrace/modelPreset, controlledVariables, actionSteps  
observationPredicates, interpretationPrompt, explanation  
evidenceClasses, integrityNote, limitations, extensionChallenge

# Glossary seeds

| Term | Plain-language definition |
| :---- | :---- |
| Token | A numbered text fragment processed by the model. |
| Embedding | A high-dimensional vector representation used as model input or internal state. |
| Logit | An unnormalised score used to form a probability distribution. |
| Softmax | A transformation from scores to positive probabilities summing to one. |
| Attention weight | A head-specific weighting used while combining information across positions. |
| Entropy | A summary of how spread out a probability distribution is. |
| Temperature | A scale applied to logits before softmax in decoding. |
| Top-k | A filter retaining a fixed number of highest-scoring candidates. |
| Top-p | A filter retaining a variable prefix reaching a cumulative probability threshold. |
| Seed | A value that makes a pseudo-random sequence reproducible. |

