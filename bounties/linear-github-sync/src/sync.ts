import type { CanonicalIssue, GitHubIssue, LinearIssue, Side, SyncMarker, SyncPair } from "./types.js";
import { appendMarker, canonicalHash, githubRef, parseGithubRef, readMarker, stripMarker } from "./markers.js";
import { createGitHubIssue, getGitHubIssue, updateGitHubIssue } from "./github.js";
import { createLinearIssue, getLinearIssue, updateLinearIssue } from "./linear.js";

function canonicalFromGitHub(issue: GitHubIssue): CanonicalIssue {
  return {
    title: issue.title,
    body: stripMarker(issue.body),
    closed: issue.state === "closed",
  };
}

function canonicalFromLinear(issue: LinearIssue): CanonicalIssue {
  return {
    title: issue.title,
    body: stripMarker(issue.description),
    closed: issue.state.type === "completed" || issue.state.type === "canceled",
  };
}

function chooseWinner(
  gh: GitHubIssue,
  li: LinearIssue,
  marker: SyncMarker | null,
): Side | "same" {
  const ghCanonical = canonicalFromGitHub(gh);
  const liCanonical = canonicalFromLinear(li);
  const ghHash = canonicalHash(ghCanonical);
  const liHash = canonicalHash(liCanonical);

  if (ghHash === liHash) return "same";
  if (!marker) return new Date(gh.updated_at) >= new Date(li.updatedAt) ? "github" : "linear";

  const ghChanged = ghHash !== marker.hash;
  const liChanged = liHash !== marker.hash;

  if (ghChanged && !liChanged) return "github";
  if (liChanged && !ghChanged) return "linear";
  if (!ghChanged && !liChanged) return "same";

  const gt = new Date(gh.updated_at).getTime();
  const lt = new Date(li.updatedAt).getTime();
  return gt >= lt ? "github" : "linear";
}

async function writeSharedMarker(
  repo: string,
  gh: GitHubIssue,
  li: LinearIssue,
  canonical: CanonicalIssue,
): Promise<void> {
  const marker: SyncMarker = {
    linearId: li.id,
    github: githubRef(repo, gh.number),
    hash: canonicalHash(canonical),
    syncedAt: new Date().toISOString(),
  };

  const ghBody = appendMarker(canonical.body, marker);
  const liBody = appendMarker(canonical.body, marker);

  await updateGitHubIssue(repo, gh.number, { ...canonical, body: ghBody });
  await updateLinearIssue(li.id, li.team.id, { ...canonical, body: liBody });
}

export async function syncFromGitHub(repo: string, gh: GitHubIssue, pair: SyncPair): Promise<string> {
  const marker = readMarker(gh.body);

  if (!marker?.linearId) {
    const canonical = canonicalFromGitHub(gh);
    const li = await createLinearIssue(pair.linearTeamId, canonical);
    await writeSharedMarker(repo, gh, li, canonical);
    return `created Linear ${li.identifier} from GitHub #${gh.number}`;
  }

  const li = await getLinearIssue(marker.linearId);
  const winner = chooseWinner(gh, li, marker);

  if (winner === "same") return `already in sync GitHub #${gh.number} ↔ ${li.identifier}`;

  if (winner === "github") {
    const canonical = canonicalFromGitHub(gh);
    await writeSharedMarker(repo, gh, li, canonical);
    return `GitHub #${gh.number} won conflict and updated ${li.identifier}`;
  }

  const canonical = canonicalFromLinear(li);
  await writeSharedMarker(repo, gh, li, canonical);
  return `Linear ${li.identifier} won conflict and updated GitHub #${gh.number}`;
}

export async function syncFromLinear(li: LinearIssue, pair: SyncPair): Promise<string> {
  const marker = readMarker(li.description);
  const ref = parseGithubRef(marker?.github);

  if (!ref) {
    const canonical = canonicalFromLinear(li);
    const gh = await createGitHubIssue(pair.githubRepo, canonical);
    await writeSharedMarker(pair.githubRepo, gh, li, canonical);
    return `created GitHub #${gh.number} from Linear ${li.identifier}`;
  }

  const gh = await getGitHubIssue(ref.repo, ref.number);
  const winner = chooseWinner(gh, li, marker);

  if (winner === "same") return `already in sync ${li.identifier} ↔ GitHub #${gh.number}`;

  if (winner === "linear") {
    const canonical = canonicalFromLinear(li);
    await writeSharedMarker(ref.repo, gh, li, canonical);
    return `Linear ${li.identifier} won conflict and updated GitHub #${gh.number}`;
  }

  const canonical = canonicalFromGitHub(gh);
  await writeSharedMarker(ref.repo, gh, li, canonical);
  return `GitHub #${gh.number} won conflict and updated ${li.identifier}`;
}
