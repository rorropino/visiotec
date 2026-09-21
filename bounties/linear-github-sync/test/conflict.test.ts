import { describe, expect, it } from "vitest";
import { decideSync } from "../src/conflict.js";
import type { SyncRecord } from "../src/types.js";

const record: SyncRecord = {
  linearId: "lin_1",
  githubNumber: 7,
  linearHash: "L0",
  githubHash: "G0",
  lastLinearUpdatedAt: "2026-09-20T12:00:00Z",
  lastGithubUpdatedAt: "2026-09-20T12:00:00Z",
  lastSyncedAt: "2026-09-20T12:00:00Z",
};

describe("decideSync", () => {
  it("does nothing when both sides match the checkpoint", () => {
    expect(decideSync(record, "L0", "G0", record.lastLinearUpdatedAt, record.lastGithubUpdatedAt, "latest-wins"))
      .toEqual({ action: "noop" });
  });

  it("pushes Linear-only changes to GitHub", () => {
    expect(decideSync(record, "L1", "G0", "2026-09-20T12:01:00Z", record.lastGithubUpdatedAt, "latest-wins"))
      .toEqual({ action: "linear-to-github" });
  });

  it("pushes GitHub-only changes to Linear", () => {
    expect(decideSync(record, "L0", "G1", record.lastLinearUpdatedAt, "2026-09-20T12:01:00Z", "latest-wins"))
      .toEqual({ action: "github-to-linear" });
  });

  it("resolves true conflicts using the newest edit by default", () => {
    expect(decideSync(record, "L1", "G1", "2026-09-20T12:03:00Z", "2026-09-20T12:02:00Z", "latest-wins"))
      .toEqual({ action: "conflict", winner: "linear" });
  });

  it("supports explicit side preference", () => {
    expect(decideSync(record, "L1", "G1", "2026-09-20T12:01:00Z", "2026-09-20T12:02:00Z", "linear-wins"))
      .toEqual({ action: "conflict", winner: "linear" });
  });
});
