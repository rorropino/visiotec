import type { ConflictStrategy } from "./types.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  githubToken: () => required("GITHUB_TOKEN"),
  githubOwner: () => required("GITHUB_OWNER"),
  githubRepo: () => required("GITHUB_REPO"),
  githubWebhookSecret: () => required("GITHUB_WEBHOOK_SECRET"),
  linearApiKey: () => required("LINEAR_API_KEY"),
  linearTeamId: () => required("LINEAR_TEAM_ID"),
  linearWebhookSecret: () => required("LINEAR_WEBHOOK_SECRET"),
  cronSecret: () => required("CRON_SECRET"),
  conflictStrategy: (): ConflictStrategy =>
    (process.env.CONFLICT_STRATEGY as ConflictStrategy | undefined) ?? "latest-wins",
};
