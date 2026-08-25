# Phase 5 manual review ledger

This file defines the manual observations still required for the bound source candidate. Do not
turn a checklist mark into `passed` without adding the named environment, reviewer, date, method,
result and limitation to `manifest.json`.

| Review                                  | Minimum environment                         | Current result | Required artefact                                                                     |
| --------------------------------------- | ------------------------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| Keyboard workflow and focus/read order  | Desktop browser, keyboard only              | partial        | Full tab-order notes; CI covers named-control activation of the first experiment only |
| Screen-reader smoke                     | One named desktop screen reader and browser | not-run        | Task notes; no prompt content                                                         |
| 200% zoom and target-size visual review | 1280×720 desktop viewport                   | not-run        | Screenshot and overflow notes                                                         |
| Physical Android smoke                  | Current Android Chrome phone or tablet      | not-run        | Device/browser version and task result                                                |
| Real Safari smoke                       | Current Safari on macOS or iOS              | not-run        | Device/browser version and task result                                                |
| Deployed-origin CSP/header smoke        | Exact candidate URL                         | not-run        | Header capture and hero-loop result                                                   |
| Dependency/security disposition         | Candidate lockfile                          | passed         | `reports/local-quality.md` (`pnpm audit --prod --audit-level high`)                   |
| Scientific copy review                  | All user-facing release copy                | passed         | `reports/scientific-copy-review.md`                                                   |

“Partial” is not `passed`. Do not copy it into `manifest.json` as a launch result. Playwright
keyboard _activation_ of Force runner-up, reflection append and export is recorded on
`EV-CI-PLAYWRIGHT-ILLUSTRATIVE`. Complete prompt → pause → intervene → branch → compare → save
tab order remains a launch blocker (TMO-A11Y-001 / TMO-A11Y-002).

The local harness could not install a browser because its Playwright download was returned as a
zero-byte or truncated archive. That is an environment block, not a failed browser result and not a
reason to remove the GitHub browser gate.
