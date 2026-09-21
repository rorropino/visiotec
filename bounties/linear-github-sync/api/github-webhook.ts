import { config, pairForGitHub } from "../src/config.js";
import { getGitHubIssue } from "../src/github.js";
import { syncFromGitHub } from "../src/sync.js";
import { verifyGithub } from "../src/verify.js";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  if (!verifyGithub(raw, req.headers.get("x-hub-signature-256"), config.githubWebhookSecret())) {
    return new Response("invalid signature", { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  if (event === "ping") return Response.json({ ok: true, pong: true });
  if (event !== "issues") return Response.json({ ok: true, ignored: event });

  const payload = JSON.parse(raw);
  if (payload.issue?.pull_request) return Response.json({ ok: true, ignored: "pull_request" });

  const repo = payload.repository?.full_name as string;
  const number = Number(payload.issue?.number);
  if (!repo || !number) return new Response("invalid payload", { status: 400 });

  try {
    const pair = pairForGitHub(repo);
    const issue = await getGitHubIssue(repo, number);
    const result = await syncFromGitHub(repo, issue, pair);
    return Response.json({ ok: true, result });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
