export type VenueMapPresetObject = {
  id: string;
  label: string;
  objectType: "TABLE" | "ROUND_TABLE" | "SOFA" | "ROW" | "ZONE" | "STAGE" | "BAR" | "TEXT";
  seats: number;
  priceMode: "WHOLE_TABLE" | "PER_SEAT";
  priceMinor: number;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  categoryId: string | null;
  reserved: boolean;
  seatAssignments: Array<{ position: number; categoryId: string | null }>;
};

export const READING_PRESET_MARKER = "__ATLAS_READING_V3__";

function seats(count: number) {
  return Array.from({ length: count }, (_, index) => ({ position: index + 1, categoryId: null }));
}

function object(
  key: string,
  label: string,
  objectType: VenueMapPresetObject["objectType"],
  x: number,
  y: number,
  width: number,
  height: number,
  seatCount = 0,
  rotation = 0,
): VenueMapPresetObject {
  return {
    id: `new-reading-v3-${key}`,
    label,
    objectType,
    seats: seatCount,
    priceMode: seatCount > 0 ? "PER_SEAT" : "WHOLE_TABLE",
    priceMinor: 0,
    x: Math.round(x),
    y: Math.round(y),
    rotation: Math.round(rotation),
    width: Math.round(width),
    height: Math.round(height),
    categoryId: null,
    reserved: false,
    seatAssignments: seats(seatCount),
  };
}

function horizontalTables(prefix: string, labels: number[], x: number, ys: number[]) {
  return labels.map((label, index) => object(`${prefix}-${label}`, String(label), "TABLE", x, ys[index], 58, 48, 6));
}

function slimTables(prefix: string, labels: number[], x: number, ys: number[]) {
  return labels.map((label, index) => object(`${prefix}-${label}`, String(label), "TABLE", x, ys[index], 40, 48, 2));
}

function roundTables(prefix: string, labels: number[], x: number, ys: number[]) {
  return labels.map((label, index) => object(`${prefix}-${label}`, String(label), "ROUND_TABLE", x, ys[index], 52, 52, 6));
}

export function isReadingVenue(venueName: string) {
  const value = venueName.trim().toLocaleLowerCase();
  return value === "reading 3" || value === "ридинг 3" || value === "רידינג 3" || value.includes("reading 3");
}

export function readingVenuePreset(): VenueMapPresetObject[] {
  return [
    object("marker", READING_PRESET_MARKER, "TEXT", 0, 0, 40, 30),

    object("stage", "СЦЕНА", "STAGE", 50, 10, 340, 48),
    object("dance-floor", "ТАНЦПОЛ", "ZONE", 50, 38, 530, 440),

    ...horizontalTables("left-outer", [1, 2, 3, 4, 5, 6, 7, 8], 19, [18, 24, 30, 37, 43, 50, 57, 63]),
    ...slimTables("left-slim", [10, 11, 12, 13, 14, 15, 16, 17, 18], 24, [18, 24, 30, 36, 42, 48, 54, 60, 66]),
    ...roundTables("left-round", [100, 101, 102, 103, 104, 105], 28, [18, 27, 35, 43, 51, 60]),

    ...roundTables("right-round", [110, 111, 112, 113, 114, 115], 72, [18, 27, 35, 43, 51, 60]),
    ...slimTables("right-slim", [40, 41, 42, 43, 44, 45, 46, 47], 77, [20, 26, 32, 38, 44, 50, 56, 62]),
    ...horizontalTables("right-outer", [50, 51, 52, 53, 54, 55, 56, 57, 58], 81, [18, 25, 31, 38, 44, 51, 57, 64, 70]),

    object("round-106", "106", "ROUND_TABLE", 39, 68, 52, 52, 6),
    object("round-116", "116", "ROUND_TABLE", 61, 68, 52, 52, 6),
    object("central-bar", "ЦЕНТРАЛЬНЫЙ БАР", "BAR", 50, 66, 165, 55),
    object("central-bar-seats", "Места центрального бара", "ROW", 50, 71, 178, 30, 10),

    object("upper-bar-seats", "Места верхнего бара", "ROW", 50, 75, 340, 30, 20),
    object("upper-bar", "ВЕРХНИЙ БАР", "BAR", 50, 78, 340, 30),

    object("bottom-30", "30", "TABLE", 37, 86, 46, 76, 8),
    object("bottom-31", "31", "TABLE", 42, 86, 46, 76, 8),
    object("bottom-32", "32", "TABLE", 46, 86, 46, 76, 8),
    object("bottom-33", "33", "TABLE", 54, 86, 46, 76, 8),
    object("bottom-34", "34", "TABLE", 59, 86, 46, 76, 8),
    object("bottom-35", "35", "TABLE", 63, 86, 46, 76, 8),
  ];
}
