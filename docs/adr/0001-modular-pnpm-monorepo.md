# ADR 0001 — Modular pnpm monorepo

- Status: Accepted
- Date: 24 August 2026

## Context

Inference, deterministic sampling, trace lineage and visual presentation have different correctness and change boundaries. A single frontend source tree would make it easy for UI state to become the scientific record.

## Decision

Use pnpm workspaces with one browser application and dependency-directed packages for domain, sampler, trace schema, instruments, experiments and inference worker. Package exports point to TypeScript source during development. TypeScript project references validate the graph.

Do not add Turborepo, Nx or a backend in the foundation.

## Consequences

- Pure scientific modules are testable without a browser or model download.
- Runtime and renderer changes do not redefine trace semantics.
- Package boundaries add some manifests and TypeScript configuration.
- A task orchestrator may be reconsidered only if measured build/test time warrants it.
