04 — Technical Architecture and Trace Schema

Browser inference, instrumentation, deterministic sampling and replay

# Architecture recommendation

Use a static TypeScript application with a strict worker boundary around model execution. Treat inference, sampling and trace capture as testable domain modules; visualisations consume immutable trace data rather than reaching directly into the runtime.

# System topology

| Module | Responsibility | Boundary |
| :---- | :---- | :---- |
| App shell | Routing, capability flow and layout | No tensor work |
| Experiment store | Active trace, branch DAG, selections and UI state | Immutable domain updates |
| Inference worker | Tokenizer, ONNX session, cache and tensor capture | Typed messages only |
| Sampler core | Temperature, filters, seeded draw and explanation record | Pure deterministic functions |
| Trace engine | Schema, lineage, validation, replay and migration | Versioned JSON |
| Instrument adapters | Convert trace data into view models | No model execution |
| Persistence | IndexedDB models, traces and preferences | Quota-aware |
| Demo registry | Bundled verified traces and experiment presets | Offline-capable |

# Model and runtime

* Primary target: DistilGPT2 or a compatible compact GPT-2 graph.  
* Export selected tensors as explicit ONNX outputs: final logits, chosen hidden states and attention matrices where technically valid.  
* Keep generation caching optional in the first spike; correctness and traceability outrank throughput.  
* Run inference in a dedicated worker and transfer only bounded data needed for the current instruments.  
* Prefer WebGPU; support WASM for small contexts or demonstration mode for unsupported devices.  
* Record exact model, tokenizer, quantisation, opset, runtime and asset hashes in every trace.

# Instrumentation warning

ONNX Runtime generally returns declared graph outputs; it should not be assumed to expose arbitrary intermediate nodes on demand. The model export pipeline must promote required intermediate values to outputs or produce purpose-built graphs. Verify each output numerically against the source framework before trusting the visualisation.

# Inference protocol

UI \-\> worker: loadModel, tokenise, predict, cancel, dispose  
worker \-\> UI: capability, progress, tokens, prediction, warning, error  
Prediction payload: logits/topN, optional hidden summaries, optional attention, timing, model identity

# Sampler order

1. Start with model logits for the final position.  
2. Apply explicit candidate suppression or bias interventions.  
3. Apply temperature scaling: zᵢ′ \= zᵢ / T for T \> 0; treat greedy mode separately.  
4. Apply top-k by retaining the k highest scores when enabled.  
5. Convert retained scores to a stable softmax distribution.  
6. Apply top-p by sorting descending, retaining the smallest prefix whose cumulative probability reaches the threshold, with a documented boundary rule.  
7. Renormalise the surviving distribution.  
8. Use the trace-owned seeded PRNG to produce a draw in \[0,1) and select the interval.  
9. Record every intermediate candidate state needed to explain the result.

# Trace schema goals

* Deterministic replay of sampling and branch lineage.  
* Forward-compatible schema migrations without silently changing scientific meaning.  
* Bounded size through top-N capture, optional tensor blocks and compression.  
* Separation of authoritative measurements from derived/projected/probed artefacts.  
* Explicit compatibility status when model assets or calculation versions differ.

# Illustrative trace shape

{  
  "schemaVersion": "1.0.0",  
  "traceId": "uuid",  
  "parent": {"traceId": "uuid-or-null", "forkStep": 4},  
  "model": {"id": "distilgpt2-instrumented", "assetHash": "...", "dtype": "q8"},  
  "tokenizer": {"id": "gpt2", "assetHash": "..."},  
  "promptTokenIds": \[464, 1755, 6766\],  
  "sampler": {"temperature": 0.8, "topK": 40, "topP": 0.95, "seed": "tm-42"},  
  "steps": \[{  
    "position": 3,  
    "inputTokenIds": \[464, 1755, 6766\],  
    "candidates": \[{"tokenId": 318, "logit": 8.41, "probability": 0.13}\],  
    "filters": {"suppressed": \[\], "topKCutoffRank": 40, "topPMass": 0.952},  
    "draw": {"algorithm": "xoshiro128\*\*", "stateBefore": "...", "value": 0.314},  
    "selection": {"tokenId": 318, "mode": "sampled", "interval": \[0.28, 0.41\]},  
    "measurementsRef": "tensor-block-or-null",  
    "interventions": \[\]  
  }\],  
  "annotations": \[\],  
  "calculationVersions": {"softmax": "1", "projection": "pca-1"}  
}

# Branch model

* A trace or trace segment is immutable after commitment.  
* A branch references its parent and exact fork step, then stores only divergent configuration/events plus resulting steps.  
* Replay resolves the ancestry chain into an effective experiment state.  
* Deleting a parent with descendants requires an explicit policy: prevent, cascade or materialise child ancestry.  
* Comparison validates model/tokenizer/calculation compatibility before computing distribution metrics.

# Performance budgets

| Concern | Initial target | Strategy |
| :---- | :---- | :---- |
| First meaningful interaction | Immediate demo; local model path clearly progressing | Bundle a small verified trace |
| UI responsiveness | No long main-thread blocks | Worker execution and incremental rendering |
| Context | 64 tokens default; 128 experimental | User-visible limits |
| Candidate capture | Top 50–200 per step | Configurable expert mode |
| Attention capture | Current step, selected layers/heads | Do not retain full history by default |
| Trace size | Small enough for local notebook and JSON export | Optional tensor blocks/compression |
| Memory | Detect and warn before allocation failure | Dispose tensors and sessions explicitly |

# Storage and privacy

* Model assets may be fetched from a pinned origin and cached locally.  
* Prompts and traces stay in IndexedDB unless the user explicitly exports them.  
* No analytics should capture prompt text or tensor content.  
* Provide a one-click local data report and clear-cache action.  
* Static deployment should use a strict content security policy compatible with workers, WASM and model asset origins.

# Repository shape

apps/observatory  
packages/domain  
packages/sampler  
packages/trace-schema  
packages/inference-worker  
packages/instruments  
packages/experiments  
model-tools/export  
model-tools/verify  
fixtures/traces  
docs/adr  
tests/e2e

# Verification strategy

* Golden logits and token IDs from a reference Python/PyTorch or ONNX run.  
* Cross-backend tolerance checks for WebGPU and WASM.  
* Property tests for softmax normalisation, top-k/top-p boundaries and seeded selection.  
* Round-trip schema tests and replay fixtures.  
* Worker cancellation, model disposal and quota failure tests.  
* End-to-end branch creation and first-divergence comparison.

# Material risks

| Risk | Consequence | Mitigation |
| :---- | :---- | :---- |
| Instrumented graph too large | Slow downloads and memory pressure | Start with selected layers/outputs and small context |
| Attention export unsupported or expensive | Incomplete instrument | Ship honest unavailable state or selected-head graph |
| Quantisation alters measurements | Mismatch with reference | Record dtype and validate tolerances |
| Browser GPU variation | Crashes or wrong performance assumptions | Capability matrix, WASM and demo traces |
| Trace captures excessive tensors | Storage exhaustion | Top-N summaries and optional external blocks |

