import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "src/components/scanner-client.tsx");
let source = fs.readFileSync(file, "utf8");
const before = source;
source = source.replace(
  'import { BrowserQRCodeReader } from "@zxing/browser";',
  'import { BrowserMultiFormatReader } from "@zxing/browser";',
);
source = source.replace(
  'const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 700 });',
  'const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 700 });',
);
source = source.replace(
  'placeholder="ATLAS_... или ссылка"',
  'placeholder="ATLAS_..., EV-..., barcode или ссылка"',
);
source = source.replace(
  'result?.message ?? "Наведите камеру на QR-код билета"',
  'result?.message ?? "Наведите камеру на QR-код или штрихкод билета"',
);
if (source === before) {
  console.log("Scanner multi-format patch already applied or no matching source found.");
} else {
  fs.writeFileSync(file, source);
  console.log("Applied QR + linear barcode scanner support.");
}
