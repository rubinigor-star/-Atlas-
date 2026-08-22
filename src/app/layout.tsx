import type { Metadata, Viewport } from "next";
import "@fontsource-variable/roboto-flex";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/noto-sans-hebrew/400.css";
import "@fontsource/noto-sans-hebrew/700.css";
import "./globals.css";
import "./accessibility.css";
import "./accessibility-skip.css";
import "./platform.css";
import "./event-experience.css";
import "./event-detail-sticky.css";
import "./seat-map-assignment-visibility.css";
import "./seat-map-public-match-admin.css";
import "./logo.css";
import "./site-header.css";
import "./account-menu-polish.css";
import "./sticky-header-theme.css";
import "./header-app-cta-compact.css";
import "./persistent-cart.css";
import "./cart-drawer-motion.css";
import "./cart-hebrew-side-fix.css";
import "./cart-ticket-row-grid.css";
import "./cart-reminder-card.css";
import "./mobile-cart-header.css";
import "./mobile-drawer-fix.css";
import "./mobile-language-header.css";
import "./mobile-menu-compact-actions.css";
import "./search-overlay.css";
import "./search-mobile-limit.css";
import "./tour.css";
import "./typography.css";
import "./live-emotions-theme.css";
import "./footer.css";
import "@/components/pricing-experiment.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LocaleProvider } from "@/components/locale-provider";
import { AppChrome } from "@/components/app-chrome";
import { PwaRegister } from "@/components/pwa-register";
import { MarketingTracker } from "@/components/marketing-tracker";
import { PromoterChannelTracker } from "@/components/promoter-channel-tracker";
import { CartDrawerMotion } from "@/components/cart-drawer-motion";
import { getServerI18n } from "@/lib/server-locale";

const BASE="https://www.atlas-one.co";

export const metadata: Metadata = {
  metadataBase:new URL(BASE),
  title:{default:"Atlas One - билеты на события в Израиле",template:"%s | Atlas One"},
  description:"Концерты, вечеринки, фестивали и специальные события в Израиле. Безопасная покупка и электронный билет сразу после оплаты.",
  openGraph:{type:"website",url:BASE,siteName:"Atlas One",title:"Atlas One - билеты на события в Израиле",description:"Находите события и покупайте билеты онлайн.",images:[{url:"/atlas-app-icon.svg",width:512,height:512,alt:"Atlas One"}]},
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
  const applePayIframeBootstrap=`(()=>{const enable=()=>{document.querySelectorAll('iframe').forEach((frame)=>{try{const src=frame.getAttribute('src')||'';if(src.includes('/payments/hyp/')||src.includes('hyp.co.il')||src.includes('creditguard.co.il')){frame.setAttribute('allow','payment');frame.allowPaymentRequest=true;}}catch{}})};enable();new MutationObserver(enable).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});})();`;
  return <html lang={locale} dir={dir} suppressHydrationWarning><body>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,"\\u003c")}}/>
    <script src="https://pps.creditguard.co.il/plugins/applePayOnIframe.js" defer></script>
    <script dangerouslySetInnerHTML={{__html:applePayIframeBootstrap}}/>
    <MarketingTracker/><PromoterChannelTracker/><CartDrawerMotion/><LocaleProvider initialLocale={locale}><PwaRegister/><AppChrome>{children}</AppChrome></LocaleProvider><SpeedInsights/>
  </body></html>;
}