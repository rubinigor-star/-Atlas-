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

function horizontalTableColumn(prefix: string, labels: number[], x: number, startY: number, step: number) {
  return labels.map((label, index) => object(`${prefix}-${label}`, String(label), "TABLE", x, startY + index * step, 50, 30, 6));
}

function slimVerticalColumn(prefix: string, labels: number[], x: number, startY: number, step: number) {
  return labels.map((label, index) => object(`${prefix}-${label}`, String(label), "TABLE", x, startY + index * step, 24, 40, 2));
}

function roundColumn(prefix: string, labels: number[], x: number, startY: number, step: number) {
  return labels.map((label, index) => object(`${prefix}-${label}`, String(label), "ROUND_TABLE", x, startY + index * step, 44, 44, 6));
}

export function isReadingVenue(venueName: string) {
  const value = venueName.trim().toLocaleLowerCase();
  return value === "reading 3" || value === "ридинг 3" || value === "רידינג 3" || value.includes("reading 3");
}

export function readingVenuePreset(): VenueMapPresetObject[] {
  return [
    object("stage", "СЦЕНА", "STAGE", 50, 6, 205, 34),
    object("dance-floor", "ТАНЦПОЛ", "ZONE", 50, 35, 330, 238),

    ...horizontalTableColumn("left-outer", [1, 2, 3, 4, 5, 6, 7, 8], 10, 16, 9.0),
    ...slimVerticalColumn("left-inner", [10, 11, 12, 13, 14, 15, 16, 17, 18], 19, 14, 8.3),
    ...roundColumn("left-round", [100, 101, 102, 103, 104, 105], 29, 16, 10.6),

    ...roundColumn("right-round", [110, 111, 112, 113, 114, 115], 71, 16, 10.6),
    ...slimVerticalColumn("right-inner", [40, 41, 42, 43, 44, 45, 46, 47], 81, 15, 8.5),
    ...horizontalTableColumn("right-outer", [50, 51, 52, 53, 54, 55, 56, 57, 58], 90, 13, 8.0),

    object("round-106", "106", "ROUND_TABLE", 38, 68, 44, 44, 6),
    object("round-116", "116", "ROUND_TABLE", 62, 68, 44, 44, 6),

    object("central-bar", "ЦЕНТРАЛЬНЫЙ БАР", "BAR", 50, 68, 118, 30),
    object("central-bar-seats", "Места центрального бара", "ROW", 50, 74, 205, 18, 10),

    object("upper-bar-seats", "Места верхнего бара", "ROW", 50, 80, 315, 18, 20),
    object("upper-bar", "ВЕРХНИЙ БАР", "BAR", 50, 84, 290, 24),

    object("bottom-30", "30", "TABLE", 34, 90, 24, 48, 8),
    object("bottom-31", "31", "TABLE", 40.5, 90, 24, 48, 8),
    object("bottom-32", "32", "TABLE", 47, 90, 24, 48, 8),
    object("bottom-33", "33", "TABLE", 53.5, 90, 24, 48, 8),
    object("bottom-34", "34", "TABLE", 60, 90, 24, 48, 8),
    object("bottom-35", "35", "TABLE", 66.5, 90, 24, 48, 8),
  ];
}
