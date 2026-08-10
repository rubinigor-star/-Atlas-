const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "assets", "atlas-one-app-icon.png.base64");
const target = path.join(root, "assets", "atlas-one-app-icon.png");

if (!fs.existsSync(source)) {
  throw new Error(`Missing Atlas One app icon source: ${source}`);
}

const encoded = fs.readFileSync(source, "utf8").trim();
const buffer = Buffer.from(encoded, "base64");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, buffer);
console.log(`Atlas One app icon prepared: ${target} (${buffer.length} bytes)`);
