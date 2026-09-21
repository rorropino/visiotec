import type { ConflictStrategy, SyncDecision, SyncRecord } from "./types.js";

export function decideSync(
  record: SyncRecord,
  linearHash: string,
  githubHash: string,
  linearUpdatedAt: string,
  githubUpdatedAt: string,
  strategy: ConflictStrategy,
): SyncDecision {
  const linearChanged = linearHash !== record.linearHash;
  const githubChanged = githubHash !== record.githubHash;

  if (!linearChanged && !githubChanged) return { action: "noop" };
  if (linearChanged && !githubChanged) return { action: "linear-to-github" };
  if (!linearChanged && githubChanged) return { action: "github-to-linear" };

  if (strategy === "linear-wins") return { action: "conflict", winner: "linear" };
  if (strategy === "github-wins") return { action: "conflict", winner: "github" };

  return new Date(linearUpdatedAt) >= new Date(githubUpdatedAt)
    ? { action: "conflict", winner: "linear" }
    : { action: "conflict", winner: "github" };
}
