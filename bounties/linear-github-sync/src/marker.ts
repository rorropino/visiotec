import type { SyncRecord } from "./types.js";

const MARKER_RE = /<!--\s*linear-github-sync:(\{.*?\})\s*-->/s;

export function extractSyncRecord(body: string | null | undefined): SyncRecord | null {
  if (!body) return null;
  const match = body.match(MARKER_RE);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]) as SyncRecord;
    if (!parsed.linearId || !parsed.githubNumber) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function upsertSyncRecord(body: string, record: SyncRecord): string {
  const marker = `<!-- linear-github-sync:${JSON.stringify(record)} -->`;
  if (MARKER_RE.test(body)) return body.replace(MARKER_RE, marker);
  return `${body.trim()}\n\n${marker}\n`;
}
