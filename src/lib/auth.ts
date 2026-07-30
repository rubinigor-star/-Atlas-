import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { StaffPermission } from "@prisma/client";
import { db } from "@/lib/db";
import { allPermissions, rolePermissions } from "@/lib/permissions";

export const officeSessionCookie = "atlas_office_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const TOKEN_TTL_SECONDS = 60 * 60;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const BOOTSTRAP_ADMIN_EMAIL = "rubin.igor@gmail.com";
const BOOTSTRAP_ADMIN_PASSWORD_HASH = "scrypt:21b434e1ae97b23c011ab63710dca161:5ef4bb33cca7a691e7b8d4bd1380a045151e85ac1c27b55e721223c207d90ad83ba59620e315569149c0d288571c9bc198b856b23ead2c0210fe6ed448720c4d";
export const DEMO_ORGANIZER_EMAIL = "demo.organizer@atlas-one.co";
const DEMO_ORGANIZATION_NAME = "Demo Organizer";

type OfficeSession = { userId: string; expiresAt: number };
type CredentialRow = { userId: string; passwordHash: string; emailVerifiedAt: Date | null; failedAttempts: number; lockedUntil: Date | null };

function authSecret() {
  return process.env.OFFICE_AUTH_SECRET || process.env.CUSTOMER_AUTH_SECRET || process.env.CRON_SECRET || "atlas-local-office-secret-change-me";
}
function sign(value: string) { return createHmac("sha256", authSecret()).update(value).digest("base64url"); }
function encode(payload: object) { const body = Buffer.from(JSON.stringify(payload)).toString("base64url"); return `${body}.${sign(body)}`; }
function decode<T>(token: string): T | null {
  const [body, signature] = token.split("."); if (!body || !signature) return null;
  const expected = sign(body); const left = Buffer.from(signature); const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T; } catch { return null; }
}

export async function ensureOfficeAuthTable() {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OfficeCredential" (
    "userId" TEXT PRIMARY KEY,"passwordHash" TEXT NOT NULL,"emailVerifiedAt" TIMESTAMP NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,"lockedUntil" TIMESTAMP NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}
export function hashOfficePassword(password: string) { const salt=randomBytes(16).toString("hex"); const hash=scryptSync(password,salt,64).toString("hex"); return `scrypt:${salt}:${hash}`; }
export function verifyOfficePassword(password: string, stored: string) {
  const [scheme,salt,expected]=stored.split(":"); if(scheme!=="scrypt"||!salt||!expected)return false;
  const actual=scryptSync(password,salt,64); const target=Buffer.from(expected,"hex"); return actual.length===target.length&&timingSafeEqual(actual,target);
}
async function credentialForUser(userId:string){await ensureOfficeAuthTable();const rows=await db.$queryRawUnsafe<CredentialRow[]>(`SELECT "userId","passwordHash","emailVerifiedAt","failedAttempts","lockedUntil" FROM "OfficeCredential" WHERE "userId"=$1 LIMIT 1`,userId);return rows[0]??null;}

async function ensureBootstrapSuperuser(email:string,password:string){
  if(email!==BOOTSTRAP_ADMIN_EMAIL||!verifyOfficePassword(password,BOOTSTRAP_ADMIN_PASSWORD_HASH))return;
  const user=await db.user.upsert({where:{email:BOOTSTRAP_ADMIN_EMAIL},create:{name:"Igor Rubin",email:BOOTSTRAP_ADMIN_EMAIL,role:"ADMIN",staffRole:"ADMIN",jobTitle:"Platform Super Administrator",active:true,organizationId:null},update:{name:"Igor Rubin",role:"ADMIN",staffRole:"ADMIN",jobTitle:"Platform Super Administrator",active:true,organizationId:null}});
  await ensureOfficeAuthTable();
  await db.$executeRawUnsafe(`INSERT INTO "OfficeCredential" ("userId","passwordHash","emailVerifiedAt","failedAttempts","createdAt","updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("userId") DO NOTHING`,user.id,BOOTSTRAP_ADMIN_PASSWORD_HASH);
}

export async function createOfficeCredential(userId:string,password:string,verified=false){await ensureOfficeAuthTable();const passwordHash=hashOfficePassword(password);const verifiedAt=verified?new Date():null;await db.$executeRawUnsafe(`INSERT INTO "OfficeCredential" ("userId","passwordHash","emailVerifiedAt","failedAttempts","createdAt","updatedAt") VALUES ($1,$2,$3,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("userId") DO UPDATE SET "passwordHash"=EXCLUDED."passwordHash","emailVerifiedAt"=COALESCE("OfficeCredential"."emailVerifiedAt",EXCLUDED."emailVerifiedAt"),"failedAttempts"=0,"lockedUntil"=NULL,"updatedAt"=CURRENT_TIMESTAMP`,userId,passwordHash,verifiedAt);}

export async function authenticateOfficeUser(email:string,password:string){
  const normalizedEmail=email.trim().toLowerCase();await ensureBootstrapSuperuser(normalizedEmail,password);
  const user=await db.user.findUnique({where:{email:normalizedEmail}});if(!user||!user.active||!["ORGANIZER","CHECKIN","ADMIN"].includes(user.role))return{ok:false as const,error:"INVALID_CREDENTIALS"};
  const credential=await credentialForUser(user.id);if(!credential)return{ok:false as const,error:"PASSWORD_NOT_SET"};
  if(credential.lockedUntil&&new Date(credential.lockedUntil)>new Date())return{ok:false as const,error:"LOCKED"};
  if(!verifyOfficePassword(password,credential.passwordHash)){const next=credential.failedAttempts+1;const lockedUntil=next>=MAX_FAILED_ATTEMPTS?new Date(Date.now()+LOCK_MINUTES*60_000):null;await db.$executeRawUnsafe(`UPDATE "OfficeCredential" SET "failedAttempts"=$1,"lockedUntil"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=$3`,next,lockedUntil,user.id);return{ok:false as const,error:lockedUntil?"LOCKED":"INVALID_CREDENTIALS"};}
  if(!credential.emailVerifiedAt)return{ok:false as const,error:"EMAIL_NOT_VERIFIED"};
  await db.$executeRawUnsafe(`UPDATE "OfficeCredential" SET "failedAttempts"=0,"lockedUntil"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=$1`,user.id);return{ok:true as const,user};
}

export async function createOfficeSession(userId:string){const store=await cookies();store.set(officeSessionCookie,encode({userId,expiresAt:Math.floor(Date.now()/1000)+SESSION_TTL_SECONDS}),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:SESSION_TTL_SECONDS});}
export async function clearOfficeSession(){const store=await cookies();store.delete(officeSessionCookie);}
export function createOfficeActionToken(type:"verify"|"reset",userId:string,email:string){return encode({type,userId,email:email.toLowerCase(),expiresAt:Math.floor(Date.now()/1000)+TOKEN_TTL_SECONDS});}
export function verifyOfficeActionToken(token:string,expectedType:"verify"|"reset"){const value=decode<{type?:string;userId?:string;email?:string;expiresAt?:number}>(token);if(!value||value.type!==expectedType||typeof value.userId!=="string"||typeof value.email!=="string"||typeof value.expiresAt!=="number"||value.expiresAt<Math.floor(Date.now()/1000))return null;return{userId:value.userId,email:value.email};}
export async function markOfficeEmailVerified(userId:string){await ensureOfficeAuthTable();await db.$executeRawUnsafe(`UPDATE "OfficeCredential" SET "emailVerifiedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=$1`,userId);}
export async function resetOfficePassword(userId:string,password:string){await createOfficeCredential(userId,password,true);}

export async function getCurrentStaff(){const store=await cookies();const session=decode<OfficeSession>(store.get(officeSessionCookie)?.value||"");if(!session||typeof session.userId!=="string"||typeof session.expiresAt!=="number"||session.expiresAt<Math.floor(Date.now()/1000))return null;const user=await db.user.findUnique({where:{id:session.userId},include:{permissions:true,eventAccess:true,organization:true}});if(!user||!user.active)return null;const permissions=user.role==="ADMIN"?allPermissions:user.permissions.map(grant=>grant.permission);return{...user,permissionSet:new Set<StaffPermission>(permissions)};}
export async function requirePlatformAdmin(){const user=await getCurrentStaff();if(!user||user.role!=="ADMIN")throw new Error("FORBIDDEN");return user;}
export async function requirePermission(permission:StaffPermission){const user=await getCurrentStaff();if(!user||!user.permissionSet.has(permission))throw new Error("FORBIDDEN");return user;}
export function canAccessEvent(user:Awaited<ReturnType<typeof getCurrentStaff>>,eventId:string){if(!user)return false;return user.role==="ADMIN"||user.eventAccess.length===0||user.eventAccess.some(access=>access.eventId===eventId);}
export async function requireEventAccess(permission:StaffPermission,eventId:string){const user=await requirePermission(permission);const event=await db.event.findUnique({where:{id:eventId},select:{organizationId:true}});if(!event||(user.role!=="ADMIN"&&event.organizationId!==user.organizationId)||!canAccessEvent(user,eventId))throw new Error("FORBIDDEN");return user;}

export async function ensureDemoOrganizerPlatform(){
  const existingDemoUser=await db.user.findUnique({where:{email:DEMO_ORGANIZER_EMAIL},include:{organization:true}});
  let organization=existingDemoUser?.organization??await db.organization.findFirst({where:{name:DEMO_ORGANIZATION_NAME}});
  if(!organization)organization=await db.organization.create({data:{name:DEMO_ORGANIZATION_NAME}});
  const temporaryPassword=`Atlas-${createHmac("sha256",authSecret()).update(`demo-organizer:${organization.id}`).digest("hex").slice(0,10)}!`;
  const demoUser=await db.user.upsert({where:{email:DEMO_ORGANIZER_EMAIL},update:{name:"Demo Organizer",role:"ORGANIZER",staffRole:"OWNER",jobTitle:"Organization Owner",active:true,organizationId:organization.id},create:{name:"Demo Organizer",email:DEMO_ORGANIZER_EMAIL,role:"ORGANIZER",staffRole:"OWNER",jobTitle:"Organization Owner",active:true,organizationId:organization.id},include:{organization:true}});
  const credential=await credentialForUser(demoUser.id);if(!credential||!verifyOfficePassword(temporaryPassword,credential.passwordHash))await createOfficeCredential(demoUser.id,temporaryPassword,true);
  for(const permission of rolePermissions.OWNER){await db.permissionGrant.upsert({where:{userId_permission:{userId:demoUser.id,permission}},update:{},create:{userId:demoUser.id,permission}});}
  await db.event.updateMany({data:{organizationId:organization.id}});
  await db.eventStaffAccess.deleteMany({where:{userId:demoUser.id}});
  return{organization,user:demoUser,email:DEMO_ORGANIZER_EMAIL,temporaryPassword,eventCount:await db.event.count({where:{organizationId:organization.id}})};
}

export async function ensureDemoOrganizerAccount(_organizationId?:string){const demo=await ensureDemoOrganizerPlatform();const events=await db.event.findMany({where:{organizationId:demo.organization.id},orderBy:[{startsAt:"desc"},{createdAt:"desc"}],select:{id:true,title:true}});return{email:demo.email,temporaryPassword:demo.temporaryPassword,events};}
