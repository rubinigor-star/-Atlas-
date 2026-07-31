import { readFile, writeFile } from "node:fs/promises";

const fileUrl = new URL("../src/components/venue-map-editor.tsx", import.meta.url);
const source = await readFile(fileUrl, "utf8");

const unsafe = "setHistory((current) => [...current.slice(-29), drag.current!.before]); setFuture([]); drag.current = null;";
const safe = "const before = drag.current.before; drag.current = null; setHistory((current) => [...current.slice(-29), before]); setFuture([]);";

if (source.includes(safe)) {
  console.log("Venue map drag fix already applied.");
  process.exit(0);
}

if (!source.includes(unsafe)) {
  throw new Error("Venue map drag handler changed: expected unsafe history pattern was not found.");
}

await writeFile(fileUrl, source.replace(unsafe, safe), "utf8");
console.log("Applied venue map drag history fix.");
