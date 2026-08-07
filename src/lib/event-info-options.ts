export type VenueOption = { name:string; nameHe:string; city:string; cityHe:string; address:string };

export const venueCatalog: VenueOption[] = [
  { name:"Auditorium Haifa", nameHe:"אודיטוריום חיפה", city:"Хайфа", cityHe:"חיפה", address:"שדרות הנשיא 138, חיפה" },
  { name:"Amphi Shuni", nameHe:"אמפי שוני", city:"Биньямина", cityHe:"בנימינה", address:"פארק ז׳בוטינסקי, בנימינה-גבעת עדה" },
  { name:"Barby Tel Aviv", nameHe:"בארבי תל אביב", city:"Тель-Авив-Яффо", cityHe:"תל אביב-יפו", address:"נמל יפו, מחסן 2, תל אביב-יפו" },
  { name:"Beit Nagler", nameHe:"בית נגלר", city:"Хайфа", cityHe:"חיפה", address:"רחוב בן צבי 14, קריית חיים, חיפה" },
  { name:"Gray Tel Aviv", nameHe:"גריי תל אביב", city:"Тель-Авив-Яффо", cityHe:"תל אביב-יפו", address:"אבן גבירול 30, תל אביב-יפו" },
  { name:"Gray Yehud", nameHe:"גריי יהוד", city:"Йехуд-Моноссон", cityHe:"יהוד-מונוסון", address:"דרך העצמאות 2, יהוד-מונוסון" },
  { name:"Hangar 11", nameHe:"האנגר 11", city:"Тель-Авив-Яффо", cityHe:"תל אביב-יפו", address:"כ״ג יורדי הסירה 1, נמל תל אביב" },
  { name:"Heichal HaTarbut Tel Aviv", nameHe:"היכל התרבות תל אביב", city:"Тель-Авив-Яффо", cityHe:"תל אביב-יפו", address:"כיכר הבימה, הוברמן 1, תל אביב-יפו" },
  { name:"International Convention Center Haifa", nameHe:"מרכז הקונגרסים חיפה", city:"Хайфа", cityHe:"חיפה", address:"קדושי יאסי 2, חיפה" },
  { name:"Krieger Arts Center", nameHe:"מרכז קריגר לאמנויות הבמה", city:"Хайфа", cityHe:"חיפה", address:"אליהו חכים 6, חיפה" },
  { name:"MALINA Night Club", nameHe:"מלינה נייט קלאב", city:"Хайфа", cityHe:"חיפה", address:"חיפה, ישראל" },
  { name:"Menora Mivtachim Arena", nameHe:"מנורה מבטחים ארנה", city:"Тель-Авив-Яффо", cityHe:"תל אביב-יפו", address:"יגאל אלון 51, תל אביב-יפו" },
  { name:"Pais Arena Jerusalem", nameHe:"פיס ארנה ירושלים", city:"Иерусалим", cityHe:"ירושלים", address:"דרך דוד בנבנישתי 1, ירושלים" },
  { name:"Reading 3", nameHe:"רידינג 3", city:"Тель-Авив-Яффо", cityHe:"תל אביב-יפו", address:"התערוכה 3, נמל תל אביב" },
  { name:"Romema Arena", nameHe:"רוממה ארנה", city:"Хайфа", cityHe:"חיפה", address:"פיק״א 69, חיפה" },
  { name:"Sultan's Pool", nameHe:"בריכת הסולטן", city:"Иерусалим", cityHe:"ירושלים", address:"דרך חברון, ירושלים" },
  { name:"Zappa Haifa", nameHe:"זאפה חיפה", city:"Хайфа", cityHe:"חיפה", address:"משה פלימן 4, חיפה" },
  { name:"Zappa Herzliya", nameHe:"זאפה הרצליה", city:"Герцлия", cityHe:"הרצליה", address:"מדינת היהודים 85, הרצליה" },
  { name:"Другой зал", nameHe:"אולם אחר", city:"", cityHe:"", address:"" },
].sort((a,b)=>a.nameHe.localeCompare(b.nameHe,"he"));

export const hebrewLetters=["א","ב","ג","ד","ה","ו","ז","ח","ט","י","כ","ל","מ","נ","ס","ע","פ","צ","ק","ר","ש","ת"] as const;
export const ageRestrictionOptions=["Без ограничений","Детское","3+","6+","12+","14+","16+","18+"] as const;

const ageCopy:Record<string,{ru:string;he:string;en:string}>={
  "Без ограничений":{ru:"Программа без возрастных ограничений. Подходит для семейного посещения, включая детей в сопровождении взрослых.",he:"האירוע ללא הגבלת גיל ומתאים לבילוי משפחתי, כולל ילדים בליווי מבוגר.",en:"This event has no age restriction and is suitable for families, including children accompanied by an adult."},
  "Детское":{ru:"Детская программа. Рекомендуемый возраст зависит от содержания мероприятия и указывается организатором в описании.",he:"אירוע לילדים. הגיל המומלץ נקבע לפי תוכן האירוע ומפורט בתיאור.",en:"A children’s program. The recommended age depends on the event content and is stated in the description."},
  "3+":{ru:"Посещение разрешено гостям от 3 лет. Дети допускаются только в сопровождении взрослого.",he:"הכניסה מגיל 3 ומעלה. ילדים ייכנסו בליווי מבוגר בלבד.",en:"Admission is permitted from age 3. Children must be accompanied by an adult."},
  "6+":{ru:"Посещение разрешено гостям от 6 лет. Дети допускаются только в сопровождении взрослого.",he:"הכניסה מגיל 6 ומעלה. ילדים ייכנסו בליווי מבוגר בלבד.",en:"Admission is permitted from age 6. Children must be accompanied by an adult."},
  "12+":{ru:"Посещение разрешено гостям от 12 лет. Несовершеннолетние допускаются в соответствии с правилами площадки.",he:"הכניסה מגיל 12 ומעלה. כניסת קטינים כפופה למדיניות המקום.",en:"Admission is permitted from age 12. Minors are admitted subject to the venue policy."},
  "14+":{ru:"Посещение разрешено гостям от 14 лет. Несовершеннолетние допускаются в соответствии с правилами площадки.",he:"הכניסה מגיל 14 ומעלה. כניסת קטינים כפופה למדיניות המקום.",en:"Admission is permitted from age 14. Minors are admitted subject to the venue policy."},
  "16+":{ru:"Посещение разрешено гостям от 16 лет. При входе могут попросить документ, подтверждающий возраст.",he:"הכניסה מגיל 16 ומעלה. ייתכן שתידרש הצגת תעודה מזהה בכניסה.",en:"Admission is permitted from age 16. Proof of age may be required at the entrance."},
  "18+":{ru:"Вход только для гостей от 18 лет. На входе требуется действительное удостоверение личности с фотографией.",he:"הכניסה מגיל 18 ומעלה בלבד. יש להציג תעודה מזהה תקפה עם תמונה.",en:"Admission is restricted to guests aged 18 and over. A valid photo ID is required."},
};
export function getAgeRestrictionDescription(value:string,locale:"ru"|"he"|"en"){return(ageCopy[value]||ageCopy["Без ограничений"])[locale]}
export function findVenue(name:string){return venueCatalog.find(v=>v.name===name||v.nameHe===name)}

if(typeof document!=="undefined"&&!document.getElementById("atlas-event-info-editor-styles")){
  const style=document.createElement("style"); style.id="atlas-event-info-editor-styles"; style.textContent=`
  [class*="infoPanelSection"]{gap:18px!important;padding:22px!important;border-radius:22px!important;background:linear-gradient(180deg,#fbfcff,#f4f6fa)!important;box-shadow:0 16px 40px rgba(20,30,55,.06)}
  [class*="infoControlStrip"]{grid-template-columns:repeat(4,minmax(0,1fr))!important;border:1px solid rgba(255,255,255,.13)!important;background:linear-gradient(110deg,#171820,#211b25 60%,#26191d)!important}
  [class*="infoControl"]{grid-template-columns:30px minmax(0,1fr)!important;gap:3px 10px!important;min-height:92px!important;padding:15px 18px!important}
  [class*="infoControl"] svg{width:23px!important;height:23px!important}
  [class*="infoControl"]:nth-child(1) svg{color:#ff7a18!important}[class*="infoControl"]:nth-child(2) svg{color:#638dff!important}[class*="infoControl"]:nth-child(3) svg{color:#b868ff!important}[class*="infoControl"]:nth-child(4) svg{color:#20d5a0!important}
  [class*="infoControl"]>span{font-size:11px!important}[class*="infoControl"] select,[class*="infoControl"] input{font-size:15px!important;white-space:nowrap;text-overflow:ellipsis}
  [class*="infoPanelSection"]>div:nth-of-type(2){display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px;border:1px solid #dce2ee;border-radius:14px;background:#fff;direction:rtl}
  [class*="infoPanelSection"]>div:nth-of-type(2) button{min-width:34px;height:34px;padding:0 9px;border:1px solid #d9dfeb;border-radius:9px;background:#f8f9fc;color:#293246;font-weight:800;cursor:pointer;transition:.18s ease}
  [class*="infoPanelSection"]>div:nth-of-type(2) button:hover,[class*="infoPanelSection"]>div:nth-of-type(2) button[class*="activeLetter"]{border-color:#ff7628;background:linear-gradient(135deg,#ff8427,#8155ff);color:#fff;box-shadow:0 7px 18px rgba(111,76,220,.22)}
  [class*="infoPanelSection"]>div:nth-of-type(3){display:grid;grid-template-columns:180px 180px minmax(280px,1fr);gap:12px}
  [class*="infoPanelSection"]>div:nth-of-type(3)>label{display:grid;gap:8px;padding:13px 14px;border:1px solid #dce2ec;border-radius:14px;background:#fff}
  [class*="infoPanelSection"]>div:nth-of-type(3)>label>span{display:flex;align-items:center;gap:7px;color:#3d4960;font-size:12px;font-weight:850;text-transform:uppercase}
  [class*="infoPanelSection"]>div:nth-of-type(3) input{width:100%;height:42px;padding:0 12px;border:1px solid #d6dce7;border-radius:10px;background:#f9fafc;font:inherit;font-weight:700;outline:0}
  [class*="infoPanelSection"]>div:nth-of-type(3) input:focus{border-color:#ff7926;box-shadow:0 0 0 3px rgba(255,121,38,.12)}
  [class*="infoPanelSection"]>div:last-of-type{display:flex;align-items:flex-start;gap:11px;padding:14px 16px;border:1px solid rgba(113,80,236,.2);border-radius:15px;background:linear-gradient(135deg,rgba(255,126,27,.08),rgba(106,77,238,.08));color:#293246}
  [class*="infoPanelSection"]>div:last-of-type svg{flex:0 0 auto;color:#7856ed}[class*="infoPanelSection"]>div:last-of-type strong{font-size:13px}[class*="infoPanelSection"]>div:last-of-type p{margin:4px 0 0;color:#5c687d;font-size:13px;line-height:1.45}
  @media(max-width:900px){[class*="infoControlStrip"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}[class*="infoControl"]:nth-child(2){border-right:0}[class*="infoPanelSection"]>div:nth-of-type(3){grid-template-columns:1fr 1fr}[class*="infoPanelSection"]>div:nth-of-type(3)>label:last-child{grid-column:1/-1}}
  @media(max-width:560px){[class*="infoPanelSection"]{padding:15px!important}[class*="infoControlStrip"]{grid-template-columns:1fr!important}[class*="infoControl"]{min-height:76px!important;border-right:0!important;border-bottom:1px solid rgba(255,255,255,.1)}[class*="infoPanelSection"]>div:nth-of-type(3){grid-template-columns:1fr}[class*="infoPanelSection"]>div:nth-of-type(3)>label:last-child{grid-column:auto}}
  `; document.head.appendChild(style);
}
