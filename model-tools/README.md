# Model export and verification boundary

This directory owns reproducibility work for live model evidence. No unverified script is presented as a completed export pipeline in Phase 1.

## Current pinned candidate

| Item                                  | Value                                      | Status                   |
| ------------------------------------- | ------------------------------------------ | ------------------------ |
| Base target                           | DistilGPT2-compatible six-layer GPT-2      | Recommended              |
| Browser repository                    | `Xenova/distilgpt2`                        | Pinned for adapter spike |
| Revision                              | `a41c10485c18a64b6606729b6a082330cbd8f49e` | Pinned                   |
| Browser runtime                       | `@huggingface/transformers@3.8.1`          | Pinned                   |
| WASM dtype                            | `int8`                                     | Experimental             |
| WebGPU dtype                          | `fp16`                                     | Experimental             |
| Golden tolerance                      | None accepted                              | Blocking verification    |
| Instrumented hidden/attention outputs | Not exported                               | Unavailable              |

## Phase 2 reproducibility contract

An export or model adapter is accepted only when the repository contains:

1. exact source model and tokenizer revisions;
2. locked Python, PyTorch, Transformers, Optimum, ONNX and ONNX Runtime versions;
3. the export command and graph options;
4. SHA-256 hashes and licence/source metadata for every redistributed asset;
5. reference prompts covering ordinary text, punctuation, leading spaces and Unicode;
6. exact tokenizer ID/fragment fixtures;
7. full final-position reference logits or a lossless fixture sufficient for comparison;
8. per-dtype/backend absolute and relative error, rank agreement and accepted tolerance;
9. causal-mask and sequence-position checks; and
10. browser load, inference, memory and trace-size measurements.

Required first comparison:

- Prompt: `The night sky was`
- Tokenizer: exact IDs and decoded fragments must match.
- Logits: compare the complete vocabulary, not only top-N.
- Rankings: report top-50 agreement and every rank inversion near the sampling boundary.
- Sampler: feed the complete browser logits into `@observatory/sampler`, export a trace and replay the same selected token from recorded PRNG state.

## Purpose-built instrumentation

ONNX Runtime should be assumed to return declared graph outputs only. Hidden states or attention must be promoted to explicit outputs in a purpose-built graph and verified against the source framework. If an output is too expensive or unsupported, the corresponding instrument remains unavailable; it is never approximated without an evidence label and method record.
