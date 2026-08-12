import Link from "next/link";

const LAW_URL="https://main.knesset.gov.il/Activity/Legislation/Laws/pages/lawprimary.aspx?lawitemid=2000237&st=lawlaws&t=lawlaws";
const GUIDE_URL="https://www.gov.il/he/pages/nlfeb23?chapterIndex=7";

export default async function CancellationPolicyPage({searchParams}:{searchParams?:Promise<{order?:string;email?:string}>}){
  const query=searchParams?await searchParams:{};
  const params=new URLSearchParams();
  if(query.order)params.set("order",query.order);
  if(query.email)params.set("email",query.email);
  const cancelHref=`/cancel-order${params.toString()?`?${params.toString()}`:""}`;
  return <main style={{maxWidth:920,margin:"0 auto",padding:"48px 20px 88px"}} dir="rtl">
    <div className="stack" style={{gap:20}}>
      <header style={{textAlign:"center",padding:"18px 0 8px"}}>
        <span className="eyebrow">Atlas One</span>
        <h1 style={{fontSize:"clamp(34px,6vw,58px)",margin:"8px 0 12px"}}>מדיניות ביטול</h1>
        <p className="muted" style={{maxWidth:700,margin:"0 auto",fontSize:17,lineHeight:1.7}}>מדיניות ביטול העסקאות באתר Atlas One מבוססת על הוראות חוק הגנת הצרכן והדין החל בישראל. ניתן לקרוא את הכללים ולאחר מכן להגיש בקשת ביטול מקוונת.</p>
      </header>

      <section className="panel stack" style={{fontSize:16,lineHeight:1.9}}>
        <h2 style={{marginBottom:0}}>ביטול עסקה ברכישת כרטיסים</h2>
        <p>ביטול עסקה יתבצע בהתאם להוראות <strong>חוק הגנת הצרכן, התשמ״א-1981</strong>, התקנות וההוראות הרלוונטיות כפי שיהיו בתוקף מעת לעת.</p>
        <p>בעסקת מכר מרחוק לשירותי בילוי ניתן, ככל שהדין חל על העסקה, לבטל את העסקה בתוך 14 ימים ממועד ביצוע העסקה או ממועד קבלת מסמך הגילוי, לפי המאוחר, ובתנאי שבמועד הביטול נותרו יותר מ-7 ימים שאינם ימי מנוחה עד למועד מתן השירות.</p>
        <p>כאשר הביטול נעשה כדין, דמי הביטול עשויים לעמוד על <strong>5% ממחיר העסקה או 100 ש״ח, לפי הנמוך מביניהם</strong>. ככל שנגבו בפועל הוצאות סליקה שמותר לגבותן לפי הדין, הן עשויות להיכלל בחישוב בהתאם לנסיבות העסקה.</p>
        <p>לאחר אישור הביטול והשלמת ההחזר, הכרטיסים המבוטלים יבוטלו ולא יהיו תקפים לכניסה לאירוע. אם שוחררו מקומות, מושבים או שולחנות בעקבות הביטול, הם עשויים לחזור למלאי המכירה.</p>
      </section>

      <section className="panel stack">
        <h2 style={{marginBottom:0}}>אוכלוסיות הזכאיות לתקופת ביטול מורחבת</h2>
        <p className="muted" style={{lineHeight:1.8}}>במקרים הקבועים בחוק, אדם עם מוגבלות, אזרח ותיק או עולה חדש עשוי להיות זכאי לתקופת ביטול מורחבת, בכפוף לתנאי החוק ולהצגת מסמך מתאים. בקשות מסוג זה מסומנות לבדיקה ידנית של המפיק לפני קבלת החלטה.</p>
      </section>

      <section className="panel stack" style={{background:"#f8fafc"}}>
        <h2 style={{marginBottom:0}}>אם הבקשה אינה עומדת בתנאי הביטול הסטנדרטיים</h2>
        <p className="muted" style={{lineHeight:1.8}}>עדיין ניתן להגיש בקשה. Atlas יציג למפיק כי הזכאות הסטנדרטית לא אושרה אוטומטית, והמפיק יוכל להחליט אם לאשר החזר מלא, חלקי או לדחות את הבקשה בהתאם לדין ולשיקול דעתו.</p>
      </section>

      <section className="panel stack">
        <h2 style={{marginBottom:0}}>מקורות רשמיים</h2>
        <p className="muted">ניתן לעיין בנוסח החוק ובמידע הרשמי של הרשות להגנת הצרכן לפני הגשת הבקשה.</p>
        <div className="row" style={{gap:10,flexWrap:"wrap"}}>
          <a className="btn secondary" href={LAW_URL} target="_blank" rel="noreferrer">חוק הגנת הצרכן - מאגר החקיקה הלאומי</a>
          <a className="btn secondary" href={GUIDE_URL} target="_blank" rel="noreferrer">מידע רשמי על ביטול עסקאות</a>
        </div>
      </section>

      <section className="panel" style={{textAlign:"center",padding:"30px"}}>
        <h2 style={{margin:"0 0 8px"}}>רוצים לבטל הזמנה?</h2>
        <p className="muted" style={{margin:"0 0 20px"}}>הבקשה תועבר ישירות למפיק האירוע ותופיע במרכז הביטולים שלו ב-Atlas.</p>
        <Link href={cancelHref} className="btn dark" style={{minWidth:220}}>הגשת בקשת ביטול</Link>
      </section>

      <p className="muted" style={{fontSize:12,textAlign:"center",lineHeight:1.6}}>המידע בעמוד נועד להסביר את תהליך הביטול ב-Atlas ואינו מחליף את הוראות הדין. במקרה של סתירה, הוראות הדין גוברות.</p>
    </div>
  </main>;
}
