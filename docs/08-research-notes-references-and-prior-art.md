08 — Research Notes, References and Prior Art

Feasibility findings and authoritative starting references

# Research conclusion

The concept is feasible, but the deepest instrumentation requires a purpose-built model export. Existing browser tools validate local GPT-style inference and transformer education; the Observatory must differentiate through intervention, branching, deterministic traces and unusually explicit scientific integrity.

# Prior-art position

| Reference | What it validates | Observatory response |
| :---- | :---- | :---- |
| Transformer Explainer | Live GPT-style model and multilevel transformer explanation in-browser | Do not copy its walkthrough; focus on intervention, lineage and evidence |
| Transformers.js | Browser tokenisation/inference, WebGPU and quantised model options | Use selectively for assets/tokeniser/fallbacks |
| ONNX Runtime Web | WebGPU/WASM execution and direct ONNX control | Use for instrumented graph path |
| WebLLM | Fast local LLM generation and familiar API surface | Optional later adapter; primary API may hide required tensors |
| DistilGPT2 | Small, understandable six-layer GPT-2-class model | Strong initial instrument target |
| Tuned Lens | More careful layerwise decoding than naive logit lens | Future probe with separate assets/provenance |

# Key findings

* A Georgia Tech open-source Transformer Explainer already runs GPT-2-class inference in the browser, so a simple animated pipeline would not be novel.  
* Transformers.js supports browser execution, WebGPU paths and multiple dtypes; its standalone tokeniser work lowers the cost of a focused tokenizer integration.  
* ONNX Runtime Web exposes a WebGPU execution provider suitable for browser inference, with WASM remaining useful for lighter models or fallback.  
* Arbitrary intermediate tensors should not be assumed available at runtime; required nodes usually need to be declared as graph outputs.  
* DistilGPT2’s six layers, twelve heads and approximately 82 million parameters make it more tractable for instrumented learning than larger models.  
* Attention is a measurement but not automatically an explanation; interface language and experiments must make that distinction.  
* A tuned lens can improve layerwise decoding, but it is a separately trained/provenanced probe rather than a free interpretation of hidden states.  
* WebGPU support and device capacity vary, so capability detection, HTTPS deployment, WASM and demonstration traces are part of the product.

# Architecture implications

* Prove an instrumented export in a feasibility spike before investing heavily in visual design.  
* Expose only selected hidden states/heads/layers initially to control bandwidth and memory.  
* Own sampler mathematics and seeded PRNG in application code so the explanation and trace are exact.  
* Pin and hash model/tokenizer assets; trace compatibility depends on them.  
* Keep the model adapter interface honest: a modern model mode may expose fewer measurements.  
* Use projections and probes as optional labelled instruments rather than mixing them into measured data.

# Primary references

* [Transformer Explainer repository](https://github.com/poloclub/transformer-explainer) — Open-source in-browser educational tool and implementation reference.  
* [Transformer Explainer paper](https://arxiv.org/html/2408.04619v1) — Research framing and multi-level interactive explanation.  
* [Transformers.js documentation](https://huggingface.co/docs/transformers.js/en/index) — Official browser inference, device and dtype guidance.  
* [Transformers.js v4 announcement](https://huggingface.co/blog/transformersjs-v4) — Standalone tokeniser and current v4 direction.  
* [ONNX Runtime Web WebGPU guide](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html) — Official WebGPU execution-provider setup and behaviour.  
* [ONNX intermediate-output example](https://onnx.ai/sklearn-onnx/auto_examples/plot_intermediate_outputs.html) — Shows the need to modify graph outputs for intermediate values.  
* [DistilGPT2 model card](https://huggingface.co/distilbert/distilgpt2) — Model identity, intended use and limitations.  
* [Distillation research project notes](https://github.com/huggingface/transformers-research-projects/blob/main/distillation/README.md) — Six-layer, twelve-head, 82M architecture details.  
* [Attention is not Explanation](https://arxiv.org/abs/1902.10186) — Foundational caution against treating attention as explanation.  
* [Tuned Lens paper](https://arxiv.org/html/2303.08112v5) — Method and limits for improved layerwise decoding.  
* [WebGPU specification](https://www.w3.org/TR/webgpu/) — Primary WebGPU standard.  
* [MDN WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) — Practical browser/API support reference.  
* [WebLLM repository](https://github.com/mlc-ai/web-llm) — Alternative local browser generation runtime.  
* [SmolLM2-135M-Instruct model card](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct) — Possible later modern compact-model mode.

# Prior-art licence and reuse note

Treat source code, model weights, datasets, icons and fonts as separately licensed assets. Verify each licence before reuse, retain required notices, and prefer learning from interaction patterns over copying visual identity. Document model-card limitations and any redistribution constraints in the repository.

# Research questions for the feasibility spike

* Which DistilGPT2 ONNX export produces correct logits on both WebGPU and WASM?  
* What additional graph outputs are available without unsupported operators or unacceptable memory growth?  
* Can attention be exported per selected layer/head rather than as a full retained history?  
* What quantisation preserves candidate rank well enough for the intended demonstrations?  
* What is the smallest trace sufficient for deterministic sampler replay and credible comparison?  
* Which browsers/devices can run the live path, and where should demonstration mode be the default?