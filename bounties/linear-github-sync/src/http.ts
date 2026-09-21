import crypto from "node:crypto";

export async function readRawBody(req: any): Promise<string> {
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);

  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

export function verifyHmacSha256(payload: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyLinearSignature(payload: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
