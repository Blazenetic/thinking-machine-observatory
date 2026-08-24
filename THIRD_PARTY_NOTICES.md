# Third-party notices

The Observatory keeps application source, runtime dependencies and remotely fetched model assets
as separate licensing concerns. This file is a notice, not a replacement for the upstream licence
texts.

| Component                                | Pinned version or identity                          | Declared licence | Distribution in this repository                                    |
| ---------------------------------------- | --------------------------------------------------- | ---------------- | ------------------------------------------------------------------ |
| React and React DOM                      | 19.2.8                                              | MIT              | Package-manager dependency                                         |
| Vite                                     | 8.2.2                                               | MIT              | Development dependency; generated bundle only                      |
| Transformers.js                          | 3.8.1                                               | Apache-2.0       | Package-manager dependency bundled into the worker                 |
| ONNX Runtime Web                         | 1.22.0 development pin                              | MIT              | Transitive runtime used by Transformers.js                         |
| Xenova/distilgpt2                        | revision `a41c10485c18a64b6606729b6a082330cbd8f49e` | Apache-2.0       | Fetched from the pinned upstream source; weights are not committed |
| DistilGPT2 reference model and tokenizer | pinned hashes in the model manifest                 | Apache-2.0       | Reference generation input; weights are not committed              |

The interface uses system font fallbacks and contains no downloaded font package. Checked
screenshots and trace fixtures were generated from this project. Exact model and tokenizer URLs,
hashes and sizes are recorded in `fixtures/model-golden/source-fp32/manifest.json`.

Before redistributing model weights or replacing a pinned asset, re-check its source licence and
model-card conditions and update this notice and the manifest in the same change.
