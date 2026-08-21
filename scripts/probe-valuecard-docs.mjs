const branch = process.env.VERCEL_GIT_COMMIT_REF || "";
if (branch !== "feature/valuecard-profile-enrichment-20260821") process.exit(0);

const url = "https://valuecard.co.il/Documentation/POS/swagger.json";
try {
  const response = await fetch(url, { redirect: "follow" });
  const spec = await response.json();
  const schemas = spec?.components?.schemas || {};
  const selected = {
    ClubMemberUpdateParameters: schemas.ClubMemberUpdateParameters,
    SpClubMemberDetailsResult: schemas.SpClubMemberDetailsResult,
    VcBaseResponse: schemas.VcBaseResponse,
  };
  console.log("[valuecard-update-schema]", JSON.stringify(selected));
  console.log("[valuecard-update-operation]", JSON.stringify(spec?.paths?.["/pos/club_member/UpdateClubMember"]));
  console.log("[valuecard-details-operation]", JSON.stringify(spec?.paths?.["/pos/club_member/ClubMemberDetails"]));
} catch (error) {
  console.log("[valuecard-docs-probe-error]", error instanceof Error ? error.message : String(error));
}
