export type TicketBinding="CUSTOM"|"EVENT_TITLE"|"EVENT_DATE"|"EVENT_TIME"|"VENUE"|"ADDRESS"|"CUSTOMER_NAME"|"TICKET_TYPE"|"ORDER_NUMBER"|"TICKET_CODE"|"QR"|"IMAGE";
export type TicketElement={id:string;binding:TicketBinding;x:number;y:number;width:number;height:number;content:string;fontSize:number;color:string;align:"left"|"center"|"right";bold:boolean;hidden:boolean};
export type TicketDesign={name:string;backgroundColor:string;accentColor:string;textColor:string;logoUrl:string|null;backgroundUrl:string|null;elements:TicketElement[]};
