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
    id: `new-reading-${key}`,
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

function verticalTables(prefix: string, labels: number[], x: number, startY: number, step: number) {
  return labels.map((label, index) => object(`${prefix}-${label}`, String(label), "TABLE", x, startY + index * step, 74, 40, 6, 90));
}

function horizontalTables(prefix: string, labels: number[], x: number, startY: number, step: number) {
  return labels.map((label, index) => object(`${prefix}-${label}`, String(label), "TABLE", x, startY + index * step, 76, 42, 6));
}

function roundTables(prefix: string, labels: number[], x: number, startY: number, step: number) {
  return labels.map((label, index) => object(`${prefix}-${label}`, String(label), "ROUND_TABLE", x, startY + index * step, 66, 66, 6));
}

export function isReadingVenue(venueName: string) {
  const value = venueName.trim().toLocaleLowerCase();
  return value.includes("reading") || value.includes("ридинг") || value.includes("רידינג");
}

export function readingVenuePreset(): VenueMapPresetObject[] {
  return [
    object("stage", "СЦЕНА", "STAGE", 50, 5, 300, 52),
    object("dance-floor", "ТАНЦПОЛ", "ZONE", 50, 35, 500, 385),

    ...horizontalTables("left-outer", [1, 2, 3, 4, 5, 6, 7, 8], 10, 14, 7.3),
    ...verticalTables("left-inner", [10, 11, 12, 13, 14, 15, 16, 17, 18], 18, 14, 6.5),
    ...roundTables("left-round", [100, 101, 102, 103, 104, 105], 25, 15, 10.2),

    ...roundTables("right-round", [110, 111, 112, 113, 114, 115], 75, 15, 10.2),
    ...verticalTables("right-inner", [40, 41, 42, 43, 44, 45, 46, 47], 82, 16, 7.4),
    ...horizontalTables("right-outer", [50, 51, 52, 53, 54, 55, 56, 57, 58], 90, 14, 6.5),

    object("round-106", "106", "ROUND_TABLE", 35, 70, 66, 66, 6),
    object("round-116", "116", "ROUND_TABLE", 65, 70, 66, 66, 6),
    object("central-bar", "ЦЕНТРАЛЬНЫЙ БАР", "BAR", 50, 69, 180, 56),
    object("central-bar-seats", "Места центрального бара", "ROW", 50, 75, 270, 40, 10),
    object("upper-bar-seats", "Места верхнего бара", "ROW", 50, 79, 410, 40, 20),
    object("upper-bar", "ВЕРХНИЙ БАР", "BAR", 50, 83, 410, 42),

    object("bottom-30", "30", "TABLE", 32, 92, 74, 40, 8, 90),
    object("bottom-31", "31", "TABLE", 39, 92, 74, 40, 8, 90),
    object("bottom-32", "32", "TABLE", 46, 92, 74, 40, 8, 90),
    object("bottom-33", "33", "TABLE", 54, 92, 74, 40, 8, 90),
    object("bottom-34", "34", "TABLE", 61, 92, 74, 40, 8, 90),
    object("bottom-35", "35", "TABLE", 68, 92, 74, 40, 8, 90),
  ];
}
