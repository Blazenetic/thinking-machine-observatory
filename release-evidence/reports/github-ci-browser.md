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
Those boundaries are why the grouped browser evidence record remains `blocked` even though this CI
run passed.
