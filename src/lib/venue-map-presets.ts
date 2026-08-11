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

function tableColumn(prefix: string, labels: number[], x: number, startY: number, step: number, seatCount: number, rotation = 0, width = 72, height = 20) {
  return labels.map((label, index) => object(`${prefix}-${label}`, String(label), "TABLE", x, startY + index * step, width, height, seatCount, rotation));
}

function roundColumn(prefix: string, labels: number[], x: number, startY: number, step: number) {
  return labels.map((label, index) => object(`${prefix}-${label}`, String(label), "ROUND_TABLE", x, startY + index * step, 58, 58, 6));
}

export function isReadingVenue(venueName: string) {
  const value = venueName.trim().toLocaleLowerCase();
  return value === "reading 3" || value === "ридинг 3" || value === "רידינג 3" || value.includes("reading 3");
}

export function readingVenuePreset(): VenueMapPresetObject[] {
  return [
    object("stage", "СЦЕНА", "STAGE", 50, 5, 260, 46),
    object("dance-floor", "ТАНЦПОЛ", "ZONE", 50, 35, 405, 285),

    // Outer tables: 3 seats on each long side.
    ...tableColumn("left-outer", [1, 2, 3, 4, 5, 6, 7, 8], 8, 14, 10.2, 6, 0, 78, 20),
    // Slim side tables: one seat at each end in the source map.
    ...tableColumn("left-inner", [10, 11, 12, 13, 14, 15, 16, 17, 18], 17, 12, 9.2, 2, 90, 46, 18),
    ...roundColumn("left-round", [100, 101, 102, 103, 104, 105], 27, 14, 11.0),

    ...roundColumn("right-round", [110, 111, 112, 113, 114, 115], 73, 14, 11.0),
    ...tableColumn("right-inner", [40, 41, 42, 43, 44, 45, 46, 47], 83, 14, 9.4, 2, 90, 46, 18),
    ...tableColumn("right-outer", [50, 51, 52, 53, 54, 55, 56, 57, 58], 92, 10, 9.8, 6, 0, 78, 20),

    object("round-106", "106", "ROUND_TABLE", 35, 70, 58, 58, 6),
    object("round-116", "116", "ROUND_TABLE", 65, 70, 58, 58, 6),
    object("central-bar", "ЦЕНТРАЛЬНЫЙ БАР", "BAR", 50, 68, 150, 42),
    object("central-bar-seats", "Места центрального бара", "ROW", 50, 75, 260, 28, 10),

    object("upper-bar-seats", "Места верхнего бара", "ROW", 50, 81, 400, 28, 20),
    object("upper-bar", "ВЕРХНИЙ БАР", "BAR", 50, 85, 365, 34),

    // Bottom vertical tables: four seats on each side.
    object("bottom-30", "30", "TABLE", 30, 94, 86, 20, 8, 90),
    object("bottom-31", "31", "TABLE", 38, 94, 86, 20, 8, 90),
    object("bottom-32", "32", "TABLE", 46, 94, 86, 20, 8, 90),
    object("bottom-33", "33", "TABLE", 54, 94, 86, 20, 8, 90),
    object("bottom-34", "34", "TABLE", 62, 94, 86, 20, 8, 90),
    object("bottom-35", "35", "TABLE", 70, 94, 86, 20, 8, 90),
  ];
}
