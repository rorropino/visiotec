import { config } from "../../src/config.js";
import { readRawBody, verifyLinearSignature } from "../../src/http.js";
import { pairFromLinear } from "../../src/sync.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const raw = await readRawBody(req);
  const signature = req.headers["linear-signature"] as string | undefined;
  if (!verifyLinearSignature(raw, signature, config.linearWebhookSecret())) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const payload = JSON.parse(raw);
  if (payload.type !== "Issue" || !payload.data?.id) return res.status(202).json({ ignored: true });

  const result = await pairFromLinear(payload.data.id);
  return res.status(200).json({ ok: true, result });
}
