import { describe, it, expect } from "vitest";

import {
  DEFAULT_SETTINGS,
  migrateAppSettings,
  resolveDictDefault,
  AppState,
} from "./state.js";
import { demoPack } from "@tsumugu/demo-pack";

describe("migrateAppSettings", () => {
  it('migrates explanationLang "target" → dictDefault "zh"', () => {
    expect(migrateAppSettings({ explanationLang: "target" })).toEqual({ dictDefault: "zh" });
  });

  it('migrates explanationLang "en" → dictDefault "en"', () => {
    expect(migrateAppSettings({ explanationLang: "en" })).toEqual({ dictDefault: "en" });
  });

  it("keeps an existing dictDefault and drops legacy explanationLang", () => {
    expect(
      migrateAppSettings({ dictDefault: "en", explanationLang: "target" }),
    ).toEqual({ dictDefault: "en" });
  });

  it("defaults unknown legacy values to en", () => {
    expect(migrateAppSettings({ explanationLang: "fr" })).toEqual({ dictDefault: "en" });
  });
});

describe("resolveDictDefault", () => {
  it("falls back to zh when dictDefault is absent", () => {
    expect(resolveDictDefault({} as { dictDefault: "en" | "zh" })).toBe("zh");
  });
});

describe("AppState settings", () => {
  it("applies migration on construction and defaults to zh", () => {
    const app = new AppState({
      pack: demoPack,
      settings: { explanationLang: "target" },
    });
    expect(app.settings.dictDefault).toBe("zh");
    expect((app.settings as { explanationLang?: string }).explanationLang).toBeUndefined();
  });

  it("ships immersion-first zh as the first-run default", () => {
    const app = new AppState({ pack: demoPack });
    expect(app.settings.dictDefault).toBe(DEFAULT_SETTINGS.dictDefault);
    expect(DEFAULT_SETTINGS.dictDefault).toBe("zh");
  });
});