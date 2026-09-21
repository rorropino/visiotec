import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqualHex(a: string, b: string): boolean {
  const aa = Buffer.from(a.replace(/^sha256=/, ""), "hex");
  const bb = Buffer.from(b.replace(/^sha256=/, ""), "hex");
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export function verifyGithub(raw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return safeEqualHex(expected, signature);
}

export function verifyLinear(raw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return safeEqualHex(expected, signature);
}
