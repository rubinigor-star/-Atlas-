const names = [
  "HYP_RELAY_URL",
  "HYP_API_USER",
  "HYP_API_PASSWORD",
  "HYP_MPI_MID",
  "HYP_TERMINAL_NUMBER",
  "HYP_MASOF",
];

const configured = Object.fromEntries(names.map((name) => [name, Boolean(process.env[name]?.trim())]));
const terminalAvailable = configured.HYP_TERMINAL_NUMBER || configured.HYP_MASOF;
const twoPhaseReady = configured.HYP_RELAY_URL && configured.HYP_API_USER && configured.HYP_API_PASSWORD && configured.HYP_MPI_MID && terminalAvailable;

console.log("[Atlas HYP two-phase capability]", JSON.stringify({
  environment: process.env.VERCEL_ENV || "local",
  configured,
  terminalAvailable,
  twoPhaseReady,
}));
