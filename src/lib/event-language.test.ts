import { describe, expect, it } from "vitest";
import {
  isEventVisibleInCatalog,
  normalizeEventLanguageSettings,
  parsePreferredEventLanguages,
} from "@/lib/event-language";

describe("event language settings", () => {
  it("keeps legacy events visible until an organizer classifies them", () => {
    expect(normalizeEventLanguageSettings(undefined, undefined)).toEqual({
      primaryLanguage: "MULTILINGUAL",
      catalogVisibility: "PUBLIC",
    });
  });

  it("rejects invalid stored values safely", () => {
    expect(normalizeEventLanguageSettings("INVALID", "UNKNOWN")).toEqual({
      primaryLanguage: "MULTILINGUAL",
      catalogVisibility: "PUBLIC",
    });
    expect(normalizeEventLanguageSettings("RU", "TARGETED")).toEqual({
      primaryLanguage: "RU",
      catalogVisibility: "TARGETED",
    });
  });

  it("uses the interface locale as the first catalog preference", () => {
    expect(parsePreferredEventLanguages(undefined, "he")).toEqual(["HE"]);
    expect(parsePreferredEventLanguages("RU,EN", "he")).toEqual(["RU", "EN"]);
    expect(parsePreferredEventLanguages("RU%2CEN", "he")).toEqual(["RU", "EN"]);
  });

  it("filters targeted events but never hides public or language-free events", () => {
    expect(isEventVisibleInCatalog({ primaryLanguage: "RU", catalogVisibility: "TARGETED" }, ["HE"])).toBe(false);
    expect(isEventVisibleInCatalog({ primaryLanguage: "RU", catalogVisibility: "TARGETED" }, ["RU"])).toBe(true);
    expect(isEventVisibleInCatalog({ primaryLanguage: "RU", catalogVisibility: "PUBLIC" }, ["HE"])).toBe(true);
    expect(isEventVisibleInCatalog({ primaryLanguage: "NO_LANGUAGE_BARRIER", catalogVisibility: "TARGETED" }, ["HE"])).toBe(true);
    expect(isEventVisibleInCatalog({ primaryLanguage: "HE", catalogVisibility: "DIRECT_ONLY" }, ["HE"])).toBe(false);
  });
});
