// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { MemoryVault } from "./fsVault.js";

describe("MemoryVault", () => {
  it("round-trips write → read → exists", async () => {
    const vault = new MemoryVault();

    expect(await vault.readText("tsumugu/word-store.json")).toBeNull();
    expect(await vault.exists("tsumugu/word-store.json")).toBe(false);

    await vault.writeText("tsumugu/word-store.json", '{"v":1}');

    expect(await vault.readText("tsumugu/word-store.json")).toBe('{"v":1}');
    expect(await vault.exists("tsumugu/word-store.json")).toBe(true);
  });

  it("overwrites an existing file", async () => {
    const vault = new MemoryVault();
    await vault.writeText("a.txt", "first");
    await vault.writeText("a.txt", "second");
    expect(await vault.readText("a.txt")).toBe("second");
  });

  it("normalizes redundant slashes in paths", async () => {
    const vault = new MemoryVault();
    await vault.writeText("tsumugu//notes/x.md", "hi");
    expect(await vault.readText("tsumugu/notes/x.md")).toBe("hi");
    expect(await vault.exists("/tsumugu/notes/x.md")).toBe(true);
  });

  it("lists immediate children of a directory only", async () => {
    const vault = new MemoryVault();
    await vault.writeText("tsumugu/a.json", "1");
    await vault.writeText("tsumugu/b.json", "2");
    await vault.writeText("tsumugu/sub/c.json", "3");
    await vault.writeText("other/d.json", "4");

    const children = await vault.list("tsumugu");
    expect([...children].sort()).toEqual(["a.json", "b.json", "sub"]);
  });

  it("returns null/false/empty for absent entries", async () => {
    const vault = new MemoryVault();
    expect(await vault.readText("missing.json")).toBeNull();
    expect(await vault.exists("missing.json")).toBe(false);
    expect(await vault.list("nowhere")).toEqual([]);
  });
});
