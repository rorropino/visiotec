import { createHash } from "node:crypto";
import type { CanonicalIssue, SyncMarker } from "./types.js";

const MARKER_RE = /\n?<!-- LG_SYNC (\{.*?\}) -->\s*$/s;

export function stripMarker(text?: string | null): string {
  return (text ?? "").replace(MARKER_RE, "").trimEnd();
}

export function readMarker(text?: string | null): SyncMarker | null {
  const match = (text ?? "").match(MARKER_RE);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as SyncMarker;
  } catch {
    return null;
  }
}

export function appendMarker(text: string | null | undefined, marker: SyncMarker): string {
  const clean = stripMarker(text);
  return `${clean}${clean ? "\n\n" : ""}<!-- LG_SYNC ${JSON.stringify(marker)} -->`;
}

export function canonicalHash(issue: CanonicalIssue): string {
  return createHash("sha256")
    .update(JSON.stringify({ title: issue.title.trim(), body: issue.body.trim(), closed: issue.closed }))
    .digest("hex");
}

export function githubRef(repo: string, number: number): string {
  return `${repo}#${number}`;
}

export function parseGithubRef(ref?: string): { repo: string; number: number } | null {
  if (!ref) return null;
  const m = ref.match(/^(.+\/.+)#(\d+)$/);
  return m ? { repo: m[1], number: Number(m[2]) } : null;
}
