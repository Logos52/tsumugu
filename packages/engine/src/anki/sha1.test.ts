import { describe, it, expect } from "vitest";
import { sha1Hex } from "./sha1.js";

describe("sha1Hex", () => {
  it("matches known RFC/NIST vectors", () => {
    // Empty string.
    expect(sha1Hex("")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    // "abc"
    expect(sha1Hex("abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    // The classic fox sentence.
    expect(sha1Hex("The quick brown fox jumps over the lazy dog")).toBe(
      "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12",
    );
  });

  it("handles long inputs that span multiple 64-byte blocks", () => {
    // 1,000,000 'a' has a well-known SHA-1 digest.
    const million = "a".repeat(1_000_000);
    expect(sha1Hex(million)).toBe(
      "34aa973cd4c4daa4f61eeb2bdbad27316534016f",
    );
  });

  it("is correct at message-length / padding boundaries", () => {
    // 55 bytes: padding (0x80 + length) just fits in the first 64-byte block.
    // 56 bytes: padding overflows into a SECOND block — the classic SHA-1 bug.
    // 63/64 and 119/120 exercise the block edge again. Reference digests from
    // Node's crypto SHA-1.
    const vectors: Record<number, string> = {
      55: "c1c8bbdc22796e28c0e15163d20899b65621d65a",
      56: "c2db330f6083854c99d4b5bfb6e8f29f201be699",
      63: "03f09f5b158a7a8cdad920bddc29b81c18a551f5",
      64: "0098ba824b5c16427bd7a1122a5a442a25ec644d",
      119: "ee971065aaa017e0632a8ca6c77bb3bf8b1dfc56",
      120: "f34c1488385346a55709ba056ddd08280dd4c6d6",
    };
    for (const [len, digest] of Object.entries(vectors)) {
      expect(sha1Hex("a".repeat(Number(len)))).toBe(digest);
    }
  });

  it("returns a stable 40-char lowercase hex digest for every input", () => {
    for (const s of ["", "a", "abc", "你好", "🌏🌏🌏", "x".repeat(200)]) {
      expect(sha1Hex(s)).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it("hashes UTF-8 multi-byte and surrogate-pair code points", () => {
    // Deterministic 40-hex output; non-empty and stable across calls.
    const a = sha1Hex("你好，世界 🌏");
    const b = sha1Hex("你好，世界 🌏");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
    // Differs from the ASCII-only variant.
    expect(sha1Hex("hello")).not.toBe(a);
  });
});
