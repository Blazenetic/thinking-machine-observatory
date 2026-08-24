# ADR 0003 — Pinned experimental inference worker

- Status: Superseded by ADR 0005
- Date: 24 August 2026

## Context

Local inference must not block the UI, and current browser runtimes vary across WebGPU, WASM, dtype and memory. The initial public model repository exposes causal-LM logits but not the purpose-built hidden/attention outputs planned later.

## Decision

Use a typed dedicated worker with `@huggingface/transformers@3.8.1` and `Xenova/distilgpt2` pinned to revision `a41c10485c18a64b6606729b6a082330cbd8f49e`. Start with `int8` WASM and `fp16` WebGPU. Return genuine top-N logits and exact tokenizer fragments for inspection, but mark the build unverified and the candidate universe incomplete.

The 3.8 line is intentional: it matches this legacy `Xenova` export layout. A 4.2 adapter spike failed during tokenizer metadata discovery before model inference, so adopting that runtime requires a separately verified model/export migration rather than an unreviewed dependency bump.

Do not allow the truncated capture to enter exact sampling.

## Consequences

- The UI remains responsive during model load and inference.
- The adapter provides a concrete feasibility seam for Phase 2.
- An opt-in network smoke proves the pinned WASM path can load, infer and render top logits.
- The production bundle includes a sizeable ONNX Runtime WASM asset.
- Golden comparison, complete-vocabulary transport, hashing and performance measurement remain required before acceptance.
