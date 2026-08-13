const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const appJson = require("./app.json");

const root = __dirname;
const source = path.join(root, "assets", "atlas-one-app-icon.png.base64");
const target = path.join(root, "assets", "atlas-one-app-icon.png");

function ensureAppIcon() {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing Atlas One app icon source: ${source}`);
  }

  const encoded = fs.readFileSync(source, "utf8").trim();
  const sourceBuffer = Buffer.from(encoded, "base64");
  const decoded = PNG.sync.read(sourceBuffer, { skipRescale: true });

  if (decoded.width !== 1024 || decoded.height !== 1024) {
    throw new Error(`Atlas One app icon must be 1024x1024, got ${decoded.width}x${decoded.height}`);
  }

  const normalized = PNG.sync.write(decoded, {
    colorType: 2,
    inputColorType: 6,
    inputHasAlpha: true,
    bitDepth: 8,
    deflateLevel: 9,
    deflateStrategy: 3,
    filterType: 0,
  });

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, normalized);
}

ensureAppIcon();

module.exports = appJson;
