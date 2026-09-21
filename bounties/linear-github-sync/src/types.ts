export type Side = "github" | "linear";

export interface SyncPair {
  linearTeamId: string;
  linearTeamKey?: string;
  githubRepo: string;
}

export interface SyncMarker {
  linearId?: string;
  github?: string;
  hash: string;
  syncedAt: string;
}

export interface CanonicalIssue {
  title: string;
  body: string;
  closed: boolean;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  updated_at: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  updatedAt: string;
  team: { id: string; key: string };
  state: { id: string; name?: string; type: string };
}
