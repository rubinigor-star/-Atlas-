import { readFile } from "node:fs/promises";

const files = [
  "src/components/app-chrome.tsx",
  "src/components/site-chrome.tsx",
  "src/components/global-search.tsx",
  "src/components/public-sold-out-decorator.tsx",
];

const forbidden = [
  ".appendChild(",
  ".insertBefore(",
  ".removeChild(",
  ".replaceChild(",
  ".replaceWith(",
  ".innerHTML",
  ".outerHTML",
];

const violations = [];

for (const path of files) {
  const source = await readFile(path, "utf8");
  for (const token of forbidden) {
    if (source.includes(token)) violations.push(`${path}: ${token}`);
  }
}

if (violations.length) {
  throw new Error(
    `Unsafe structural DOM mutation found in React-managed public shell:\n${violations.join("\n")}`,
  );
}

console.log("Public React DOM integrity check passed.");
