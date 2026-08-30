# ADR 0010 — Explicit Wrangler target at the workspace root

- Status: Accepted
- Date: 28 August 2026

## Context

The Observatory is a pnpm workspace. The prepared static host builds from the repository root so
install and `pnpm build` can see every package. Cloudflare Workers Builds then runs
`npx wrangler deploy` from that same root.

Wrangler 4.x application detection refuses to guess a package at a workspace root when no
configuration file is present. A first Pages deploy therefore failed after a successful Vite
build with: the detection logic was run in the root of a workspace instead of targeting a
specific project.

Adding Wrangler as a workspace dependency would make a host tool part of the application lockfile.
Pointing the Cloudflare root directory at `apps/observatory` would break the workspace install.

## Decision

Commit a repository-root `wrangler.toml` that names the built observatory assets and no Worker
script. Keep Wrangler out of `package.json`. Dashboard builds continue to use `pnpm build` and
`npx wrangler deploy` from `/`.

The Cloudflare project name must match `thinking-machine-observatory`. Classic Pages output-directory
uploads remain valid and do not require this file.

## Consequences

- The default host deploy command can target the static bundle without changing the dashboard
  working directory.
- `_headers` remains the security-header contract; Vite still copies it into `apps/observatory/dist`.
- A renamed Cloudflare project must be reconciled with `wrangler.toml` before the next deploy.
- This does not introduce Functions, a Worker script or an application backend.
