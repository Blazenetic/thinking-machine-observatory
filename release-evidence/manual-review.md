# Phase 5 manual review ledger

This file defines the manual observations still required for the bound source candidate. Do not
turn a checklist mark into `passed` without adding the named environment, reviewer, date, method,
result and limitation to `manifest.json`.

| Review                                  | Minimum environment                         | Current result | Required artefact                      |
| --------------------------------------- | ------------------------------------------- | -------------- | -------------------------------------- |
| Keyboard workflow and focus/read order  | Desktop browser, keyboard only              | not-run        | Structured observation notes           |
| Screen-reader smoke                     | One named desktop screen reader and browser | not-run        | Task notes; no prompt content          |
| 200% zoom and target-size visual review | 1280×720 desktop viewport                   | not-run        | Screenshot and overflow notes          |
| Physical Android smoke                  | Current Android Chrome phone or tablet      | not-run        | Device/browser version and task result |
| Real Safari smoke                       | Current Safari on macOS or iOS              | not-run        | Device/browser version and task result |
| Deployed-origin CSP/header smoke        | Exact candidate URL                         | not-run        | Header capture and hero-loop result    |
| Dependency/security disposition         | Candidate lockfile                          | not-run        | Audit output and reviewed exceptions   |
| Scientific copy review                  | All user-facing release copy                | not-run        | Reviewer notes and search protocol     |

The local harness could not install a browser because its Playwright download was returned as a
zero-byte or truncated archive. That is an environment block, not a failed browser result and not a
reason to remove the GitHub browser gate.
