import { config } from "../src/config.js";
import { listGitHubIssues } from "../src/github.js";
import { listLinearIssues } from "../src/linear.js";
import { syncFromGitHub, syncFromLinear } from "../src/sync.js";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") return new Response("method not allowed", { status: 405 });
  if (req.headers.get("authorization") !== `Bearer ${config.cronSecret()}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const results: Array<{ pair: string; result?: string; error?: string }> = [];

  for (const pair of config.pairs()) {
    try {
      const ghIssues = await listGitHubIssues(pair.githubRepo);
      for (const issue of ghIssues) {
        try {
          results.push({ pair: pair.githubRepo, result: await syncFromGitHub(pair.githubRepo, issue, pair) });
        } catch (error) {
          results.push({ pair: pair.githubRepo, error: String(error) });
        }
      }

      const linearIssues = await listLinearIssues(pair.linearTeamId);
      for (const issue of linearIssues) {
        try {
          results.push({ pair: pair.githubRepo, result: await syncFromLinear(issue, pair) });
        } catch (error) {
          results.push({ pair: pair.githubRepo, error: String(error) });
        }
      }
    } catch (error) {
      results.push({ pair: pair.githubRepo, error: String(error) });
    }
  }

  return Response.json({ ok: results.every((x) => !x.error), results });
}
