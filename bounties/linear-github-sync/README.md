# Linear ↔ GitHub two-way sync

Production-oriented TypeScript implementation for the AislandLab bounty.

## What it does

- GitHub Issue → Linear Issue synchronization.
- Linear Issue → GitHub Issue synchronization.
- Synchronizes title, description/body and open/closed workflow state.
- GitHub webhook for near real-time updates.
- Linear webhook for near real-time updates.
- Vercel Cron reconciliation every 10 minutes to recover missed webhooks.
- Durable mapping/checkpoint stored in a hidden GitHub issue marker; no database required.
- Content-hash conflict detection prevents webhook feedback loops.
- Conflict strategies: `latest-wins` (default), `linear-wins`, or `github-wins`.
- HMAC verification for both webhook providers.
- Idempotent reconciliation.

## Deploy

Deploy the `bounties/linear-github-sync` directory as the Vercel project root and configure the variables in `.env.example`.

Webhook URLs after deployment:

- GitHub: `https://YOUR_HOST/api/webhooks/github`
- Linear: `https://YOUR_HOST/api/webhooks/linear`
- Cron: `https://YOUR_HOST/api/cron/sync`

For GitHub, subscribe to Issue events and use the same value as `GITHUB_WEBHOOK_SECRET`.
For Linear, create an Issue webhook and use its signing secret as `LINEAR_WEBHOOK_SECRET`.

Vercel automatically sends `Authorization: Bearer $CRON_SECRET` to cron invocations when `CRON_SECRET` is configured.

## Conflict model

Each paired GitHub issue contains an HTML comment with the Linear ID, GitHub number, content hashes and last synchronization timestamps. The marker is stripped before calculating canonical content, so writing the checkpoint itself never causes a sync loop.

When both sides changed since the last checkpoint, the selected strategy resolves the collision. Under `latest-wins`, the side with the newest provider `updatedAt` wins.

## Validation

```bash
npm install
npm run build
npm test
```

The included test suite covers one-sided updates, simultaneous conflicts, explicit conflict preferences and checkpoint round-tripping.
