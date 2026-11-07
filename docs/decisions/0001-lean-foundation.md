# 0001: One app, one tracker, lightweight factory

Date: 2026-11-07. Status: accepted for repository bootstrap.

## Decision

Use Expo + strict TypeScript in one npm package. GitHub Issues is the live tracker; PRs hold review and verification; this repo holds durable context. Use isolated branches/worktrees and one shared-contract owner per change. Keep independent review, tested outcomes and bounded escalation from factory-core without vendoring its private implementation or operational history.

Start with local fixtures and versioned runtime schemas. Keep future persistence and generation behind adapters. No backend or provider credentials are provisioned. Do not equate local-first with offline AI.

## Tradeoffs

This is easier for two people to understand and contribute to than a fleet of permanent factory roles. It has fewer automatic safeguards initially. Local checks exist, but PR/main automation and branch protections are explicitly unresolved. Choose and approve the runner, access and cost model before enabling automation.

## Revisit when

A second app genuinely needs shared packages; provider choice requires backend infrastructure; reliable autonomous work needs approved automation; or public submission requires a license/visibility decision.
