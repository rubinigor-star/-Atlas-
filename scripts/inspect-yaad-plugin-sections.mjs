import { writeFile, mkdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "preview") process.exit(0);
const zipUrl = "https://downloads.wordpress.org/plugin/yaad-sarig-payment-gateway-for-wc.2.2.11.zip";
const zipPath = "/tmp/yaad-sections.zip";
const outDir = "/tmp/yaad-sections";
try {
  const response = await fetch(zipUrl, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  await writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
  await mkdir(outDir, { recursive: true });
  execFileSync("unzip", ["-oq", zipPath, "-d", outDir]);
  const file = `${outDir}/yaad-sarig-payment-gateway-for-wc/classes/class-wc-gateway-yaadpay.php`;
  const lines = (await readFile(file, "utf8")).split(/\r?\n/);
  for (const [start,end] of [[1960,2025],[2100,2165],[2325,2360],[2475,2515]]) {
    const block = lines.slice(start-1,end).map((line,i)=>`${start+i}: ${line.trim()}`).join("\n");
    console.log(`[Atlas Yaad exact ${start}-${end}]\n${block}`);
  }
} catch (error) {
  console.log("[Atlas Yaad exact sections] unavailable", error instanceof Error ? error.message : String(error));
}
