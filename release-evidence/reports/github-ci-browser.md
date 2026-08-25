# GitHub CI browser evidence

- Source candidate: `ae9f7605a9cf613695c4363faa3e5250b67673a8`
- Workflow: [CI run 28](https://github.com/Blazenetic/thinking-machine-observatory/actions/runs/32737565886)
- Browser artifact: `release-browser-evidence`, artifact ID `9523869778`
- Result: passed
- Observation date: 25 August 2026

The candidate installed Playwright 1.62.1 with Chromium, Firefox and WebKit, built the production
application and completed the checked browser suite with 33 passed journeys and six declared skips.
The run covered the illustrative hero loop, compact trace round-trip, keyboard reflection and
export, focus and target size, 200% reflow proxy, Chromium forced colours, cached-shell service and
interrupted model-load recovery.

The six skips were the opt-in network-backed live-model journey in all three engines, forced-colour
emulation in Firefox and WebKit, and WebKit offline automation. The run did not provide physical
device, real screen-reader, deployed-origin, learner-study or current hero screenshot evidence.

The post-Phase-5 evidence split records only the criteria this run actually established:

- `EV-CI-PLAYWRIGHT-ILLUSTRATIVE` — hero loop, named controls, table captions, reduced motion,
  24px targets and the supported-browser handback;
- `EV-CI-PLAYWRIGHT-OFFLINE-SHELL` — Chromium/Firefox cached-shell fetch plus in-session branch
  (not a full offline reload, not a cached model);
- `EV-CI-PLAYWRIGHT-INTERRUPT` — fixture-worker load interruption on the teaching path.

Remaining live-model, WebGPU-denied, visual-inspection, complete keyboard-order and screenshot
criteria stay in `EV-LOCAL-BROWSER-BLOCKED`. Read `release-evidence/summary.md` for the machine
decision.
