import { config } from "./config.js";
import type { CanonicalIssue, GitHubIssue } from "./types.js";

const API = "https://api.github.com";

async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.githubToken()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "linear-github-sync",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function getGitHubIssue(repo: string, number: number): Promise<GitHubIssue> {
  return gh<GitHubIssue>(`/repos/${repo}/issues/${number}`);
}

export async function createGitHubIssue(
  repo: string,
  issue: CanonicalIssue,
): Promise<GitHubIssue> {
  const created = await gh<GitHubIssue>(`/repos/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({ title: issue.title, body: issue.body }),
  });
  if (issue.closed) return updateGitHubIssue(repo, created.number, issue);
  return created;
}

export async function updateGitHubIssue(
  repo: string,
  number: number,
  issue: CanonicalIssue,
): Promise<GitHubIssue> {
  return gh<GitHubIssue>(`/repos/${repo}/issues/${number}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: issue.title,
      body: issue.body,
      state: issue.closed ? "closed" : "open",
    }),
  });
}

export async function listGitHubIssues(repo: string): Promise<GitHubIssue[]> {
  return gh<GitHubIssue[]>(`/repos/${repo}/issues?state=all&per_page=100&sort=updated&direction=desc`);
}
