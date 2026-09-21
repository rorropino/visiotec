import crypto from "node:crypto";
import type { CanonicalIssue } from "./types.js";

const MARKER_RE = /<!--\s*linear-github-sync:(\{.*?\})\s*-->/gs;

export function stripSyncMarker(body: string): string {
  return body.replace(MARKER_RE, "").trim();
}

export function fingerprint(issue: CanonicalIssue): string {
  const normalized = JSON.stringify({
    title: issue.title.trim(),
    body: stripSyncMarker(issue.body).replace(/\r\n/g, "\n").trim(),
    state: issue.state,
  });
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
