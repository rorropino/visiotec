# Linear ↔ GitHub two-way issue sync

Production-oriented TypeScript implementation for the AislandLab **Linear-GitHub two-way sync** bounty.

## What it does

- Synchronizes issues in both directions: **GitHub → Linear** and **Linear → GitHub**.
- Creates the missing counterpart automatically.
- Synchronizes title, description/body, and open/completed state.
- Resolves concurrent edits deterministically using the last synchronized content hash plus source timestamps.
- Prevents webhook loops by embedding an invisible sync marker in both issue bodies.
- Verifies both GitHub and Linear webhook signatures with HMAC-SHA256.
- Adds a reconciliation cron so missed webhook deliveries are repaired automatically.
- Supports multiple Linear-team ↔ GitHub-repository pairs through configuration.
- Ignores GitHub pull requests when reconciling the issue endpoint.

## Architecture

```
GitHub issue webhook ─┐
                      ├─> sync engine ─> Linear GraphQL API
Linear issue webhook ─┘        │
                               └─> GitHub REST API

Vercel Cron ─────────────> full reconciliation pass
```

The service keeps no external database. Mapping and synchronization state live in an invisible HTML comment appended to both issue descriptions:

```html
<!-- LG_SYNC {"linearId":"...","github":"owner/repo#42","hash":"...","syncedAt":"..."} -->
```

That makes deployment simple and keeps the service restart-safe.

## Conflict resolution

Each synchronized issue stores the SHA-256 hash of the last canonical state.

On every webhook or cron reconciliation:

1. If both sides match, nothing is written.
2. If only one side differs from the last synchronized hash, that side wins.
3. If both sides changed, the newest `updatedAt` timestamp wins.
4. Exact timestamp ties resolve to GitHub for deterministic behavior.
5. The winning state is written to both systems with a new shared hash.

This is a true two-way reconciliation strategy rather than a one-direction mirror.

## Endpoints

- `POST /api/github-webhook`
- `POST /api/linear-webhook`
- `GET /api/cron`
- `GET /api/health`

## Configuration

Copy `.env.example` and configure:

```bash
LINEAR_API_KEY=lin_api_xxx
LINEAR_WEBHOOK_SECRET=xxx
GITHUB_TOKEN=github_pat_xxx
GITHUB_WEBHOOK_SECRET=xxx
CRON_SECRET=xxx
SYNC_PAIRS_JSON=[{"linearTeamId":"TEAM_UUID","linearTeamKey":"ENG","githubRepo":"owner/repo"}]
```

The GitHub token needs Issues read/write access to every configured repository.

## Webhook setup

### GitHub

Create a repository webhook pointing to:

```
https://YOUR_DEPLOYMENT/api/github-webhook
```

Subscribe to **Issues** events and configure the same secret used in `GITHUB_WEBHOOK_SECRET`.

### Linear

Create a Linear webhook pointing to:

```
https://YOUR_DEPLOYMENT/api/linear-webhook
```

Subscribe to **Issue** events and configure the signing secret as `LINEAR_WEBHOOK_SECRET`.

## Cron

`vercel.json` schedules:

```
*/10 * * * *
```

The cron endpoint also validates `Authorization: Bearer $CRON_SECRET`.

## Local validation

```bash
npm install
npm run typecheck
npm test
```

Tests cover marker round-tripping, canonical hashing, GitHub-reference parsing, and webhook signature verification.

## Deploy

Set the Vercel project root directory to:

```
bounties/linear-github-sync
```

Then add the environment variables and deploy.

## Security notes

- Raw webhook bodies are verified before JSON parsing.
- HMAC comparisons use `timingSafeEqual`.
- API credentials are environment-only and never committed.
- Unsupported webhook types are ignored.
- GitHub PRs are excluded from issue reconciliation.

## Bounty deliverable

Branch:

```
bounty-linear-github-sync
```

Implementation directory:

```
bounties/linear-github-sync
```
