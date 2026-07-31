import fs from "node:fs";

function patch(path, replacements) {
  let source = fs.readFileSync(path, "utf8");
  let changed = false;
  for (const [from, to] of replacements) {
    if (source.includes(from)) {
      source = source.replaceAll(from, to);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(path, source);
}

patch("src/components/guest-link-manager.tsx", [
  ['name="startsAt" type="datetime-local"', 'name="startsAt" type="date"'],
  ['name="endsAt" type="datetime-local"', 'name="endsAt" type="date"'],
]);

patch("src/components/create-event-form.tsx", [
  ['name="earlyBirdEndsAt" type="datetime-local"', 'name="earlyBirdEndsAt" type="date"'],
  ['name="salesStart" type="datetime-local"', 'name="salesStart" type="date"'],
  ['name="salesEnd" type="datetime-local"', 'name="salesEnd" type="date"'],
]);

if (fs.existsSync("src/components/clone-event-form.tsx")) {
  patch("src/components/clone-event-form.tsx", [
    ['name="salesStart" type="datetime-local"', 'name="salesStart" type="date"'],
    ['name="salesEnd" type="datetime-local"', 'name="salesEnd" type="date"'],
    ['name="earlyBirdEndsAt" type="datetime-local"', 'name="earlyBirdEndsAt" type="date"'],
  ]);
}

patch("src/components/category-manager.tsx", [
  ['setMessage(text.saved);setEditingId(null);\n   window.setTimeout(()=>window.location.reload(),250);', 'setMessage(text.saved);setEditingId(null);'],
]);

console.log("Applied date-only ticket and sales-channel UI patch.");
