import type { Metadata } from "next";
import { ContentPage,Section } from "@/components/content-page";

export const metadata:Metadata={title:"О компании Atlas One",description:"Atlas One — израильская платформа для продажи билетов на концерты, вечеринки, фестивали и другие живые события.",alternates:{canonical:"/about"}};

export default function AboutPage(){
 const schema={"@context":"https://schema.org","@type":"AboutPage",name:"О компании Atlas One",url:"https://www.atlas-one.co/about",mainEntity:{"@type":"Organization",name:"Atlas One",url:"https://www.atlas-one.co",logo:"https://www.atlas-one.co/atlas-app-icon.svg",areaServed:"IL",description:"Израильская платформа для продажи билетов и управления мероприятиями."}};
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/><ContentPage eyebrow="Atlas One" title="Билеты без лишних сложностей" intro="Atlas One помогает зрителям находить события и покупать билеты, а организаторам — управлять продажами, гостями, входом и коммуникацией в одном месте.">
  <Section title="Кто мы"><p>Мы развиваем современную израильскую билетную платформу для концертов, клубных событий, фестивалей, стендапа, семейных шоу и специальных мероприятий.</p></Section>
  <Section title="Для покупателей"><p>Понятная цена, безопасная оплата на защищённой странице платёжного провайдера, электронный билет сразу после успешной покупки и удобный вход по QR-коду.</p></Section>
  <Section title="Для организаторов"><p>Создание мероприятий, категории и динамические цены, продажи, промокоды, база гостей, рассадка, отчёты, возвраты, сканирование билетов и работа команды.</p></Section>
  <Section title="Наш принцип"><p>Технология должна упрощать организацию события и оставаться незаметной для гостя. Поэтому мы фокусируемся на скорости, прозрачности, мобильном интерфейсе и надёжности.</p></Section>
 </ContentPage></>;
}
