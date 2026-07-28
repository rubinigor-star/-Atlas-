import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./event-experience.css";
import "./logo.css";
import "./tour.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LocaleProvider } from "@/components/locale-provider";
import { AppChrome } from "@/components/app-chrome";
import { PwaRegister } from "@/components/pwa-register";
import { getServerI18n } from "@/lib/server-locale";

const BASE="https://www.atlas-one.co";

export const metadata: Metadata = {
  metadataBase:new URL(BASE),
  title:{default:"Atlas One — билеты на события в Израиле",template:"%s | Atlas One"},
  description:"Концерты, вечеринки, фестивали и специальные события в Израиле. Безопасная покупка и электронный билет сразу после оплаты.",
  alternates:{canonical:"/"},
  openGraph:{type:"website",url:BASE,siteName:"Atlas One",title:"Atlas One — билеты на события в Израиле",description:"Находите события и покупайте билеты онлайн.",images:[{url:"/atlas-app-icon.svg",width:512,height:512,alt:"Atlas One"}]},
  twitter:{card:"summary_large_image",title:"Atlas One",description:"Билеты на концерты и события в Израиле",images:["/atlas-app-icon.svg"]},
  robots:{index:true,follow:true,googleBot:{index:true,follow:true,"max-image-preview":"large","max-snippet":-1,"max-video-preview":-1}},
  manifest: "/manifest.webmanifest",
  appleWebApp: {capable: true,statusBarStyle: "black-translucent",title: "Atlas One"},
  icons: {icon: "/atlas-app-icon.svg",apple: "/atlas-app-icon.svg"},
};

export const viewport: Viewport = {themeColor: "#081426",viewportFit: "cover"};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getServerI18n();
  const schema={"@context":"https://schema.org","@graph":[
    {"@type":"Organization","@id":`${BASE}/#organization`,name:"Atlas One",url:BASE,logo:`${BASE}/atlas-app-icon.svg`,email:"support@atlas-one.co",areaServed:{"@type":"Country",name:"Israel"}},
    {"@type":"WebSite","@id":`${BASE}/#website`,url:BASE,name:"Atlas One",publisher:{"@id":`${BASE}/#organization`},inLanguage:["ru","he","en"]}
  ]};
  return <html lang={locale} dir={dir} suppressHydrationWarning><body>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
    <LocaleProvider initialLocale={locale}><PwaRegister/><AppChrome>{children}</AppChrome></LocaleProvider><SpeedInsights/>
  </body></html>;
}
