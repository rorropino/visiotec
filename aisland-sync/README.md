# Linear ↔ GitHub two-way sync

A minimal TypeScript implementation for AislandLab bounty `c5e63516-0f98-4957-99bd-7b375c08072d`.

## Features
- Two-way issue synchronization through Linear and GitHub adapters.
- Deterministic conflict resolution: unchanged side loses; simultaneous edits use latest `updatedAt`.
- GitHub and Linear HMAC-verified webhook endpoints.
- Cron runner for reconciliation after missed/out-of-order webhooks.
- Tests for conflict resolution.

## Run
`npm install && npm test && npm run build`

Set `LINEAR_TOKEN`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `SYNC_LINKS`, `GITHUB_WEBHOOK_SECRET`, and `LINEAR_WEBHOOK_SECRET`. Start webhook service with `npm start`; schedule `npm run cron` at the desired reconciliation interval.

`SYNC_LINKS` is JSON such as `[{"linearId":"LIN-123","githubId":"42","lastLinear":"...","lastGithub":"..."}]`.

## Conflict policy
Each link stores the timestamps observed at the previous successful reconciliation. If only one side changed, it is authoritative. If both changed, latest-update-wins. The cron provides eventual convergence if a webhook is missed.