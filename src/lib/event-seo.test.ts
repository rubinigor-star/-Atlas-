import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db",()=>({db:{}}));

import { buildEventSeoSlug, isTechnicalEventSlug, slugifyEventText } from "@/lib/event-seo";

describe("event SEO slugs",()=>{
  it("transliterates Russian event titles into readable ASCII slugs",()=>{
    expect(slugifyEventText("Бандерос в Тель-Авиве")).toBe("banderos-v-tel-avive");
  });

  it("creates a stable event-city-date slug",()=>{
    expect(buildEventSeoSlug("Бандерос","Tel Aviv",new Date("2026-10-31T18:00:00.000Z"))).toBe("banderos-tel-aviv-2026-10-31");
  });

  it("uses the Israel calendar date around local midnight",()=>{
    expect(buildEventSeoSlug("Night Show","Tel Aviv",new Date("2026-10-31T22:30:00.000Z"))).toBe("night-show-tel-aviv-2026-11-01");
  });

  it("recognizes only technical draft slugs as temporary",()=>{
    expect(isTechnicalEventSlug("draft-a1b2c3d4")).toBe(true);
    expect(isTechnicalEventSlug("banderos-tel-aviv-2026-10-31")).toBe(false);
  });
});
