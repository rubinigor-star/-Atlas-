import { z } from "zod";

export const ticketBindingSchema=z.enum(["CUSTOM","EVENT_TITLE","EVENT_DATE","EVENT_TIME","VENUE","ADDRESS","CUSTOMER_NAME","TICKET_TYPE","ORDER_NUMBER","TICKET_CODE","QR","IMAGE"]);
export const ticketElementSchema=z.object({id:z.string(),binding:ticketBindingSchema,x:z.number().min(0).max(100),y:z.number().min(0).max(100),width:z.number().min(5).max(100),height:z.number().min(3).max(100),content:z.string().max(500).default(""),fontSize:z.number().min(8).max(54).default(16),color:z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#FFFFFF"),align:z.enum(["left","center","right"]).default("left"),bold:z.boolean().default(false),hidden:z.boolean().default(false)});
export const ticketTemplateSchema=z.object({name:z.string().min(2).max(80),backgroundColor:z.string().regex(/^#[0-9A-Fa-f]{6}$/),accentColor:z.string().regex(/^#[0-9A-Fa-f]{6}$/),textColor:z.string().regex(/^#[0-9A-Fa-f]{6}$/),logoUrl:z.string().max(500).nullable(),backgroundUrl:z.string().max(500).nullable(),elements:z.array(ticketElementSchema).min(1).max(40)});
export type TicketElement=z.infer<typeof ticketElementSchema>;
export type TicketDesign=z.infer<typeof ticketTemplateSchema>;

export const defaultTicketElements:TicketElement[]=[
  {id:"event-title",binding:"EVENT_TITLE",x:7,y:8,width:86,height:12,content:"",fontSize:30,color:"#FFFFFF",align:"left",bold:true,hidden:false},
  {id:"ticket-type",binding:"TICKET_TYPE",x:7,y:22,width:86,height:6,content:"",fontSize:14,color:"#FFB4A8",align:"left",bold:true,hidden:false},
  {id:"date",binding:"EVENT_DATE",x:7,y:31,width:42,height:7,content:"",fontSize:15,color:"#FFFFFF",align:"left",bold:true,hidden:false},
  {id:"time",binding:"EVENT_TIME",x:52,y:31,width:41,height:7,content:"",fontSize:15,color:"#FFFFFF",align:"right",bold:true,hidden:false},
  {id:"venue",binding:"VENUE",x:7,y:40,width:86,height:7,content:"",fontSize:14,color:"#D8E1ED",align:"left",bold:false,hidden:false},
  {id:"holder",binding:"CUSTOMER_NAME",x:7,y:51,width:86,height:7,content:"",fontSize:16,color:"#FFFFFF",align:"left",bold:true,hidden:false},
  {id:"qr",binding:"QR",x:23,y:62,width:54,height:26,content:"",fontSize:14,color:"#FFFFFF",align:"center",bold:false,hidden:false},
  {id:"code",binding:"TICKET_CODE",x:7,y:91,width:86,height:4,content:"",fontSize:9,color:"#B5C0CF",align:"center",bold:false,hidden:false},
];

export function defaultTicketDesign():TicketDesign{return{name:"Основной билет",backgroundColor:"#081426",accentColor:"#FF5C45",textColor:"#FFFFFF",logoUrl:null,backgroundUrl:null,elements:defaultTicketElements}}

export function parseTicketDesign(input:{name:string;backgroundColor:string;accentColor:string;textColor:string;logoUrl:string|null;backgroundUrl:string|null;canvasJson:string}|null|undefined):TicketDesign{
  if(!input)return defaultTicketDesign();
  try{return ticketTemplateSchema.parse({...input,elements:JSON.parse(input.canvasJson)})}catch{return defaultTicketDesign()}
}

export type TicketRenderData={eventTitle:string;startsAt:Date;venue:string;address:string;customerName:string;ticketType:string;orderNumber:string;ticketCode:string};
export function resolveTicketText(element:TicketElement,data:TicketRenderData){switch(element.binding){case"CUSTOM":return element.content;case"EVENT_TITLE":return data.eventTitle;case"EVENT_DATE":return data.startsAt.toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"});case"EVENT_TIME":return data.startsAt.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});case"VENUE":return data.venue;case"ADDRESS":return data.address;case"CUSTOMER_NAME":return data.customerName;case"TICKET_TYPE":return data.ticketType;case"ORDER_NUMBER":return data.orderNumber;case"TICKET_CODE":return data.ticketCode;default:return element.content}}
