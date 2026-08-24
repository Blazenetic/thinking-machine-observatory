# ADR 0005 — Verified fp32 WASM live path

- Status: Accepted
- Date: 24 August 2026

## Context

Phase 1 used the repository's smaller `int8` graph as an experimental WASM path. A live trace may enter exact sampling only if its tokenizer, complete final-position logits, ranking and causal-position behaviour agree with a pinned source-framework run under a declared tolerance.

The four-prompt suite covers ordinary text, mixed punctuation, Unicode and leading spaces. Both browser graphs were executed through ONNX Runtime Web's WASM execution provider and compared with PyTorch `float32` logits across all 50,257 vocabulary entries.

## Decision

Accept `Xenova/distilgpt2`'s `onnx/model.onnx` fp32 graph at revision `a41c10485c18a64b6606729b6a082330cbd8f49e` for the verified WASM path. Its asset SHA-256 is `d605c4b3740df3960e8f84e4c5735af8d81d19105eb915b692272c08cc800b0c`.

The `distilgpt2-wasm-fp32-v1` profile requires:

- exact token IDs and decoded byte specimens;
- exact top-1 and complete top-50 overlap;
- maximum and mean absolute logit error no greater than `0.0002` and `0.00005`;
- the same bounds after removing any additive offset; and
- zero change at every earlier sequence position after mutating the final input token.

Keep WebGPU fp16 isolated as unverified. Reject the `model_int8.onnx` graph for exact live sampling under profile `distilgpt2-wasm-int8-v1`: it produced only 36–45/50 top-token overlap, two top-1 mismatches and non-zero earlier-position changes after the future-token mutation. The observed rejection is sufficient; its mechanism is not inferred without further graph analysis.

Carry the complete fp32 vector across the worker boundary as a transferable `Float32Array`. Use only the top 50 decoded candidates for display, but feed all 50,257 logits into the exact sampler and record their SHA-256 in trace schema 1.1.

## Consequences

- The verified path is mathematically eligible for exact sampling and deterministic replay.
- The accepted model asset is 327.8 MB rather than the 236.7 MB rejected int8 asset; loading remains opt-in and the instant illustrative path stays available.
- One expanded live trace is 23.06 MiB JSON and used approximately 187 MB of additional Node heap in the recorded harness. This is acceptable for the one-step Phase 2 proof, not for multi-step Phase 3 storage.
- A content-addressed compact logit payload is a Phase 3 prerequisite; the measured gzip floor for this trace is 1.10 MiB.
- Hidden states, attention and WebGPU remain unavailable for verified claims.

The source fixtures, accepted and rejected reports, tolerance profiles and exact live-replay report are under `fixtures/model-golden` and `model-tools/verification`.
