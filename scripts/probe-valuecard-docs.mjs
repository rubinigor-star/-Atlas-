const branch = process.env.VERCEL_GIT_COMMIT_REF || "";
if (branch !== "feature/valuecard-profile-enrichment-20260821") process.exit(0);

const url = "https://valuecard.co.il/Documentation/POS/swagger.json";
try {
  const response = await fetch(url, { redirect: "follow" });
  const spec = await response.json();
  const paths = spec?.paths || {};
  const memberOps = [];
  for (const [path, methods] of Object.entries(paths)) {
    if (!/member|club_member/i.test(path)) continue;
    for (const [method, operation] of Object.entries(methods || {})) {
      if (!operation || typeof operation !== "object") continue;
      const haystack = JSON.stringify(operation);
      if (!/update|edit|register|member/i.test(haystack)) continue;
      memberOps.push({
        path,
        method,
        operationId: operation.operationId,
        summary: operation.summary,
        requestBody: operation.requestBody,
        parameters: operation.parameters,
      });
    }
  }
  const schemas = spec?.components?.schemas || {};
  const relevantSchemas = Object.fromEntries(Object.entries(schemas).filter(([name]) => /member|register|update/i.test(name)));
  console.log("[valuecard-member-ops]", JSON.stringify(memberOps));
  console.log("[valuecard-member-schemas]", JSON.stringify(relevantSchemas));
} catch (error) {
  console.log("[valuecard-docs-probe-error]", error instanceof Error ? error.message : String(error));
}
