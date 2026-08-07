import fs from "node:fs";

const file = "src/app/page.tsx";
let source = fs.readFileSync(file, "utf8");

const optimizedBefore = '      where: { status: "PUBLISHED" },';
const optimizedAfter = '      where: { status: "PUBLISHED", startsAt: { gte: new Date() } },';
const legacyBefore = '      status: "PUBLISHED",\n      ...(hiddenEventIds.length ? { id: { notIn: hiddenEventIds } } : {}),';
const legacyAfter = '      status: "PUBLISHED",\n      startsAt: { gte: new Date() },\n      ...(hiddenEventIds.length ? { id: { notIn: hiddenEventIds } } : {}),';

if (source.includes(optimizedAfter) || source.includes(legacyAfter)) {
  console.log("Past events are already excluded from the public home listings.");
} else if (source.includes(optimizedBefore)) {
  source = source.replace(optimizedBefore, optimizedAfter);
  fs.writeFileSync(file, source);
  console.log("Past events are excluded from the optimized public home query.");
} else if (source.includes(legacyBefore)) {
  source = source.replace(legacyBefore, legacyAfter);
  fs.writeFileSync(file, source);
  console.log("Past events are excluded from the public home listings.");
} else {
  throw new Error("Home event query pattern not found");
}
