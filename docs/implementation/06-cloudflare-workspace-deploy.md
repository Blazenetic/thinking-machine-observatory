# Session 06 handover — Cloudflare workspace deploy target

## Outcome

The first Cloudflare Pages / Workers Builds deploy failed after a successful `pnpm build`. Wrangler
4.127.1 ran `npx wrangler deploy` at the pnpm workspace root and refused application detection.

This change adds an explicit static-asset target so the host's default deploy command can run from
`/`. It does not change the built application, sampler, worker protocol, evidence manifest or
accepted release claims. The Phase 5 source candidate remains
`ae9f7605a9cf613695c4363faa3e5250b67673a8`. This note was rebased onto current `main`
(`a63181c`); the broader follow-up review is
[06-post-phase-5-review](06-post-phase-5-review.md).

## Scientific boundary

No model path, header contract or evidence class changed. The host still serves
`apps/observatory/dist` with `public/_headers`. There is still no Worker script, Pages Function or
application backend.

## What landed

- repository-root `wrangler.toml` naming `./apps/observatory/dist` and no `main` script;
- ADR 0010 for the workspace-root Wrangler target;
- runbook dashboard settings for Workers Builds and the classic Pages output-directory path;
- static-release policy checks for the Wrangler target and workspace-root deploy command.

## Observed commands

Recorded on this branch after the change:

- `node --experimental-strip-types scripts/verify-static-release.ts` passed;
- `pnpm build` emitted `apps/observatory/dist` including `_headers` and `service-worker.js`;
- `npx wrangler@4.127.1 deploy` at a workspace root without `wrangler.toml` still failed with the
  original application-detection error;
- `npx wrangler@4.127.1 deploy --dry-run` from `/` with the committed config read
  `apps/observatory/dist` and exited 0. The same command with `-c wrangler.toml` also exited 0.

A live Cloudflare deploy is not claimed here. That remains a deployed-origin evidence record.

## Next bounded slice

Redeploy the existing Cloudflare project after this lands. Confirm the dashboard project name
matches `thinking-machine-observatory`, then attach the live URL, observed headers and commit to
the release manifest.
