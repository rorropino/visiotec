import { config, pairForLinear } from "../src/config.js";
import { getLinearIssue } from "../src/linear.js";
import { syncFromLinear } from "../src/sync.js";
import { verifyLinear } from "../src/verify.js";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  if (!verifyLinear(raw, req.headers.get("linear-signature"), config.linearWebhookSecret())) {
    return new Response("invalid signature", { status: 401 });
  }

  const payload = JSON.parse(raw);
  if (payload.type !== "Issue") return Response.json({ ok: true, ignored: payload.type });
  if (payload.action === "remove") return Response.json({ ok: true, ignored: "remove" });

  const id = payload.data?.id as string;
  if (!id) return new Response("invalid payload", { status: 400 });

  try {
    const issue = await getLinearIssue(id);
    const pair = pairForLinear(issue.team.id, issue.team.key);
    const result = await syncFromLinear(issue, pair);
    return Response.json({ ok: true, result });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
