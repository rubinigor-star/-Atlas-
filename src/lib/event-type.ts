export const eventTypeValues=["SOLO_CONCERT","LIVE_MUSIC","CLASSICAL_CONCERT","FESTIVAL","PARTY","DJ_SET","THEATRE","COMEDY","CHILDREN_SHOW","SPORT","LECTURE","CONFERENCE","EXHIBITION","WORKSHOP","OTHER"] as const;
export type EventType=typeof eventTypeValues[number];

const marker=/<!--ATLAS_EVENT_TYPES?:([A-Z_,]+)-->/;

export function parseEventTypes(description:string):EventType[]{
 const raw=description.match(marker)?.[1]?.split(",")??[];
 const values=raw.filter(value=>eventTypeValues.includes(value as EventType)) as EventType[];
 return values.length?Array.from(new Set(values)):["OTHER"];
}

export function parseEventType(description:string):EventType{return parseEventTypes(description)[0]??"OTHER";}

export function stripEventType(description:string){return description.replace(/\n?<!--ATLAS_EVENT_TYPES?:[A-Z_,]+-->/g,"").trim();}

export function withEventTypes(description:string,types:EventType[]){
 const clean=stripEventType(description);
 const valid=Array.from(new Set(types.filter(type=>eventTypeValues.includes(type))));
 return `${clean}\n<!--ATLAS_EVENT_TYPES:${(valid.length?valid:["OTHER"]).join(",")}-->`;
}

export function withEventType(description:string,type:EventType){return withEventTypes(description,[type]);}

export const eventTypeLabels:Record<"ru"|"he"|"en",Record<EventType,string>>={
 ru:{SOLO_CONCERT:"Сольный концерт",LIVE_MUSIC:"Живая музыка",CLASSICAL_CONCERT:"Классический концерт",FESTIVAL:"Фестиваль",PARTY:"Вечеринка",DJ_SET:"DJ-сет",THEATRE:"Спектакль",COMEDY:"Стендап и комедия",CHILDREN_SHOW:"Детское представление",SPORT:"Спортивное мероприятие",LECTURE:"Лекция",CONFERENCE:"Конференция",EXHIBITION:"Выставка",WORKSHOP:"Мастер-класс",OTHER:"Другое событие"},
 he:{SOLO_CONCERT:"מופע סולו",LIVE_MUSIC:"מוזיקה חיה",CLASSICAL_CONCERT:"קונצרט קלאסי",FESTIVAL:"פסטיבל",PARTY:"מסיבה",DJ_SET:"סט DJ",THEATRE:"הצגה",COMEDY:"סטנדאפ וקומדיה",CHILDREN_SHOW:"מופע ילדים",SPORT:"אירוע ספורט",LECTURE:"הרצאה",CONFERENCE:"כנס",EXHIBITION:"תערוכה",WORKSHOP:"סדנה",OTHER:"אירוע אחר"},
 en:{SOLO_CONCERT:"Solo concert",LIVE_MUSIC:"Live music",CLASSICAL_CONCERT:"Classical concert",FESTIVAL:"Festival",PARTY:"Party",DJ_SET:"DJ set",THEATRE:"Theatre",COMEDY:"Stand-up & comedy",CHILDREN_SHOW:"Children’s show",SPORT:"Sports event",LECTURE:"Lecture",CONFERENCE:"Conference",EXHIBITION:"Exhibition",WORKSHOP:"Workshop",OTHER:"Other event"}
};
