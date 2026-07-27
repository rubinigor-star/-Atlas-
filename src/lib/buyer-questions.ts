export type BuyerQuestionType = "TEXT" | "TEXTAREA" | "SELECT" | "CHECKBOX" | "PHONE" | "EMAIL" | "DATE";
export type BuyerQuestion = { id:string; label:string; type:BuyerQuestionType; required:boolean; placeholder?:string; options?:string[] };
const MARKER = "\n\n<!--ATLAS_BUYER_QUESTIONS:";
export function parseBuyerQuestions(description:string):BuyerQuestion[]{
 const start=description.lastIndexOf(MARKER); if(start<0)return [];
 const end=description.indexOf("-->",start); if(end<0)return [];
 try{const value=JSON.parse(Buffer.from(description.slice(start+MARKER.length,end),"base64url").toString("utf8"));return Array.isArray(value)?value:[];}catch{return [];}
}
export function stripBuyerQuestions(description:string){const start=description.lastIndexOf(MARKER);return start<0?description:description.slice(0,start).trimEnd();}
export function withBuyerQuestions(description:string,questions:BuyerQuestion[]){const clean=stripBuyerQuestions(description);if(!questions.length)return clean;const payload=Buffer.from(JSON.stringify(questions)).toString("base64url");return `${clean}${MARKER}${payload}-->`;}
