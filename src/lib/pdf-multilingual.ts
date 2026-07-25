import type { PDFPage, PDFFont, RGB } from "pdf-lib";

export type PdfFontSet = {
  regular: PDFFont;
  bold: PDFFont;
  hebrew: PDFFont;
};

type Segment = { text: string; hebrew: boolean };

function visualHebrew(value: string) {
  return Array.from(value).reverse().join("");
}

function splitSegments(value: string): Segment[] {
  const parts = value.match(/[\u0590-\u05FF]+|[^\u0590-\u05FF]+/g) ?? [value];
  const segments = parts.map((text) => ({ text, hebrew: /[\u0590-\u05FF]/.test(text) }));
  if (/^[\s\u0590-\u05FF]/.test(value)) segments.reverse();
  return segments.map((segment) => ({ ...segment, text: segment.hebrew ? visualHebrew(segment.text) : segment.text }));
}

export function multilingualWidth(value: string, size: number, fonts: PdfFontSet, bold = false) {
  return splitSegments(value).reduce((sum, segment) => {
    const font = segment.hebrew ? fonts.hebrew : bold ? fonts.bold : fonts.regular;
    return sum + font.widthOfTextAtSize(segment.text, size);
  }, 0);
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
    const font = segment.hebrew ? fonts.hebrew : bold ? fonts.bold : fonts.regular;
    const width = font.widthOfTextAtSize(segment.text, size);
    if (maxWidth !== undefined && x + width > params.x + maxWidth) break;
    page.drawText(segment.text, { x, y, size, font, color });
    x += width;
  }
}
