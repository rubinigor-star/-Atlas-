import { readFile, writeFile } from "node:fs/promises";

const path="src/app/page.tsx";
let source=await readFile(path,"utf8");
const start="  const marqueeCards=[";
const end="  ].slice(0,14);";
if(!source.includes(start)){
  if(source.includes("HomeMarqueeEvent")){console.log("Home marquee source patch already applied.");process.exit(0);}
  throw new Error("Home marquee block was not found");
}
const from=source.indexOf(start);
const to=source.indexOf(end,from);
if(to<0)throw new Error("Home marquee block end was not found");
const replacement=`  const marqueeRows=await db.$queryRawUnsafe<Array<{eventId:string;position:number}>>(\`SELECT "eventId","position" FROM "HomeMarqueeEvent" WHERE "active"=TRUE ORDER BY "position" ASC\`);\n  const marqueeEventById=new Map(events.map(event=>[event.id,event]));\n  const marqueeCards=marqueeRows.map(row=>marqueeEventById.get(row.eventId)).filter((event):event is EventRow=>Boolean(event&&event.startsAt.getTime()>=Date.now())).map(event=>({\n    id:\`event-\${event.id}\`,\n    href:\`/events/\${event.slug}\`,\n    title:event.title,\n    poster:event.posterUrl,\n    meta:\`\${displayCity(event.venue.city,locale)} · \${shortDate(event.startsAt,locale)}\`,\n  }));`;
source=source.slice(0,from)+replacement+source.slice(to+end.length);
await writeFile(path,source);
console.log("Applied manual home marquee source patch.");
