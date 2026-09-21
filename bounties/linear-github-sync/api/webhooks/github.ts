import { config } from "../../src/config.js";
import { readRawBody, verifyHmacSha256 } from "../../src/http.js";
import { pairFromGithub } from "../../src/sync.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const raw = await readRawBody(req);
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  if (!verifyHmacSha256(raw, signature, config.githubWebhookSecret())) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = req.headers["x-github-event"];
  if (event !== "issues") return res.status(202).json({ ignored: true });

  const payload = JSON.parse(raw);
  if (!payload.issue?.number || payload.issue?.pull_request) return res.status(202).json({ ignored: true });

  const result = await pairFromGithub(payload.issue.number);
  return res.status(200).json({ ok: true, result });
}
