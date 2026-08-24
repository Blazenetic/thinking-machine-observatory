# Model evidence and reproducibility

This directory owns the boundary between a genuine runtime value and a verified Observatory measurement. Large model weights are fetched from their pinned source and are not committed here.

## Accepted and rejected targets

| Item                        | Pinned value                                                               | Status              |
| --------------------------- | -------------------------------------------------------------------------- | ------------------- |
| Source model                | `distilbert/distilgpt2@2290a62682d06624634c1f46a6ad5be0f47f38aa`           | Golden fp32         |
| Source weights              | SHA-256 `e1ff18884359fe8beb795a5f414feb85a6ce3d929ad019c0d958c039d2b94a1b` | Verified locally    |
| Browser model/tokenizer     | `Xenova/distilgpt2@a41c10485c18a64b6606729b6a082330cbd8f49e`               | Pinned              |
| Browser tokenizer inventory | SHA-256 `fb803549cd431422aa2398fd669a1b2cff3ac8c57ff5843d9a65869a4df0b592` | Exact IDs/fragments |
| `onnx/model.onnx`           | SHA-256 `d605c4b3740df3960e8f84e4c5735af8d81d19105eb915b692272c08cc800b0c` | fp32 WASM accepted  |
| `onnx/model_int8.onnx`      | SHA-256 `80b02da4fe266412bc49c9955a518151c50f9bac062f596a875068492a21f080` | int8 WASM rejected  |
| `onnx/model_fp16.onnx`      | SHA-256 `0f1853d55a420459d178be4c1804577ec0e4b992568c3991ebdf292b1f4319c0` | WebGPU unverified   |

Both model repositories declare Apache-2.0. Exact source URLs, every small asset hash, sizes and package versions are in `fixtures/model-golden/source-fp32/manifest.json`.

## Checked evidence

- `reference/prompts.json` covers ordinary text, mixed punctuation, Unicode and leading spaces.
- `fixtures/model-golden/source-fp32` contains exact token specimens and four little-endian 50,257-value PyTorch fp32 vectors.
- `fixtures/model-golden/wasm-fp32` contains the corresponding ONNX Runtime Web WASM vectors.
- `verification/wasm-fp32-tolerance.json` is the accepted numerical gate.
- `verification/wasm-fp32-report.json` records the accepted comparison.
- `verification/wasm-int8-report.json` preserves why the smaller graph was rejected.
- `verification/live-trace-report.json` proves the accepted hero vector survives exact sample, JSON import and replay.

`pnpm fixtures:check` hashes the vectors and re-evaluates the accepted errors/ranks without downloading weights. `pnpm trace:verify:live` exercises the production sampler and trace parser with the accepted hero vector. Both run in ordinary CI.

## Reference environment

Use Python 3.12.13 and a fresh virtual environment. The direct and transitive packages used for generation are pinned in `reference/requirements.lock`.

```bash
python3.12 -m venv /tmp/observatory-reference
source /tmp/observatory-reference/bin/activate
python -m pip install --upgrade pip
python -m pip install -r model-tools/reference/requirements.lock
```

Download both browser graphs at the pinned browser revision with Hugging Face Hub tooling, then make their local paths explicit. The generator verifies their SHA-256 before it marks `verifiedFromLocalBytes` true.

```bash
huggingface-cli download Xenova/distilgpt2 \
  onnx/model.onnx onnx/model_int8.onnx \
  --revision a41c10485c18a64b6606729b6a082330cbd8f49e \
  --local-dir /tmp/observatory-browser-model
export OBSERVATORY_ONNX_MODEL_FP32=/tmp/observatory-browser-model/onnx/model.onnx
export OBSERVATORY_ONNX_MODEL_INT8=/tmp/observatory-browser-model/onnx/model_int8.onnx
export HF_HOME=/tmp/observatory-hf
pnpm model:golden:generate
```

Generation also downloads the pinned source weights and small tokenizer/config assets into `HF_HOME`. No mutable branch name such as `main` participates in the evidence identity.

## Re-run ONNX Runtime Web verification

Install the Node workspace, set both local graph paths and run:

```bash
export OBSERVATORY_ONNX_MODEL_FP32=/path/to/onnx/model.onnx
export OBSERVATORY_ONNX_MODEL_INT8=/path/to/onnx/model_int8.onnx
pnpm model:verify
```

To deliberately refresh reports and accepted runtime vectors after reviewing a model/runtime change:

```bash
OBSERVATORY_ONNX_MODEL="$OBSERVATORY_ONNX_MODEL_FP32" \
  node packages/inference-worker/scripts/verify-golden.mjs \
  --variant fp32 --write-report --write-observed-dir fixtures/model-golden/wasm-fp32

OBSERVATORY_ONNX_MODEL="$OBSERVATORY_ONNX_MODEL_INT8" \
  node packages/inference-worker/scripts/verify-golden.mjs \
  --variant int8 --expect-rejection --write-report

pnpm trace:verify:live --write-report
```

Report refreshes are evidence changes, not snapshots to accept blindly. Review hashes, token specimens, every failed gate and performance environment before committing them.

## Tolerance rationale

The fp32 profile requires exact tokenisation, exact top-1, 50/50 top-50 overlap, maximum absolute and shift-aligned errors at most `0.0002`, corresponding mean errors at most `0.00005`, and an exactly unchanged causal prefix. The observed maximum absolute error is below `0.000077`, leaving margin without relaxing ranks.

The int8 profile intentionally allowed much larger numeric error while retaining exact top-1 and causal semantics. It still failed. The live adapter therefore uses fp32; it does not choose a tolerance after the fact to admit the smaller graph.

## Purpose-built instrumentation

ONNX Runtime exposes only declared graph outputs. Hidden states or attention must be promoted to explicit outputs in a purpose-built graph and independently verified against the source framework. Until that work passes its own profile, the corresponding instrument remains unavailable rather than approximated.
