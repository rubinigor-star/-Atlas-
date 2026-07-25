import type { PDFPage, PDFFont, RGB } from "pdf-lib";

export type PdfFontSet = {
  latinRegular: PDFFont;
  latinBold: PDFFont;
  cyrillicRegular: PDFFont;
  cyrillicBold: PDFFont;
  hebrew: PDFFont;
};

type Script = "latin" | "cyrillic" | "hebrew";
type Segment = { text: string; script: Script };

function scriptFor(char: string): Script {
  if (/\p{Script=Hebrew}/u.test(char)) return "hebrew";
  if (/\p{Script=Cyrillic}/u.test(char)) return "cyrillic";
  return "latin";
}

function splitSegments(value: string): Segment[] {
  const result: Segment[] = [];
  for (const char of Array.from(value)) {
    const script = scriptFor(char);
    const last = result[result.length - 1];
    if (last?.script === script) last.text += char;
    else result.push({ text: char, script });
  }

  return result.map((segment) =>
    segment.script === "hebrew"
      ? { ...segment, text: Array.from(segment.text).reverse().join("") }
      : segment,
  );
}

function fontFor(segment: Segment, fonts: PdfFontSet, bold: boolean) {
  if (segment.script === "hebrew") return fonts.hebrew;
  if (segment.script === "cyrillic") return bold ? fonts.cyrillicBold : fonts.cyrillicRegular;
  return bold ? fonts.latinBold : fonts.latinRegular;
}

export function multilingualWidth(value: string, size: number, fonts: PdfFontSet, bold = false) {
  return splitSegments(value).reduce((sum, segment) => sum + fontFor(segment, fonts, bold).widthOfTextAtSize(segment.text, size), 0);
}

export function drawMultilingualText(params: {
  page: PDFPage;
  value: string;
  x: number;
  y: number;
  size: number;
  color: RGB;
  fonts: PdfFontSet;
  bold?: boolean;
  maxWidth?: number;
}) {
  const { page, value, y, size, color, fonts, bold = false, maxWidth } = params;
  let x = params.x;
  for (const segment of splitSegments(value)) {
    const font = fontFor(segment, fonts, bold);
    const width = font.widthOfTextAtSize(segment.text, size);
    if (maxWidth !== undefined && x + width > params.x + maxWidth) break;
    page.drawText(segment.text, { x, y, size, font, color });
    x += width;
  }
}
