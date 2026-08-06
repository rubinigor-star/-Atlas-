import fs from "node:fs";

const file = "src/app/page.tsx";
let source = fs.readFileSync(file, "utf8");
const before = '      status: "PUBLISHED",\n      ...(hiddenEventIds.length ? { id: { notIn: hiddenEventIds } } : {}),';
const after = '      status: "PUBLISHED",\n      startsAt: { gte: new Date() },\n      ...(hiddenEventIds.length ? { id: { notIn: hiddenEventIds } } : {}),';

if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error("Home event query pattern not found");
  source = source.replace(before, after);
  fs.writeFileSync(file, source);
}

console.log("Past events are excluded from the public home listings.");
