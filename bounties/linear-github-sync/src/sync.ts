import { config } from "./config.js";
import { decideSync } from "./conflict.js";
import { fingerprint, stripSyncMarker } from "./content.js";
import { createGithubIssue, getGithubIssue, listGithubIssues, updateGithubIssue } from "./github.js";
import { createLinearIssue, getLinearIssue, listLinearIssues, updateLinearIssue } from "./linear.js";
import { extractSyncRecord, upsertSyncRecord } from "./marker.js";
import { fromGithub, fromLinear } from "./normalize.js";
import type { CanonicalIssue, SyncRecord } from "./types.js";

function clean(issue: CanonicalIssue): CanonicalIssue {
  return { ...issue, body: stripSyncMarker(issue.body) };
}

function recordFor(linear: any, github: any, linearIssue: CanonicalIssue, githubIssue: CanonicalIssue): SyncRecord {
  return {
    linearId: linear.id,
    githubNumber: github.number,
    linearHash: fingerprint(clean(linearIssue)),
    githubHash: fingerprint(clean(githubIssue)),
    lastLinearUpdatedAt: linear.updatedAt,
    lastGithubUpdatedAt: github.updated_at,
    lastSyncedAt: new Date().toISOString(),
  };
}

async function persistRecord(githubNumber: number, githubCanonical: CanonicalIssue, record: SyncRecord) {
  const body = upsertSyncRecord(clean(githubCanonical).body, record);
  return updateGithubIssue(githubNumber, { ...githubCanonical, body });
}

export async function pairFromGithub(githubNumber: number) {
  const github = await getGithubIssue(githubNumber);
  const existing = extractSyncRecord(github.body);
  if (existing) return syncPair(existing);

  const githubCanonical = clean(fromGithub(github));
  const linear = await createLinearIssue(githubCanonical);
  const linearCanonical = clean(fromLinear(linear));
  const record = recordFor(linear, github, linearCanonical, githubCanonical);
  await persistRecord(github.number, githubCanonical, record);
  return { created: "linear", linearId: linear.id, githubNumber: github.number };
}

export async function pairFromLinear(linearId: string) {
  const githubIssues = await listGithubIssues();
  const mapped = githubIssues.find((issue) => extractSyncRecord(issue.body)?.linearId === linearId);
  if (mapped) return syncPair(extractSyncRecord(mapped.body)!);

  const linear = await getLinearIssue(linearId);
  const linearCanonical = clean(fromLinear(linear));
  const github = await createGithubIssue(linearCanonical);
  const githubCanonical = clean(fromGithub(github));
  const record = recordFor(linear, github, linearCanonical, githubCanonical);
  await persistRecord(github.number, githubCanonical, record);
  return { created: "github", linearId: linear.id, githubNumber: github.number };
}

export async function syncPair(record: SyncRecord) {
  const [linear, github] = await Promise.all([
    getLinearIssue(record.linearId),
    getGithubIssue(record.githubNumber),
  ]);

  const linearCanonical = clean(fromLinear(linear));
  const githubCanonical = clean(fromGithub(github));
  const linearHash = fingerprint(linearCanonical);
  const githubHash = fingerprint(githubCanonical);
  const decision = decideSync(
    record,
    linearHash,
    githubHash,
    linearCanonical.updatedAt,
    githubCanonical.updatedAt,
    config.conflictStrategy(),
  );

  if (decision.action === "noop") return { action: "noop", record };

  let updatedLinear = linear;
  let updatedGithub = github;
  let finalLinear = linearCanonical;
  let finalGithub = githubCanonical;

  if (decision.action === "linear-to-github" || (decision.action === "conflict" && decision.winner === "linear")) {
    updatedGithub = await updateGithubIssue(record.githubNumber, linearCanonical);
    finalGithub = clean(fromGithub(updatedGithub));
  } else {
    updatedLinear = await updateLinearIssue(record.linearId, githubCanonical);
    finalLinear = clean(fromLinear(updatedLinear));
  }

  const nextRecord = recordFor(updatedLinear, updatedGithub, finalLinear, finalGithub);
  await persistRecord(record.githubNumber, finalGithub, nextRecord);

  return { action: decision.action, winner: "winner" in decision ? decision.winner : undefined, record: nextRecord };
}

export async function fullReconcile() {
  const [githubIssues, linearIssues] = await Promise.all([listGithubIssues(), listLinearIssues()]);
  const results: unknown[] = [];

  for (const issue of githubIssues) {
    const record = extractSyncRecord(issue.body);
    if (record) results.push(await syncPair(record));
  }

  const mappedLinearIds = new Set(
    githubIssues.map((issue) => extractSyncRecord(issue.body)?.linearId).filter(Boolean),
  );
  for (const linear of linearIssues) {
    if (!mappedLinearIds.has(linear.id)) results.push(await pairFromLinear(linear.id));
  }

  for (const github of githubIssues) {
    if (!extractSyncRecord(github.body)) results.push(await pairFromGithub(github.number));
  }

  return results;
}
