import type { SyncPair } from "./types.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const config = {
  linearApiKey: () => required("LINEAR_API_KEY"),
  linearWebhookSecret: () => required("LINEAR_WEBHOOK_SECRET"),
  githubToken: () => required("GITHUB_TOKEN"),
  githubWebhookSecret: () => required("GITHUB_WEBHOOK_SECRET"),
  cronSecret: () => required("CRON_SECRET"),
  pairs: (): SyncPair[] => {
    const parsed = JSON.parse(required("SYNC_PAIRS_JSON"));
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("SYNC_PAIRS_JSON must be a non-empty JSON array");
    }
    return parsed;
  },
};

export function pairForGitHub(repo: string): SyncPair {
  const pair = config.pairs().find((p) => p.githubRepo.toLowerCase() === repo.toLowerCase());
  if (!pair) throw new Error(`No sync pair configured for GitHub repo ${repo}`);
  return pair;
}

export function pairForLinear(teamId: string, teamKey?: string): SyncPair {
  const pair = config.pairs().find(
    (p) => p.linearTeamId === teamId || (teamKey && p.linearTeamKey === teamKey),
  );
  if (!pair) throw new Error(`No sync pair configured for Linear team ${teamKey ?? teamId}`);
  return pair;
}
