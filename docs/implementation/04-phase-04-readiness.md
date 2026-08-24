# Phase 4 readiness — honest instruments and guided laboratory

- Status: Draft implementation contract
- Depends on: Phase 3 draft PR #4
- Target outcome: every secondary instrument is either backed by a verified output profile or presents an explicit unavailable state

## Readiness result

Phase 3 established the trustworthy spine: exact token-ID prefixes, complete verified logits, replayable PRNG state, immutable branches and bounded local persistence. Phase 4 can now deepen observation without changing that spine.

The current fp32 ONNX graph verifies final logits only. It does not authorise hidden-state, attention, logit-lens or semantic claims. Phase 4 therefore starts with token specimens already derivable from verified tokenizer output, then admits each model-dependent instrument through an independent capability and golden-fixture gate. A visually finished unavailable state is a valid result.

## Evidence vocabulary

| Datum                                      | Initial class  | Admission rule                                                                                    |
| ------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------- |
| token ID and decoded fragment              | Measured       | emitted by the pinned, golden-verified tokenizer                                                  |
| UTF-8 bytes of a decoded fragment          | Derived        | computed with a versioned UTF-8 method; not described as original prompt bytes or BPE merge bytes |
| probability, entropy and branch divergence | Derived        | recomputed from a verified complete logit vector                                                  |
| hidden-state coordinates                   | Measured       | only from a purpose-built export that passes source/runtime golden checks                         |
| attention weights                          | Measured       | only after shape, mask, normalisation and source/runtime checks                                   |
| logit-lens vocabulary distribution         | Probed         | named projection method, layer, normalisation and unembedding provenance                          |
| semantic neighbour distance                | Derived        | exact metric over identified vectors                                                              |
| two-dimensional semantic layout            | Projected      | named projection method/seed and an adjacent distortion limitation                                |
| forced/suppressed counterfactual           | Interventional | immutable intervention record plus exact replay                                                   |

Every instrument header must expose its evidence class, source capability/profile, calculation version and limitations. Marketing names do not weaken those requirements.

## Capability contract

The worker should report capabilities after session creation rather than allowing the UI to infer them from model names:

```ts
interface InstrumentCapability {
  readonly id: 'token-specimens' | 'hidden-states' | 'attention' | 'logit-lens';
  readonly status: 'unavailable' | 'unverified' | 'verified';
  readonly evidenceClass: 'measured' | 'derived' | 'projected' | 'probed';
  readonly profileId: string | null;
  readonly methodVersion: string;
  readonly limits: Readonly<Record<string, number>>;
  readonly reason: string;
}
```

The exact shape may change during 4A, but these semantics may not: absence is explicit, `verified` requires checked evidence, limits travel with the capability and a model switch invalidates the previous declaration. Trace records retain only instrument data actually captured; they never synthesise missing outputs.

## Bounded work packages

### 4A — Token specimen bench

- show the exact token position, ID and decoded fragment for prompt and generated tokens;
- render whitespace/control characters without hiding their identity;
- derive and display UTF-8 hexadecimal/decimal bytes for each decoded fragment;
- distinguish decoded-fragment bytes from original prompt offsets and tokenizer-internal byte symbols;
- synchronise specimens to the active baseline/child step; and
- provide a semantic table and copyable text alternative.

Exit: punctuation, leading-space, multi-byte Unicode and replacement-character fixtures render stable token IDs/fragments/derived bytes and survive branch export/import.

### 4B — Model-output feasibility and verification harness

- inventory the pinned source model and browser runtime outputs without changing the accepted sampling path;
- produce a purpose-built candidate export only if it can expose bounded selected hidden states and/or attention;
- pin exporter, runtime, graph, tokenizer and source-model identities plus asset hashes;
- capture source-framework golden fixtures for the existing four prompt cases;
- require accepted final-logit equivalence before comparing any secondary output;
- define dtype-specific absolute/relative tolerances and rejection reports; and
- measure graph size, cold load, inference latency and peak capture memory.

Exit: a checked report either accepts a named capability profile or records a reproducible rejection. No instrument UI depends on an unaccepted graph.

### 4C — Layer telescope

- request only selected layers/positions under explicit capture limits;
- display shape, layer, token position, dtype, norm and bounded coordinate summaries;
- make the raw numeric table the accessibility baseline;
- keep similarity/difference calculations versioned and separate from measured coordinates; and
- dispose transient tensors after the bounded copy completes.

Exit: every displayed coordinate matches an accepted golden fixture within its declared tolerance, while unsupported sessions show why the telescope is unavailable.

### 4D — Attention interferometer

- verify batch/layer/head/query/key axes rather than assuming an exporter layout;
- check causal-mask zeros/tolerance, finite values and row normalisation;
- bind source and target cells to exact token IDs/fragments;
- bound retained layers, heads and context length before allocating matrices;
- offer a keyboard-readable table and focused row/column inspection; and
- state beside the view that attention weight is not a complete causal explanation or importance score.

Exit: shape/mask/normalisation tests and source/runtime fixture comparisons pass for every enabled profile; otherwise the instrument remains unavailable.

### 4E — Probes and semantic views

- treat logit lens as a named probe, never as a measured belief or decoded thought;
- record layer, normalisation, unembedding weights/bias and method version;
- verify top-token/rank results against the source implementation;
- define semantic neighbour vector source and distance metric explicitly;
- label any 2D layout Projected with method, seed, fit set and distortion caveat; and
- keep these modules optional so 4A–4D do not inherit their asset cost.

Exit: probe and projection records replay to the same versioned result, and disabling them removes both data capture and UI claims.

### 4F — Guided laboratory and notebook reflections

- turn the eight experiment definitions into versioned steps with executable observation predicates;
- evaluate predicates over trace/instrument data rather than completion clicks;
- save free-text reflections as append-only notebook annotations;
- distinguish expected observations from measured outcomes;
- add reduced-motion, keyboard and dense-visual table paths; and
- support a useful experiment completion path when optional instruments are unavailable.

Exit: each experiment can be completed, exported and replay-reviewed with its observations, evidence class and reflections intact.

## Capture and storage budget

Phase 3's import ceilings remain in force. Secondary tensors require separate limits before schema work begins:

- captures are opt-in and scoped to named layers/heads/token positions;
- current-step transient views do not automatically become notebook evidence;
- persisted captures use typed, content-addressed payloads with shape/dtype metadata;
- a trace declares the exact bytes it owns and reports approximate local storage before save;
- import validates byte size and shape multiplication before allocation; and
- deletion/reference-count policy follows the Phase 3 notebook unless a new ADR changes it.

The first accepted profile should favour a small, explainable capture over an exhaustive tensor dump.

## Verification matrix

| Layer                 | Required proof                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| token specimens       | exact IDs/fragments, Unicode/control fixtures, derived UTF-8 bytes, trace round-trip                   |
| capability registry   | model-switch invalidation, unavailable reasons, profile/limit propagation                              |
| exporter              | pinned identities/hashes, final-logit equivalence, accepted and rejected reports                       |
| hidden states         | source/runtime coordinate/norm comparison, dtype tolerance, shape and bounded allocation               |
| attention             | source/runtime values, axis order, causal mask, finite rows and normalisation                          |
| probes                | source-equivalent ranks/tokens, method provenance and replay determinism                               |
| projections           | deterministic seed/fit set, distance-vs-layout distinction and no causal language                      |
| experiments           | predicate truth/falsehood, unavailable fallback, annotation append-only behaviour                      |
| browser/accessibility | keyboard navigation, table alternatives, responsive overflow, reduced motion and honest unavailable UI |

The ordinary CI gate uses checked small fixtures. Network-backed graph verification and genuine-browser capture remain explicit profile jobs; their absence may not be reported as a pass.

## Decisions for review before 4A merges

1. Confirm that the first implementation PR contains 4A plus the capability registry/unavailable states, with 4B as a parallel evidence spike rather than a UI dependency.
2. Choose the maximum retained layers, heads, token positions and bytes for the first secondary-output profile.
3. Decide whether accepted secondary tensors extend schema 1.2 through optional records or require schema 1.3. No ad hoc notebook-only shape is allowed.
4. Select the first logit-lens normalisation/projection definition, or explicitly defer 4E after the verification spike.
5. Decide whether semantic neighbours use the model's tied token embedding space or a separately identified asset; no unnamed embedding source is permitted.

## Deliberate non-goals

- describing any tensor as thought, intent, belief, understanding or consciousness;
- deriving attention or hidden states from final logits;
- enabling an unverified export because its pictures look plausible;
- storing every layer/head/token by default;
- treating attention weight, logit-lens rank or 2D proximity as causal proof;
- changing the accepted Phase 3 sampler/branch semantics; and
- adding accounts, a backend or collaborative notebooks.

Phase 4 is ready to begin with 4A. Work packages 4C–4E remain blocked until 4B accepts the exact capability they consume.
