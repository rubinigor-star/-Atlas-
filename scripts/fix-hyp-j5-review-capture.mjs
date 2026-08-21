import fs from 'node:fs';

const path='src/lib/order-review-service.ts';
let src=fs.readFileSync(path,'utf8');

const oldType='type AuthorizationRow = { id:string; provider:string; status:string; amountMinor:number; currency:string; hypTransId:string|null; hypCaptureTransId:string|null };';
const newType='type AuthorizationRow = { id:string; provider:string; status:string; amountMinor:number; currency:string; hypTransId:string|null; hypCaptureTransId:string|null; hypAuthorizationCode:string|null; providerPayloadJson:string|null };';
if(src.includes(oldType))src=src.replace(oldType,newType);
else if(!src.includes(newType))throw new Error('AuthorizationRow anchor not found');

const oldSelect='SELECT "id","provider","status","amountMinor","currency","hypTransId","hypCaptureTransId" FROM "PaymentAuthorization"';
const newSelect='SELECT "id","provider","status","amountMinor","currency","hypTransId","hypCaptureTransId","hypAuthorizationCode","providerPayloadJson" FROM "PaymentAuthorization"';
if(src.includes(oldSelect))src=src.replace(oldSelect,newSelect);
else if(!src.includes(newSelect))throw new Error('Authorization SELECT anchor not found');

const oldCall='const result=await captureHypAuthorization({transactionId:authorization.hypTransId,amountMinor:authorization.amountMinor,description:"Atlas organizer approval"});';
const newCall='let originalUid="";try{const payload=JSON.parse(authorization.providerPayloadJson||"{}");originalUid=String(payload.UID||payload.Uid||payload.uid||payload.originalUid||"");}catch{}const result=await captureHypAuthorization({transactionId:authorization.hypTransId,amountMinor:authorization.amountMinor,description:"Atlas organizer approval",originalUid,authorizationCode:authorization.hypAuthorizationCode});';
if(src.includes(oldCall))src=src.replace(oldCall,newCall);
else if(!src.includes('authorizationCode:authorization.hypAuthorizationCode'))throw new Error('J5 capture call anchor not found');

src=src.replaceAll('HYP TransId не сохранён для завершения Postpone','HYP TransId не сохранён для завершения авторизации');
src=src.replaceAll('HYP TransId не сохранён для отклонения Postpone','HYP TransId не сохранён для отмены авторизации');
src=src.replaceAll('HYP Postpone не был закрыт без списания','HYP-авторизация не была отменена без списания');

fs.writeFileSync(path,src);
console.log('Wired HYP J5 authorization capture/release into organizer review.');
