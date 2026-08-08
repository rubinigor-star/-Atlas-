import { writeFile, mkdir, readdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

if (process.env.VERCEL_ENV !== "preview") process.exit(0);

const zipUrl = "https://downloads.wordpress.org/plugin/yaad-sarig-payment-gateway-for-wc.2.2.11.zip";
const zipPath = "/tmp/yaad-plugin.zip";
const outDir = "/tmp/yaad-plugin-src";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(full));
    else if (/\.php$/i.test(entry.name)) result.push(full);
  }
  return result;
}

try {
  const response = await fetch(zipUrl, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`download HTTP ${response.status}`);
  await writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
  await mkdir(outDir, { recursive: true });
  execFileSync("unzip", ["-oq", zipPath, "-d", outDir]);
  const files = await walk(outDir);
  const needles = /(YAADPAY_POSTPONE_PAYMENT|YAAD_POSTPONE|YAAD_J5|\bJ5\b|Postpone|postpone|TransId|ACode|capture|deferred|חיוב דחוי)/i;
  const interesting = [];
  for (const file of files) {
    const text = await readFile(file, "utf8").catch(() => "");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!needles.test(lines[i])) continue;
      const excerpt = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 7)).join(" ").replace(/\s+/g, " ").trim();
      if (!excerpt) continue;
      interesting.push({ file: path.relative(outDir, file), line: i + 1, excerpt: excerpt.slice(0, 1400) });
      if (interesting.length >= 60) break;
    }
    if (interesting.length >= 60) break;
  }
  console.log("[Atlas Yaad plugin J5 focused]", JSON.stringify(interesting));
} catch (error) {
  console.log("[Atlas Yaad plugin J5 focused] unavailable", error instanceof Error ? error.message : String(error));
}
