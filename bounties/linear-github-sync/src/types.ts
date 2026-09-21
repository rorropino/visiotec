export type SyncRecord = {
  linearId: string;
  githubNumber: number;
  linearHash: string;
  githubHash: string;
  lastLinearUpdatedAt: string;
  lastGithubUpdatedAt: string;
  lastSyncedAt: string;
};

export type CanonicalIssue = {
  title: string;
  body: string;
  state: "open" | "closed";
  updatedAt: string;
};

export type ConflictStrategy = "latest-wins" | "linear-wins" | "github-wins";

export type SyncDecision =
  | { action: "noop" }
  | { action: "linear-to-github" }
  | { action: "github-to-linear" }
  | { action: "conflict"; winner: "linear" | "github" };
