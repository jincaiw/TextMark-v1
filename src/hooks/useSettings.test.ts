import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, readSettings } from "./useSettings";

const storage = (values: Record<string, string>) => ({ getItem: (key: string) => values[key] ?? null });

describe("settings migration", () => {
  it("starts in Chinese with a stable v2 schema", () => {
    expect(readSettings(storage({}))).toMatchObject({ schemaVersion: 2, locale: "zh-CN", updateChannel: "stable" });
  });
  it("migrates v1 values and removes unknown toolbar entries", () => {
    const settings = readSettings(storage({ "textmark.settings.v1": JSON.stringify({ locale: "en", zoom: 999, toolbar: ["sidebar", "bad", "search"] }) }));
    expect(settings).toMatchObject({ schemaVersion: 2, locale: "en", zoom: 300, toolbar: ["sidebar", "search"] });
  });
  it("recovers from invalid JSON", () => expect(readSettings(storage({ "textmark.settings.v2": "{" }))).toEqual(DEFAULT_SETTINGS));
});
