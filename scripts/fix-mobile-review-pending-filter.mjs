import fs from "node:fs";

const path = "src/app/api/mobile/events/[id]/operations/route.ts";
const source = fs.readFileSync(path, "utf8");
const before = '  pending: ["PENDING", "PENDING_APPROVAL"] as const,';
const after = '  pending: ["PENDING_APPROVAL"] as const,';

if (source.includes(after)) {
  console.log("Mobile review pending filter already applied.");
  process.exit(0);
}

if (!source.includes(before)) {
  throw new Error("Mobile review pending filter target not found. Refusing to build with an unverified operations route.");
}

fs.writeFileSync(path, source.replace(before, after));
console.log("Applied mobile review pending filter: raw PENDING checkout orders are excluded from review.");
