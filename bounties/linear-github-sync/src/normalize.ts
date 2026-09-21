import type { CanonicalIssue } from "./types.js";

export function fromGithub(issue: any): CanonicalIssue {
  return {
    title: issue.title,
    body: issue.body ?? "",
    state: issue.state === "closed" ? "closed" : "open",
    updatedAt: issue.updated_at,
  };
}

export function fromLinear(issue: any): CanonicalIssue {
  return {
    title: issue.title,
    body: issue.description ?? "",
    state: issue.state?.type === "completed" || issue.state?.type === "canceled" ? "closed" : "open",
    updatedAt: issue.updatedAt,
  };
}
