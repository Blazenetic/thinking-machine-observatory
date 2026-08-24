# Visual evidence

Session 01 screenshots are generated from the production build with `pnpm capture:evidence` while the preview server is running.

These images document the original illustrative hero loop; they are not presented as current Phase
5 browser or release-candidate evidence. Phase 5 browser installation was blocked in the local
harness, so new candidate screenshots and recordings remain unresolved in
`release-evidence/summary.md` until they are captured against the bound candidate.

- `session-01-welcome.png` — first-view identity and integrity boundary.
- `session-01-workbench.png` — probability instrument and calibration controls after forcing the runner-up.
- `session-01-branch-chamber.png` — immutable baseline/child comparison.
- `session-01-mobile.png` — 390 × 844 reduced-width observation view.

These screenshots show the illustrative teaching path. Phase 2 numerical evidence is deliberately machine-readable rather than inferred from screenshots:

- `fixtures/model-golden/source-fp32` — source-framework token and full-logit fixtures;
- `fixtures/model-golden/wasm-fp32` — accepted runtime full-logit fixtures;
- `model-tools/verification/wasm-fp32-report.json` — accepted comparison;
- `model-tools/verification/wasm-int8-report.json` — preserved rejection; and
- `model-tools/verification/live-trace-report.json` — exact selected-token export/import/replay and trace-size evidence.
- `model-tools/verification/compact-payload-spike-report.json` — Phase 3 compact representation and exact sampler-equivalence evidence.
- `release-evidence/manifest.json` — candidate-bound automated, blocked and unrun release records.
- `release-evidence/summary.md` — generated release decision; the authoritative status for Phase 5.

The live interface remains covered by an opt-in network-backed Playwright test. A screenshot alone is not accepted as proof of numerical equivalence.
