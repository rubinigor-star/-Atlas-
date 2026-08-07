import fs from "node:fs";

function patch(path, replacements, assertions = []) {
  if (!fs.existsSync(path)) throw new Error(`Required UI source is missing: ${path}`);

  let source = fs.readFileSync(path, "utf8");
  let changed = false;

  for (const [from, to] of replacements) {
    if (source.includes(from)) {
      source = source.replaceAll(from, to);
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(path, source);

  const finalSource = changed ? source : fs.readFileSync(path, "utf8");
  const failures = assertions.filter((pattern) => finalSource.includes(pattern));
  if (failures.length) {
    throw new Error(`Ticket/date UI patch verification failed for ${path}: ${failures.join(", ")}`);
  }
}

patch("src/components/guest-link-manager.tsx", [
  ['name="startsAt" type="datetime-local"', 'name="startsAt" type="date"'],
  ['name="endsAt" type="datetime-local"', 'name="endsAt" type="date"'],
], [
  'name="startsAt" type="datetime-local"',
  'name="endsAt" type="datetime-local"',
]);

patch("src/components/create-event-form.tsx", [
  ['name="earlyBirdEndsAt" type="datetime-local"', 'name="earlyBirdEndsAt" type="date"'],
  ['name="salesStart" type="datetime-local"', 'name="salesStart" type="date"'],
  ['name="salesEnd" type="datetime-local"', 'name="salesEnd" type="date"'],
], [
  'name="earlyBirdEndsAt" type="datetime-local"',
  'name="salesStart" type="datetime-local"',
  'name="salesEnd" type="datetime-local"',
]);

if (fs.existsSync("src/components/clone-event-form.tsx")) {
  patch("src/components/clone-event-form.tsx", [
    ['name="salesStart" type="datetime-local"', 'name="salesStart" type="date"'],
    ['name="salesEnd" type="datetime-local"', 'name="salesEnd" type="date"'],
    ['name="earlyBirdEndsAt" type="datetime-local"', 'name="earlyBirdEndsAt" type="date"'],
  ], [
    'name="salesStart" type="datetime-local"',
    'name="salesEnd" type="datetime-local"',
    'name="earlyBirdEndsAt" type="datetime-local"',
  ]);
}

const categoryReload = 'setMessage(text.saved);setEditingId(null);\n   window.setTimeout(()=>window.location.reload(),250);';
patch("src/components/category-manager.tsx", [
  [categoryReload, 'setMessage(text.saved);setEditingId(null);'],
], [categoryReload]);

console.log("Applied and verified date-only ticket and sales-channel UI patch.");
