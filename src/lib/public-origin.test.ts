import { afterEach, describe, expect, it } from "vitest";
import { getCanonicalOrigin, getPublicOrigin } from "@/lib/public-origin";

const originalEnv={...process.env};

afterEach(()=>{
  process.env={...originalEnv};
});

describe("SEO origins",()=>{
  it("keeps canonical URLs on production during Vercel previews",()=>{
    process.env.VERCEL_ENV="preview";
    process.env.VERCEL_URL="atlas-git-feature-example.vercel.app";
    delete process.env.CANONICAL_APP_URL;
    expect(getCanonicalOrigin()).toBe("https://www.atlas-one.co");
    expect(getPublicOrigin()).toBe("https://atlas-git-feature-example.vercel.app");
  });

  it("allows an explicit canonical production origin",()=>{
    process.env.CANONICAL_APP_URL="https://tickets.example.com/";
    expect(getCanonicalOrigin()).toBe("https://tickets.example.com");
  });
});
