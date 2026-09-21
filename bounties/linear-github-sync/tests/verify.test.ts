import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGithub, verifyLinear } from "../src/verify.js";

describe("webhook verification", () => {
  const body = JSON.stringify({ hello: "world" });
  const secret = "test-secret";
  const digest = createHmac("sha256", secret).update(body).digest("hex");

  it("verifies GitHub sha256 signatures", () => {
    expect(verifyGithub(body, `sha256=${digest}`, secret)).toBe(true);
    expect(verifyGithub(body, "sha256=00", secret)).toBe(false);
  });

  it("verifies Linear signatures", () => {
    expect(verifyLinear(body, digest, secret)).toBe(true);
    expect(verifyLinear(body, null, secret)).toBe(false);
  });
});
