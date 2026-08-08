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
  const ranges = [[600,675],[900,1040],[1040,1180],[1180,1320]];
  for (const [start,end] of ranges) {
    const hits = lines.slice(start-1,end).map((line,i)=>({n:start+i,line:line.trim()})).filter(x => /(J5|Postpone|postpone|YAADPAY_POSTPONE_PAYMENT|TransId|ACode|PassP|Masof|Amount|pay|charge|token)/i.test(x.line));
    if (hits.length) console.log(`[Atlas Yaad section ${start}-${end}]`, JSON.stringify(hits.slice(0,100)));
  }
  const occurrences = [];
  for (let i=0;i<lines.length;i++) if (/(YAADPAY_POSTPONE_PAYMENT|yaad_postpone_payment|_yaad_postpone|postpone_payment|J5)/i.test(lines[i])) occurrences.push({n:i+1,line:lines[i].trim().slice(0,1000)});
  console.log("[Atlas Yaad postpone occurrences]", JSON.stringify(occurrences.slice(0,120)));
} catch (error) {
  console.log("[Atlas Yaad sections] unavailable", error instanceof Error ? error.message : String(error));
}
