import { readFile, writeFile } from "node:fs/promises";

const fileUrl = new URL("../src/app/admin/events/[id]/page.tsx", import.meta.url);
let source = await readFile(fileUrl, "utf8");

const importLine = 'import { VenueMapEditor } from "@/components/venue-map-editor";';
const fullscreenImport = 'import { FullscreenMapPanel } from "@/components/fullscreen-map-panel";';

if (!source.includes(fullscreenImport)) {
  if (!source.includes(importLine)) throw new Error("VenueMapEditor import was not found.");
  source = source.replace(importLine, `${importLine}\n${fullscreenImport}`);
}

const oldStart = '<section className="panel"><span className="eyebrow">Карта мероприятия</span><h2>Схема, места и назначение билетов</h2><p className="muted">Используется проверенный редактор карты без дополнительной fullscreen-обёртки и перехвата событий.</p><VenueMapEditor';
const newStart = '<FullscreenMapPanel><VenueMapEditor';

if (source.includes(oldStart)) {
  source = source.replace(oldStart, newStart);
}

const oldEnd = '/></section>:event.mapEnabled?<div className="panel">У вас нет доступа к редактированию карты.</div>';
const newEnd = '/></FullscreenMapPanel>:event.mapEnabled?<div className="panel">У вас нет доступа к редактированию карты.</div>';

if (source.includes(oldEnd)) {
  source = source.replace(oldEnd, newEnd);
}

if (!source.includes('<FullscreenMapPanel><VenueMapEditor') || !source.includes('/></FullscreenMapPanel>:event.mapEnabled?')) {
  throw new Error("Could not safely enable the venue map fullscreen wrapper.");
}

await writeFile(fileUrl, source, "utf8");
console.log("Enabled safe application-level fullscreen mode for venue map.");
