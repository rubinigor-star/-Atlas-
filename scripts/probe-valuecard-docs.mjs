const branch = process.env.VERCEL_GIT_COMMIT_REF || "";
if (branch !== "feature/valuecard-profile-enrichment-20260821") process.exit(0);

const base = "https://valuecard.co.il/Documentation/POS/";
const candidates = [
  base,
  `${base}swagger.json`,
  `${base}openapi.json`,
  `${base}swagger/v1/swagger.json`,
  `${base}swagger.yaml`,
  `${base}openapi.yaml`,
];

for (const url of candidates) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    const text = await response.text();
    console.log("[valuecard-docs-probe]", JSON.stringify({
      url,
      status: response.status,
      contentType: response.headers.get("content-type"),
      finalUrl: response.url,
      length: text.length,
      sample: text.slice(0, 1600).replace(/\s+/g, " "),
      discovered: [...text.matchAll(/(?:href|src)=["']([^"']+)["']/gi)].map(match => match[1]).filter(value => /swagger|openapi|\.js|\.json/i.test(value)).slice(0, 30),
    }));
  } catch (error) {
    console.log("[valuecard-docs-probe]", JSON.stringify({ url, error: error instanceof Error ? error.message : String(error) }));
  }
}
