const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!apiToken || !accountId) {
  console.log(`[Cloudflare check] env token=${Boolean(apiToken)} accountId=${Boolean(accountId)} connected=false reason=missing_env`);
  process.exit(0);
}

const headers = { Authorization: `Bearer ${apiToken}` };

try {
  const verifyRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`, { headers });
  const verify = await verifyRes.json();
  const tokenStatus = verify?.result?.status ?? 'unknown';
  const verifyOk = Boolean(verifyRes.ok && verify?.success && tokenStatus === 'active');

  const zonesUrl = new URL('https://api.cloudflare.com/client/v4/zones');
  zonesUrl.searchParams.set('per_page', '50');
  const zonesRes = await fetch(zonesUrl, { headers });
  const zones = await zonesRes.json();
  const zoneRows = Array.isArray(zones?.result) ? zones.result : [];
  const names = zoneRows.map((z) => z?.name).filter(Boolean);
  const accountMatches = zoneRows.some((z) => z?.account?.id === accountId);
  const connected = Boolean(verifyOk && zones?.success && names.length > 0 && accountMatches);

  console.log(`[Cloudflare check] env token=true accountId=true verifyHttp=${verifyRes.status} verifySuccess=${Boolean(verify?.success)} tokenStatus=${tokenStatus} zonesHttp=${zonesRes.status} zoneAccess=${Boolean(zones?.success)} zoneCount=${names.length} accountMatches=${accountMatches} zones=${names.join(',')} connected=${connected}`);
} catch (error) {
  console.log(`[Cloudflare check] env token=true accountId=true connected=false reason=request_failed message=${error instanceof Error ? error.message : 'unknown'}`);
}
