import { describe, expect, it } from "vitest";
import { appendMarker, canonicalHash, parseGithubRef, readMarker, stripMarker } from "../src/markers.js";

describe("sync markers", () => {
  it("round-trips markers without changing user content", () => {
    const marker = {
      linearId: "lin_123",
      github: "acme/widgets#42",
      hash: "abc",
      syncedAt: "2026-09-20T00:00:00.000Z",
    };
    const body = appendMarker("hello\nworld", marker);
    expect(stripMarker(body)).toBe("hello\nworld");
    expect(readMarker(body)).toEqual(marker);
  });

  it("hashes only canonical user-visible data", () => {
    expect(canonicalHash({ title: "A", body: "B", closed: false }))
      .toBe(canonicalHash({ title: "A", body: "B", closed: false }));
    expect(canonicalHash({ title: "A", body: "B", closed: false }))
      .not.toBe(canonicalHash({ title: "A", body: "B", closed: true }));
  });

  it("parses GitHub references", () => {
    expect(parseGithubRef("acme/widgets#42")).toEqual({ repo: "acme/widgets", number: 42 });
    expect(parseGithubRef("bad")).toBeNull();
  });
});
