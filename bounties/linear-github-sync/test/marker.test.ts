import { describe, expect, it } from "vitest";
import { extractSyncRecord, upsertSyncRecord } from "../src/marker.js";
import { stripSyncMarker } from "../src/content.js";
import type { SyncRecord } from "../src/types.js";

const record: SyncRecord = {
  linearId: "abc",
  githubNumber: 42,
  linearHash: "lh",
  githubHash: "gh",
  lastLinearUpdatedAt: "2026-09-20T00:00:00Z",
  lastGithubUpdatedAt: "2026-09-20T00:00:00Z",
  lastSyncedAt: "2026-09-20T00:00:00Z",
};

describe("sync marker", () => {
  it("round trips metadata without polluting canonical body", () => {
    const body = upsertSyncRecord("hello", record);
    expect(extractSyncRecord(body)).toEqual(record);
    expect(stripSyncMarker(body)).toBe("hello");
  });

  it("updates rather than duplicates metadata", () => {
    const first = upsertSyncRecord("hello", record);
    const second = upsertSyncRecord(first, { ...record, githubHash: "gh2" });
    expect((second.match(/linear-github-sync:/g) ?? []).length).toBe(1);
    expect(extractSyncRecord(second)?.githubHash).toBe("gh2");
  });
});
