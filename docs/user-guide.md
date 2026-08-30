# User guide

The Thinking Machine Observatory is a local-first learning instrument for next-token prediction.
Its shortest path uses a ten-candidate teaching fixture, so it works without downloading a model.
The sampler maths, branch lineage and comparisons are exact inside that declared fixture; the ten
starting logits are illustrative, not measured model output.

## Complete the first experiment

1. Open the **Observation floor** and inspect “The night sky was”. The prompt is intentionally
   locked so edited text cannot be mistaken for output from the fixture.
2. Review the ranked candidates and their probabilities in the Probability Spectrometer.
3. Choose **Force runner-up branch**. That action is itself a commit: it creates an interventional
   child that selects the second-ranked token. The baseline is unchanged.
4. Alternatively, change temperature, top-k, top-p, mode or seed, or **Suppress** a candidate, then
   choose **Commit branch 1**. Calibration previews stay reversible until that commit.
5. In the Branch Chamber, compare the selected tokens, entropy and Jensen–Shannon divergence.
6. Choose **Export selected trace JSON** to keep a portable local copy.

Changing temperature, top-k, top-p, mode, seed or candidate suppression produces a reversible
preview until you commit it. A forced token is an explicit intervention; it is not evidence of a
model's hidden preference, intent or thought.

## Read the evidence labels

| Label               | What it means in this instrument                                  |
| ------------------- | ----------------------------------------------------------------- |
| Illustrative        | Authored teaching input, clearly separated from model measurement |
| Measured            | Captured from the named runtime and model path                    |
| Derived             | Calculated exactly from declared inputs                           |
| Interventional      | Caused by a user override such as force or suppress               |
| Unverified measured | Runtime output that may be inspected but not committed as exact   |
| Unavailable         | The required source tensor or accepted method is not present      |

Unavailable hidden states, attention, probes and projections are not reconstructed or filled with
plausible-looking values.

## Optional verified local model

The **Load verified WASM** action fetches the pinned DistilGPT2 fp32 model and tokenizer and may
download about 327.8 MB on first use. It runs locally in a browser worker; no inference service is
called. Once ready, choose **Start new baseline**, pause on a complete 50,257-logit distribution,
then continue or fork the trace.

**Inspect with WebGPU** is experimental and unverified. Its output is inspection-only and cannot be
promoted to an exact committed trace. If the model path fails or the browser lacks a capability,
return to the teaching fixture; it contains the complete core experiment.

## Save, restore and export

- **Export ancestry bundle** downloads the active live trace plus the ancestors and verified
  content-addressed payloads required to replay it.
- **Save to local notebook** writes explicitly to this browser's IndexedDB. The application does
  not create an account or synchronise the notebook elsewhere.
- Clearing site data can remove the application cache and local notebook. Export important traces
  before clearing browser storage or changing devices.
- The production application shell can reopen offline after a successful online visit. The
  cross-origin model is not cached by that shell, and an uncached first visit does not work offline.

## Privacy and limitations

There is no account, analytics pipeline, prompt telemetry or application backend. Model files may
be fetched from the pinned upstream host, and exported files remain under your control. See the
[privacy statement](../PRIVACY.md) for the exact boundary.

Phase 5 browser, physical-device, screen-reader, deployed-origin and learner-study claims remain
evidence-gated. The current source candidate is implemented, but the generated
[release evidence summary](../release-evidence/summary.md) remains the authority on what has actually
passed.

## If something goes wrong

- If controls are disabled, read the nearby capability or status message before retrying.
- If a model load is slow, use **Cancel and return to demo**; no teaching-path work is lost.
- If an import is rejected, keep the original file. The app rejects oversized, malformed,
  incomplete or identity-mismatched bundles rather than partially accepting them.
- If local notebook storage is full, export a bundle before removing any stored traces. Parent
  traces with descendants are protected from accidental deletion.
