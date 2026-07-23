export const guestFieldKeys=["firstName","lastName","phone","email","birthDate","city","facebook","instagram"] as const;
export type GuestFieldKey=typeof guestFieldKeys[number];
export type GuestFieldConfig=Record<GuestFieldKey,{visible:boolean;required:boolean}>;

export const defaultGuestFields:GuestFieldConfig={
  firstName:{visible:true,required:true},lastName:{visible:true,required:true},phone:{visible:true,required:true},
  email:{visible:true,required:true},birthDate:{visible:true,required:true},city:{visible:true,required:true},
  facebook:{visible:true,required:false},instagram:{visible:true,required:false},
};

const marker=/<!--ATLAS_GUEST_FIELDS:([A-Za-z0-9+/=]+)-->/;
export function serializeGuestFields(config:GuestFieldConfig){return `<!--ATLAS_GUEST_FIELDS:${Buffer.from(JSON.stringify(config)).toString("base64")}-->`;}
export function parseGuestFields(description:string):GuestFieldConfig{
  const found=description.match(marker)?.[1];if(!found)return defaultGuestFields;
  try{const parsed=JSON.parse(Buffer.from(found,"base64").toString("utf8"));return Object.fromEntries(guestFieldKeys.map(key=>[key,{visible:parsed?.[key]?.visible!==false,required:parsed?.[key]?.required===true}])) as GuestFieldConfig;}catch{return defaultGuestFields;}
}
export function stripEventMarkers(description:string){return description.replace(/\n?<!--ATLAS_(?:DOORS_OPEN|GUEST_FIELDS):[^>]+-->/g,"").trim();}
