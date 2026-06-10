// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { segmentLiveText } from "./jiebaSegment.js";
import { createZhHantBrowserPack } from "./zhHant.js";

describe("segmentLiveText", () => {
  it("segments 通勤 and 夜市 in a Chinese sentence", async () => {
    const pack = createZhHantBrowserPack();
    const commute = await segmentLiveText("通勤的時候我會開播客。", pack);
    expect(commute.filter((t) => t.isWord).map((t) => t.text)).toContain("通勤");

    const lively = await segmentLiveText("週末的夜市總是很熱鬧。", pack);
    const words = lively.filter((t) => t.isWord).map((t) => t.text);
    expect(words).toContain("夜市");
    expect(words).toContain("熱");
    expect(words).toContain("鬧");
  });
});