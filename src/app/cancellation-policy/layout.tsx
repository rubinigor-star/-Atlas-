import type { Metadata } from "next";
import { getCanonicalOrigin } from "@/lib/public-origin";

const url=`${getCanonicalOrigin()}/cancellation-policy`;

export const metadata:Metadata={
  title:"מדיניות ביטול והחזרים",
  description:"מדיניות ביטול עסקאות והחזרי כרטיסים ב-Atlas One בהתאם לדין החל בישראל.",
  alternates:{canonical:url},
  openGraph:{type:"website",url,siteName:"Atlas One",title:"מדיניות ביטול והחזרים | Atlas One",description:"מידע על ביטול עסקאות, החזרים והגשת בקשת ביטול ב-Atlas One."},
};

export default function CancellationPolicyLayout({children}:{children:React.ReactNode}){
  return children;
}
