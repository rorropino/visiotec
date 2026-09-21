import { config } from "../../src/config.js";
import { fullReconcile } from "../../src/sync.js";

export default async function handler(req: any, res: any) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${config.cronSecret()}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const results = await fullReconcile();
  return res.status(200).json({ ok: true, reconciled: results.length, results });
}
