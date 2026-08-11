import { requirePromoterV2 } from "@/lib/promoter-auth-v2";
import { db } from "@/lib/db";

export default async function PromoterProfilePage(){
 const promoter=await requirePromoterV2();const organization=await db.organization.findUnique({where:{id:promoter.organizationId},select:{name:true}});
 return <><div><div style={{fontSize:13,textTransform:"uppercase",letterSpacing:".12em",color:"#667085"}}>Аккаунт</div><h1 style={{fontSize:34,margin:"8px 0"}}>Профиль</h1><p style={{color:"#667085"}}>Контактные данные вашего защищённого promoter-аккаунта.</p></div><div style={{marginTop:24,maxWidth:620,background:"white",border:"1px solid #eaecf0",borderRadius:16,padding:22}}><div style={{display:"grid",gap:18}}><div><div style={{fontSize:12,color:"#667085"}}>Имя</div><strong>{promoter.name}</strong></div><div><div style={{fontSize:12,color:"#667085"}}>Email</div><strong>{promoter.email}</strong></div><div><div style={{fontSize:12,color:"#667085"}}>Телефон</div><strong>{promoter.phone||"Не указан"}</strong></div><div><div style={{fontSize:12,color:"#667085"}}>Организация</div><strong>{organization?.name||"Atlas One"}</strong></div></div><p style={{marginTop:22,color:"#667085",fontSize:13}}>Изменение контактных данных выполняет организатор. Для смены пароля используйте восстановление доступа на странице входа.</p></div></>;
}
