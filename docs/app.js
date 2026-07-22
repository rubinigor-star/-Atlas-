const app = document.querySelector("#app");
const state = {
  locale: localStorage.getItem("atlas-demo-locale-v2") || "ru",
  category: "General Admission",
  price: 149,
  quantity: 1,
  table: null,
  salesMode: "APPROVAL_REQUIRED",
  requestStatus: "NONE",
  applicant: "Игорь Рубин",
  eligibilityAnswer: "Клубная карта MLN-2841",
  selectedMapObject: null,
  selectedSeats: [],
  editorObject: "T1",
  editorTab: "design",
  editorZoom: 0.72,
  editorInspectorOpen: false,
  editorSeats: [],
  editorTicket: "VIP Seating",
  admissionMode: "RESERVED_SEATING",
  demoPricingMode: "SCHEDULED",
  mapObjects: [
    { id: "STAGE", type: "stage", label: "СЦЕНА", seats: 0, x: 50, y: 12, width: 440, height: 72 },
    { id: "DANCE", type: "zone", label: "ТАНЦПОЛ", seats: 0, x: 50, y: 48, width: 390, height: 280 },
    { id: "T1", type: "table", label: "T1", seats: 6, mode: "whole", price: 1890, category: "VIP Seating", x: 18, y: 35, width: 128, height: 76, rotation: 0 },
    { id: "T2", type: "round-table", label: "T2", seats: 6, mode: "whole", price: 1890, category: "VIP Seating", x: 82, y: 35, width: 104, height: 104 },
    { id: "T3", type: "table", label: "T3", seats: 6, mode: "seat", price: 349, category: "VIP Seating", seatCategories:["Golden Ring","Golden Ring","VIP Seating","VIP Seating","Golden Ring","Golden Ring"], x: 18, y: 67, width: 128, height: 76, rotation: 15 },
    { id: "S1", type: "sofa", label: "S1", seats: 4, mode: "whole", price: 1200, category: "VIP Seating", x: 36, y: 83, width: 172, height: 70 },
    { id: "S2", type: "sofa", label: "S2", seats: 4, mode: "seat", price: 299, category: "VIP Seating", x: 64, y: 83, width: 172, height: 70 },
    { id: "R1", type: "row", label: "Ряд A", seats: 8, mode: "seat", price: 239, category: "Golden Ring", seatCategories:["Standard","Standard","Golden Ring","VIP Seating","VIP Seating","Golden Ring","Standard","Standard"], x: 82, y: 67, width: 250, height: 54, rotation: -12 },
    { id: "BAR", type: "bar", label: "ЦЕНТРАЛЬНЫЙ БАР", seats: 0, x: 50, y: 95, width: 250, height: 46 },
  ],
};

const hebrew = new Map(Object.entries({
  "События":"אירועים","Организаторам":"למפיקים","Сканер":"סורק","Demo back-office":"ממשק מפיק","Статическая демонстрация":"הדגמה סטטית","Оплата, база данных и сканирование отключены":"תשלום, מסד נתונים וסריקה אינם פעילים","Билеты, ради которых хочется выйти из дома.":"כרטיסים שבשבילם שווה לצאת מהבית.","Ближайшие события":"אירועים קרובים","Все события":"כל האירועים","Выберите билет":"בחירת כרטיס","Выберите место на карте":"בחירת מקום במפה","СЦЕНА":"במה","Итого":"סה״כ","Продолжить":"המשך","Подать заявку":"שליחת בקשה","Количество":"כמות","Заявка на билет":"בקשה לכרטיס","Данные для проверки":"פרטים לבדיקה","Имя и фамилия":"שם מלא","Телефон":"טלפון","Промокод":"קוד הטבה","Оплаты сейчас нет":"אין תשלום כעת","Отправить заявку организатору":"שליחת בקשה למפיק","Ваш заказ":"ההזמנה שלך","Заявка отправлена":"הבקשה נשלחה","Заявка одобрена":"הבקשה אושרה","Заявка отклонена":"הבקשה נדחתה","Открыть приложение организатора":"פתיחת ממשק המפיק","Редактор карты мероприятия":"עורך מפת האירוע","Добавить стол":"הוספת שולחן","Добавить диван":"הוספת ספה","Продажа целиком":"מכירה שלמה","Продажа по местам":"מכירה לפי מקומות","Цена":"מחיר","Категория билета":"קטגוריית כרטיס","Сохранить карту":"שמירת מפה","Как продавать билеты":"איך למכור כרטיסים","Автоматическая продажа":"מכירה אוטומטית","Только после моего одобрения":"רק לאחר האישור שלי","Заявки на вход":"בקשות כניסה","Одобрить":"אישור","Отклонить":"דחייה","Посмотреть событие":"צפייה באירוע","мест":"מקומות","целиком":"שלם","за место":"למקום","Дизайн схемы":"עיצוב המפה","Назначить билеты":"שיוך כרטיסים","Добавить места":"הוספת מקומות","Добавить объекты":"הוספת אובייקטים","Ряды":"שורות","Прямоугольный стол":"שולחן מלבני","Круглый стол":"שולחן עגול","Диван":"ספה","Зона":"אזור","Сцена":"במה","Бар":"בר","Текст":"טקסט","Превью":"תצוגה מקדימה","Сохранить":"שמירה","Вместимость площадки":"קיבולת המקום","посадочных мест":"מקומות ישיבה","Выбран объект":"האובייקט שנבחר","Название":"שם","Количество мест":"מספר מקומות","Ширина":"רוחב","Высота":"גובה","Как продавать этот объект":"איך למכור את האובייקט","Целиком":"הכול יחד","По местам":"לפי מקומות","Одна цена за весь объект":"מחיר אחד לכל האובייקט","Каждый стул отдельно":"כל כיסא בנפרד","Удалить объект":"מחיקת אובייקט","Ключевая настройка":"הגדרה מרכזית","Клиент сразу оплачивает и получает билет.":"הלקוח משלם ומקבל את הכרטיס מיד.","Заявка → проверка → оплата → билет.":"בקשה ← בדיקה ← תשלום ← כרטיס","Положение по горизонтали":"מיקום אופקי","Положение по вертикали":"מיקום אנכי","Этот объект оформляет площадку и не продаётся.":"האובייקט מיועד לעיצוב המקום ואינו למכירה.","Выберите объект на схеме, чтобы настроить его.":"בחרו אובייקט במפה כדי להגדיר אותו.","Событие":"אירוע","Заявки":"בקשות","Заказы":"הזמנות"
}));
const russian = new Map([...hebrew.entries()].map(([ru, he]) => [he, ru]));

function applyLanguage() {
  const isHebrew = state.locale === "he";
  document.documentElement.lang = state.locale;
  document.documentElement.dir = isHebrew ? "rtl" : "ltr";
  document.querySelector("#lang-ru")?.classList.toggle("active", !isHebrew);
  document.querySelector("#lang-he")?.classList.toggle("active", isHebrew);
  document.querySelector("#lang-ru")?.setAttribute("aria-pressed", String(!isHebrew));
  document.querySelector("#lang-he")?.setAttribute("aria-pressed", String(isHebrew));
  const dictionary = isHebrew ? hebrew : russian;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const raw = node.nodeValue;
    const value = raw.trim();
    if (dictionary.has(value)) node.nodeValue = raw.replace(value, dictionary.get(value));
  });
}

const sellableTypes = new Set(["table", "round-table", "sofa", "row"]);
const ticketTypes = {"Standard":{price:149,color:"#2563EB"},"Golden Ring":{price:239,color:"#9333EA"},"VIP Seating":{price:349,color:"#D97706"}};
let studioBackground="#081426";
let studioSelectedId="title";
let studioElements=[{id:"title",type:"text",text:"NOA ELECTRIC — LIVE",x:8,y:9,size:30,bold:true},{id:"type",type:"text",text:"VIP SEATING",x:8,y:23,size:14,bold:true},{id:"date",type:"text",text:"18 сентября 2026 · 21:30",x:8,y:33,size:16,bold:true},{id:"venue",type:"text",text:"Hangar 11, Tel Aviv",x:8,y:42,size:14},{id:"guest",type:"text",text:"Igor Levin",x:8,y:53,size:17,bold:true},{id:"qr",type:"qr",text:"▦",x:32,y:66,size:92,bold:true,required:true},{id:"code",type:"text",text:"ATL-TKT-8F2K-92MA",x:25,y:91,size:10}];
const escapeHtml=(value)=>String(value).replace(/[&<>"']/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[character]);
function nextStudioPosition(){const added=Math.max(0,studioElements.length-7);return{x:8+(added*13)%52,y:55+(added*11)%32}}

function seatsMarkup(item, editor = false) {
  return `<span class="furniture-seats">${Array.from({length:item.seats},(_,index)=>{const category=item.mode==="whole"?item.category:(item.seatCategories?.[index]||null);const color=ticketTypes[category]?.color||"#fff";const editorSelected=editor&&state.editorObject===item.id&&state.editorSeats.includes(index+1);return `<button class="demo-chair seat-${index + 1} ${!editor && state.selectedSeats.includes(`${item.id}-${index+1}`) ? "selected" : ""} ${editorSelected?"editor-selected":""}" style="--seat-color:${color}" ${item.mode === "whole" || (editor&&state.editorTab!=="tickets") ? "disabled" : ""} ${editor?`data-editor-seat="${index+1}"`: `data-map-seat="${item.id}-${index+1}"`} data-parent="${item.id}">${index+1}</button>`}).join("")}</span>`;
}

function furnitureMarkup(item, editor = false) {
  const selected = (editor ? state.editorObject : state.selectedMapObject) === item.id;
  const style = `left:${item.x}%;top:${item.y}%;width:${item.width || 130}px;height:${item.height || 70}px;transform:translate(-50%,-50%) rotate(${item.rotation||0}deg)`;
  if (!sellableTypes.has(item.type)) return `<div class="venue-object decoration ${item.type} ${selected ? "selected" : ""}" style="${style}" ${editor ? `data-edit-object="${item.id}"` : ""}><strong>${item.label}</strong></div>`;
  return `<div class="venue-object furniture ${item.type} ${selected ? "selected" : ""}" style="${style}" data-${editor ? "edit" : "map"}-object="${item.id}"><div class="furniture-body"><strong>${item.label}</strong>${item.type === "sofa" ? `<span class="sofa-cushions">${Array.from({length:item.seats},()=>"<i></i>").join("")}</span>` : ""}</div>${seatsMarkup(item, editor)}${editor&&selected&&state.editorTab==="design"?`<button class="demo-rotate-handle" data-rotate-object="${item.id}">↻</button>`:""}${editor ? "" : `<small class="object-price">${item.mode==="whole"?`${money(ticketTypes[item.category]?.price||item.price)} целиком`:"цена по цвету места"}</small>`}</div>`;
}

function mapMarkup(editor = false) {
  return `<div class="demo-map ${editor ? "editor-map" : ""}">${state.mapObjects.map((item) => furnitureMarkup(item, editor)).join("")}</div>`;
}

function selectedMapItem() { return state.mapObjects.find((item) => item.id === state.selectedMapObject); }
function selectionTotal() { const item=selectedMapItem(); return item ? item.mode === "whole" ? (ticketTypes[item.category]?.price||item.price) : state.selectedSeats.reduce((sum,id)=>{const index=Number(id.split("-").pop())-1;return sum+(ticketTypes[item.seatCategories?.[index]]?.price||0)},0) : state.table ? 1890 : state.price * state.quantity; }
function selectionQuantity() { const item=selectedMapItem(); return item ? item.mode === "whole" ? item.seats : state.selectedSeats.length : state.table ? 6 : state.quantity; }
function selectionLabel() { const item=selectedMapItem(); return item ? `${item.type === "sofa" ? "Диван" : "Стол"} ${item.label} · ${item.mode === "whole" ? "целиком" : `места ${state.selectedSeats.map((id)=>id.split("-").pop()).join(", ")}`}` : state.table ? `VIP-стол ${state.table}` : state.category; }

const money = (value) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value);

const approvalRequired = () => state.salesMode === "APPROVAL_REQUIRED";
const icon = (value) => `<span class="meta-icon">${value}</span>`;

function home() {
  app.innerHTML = `<div class="fade">
    <section class="hero shell">
      <span class="eyebrow">Live experiences in Israel</span>
      <h1>Билеты, ради которых хочется выйти из дома.</h1>
      <p class="lead">Концерты, вечеринки и специальные события. Простой выбор, прозрачная цена и билет сразу после оформления.</p>
    </section>
    <section class="shell">
      <div class="section-head row"><h2>Ближайшие события</h2><span class="muted">3 события</span></div>
      <div class="event-grid">
        <article class="event-card" data-route="event">
          <div class="event-image"><img src="./assets/noa-live-tel-aviv.png" alt="NOA ELECTRIC концерт">
            <div class="event-overlay"><span class="pill">Tel Aviv</span><h2>NOA ELECTRIC - LIVE</h2><div>18 сентября 2026 · Hangar 11</div></div>
          </div>
        </article>
        <div class="side-list">
          <article class="mini-card"><div><span class="pill">Haifa</span><h3>Night Shift</h3><p class="muted">2 октября · Malina</p></div><strong>от ${money(99)}</strong></article>
          <article class="mini-card soon"><div><span class="eyebrow">Private event</span><h3>Вход после проверки организатором</h3></div><span>Новый сценарий Atlas</span></article>
        </div>
      </div>
    </section>
  </div>`;
  document.querySelector('[data-route="event"]').onclick = () => (location.hash = "event");
}

function eventPage() {
  app.innerHTML = `<div class="page fade"><div class="shell">
    <a class="back" href="#home">← Все события</a>
    <div class="event-layout">
      <img class="poster" src="./assets/noa-live-tel-aviv.png" alt="NOA ELECTRIC">
      <section class="event-copy">
        <span class="pill">${approvalRequired() ? "Вход после одобрения" : "Свободная продажа"}</span>
        <h1>NOA ELECTRIC - LIVE</h1>
        <div class="meta">
          <div class="meta-row">${icon("◷")}<div><strong>18 сентября 2026, 21:30</strong><br><span class="muted">Двери откроются в 20:30</span></div></div>
          <div class="meta-row">${icon("⌖")}<div><strong>Hangar 11</strong><br><span class="muted">Yordei HaSira 1, Tel Aviv-Yafo</span></div></div>
          <div class="meta-row">${icon("✓")}<div><strong>${approvalRequired() ? "Организатор проверяет заявки" : "Билет выдаётся автоматически"}</strong><br><span class="muted">${approvalRequired() ? "Сначала заявка, затем оплата и билет" : "Сразу после тестовой оплаты"}</span></div></div>
        </div>
        <p class="lead">Большое ночное шоу на берегу Средиземного моря: живой вокал, электронный звук и сценическая постановка.</p>
        <div class="panel selector">
          <h2>Выберите билет</h2>
          ${[
            ["General Admission", "Танцевальная зона", 149],
            ["Golden Ring", "Зона у сцены", 239],
            ["VIP Table", "VIP-зона со столами", 349],
          ].map((item) => `<button class="option ${state.category === item[0] && !state.table ? "selected" : ""}" data-cat="${item[0]}" data-price="${item[2]}"><span><strong>${item[0]}</strong><small>${item[1]}</small></span><strong>${money(item[2])}</strong></button>`).join("")}
          <h3>Выберите место на карте</h3>
          ${mapMarkup(false)}
          ${state.selectedSeats.length ? `<div class="map-status"><span>Выбрано мест</span><strong>${state.selectedSeats.length}</strong></div>` : ""}
          ${selectedMapItem() || state.table ? "" : `<label class="field"><span>Количество</span><select id="quantity" class="input">${[1, 2, 3, 4, 5, 6].map((number) => `<option ${state.quantity === number ? "selected" : ""}>${number}</option>`).join("")}</select></label>`}
          <div class="total row"><div><small class="muted">${approvalRequired() ? "К оплате после одобрения" : "Итого"}</small><div class="price">${money(selectionTotal())}</div></div><button id="continue" class="button" ${selectedMapItem()?.mode === "seat" && !state.selectedSeats.length ? "disabled" : ""}>${approvalRequired() ? "Подать заявку" : "Продолжить"}</button></div>
        </div>
      </section>
    </div>
  </div></div>`;

  document.querySelectorAll("[data-cat]").forEach((button) => {
    button.onclick = () => {
      state.category = button.dataset.cat;
      state.price = Number(button.dataset.price);
      state.table = null;
      state.selectedMapObject = null;
      state.selectedSeats = [];
      eventPage();
    };
  });
  document.querySelectorAll("[data-table]").forEach((button) => {
    button.onclick = () => {
      state.table = button.dataset.table;
      state.category = "VIP Table";
      state.price = 349;
      eventPage();
    };
  });
  document.querySelectorAll("[data-map-object]").forEach((object) => {
    object.onclick = (event) => {
      if (event.target.closest("[data-map-seat]")) return;
      const item = state.mapObjects.find((entry) => entry.id === object.dataset.mapObject);
      if (!item || item.mode !== "whole") return;
      state.selectedMapObject = state.selectedMapObject === item.id ? null : item.id;
      state.selectedSeats = [];
      state.table = item.label;
      state.category = item.category;
      eventPage();
    };
  });
  document.querySelectorAll("[data-map-seat]").forEach((seat) => {
    seat.onclick = (event) => {
      event.stopPropagation();
      const parent = seat.dataset.parent;
      if (state.selectedMapObject !== parent) state.selectedSeats = [];
      state.selectedMapObject = parent;
      state.table = null;
      const item = state.mapObjects.find((entry) => entry.id === parent);
      if (item) state.category = item.category;
      state.selectedSeats = state.selectedSeats.includes(seat.dataset.mapSeat) ? state.selectedSeats.filter((id) => id !== seat.dataset.mapSeat) : [...state.selectedSeats, seat.dataset.mapSeat];
      eventPage();
    };
  });
  const quantity = document.querySelector("#quantity");
  if (quantity) quantity.onchange = (event) => { state.quantity = Number(event.target.value); eventPage(); };
  document.querySelector("#continue").onclick = () => (location.hash = "checkout");
  applyLanguage();
}

function checkout() {
  const total = selectionTotal();
  app.innerHTML = `<div class="page fade"><div class="shell">
    <a class="back" href="#event">← Вернуться к выбору</a>
    <div class="checkout-layout">
      <section><span class="eyebrow">${approvalRequired() ? "Заявка на билет" : "Checkout"}</span><h1>${approvalRequired() ? "Данные для проверки" : "Контактные данные"}</h1>
        <form id="checkout-form" class="panel form">
          <label class="field"><span>Имя и фамилия</span><input id="name" class="input" required value="${state.applicant}"></label>
          <label class="field"><span>Телефон</span><input class="input" required value="+972 52 513 8899"></label>
          <label class="field"><span>Email</span><input class="input" type="email" required value="igor@example.com"></label>
          ${approvalRequired() ? `<label class="field"><span>Укажите номер клубной карты или кто вас пригласил</span><textarea id="eligibility" class="input" rows="4" required>${state.eligibilityAnswer}</textarea></label>` : `<label class="field"><span>Промокод</span><input class="input" placeholder="Например, ATLAS10"></label>`}
          <div class="notice"><strong>${approvalRequired() ? "Оплаты сейчас нет" : "Тестовая оплата"}</strong><br>${approvalRequired() ? "Сначала организатор должен одобрить участие. После этого откроется оплата и выпуск билета." : "Банковская карта не требуется."}</div>
          <button class="button full">${approvalRequired() ? "Отправить заявку организатору" : "Подтвердить тестовый заказ"}</button>
        </form>
      </section>
      <aside class="panel summary"><span class="pill">${approvalRequired() ? "Запрашиваемый билет" : "Ваш заказ"}</span><h2>NOA ELECTRIC - LIVE</h2><p>${selectionLabel()}</p><div class="summary-line row"><span class="muted">Количество</span><strong>${selectionQuantity()}</strong></div><div class="summary-line row"><span>${approvalRequired() ? "После одобрения" : "Итого"}</span><strong class="price">${money(total)}</strong></div></aside>
    </div>
  </div></div>`;
  document.querySelector("#checkout-form").onsubmit = (event) => {
    event.preventDefault();
    state.applicant = document.querySelector("#name").value;
    if (approvalRequired()) {
      state.eligibilityAnswer = document.querySelector("#eligibility").value;
      state.requestStatus = "PENDING";
      location.hash = "request";
    } else {
      location.hash = "ticket";
    }
  };
}

function requestPage() {
  const status = state.requestStatus;
  app.innerHTML = `<div class="page fade"><section class="shell ticket-wrap">
    <div class="success-icon">${status === "REJECTED" ? "×" : status === "APPROVED" ? "✓" : "◷"}</div>
    <h1>${status === "REJECTED" ? "Заявка отклонена" : status === "APPROVED" ? "Заявка одобрена" : "Заявка отправлена"}</h1>
    <p class="lead" style="margin-inline:auto">${status === "REJECTED" ? "Организатор не подтвердил участие. Оплата не проводилась." : status === "APPROVED" ? "Организатор подтвердил участие. Теперь можно оплатить и получить билет." : "Организатор получил данные и должен принять решение. До этого оплата и билет недоступны."}</p>
    <article class="panel" style="text-align:left;max-width:500px;margin:24px auto">
      <div class="summary-line row"><span>Заявитель</span><strong>${state.applicant}</strong></div>
      <div class="summary-line row"><span>Проверка</span><strong>${state.eligibilityAnswer}</strong></div>
      <div class="summary-line row"><span>Статус</span><span class="pill">${status}</span></div>
    </article>
    ${status === "APPROVED" ? `<button id="pay" class="button">Оплатить тестово и получить билет</button>` : `<a class="button ghost" href="#admin">Открыть приложение организатора</a>`}
  </section></div>`;
  const pay = document.querySelector("#pay");
  if (pay) pay.onclick = () => (location.hash = "ticket");
}

function ticket() {
  app.innerHTML = `<div class="page fade"><section class="shell ticket-wrap">
    <div class="success-icon">✓</div><h1>Билет выпущен</h1><p class="lead" style="margin-inline:auto">Участие одобрено, тестовая оплата завершена.</p>
    <article class="panel ticket"><div class="ticket-head"><div class="brand" style="color:white">ATL<span>AS</span></div><small>DIGITAL TICKET</small></div><div class="ticket-body"><span class="pill">VALID · DEMO</span><h2>NOA ELECTRIC - LIVE</h2><p>${selectionLabel()}<br><span class="muted">18 сентября 2026 · Hangar 11</span></p><img class="ticket-qr" src="./assets/demo-qr.png" alt="Демонстрационный QR-код"><div class="ticket-code">ATLAS_DEMO_NOT_VALID_FOR_ENTRY</div></div></article>
    <div class="row" style="justify-content:center;margin-top:22px"><button class="wallet-demo-badge"> Add to Apple Wallet</button><a class="button dark" href="#home">Вернуться к событиям</a></div>
  </section></div>`;
}

function adminMapEditorMarkup() {
  const selected = state.mapObjects.find((item) => item.id === state.editorObject) || state.mapObjects[0];
  if (selected) state.editorObject = selected.id;
  const capacity = state.mapObjects.filter((item) => sellableTypes.has(item.type)).reduce((sum, item) => sum + item.seats, 0);
  const palette = [
    ["row", "Ряды"], ["table", "Прямоугольный стол"], ["round-table", "Круглый стол"], ["sofa", "Диван"], ["zone", "Зона"],
    ["stage", "Сцена"], ["bar", "Бар"], ["text", "Текст"],
  ];
  const isSellable = selected && sellableTypes.has(selected.type);
  return `<section class="venue-builder-demo" style="margin-top:22px">
    <div class="builder-demo-head">
      <div><span class="eyebrow">Venue map builder</span><h2>Редактор карты мероприятия</h2></div>
      <div class="builder-tabs"><button class="${state.editorTab === "design" ? "active" : ""}" data-editor-tab="design">Дизайн схемы</button><button class="${state.editorTab === "tickets" ? "active" : ""}" data-editor-tab="tickets">Назначить билеты</button></div>
      <div class="builder-actions"><button class="icon-action" title="Отменить">↶</button><button class="icon-action" title="Повторить">↷</button><button data-toggle-inspector class="button ghost">${state.editorInspectorOpen ? "Скрыть настройки" : "Настройки объекта"}</button><button id="preview-map" class="button ghost">Превью</button><button id="save-map" class="button">Сохранить</button></div>
    </div>
    <div class="builder-demo-layout ${state.editorInspectorOpen ? "inspector-open" : ""}">
      <aside class="object-library"><strong>Добавить места</strong>${palette.slice(0,5).map(([type,label])=>`<button data-add-object="${type}"><span class="palette-visual ${type}"><i></i><i></i><i></i></span><span>${label}</span></button>`).join("")}<strong>Добавить объекты</strong>${palette.slice(5).map(([type,label])=>`<button data-add-object="${type}"><span class="palette-visual ${type}"><i></i></span><span>${label}</span></button>`).join("")}</aside>
      <div class="builder-workspace"><div class="floating-tools"><button>↖</button><button>☝</button><span></span><button data-zoom="out">−</button><strong>${Math.round(state.editorZoom * 100)}%</strong><button data-zoom="in">+</button></div>${state.editorTab==="tickets"?`<div class="demo-ticket-assign"><strong>Назначить тип билета</strong><select id="editor-ticket"><option>Standard</option><option>Golden Ring</option><option>VIP Seating</option></select><button id="assign-editor-ticket">Назначить выбранным местам</button><small>Выбрано: ${state.editorSeats.length||"весь объект"}</small></div><div class="demo-map-legend">${Object.entries(ticketTypes).map(([name,ticket])=>`<span><i style="background:${ticket.color}"></i>${name} · ${money(ticket.price)}</span>`).join("")}</div>`:`<div class="demo-angle-toolbar"><span>Поворот ${selected?.rotation||0}°</span><button data-angle="${(selected?.rotation||0)-15}">↶ 15°</button><button data-angle="${(selected?.rotation||0)+15}">↷ 15°</button><button data-angle="0">0°</button><button data-angle="90">90°</button></div>`}<div class="builder-viewport"><div class="builder-world" style="transform:scale(${state.editorZoom})">${mapMarkup(true)}</div></div></div>
      ${state.editorInspectorOpen ? `<aside class="property-panel"><button data-toggle-inspector class="close-property">×</button><div class="capacity"><span>Вместимость площадки</span><strong>${capacity}</strong><small>посадочных мест</small></div>${selected ? `<div class="selected-kind"><span class="palette-visual ${selected.type}"><i></i><i></i><i></i></span><div><small>Выбран объект</small><strong>${selected.label}</strong></div></div><label class="field"><span>Название</span><input id="map-label" class="input" value="${selected.label}"></label>${state.editorTab === "design" ? `<label class="field"><span>Количество мест</span><input id="map-seats" class="input" type="number" min="${isSellable ? 1 : 0}" max="30" value="${selected.seats}"></label><div class="dimensions"><label class="field"><span>Ширина</span><input id="map-width" class="input" type="number" value="${selected.width || 130}"></label><label class="field"><span>Высота</span><input id="map-height" class="input" type="number" value="${selected.height || 70}"></label></div><label class="field"><span>Положение по горизонтали</span><input id="map-x" type="range" min="6" max="94" value="${selected.x}"></label><label class="field"><span>Положение по вертикали</span><input id="map-y" type="range" min="6" max="96" value="${selected.y}"></label>` : isSellable ? `<label class="field"><span>Категория билета</span><select id="map-category" class="input"><option ${selected.category === "VIP Seating" ? "selected" : ""}>VIP Seating</option><option ${selected.category === "Golden Ring" ? "selected" : ""}>Golden Ring</option></select></label><div><strong>Как продавать этот объект</strong><div class="map-mode"><button class="${selected.mode === "whole" ? "active" : ""}" data-map-mode="whole"><strong>Целиком</strong><small>Одна цена за весь объект</small></button><button class="${selected.mode === "seat" ? "active" : ""}" data-map-mode="seat"><strong>По местам</strong><small>Каждый стул отдельно</small></button></div></div><label class="field"><span>Цена, ₪ ${selected.mode === "whole" ? "за весь объект" : "за одно место"}</span><input id="map-price" class="input" type="number" min="1" value="${selected.price}"></label><div class="ticket-summary"><span>${selected.seats} мест</span><strong>${selected.mode === "whole" ? money(selected.price) : `${money(selected.price)} × ${selected.seats}`}</strong></div>` : `<div class="empty-inspector">Этот объект оформляет площадку и не продаётся.</div>`}<button id="remove-map-object" class="danger-link">Удалить объект</button>` : `<div class="empty-inspector">Выберите объект на схеме, чтобы настроить его.</div>`}</aside>` : ""}
    </div>
  </section>`;
}

function adminTicketsMarkup() {
  return `<section class="panel ticket-settings-demo" style="margin-top:22px"><div class="section-head row"><div><span class="eyebrow">Ticket types</span><h2>Билеты без схемы зала</h2></div><button class="button">+ Добавить билет</button></div><div class="demo-ticket-list"><article><div><strong>General Admission</strong><small>Вход в танцевальную зону · 450 билетов</small></div><div><span class="price">₪149</span><small>Основной тариф</small></div></article><article><div><strong>Early Bird</strong><small>Продажа до 1 августа · 100 билетов</small></div><div><span class="price">₪119</span><small>Затем автоматически ₪149</small></div></article></div><div class="ticket-editor-demo"><h3>Настройка тарифа</h3><div class="pricing-switch"><button class="${state.demoPricingMode === "FIXED" ? "active" : ""}" data-demo-pricing="FIXED">Фиксированная цена</button><button class="${state.demoPricingMode === "SCHEDULED" ? "active" : ""}" data-demo-pricing="SCHEDULED">Цена по расписанию</button></div><div class="ticket-field-grid"><label class="field"><span>Название</span><input class="input" value="General Admission"></label><label class="field"><span>Количество</span><input class="input" type="number" value="450"></label><label class="field"><span>Начало продаж</span><input class="input" type="datetime-local" value="2026-07-22T12:00"></label><label class="field"><span>Окончание продаж</span><input class="input" type="datetime-local" value="2026-09-18T18:00"></label>${state.demoPricingMode === "SCHEDULED" ? `<label class="field"><span>Ранняя цена, ₪</span><input class="input" type="number" value="119"></label><label class="field"><span>Сменить цену</span><input class="input" type="datetime-local" value="2026-08-01T23:59"></label>` : ""}<label class="field"><span>Основная цена, ₪</span><input class="input" type="number" value="149"></label><label class="field"><span>Максимум в заказе</span><input class="input" type="number" value="10"></label></div><button class="button">Сохранить тариф</button></div></section>`;
}

function admin() {
  const pendingRow = state.requestStatus === "PENDING" ? `<tr><td><strong>${state.applicant}</strong><br><small>+972 52 513 8899</small></td><td>NOA ELECTRIC</td><td>${state.eligibilityAnswer}</td><td><button class="button" id="approve">Одобрить</button> <button class="button ghost" id="reject">Отклонить</button></td></tr>` : `<tr><td colspan="4" class="muted">Новых заявок нет</td></tr>`;
  app.innerHTML = `<div class="page fade"><div class="shell"><div class="admin-layout">
    <aside class="sidebar"><strong>Atlas Office</strong><span class="active">Событие</span><span>Заявки ${state.requestStatus === "PENDING" ? "· 1" : ""}</span><span>Заказы</span><span>Сканер</span></aside>
    <section class="admin-main">
      <div class="admin-head row"><div><span class="eyebrow">Event manager</span><h1>NOA ELECTRIC</h1></div><div class="row"><a class="button dark" href="#ticket-studio">Редактор билета</a><a class="button ghost" href="#event">Посмотреть событие</a></div></div>
      <div class="panel form admission-choice"><span class="eyebrow">Формат продажи</span><h2>Как покупатель выбирает билет?</h2><div class="admission-grid"><button class="${state.admissionMode === "GENERAL_ADMISSION" ? "selected" : ""}" data-admission="GENERAL_ADMISSION"><i>🎟</i><strong>Без схемы зала</strong><small>Тип билета и количество</small></button><button class="${state.admissionMode === "RESERVED_SEATING" ? "selected" : ""}" data-admission="RESERVED_SEATING"><i>▦</i><strong>С выбором мест</strong><small>Карта, столы, диваны и стулья</small></button></div></div>
      <div class="panel form">
        <span class="eyebrow">Ключевая настройка</span><h2>Как продавать билеты</h2>
        <button class="option ${state.salesMode === "INSTANT" ? "selected" : ""}" data-mode="INSTANT"><span><strong>Автоматическая продажа</strong><small>Клиент сразу оплачивает и получает билет.</small></span><strong>○</strong></button>
        <button class="option ${state.salesMode === "APPROVAL_REQUIRED" ? "selected" : ""}" data-mode="APPROVAL_REQUIRED"><span><strong>Только после моего одобрения</strong><small>Заявка → проверка → оплата → билет.</small></span><strong>○</strong></button>
      </div>
      ${state.admissionMode === "RESERVED_SEATING" ? adminMapEditorMarkup() : adminTicketsMarkup()}
      <div class="section-head row"><h2>Заявки на вход</h2><span class="pill">${state.requestStatus === "PENDING" ? "1 ожидает" : "нет новых"}</span></div>
      <div class="table-wrap"><table><thead><tr><th>Клиент</th><th>Событие</th><th>Ответ</th><th>Решение</th></tr></thead><tbody>${pendingRow}</tbody></table></div>
    </section>
  </div></div></div>`;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.onclick = () => { state.salesMode = button.dataset.mode; admin(); };
  });
  document.querySelectorAll("[data-admission]").forEach((button) => { button.onclick = () => { state.admissionMode = button.dataset.admission; admin(); }; });
  document.querySelectorAll("[data-demo-pricing]").forEach((button) => { button.onclick = () => { state.demoPricingMode = button.dataset.demoPricing; admin(); }; });
  document.querySelectorAll("[data-edit-object]").forEach((object) => {
    object.onpointerdown = (event) => {
      if (state.editorTab !== "design" || event.target.closest("[data-editor-seat], [data-rotate-object]")) return;
      event.preventDefault();
      state.editorObject = object.dataset.editObject;
      const map = object.closest(".demo-map");
      if (!map) return;
      object.setPointerCapture(event.pointerId);
      const move = (pointerEvent) => {
        const bounds = map.getBoundingClientRect();
        const x = Math.max(4, Math.min(96, ((pointerEvent.clientX - bounds.left) / bounds.width) * 100));
        const y = Math.max(4, Math.min(96, ((pointerEvent.clientY - bounds.top) / bounds.height) * 100));
        updateEditorObject({ x: Math.round(x), y: Math.round(y) });
        object.style.left = `${x}%`; object.style.top = `${y}%`;
      };
      const up = () => { object.removeEventListener("pointermove", move); object.removeEventListener("pointerup", up); admin(); };
      object.addEventListener("pointermove", move); object.addEventListener("pointerup", up);
    };
  });
  document.querySelectorAll("[data-editor-seat]").forEach((seat) => { seat.onclick = (event) => { event.stopPropagation(); const position=Number(seat.dataset.editorSeat); state.editorObject=seat.dataset.parent; state.editorSeats=event.shiftKey&&state.editorSeats.length?Array.from({length:Math.abs(position-state.editorSeats.at(-1))+1},(_,i)=>Math.min(position,state.editorSeats.at(-1))+i):(state.editorSeats.includes(position)?state.editorSeats.filter((value)=>value!==position):[...state.editorSeats,position]); admin(); }; });
  document.querySelectorAll("[data-rotate-object]").forEach((handle)=>{handle.onpointerdown=(event)=>{event.preventDefault();event.stopPropagation();const object=handle.closest("[data-edit-object]"),map=handle.closest(".demo-map"),item=state.mapObjects.find(value=>value.id===handle.dataset.rotateObject);if(!object||!map||!item)return;handle.setPointerCapture(event.pointerId);const move=(pointer)=>{const bounds=map.getBoundingClientRect(),cx=bounds.left+bounds.width*item.x/100,cy=bounds.top+bounds.height*item.y/100,angle=Math.round((Math.atan2(pointer.clientY-cy,pointer.clientX-cx)*180/Math.PI+90)/5)*5;item.rotation=((angle%360)+360)%360;object.style.transform=`translate(-50%,-50%) rotate(${item.rotation}deg)`;};const up=()=>{handle.removeEventListener("pointermove",move);handle.removeEventListener("pointerup",up);admin();};handle.addEventListener("pointermove",move);handle.addEventListener("pointerup",up);};});
  document.querySelectorAll("[data-angle]").forEach((button) => { button.onclick = (event) => { event.stopPropagation(); updateEditorObject({rotation:((Number(button.dataset.angle)%360)+360)%360}); admin(); }; });
  const ticketSelect=document.querySelector("#editor-ticket"); if(ticketSelect){ticketSelect.value=state.editorTicket;ticketSelect.onchange=()=>{state.editorTicket=ticketSelect.value;};}
  const assignTicket=document.querySelector("#assign-editor-ticket"); if(assignTicket)assignTicket.onclick=()=>{const item=state.mapObjects.find((value)=>value.id===state.editorObject);if(!item||!sellableTypes.has(item.type))return;if(item.mode==="whole")updateEditorObject({category:state.editorTicket,price:ticketTypes[state.editorTicket].price});else{const selected=state.editorSeats.length?state.editorSeats:Array.from({length:item.seats},(_,i)=>i+1);const seatCategories=Array.from({length:item.seats},(_,i)=>selected.includes(i+1)?state.editorTicket:(item.seatCategories?.[i]||null));updateEditorObject({seatCategories});}admin();};
  document.querySelectorAll("[data-toggle-inspector]").forEach((button) => { button.onclick = () => { state.editorInspectorOpen = !state.editorInspectorOpen; admin(); }; });
  document.querySelectorAll("[data-add-object]").forEach((button) => { button.onclick = () => addMapObject(button.dataset.addObject); });
  document.querySelectorAll("[data-editor-tab]").forEach((button) => { button.onclick = () => { state.editorTab = button.dataset.editorTab; admin(); }; });
  document.querySelectorAll("[data-zoom]").forEach((button) => { button.onclick = () => { state.editorZoom = Math.max(.45, Math.min(1.05, state.editorZoom + (button.dataset.zoom === "in" ? .1 : -.1))); admin(); }; });
  document.querySelectorAll("[data-map-mode]").forEach((button) => { button.onclick = () => { updateEditorObject({ mode: button.dataset.mapMode }); admin(); }; });
  const bindEditor = (selector, key, numeric = false) => { const input = document.querySelector(selector); if (input) input.onchange = () => { updateEditorObject({ [key]: numeric ? Number(input.value) : input.value }); admin(); }; };
  bindEditor("#map-label", "label"); bindEditor("#map-seats", "seats", true); bindEditor("#map-category", "category"); bindEditor("#map-width", "width", true); bindEditor("#map-height", "height", true); bindEditor("#map-x", "x", true); bindEditor("#map-y", "y", true);
  const remove = document.querySelector("#remove-map-object"); if (remove) remove.onclick = () => { state.mapObjects = state.mapObjects.filter((item) => item.id !== state.editorObject); state.editorObject = state.mapObjects[0]?.id || null; admin(); };
  const saveMap = document.querySelector("#save-map"); if (saveMap) saveMap.onclick = () => { saveMap.textContent = "Карта сохранена ✓"; };
  const approve = document.querySelector("#approve");
  if (approve) approve.onclick = () => { state.requestStatus = "APPROVED"; location.hash = "request"; };
  const reject = document.querySelector("#reject");
  if (reject) reject.onclick = () => { state.requestStatus = "REJECTED"; location.hash = "request"; };
  applyLanguage();
}

function updateEditorObject(patch) { state.mapObjects = state.mapObjects.map((item) => item.id === state.editorObject ? { ...item, ...patch } : item); }
function addMapObject(type) {
  const number = state.mapObjects.filter((item) => item.type === type).length + 1;
  const presets = {
    table: ["Стол", 6, 1890, 128, 76], "round-table": ["Круглый стол", 6, 1890, 104, 104], sofa: ["Диван", 4, 1200, 172, 70], row: ["Ряд", 8, 239, 210, 54],
    zone: ["Зона", 0, 0, 280, 180], stage: ["СЦЕНА", 0, 0, 360, 70], bar: ["БАР", 0, 0, 230, 46], text: ["Надпись", 0, 0, 180, 44],
  };
  const [label, seats, price, width, height] = presets[type] || presets.table;
  const item = { id: `${type[0].toUpperCase()}${Date.now()}`, type, label: `${label} ${number}`, seats, mode: type === "row" ? "seat" : "whole", price, category: sellableTypes.has(type) ? "VIP Seating" : null, seatCategories:Array.from({length:seats},()=>null), rotation:0, width, height, x: 20 + (state.mapObjects.length * 11) % 60, y: 24 + (state.mapObjects.length * 9) % 62 };
  state.mapObjects.push(item); state.editorObject = item.id; admin();
}

function office() {
  app.innerHTML=`<div class="office-demo"><aside class="office-demo-nav"><a class="office-logo" href="#office">ATL<span>AS</span><small>OFFICE</small></a><div class="office-org"><i>AL</i><div><strong>Atlas Live Israel</strong><small>Владелец</small></div></div><nav><a class="active" href="#office">⌂ <span>Обзор</span></a><a href="#requests">✓ <span>Заявки</span><b>2</b></a><a href="#admin">▦ <span>Мероприятия</span></a><a href="#office">▤ <span>Заказы</span></a><a href="#scanner">⌗ <span>Сканер</span></a><a href="#team">♙ <span>Команда</span></a></nav><div class="office-user"><i>MO</i><div><strong>Maya Organizer</strong><small>organizer@atlas.test</small></div></div></aside><section class="office-content"><header><div><span class="eyebrow">Organizer workspace</span><h1>Добрый день, Maya</h1><p>Всё важное по мероприятиям и гостям — в одном месте.</p></div><a class="button" href="#admin">Открыть мероприятие</a></header><div class="office-metrics"><article><span>Продажи</span><strong>₪ 47,800</strong><small>↗ 18% за неделю</small></article><article><span>Ожидают решения</span><strong>2</strong><a href="#requests">Проверить заявки →</a></article><article><span>Гостей вошло</span><strong>126</strong><a href="#scanner">Открыть сканер →</a></article></div><div class="office-section-title"><h2>Ближайшее мероприятие</h2><a href="#admin">Настройки →</a></div><article class="office-event"><img src="./assets/noa-live-tel-aviv.png" alt="NOA"><div><span class="status">ОПУБЛИКОВАНО</span><h2>NOA ELECTRIC — LIVE</h2><p>18 сентября · Hangar 11, Tel Aviv</p><div class="office-progress"><i style="width:38%"></i></div><small>172 из 450 билетов продано</small></div></article><div class="office-quick"><a href="#requests"><b>✓</b><span><strong>Проверить гостей</strong><small>2 новые заявки</small></span></a><a href="#scanner"><b>⌗</b><span><strong>Контроль входа</strong><small>Камера и ручной ввод</small></span></a><a href="#team"><b>♙</b><span><strong>Команда</strong><small>Роли и разрешения</small></span></a></div></section><nav class="office-mobile-nav"><a href="#office">⌂<small>Обзор</small></a><a href="#requests">✓<small>Заявки</small></a><a href="#admin">▦<small>События</small></a><a href="#scanner">⌗<small>Сканер</small></a></nav></div>`;
}

function requests(){const cards=[{name:"Игорь Левин",phone:"+972 50 111 2233",answer:"Клубная карта MLN-2841",tickets:"VIP Seating × 1",price:"₪349"},{name:"Анна Коэн",phone:"+972 52 222 3344",answer:"Приглашение от Maya",tickets:"Golden Ring × 2",price:"₪478"}];app.innerHTML=`<div class="office-subpage"><a class="back" href="#office">← Atlas Office</a><span class="eyebrow">Guest approval</span><h1>Заявки на билеты</h1><p class="lead">Проверьте гостя до того, как он получит ссылку на оплату и билет.</p><div class="request-demo-grid">${cards.map((item,index)=>`<article><header><i>${item.name.split(" ").map(x=>x[0]).join("")}</i><div><strong>${item.name}</strong><small>${item.phone}</small></div><span>ОЖИДАЕТ</span></header><div class="request-event-demo"><small>NOA ELECTRIC — LIVE</small><strong>${item.tickets}</strong><b>${item.price}</b></div><blockquote><small>Ответ клиента</small>${item.answer}</blockquote><footer><button class="approve-demo" data-request="${index}">✓ Одобрить</button><button class="reject-demo" data-request="${index}">Отклонить</button></footer></article>`).join("")}</div></div>`;document.querySelectorAll(".approve-demo,.reject-demo").forEach(button=>button.onclick=()=>{button.closest("article").classList.add("processed");button.closest("footer").innerHTML=`<strong>${button.classList.contains("approve-demo")?"Заявка одобрена · ссылка на оплату готова":"Заявка отклонена"}</strong>`})}

function team(){const members=["Maya Organizer · Владелец","Alex Event Manager · Менеджер","Dana Face Control · Проверка гостей","Door Team · Контроль входа"];app.innerHTML=`<div class="office-subpage"><a class="back" href="#office">← Atlas Office</a><span class="eyebrow">Access control</span><h1>Команда и права</h1><p class="lead">Назначайте сотрудникам только необходимые действия.</p><div class="team-demo"><aside>${members.map((name,index)=>`<button class="${index===2?"active":""}"><i>${name.split(" ").slice(0,2).map(x=>x[0]).join("")}</i><span>${name}</span></button>`).join("")}</aside><section><h2>Dana Face Control</h2><p>dana@atlas.test · Face control</p><h3>Разрешения</h3><div class="permission-demo">${["Просмотр мероприятий","Одобрение заявок","Просмотр заказов","Сканирование билетов","Изменение мероприятий","Управление командой"].map((name,index)=>`<label class="${index<3?"checked":""}"><input type="checkbox" ${index<3?"checked":""}>${name}</label>`).join("")}</div><h3>Доступ к мероприятиям</h3><label class="event-chip"><input type="checkbox" checked> NOA ELECTRIC — LIVE</label><button class="button">Сохранить права</button></section></div></div>`}

function scannerDemo(){app.innerHTML=`<div class="scanner-demo"><a href="#office">← Atlas Office</a><span class="eyebrow">Door control</span><h1>Сканер билетов</h1><div class="scanner-phone"><div class="scanner-camera"><span></span><b>Наведите камеру на QR-код</b></div><div class="scanner-count"><small>Вошли сегодня</small><strong>126</strong></div><label>Или введите код вручную<input class="input" value="ATL-QR-8F2K-92MA"></label><button id="scan-demo" class="button full">Проверить билет</button><div id="scan-result"></div></div></div>`;document.querySelector("#scan-demo").onclick=()=>{document.querySelector("#scan-result").innerHTML='<div class="scan-valid">✓<strong>Билет действителен</strong><small>NOA ELECTRIC · VIP Seating</small></div>'}}

function studioElementMarkup(item){
  const content=item.type==="image"?`<img src="${item.src}" alt="${escapeHtml(item.text||"Фотография")}">`:escapeHtml(item.text);
  return `<button class="${item.id===studioSelectedId?"selected":""} ${item.type==="image"?"studio-image-element":""}" data-studio-element="${item.id}" style="left:${item.x}%;top:${item.y}%;font-size:${item.size}px;font-weight:${item.bold?800:400}">${content}</button>`;
}

function ticketStudio(){
  const selected=studioElements.find(item=>item.id===studioSelectedId)||null;
  app.innerHTML=`<div class="studio-demo-page"><a class="back" href="#admin">← Настройки мероприятия</a><div class="studio-demo-head"><div><span class="eyebrow">Ticket studio</span><h1>Редактор билета</h1><p>Текст, фотографии, системные поля, QR, PDF и Apple Wallet.</p></div><button id="studio-save" class="button">Сохранить шаблон</button></div><div class="studio-demo"><aside class="studio-toolbox"><h3>Добавить</h3><button data-add-studio="text">T <span>Произвольный текст</span></button><label class="studio-upload-button">▧ <span>Фотография</span><input id="studio-photo" type="file" accept="image/png,image/jpeg,image/webp"></label><button data-add-studio="date">◷ <span>Дата и время</span></button><button data-add-studio="venue">⌖ <span>Площадка</span></button><button data-add-studio="guest">♙ <span>Имя гостя</span></button><button data-add-studio="qr">▦ <span>QR-код</span></button><h3>Цвет билета</h3><input id="studio-color" type="color" value="${studioBackground}"></aside><main><div class="studio-phone"><div id="studio-canvas" class="studio-ticket" style="background-color:${studioBackground}">${studioElements.map(studioElementMarkup).join("")}</div></div><small>Перетащите любой элемент в нужное место</small></main><aside class="studio-props"><h3>Свойства элемента</h3>${selected?`<p class="studio-selected-name">${selected.type==="image"?"Фотография":selected.type==="qr"?"QR-код":"Текст"}</p>${selected.type==="text"?`<label>Содержание<textarea id="studio-text" rows="3">${escapeHtml(selected.text)}</textarea></label>`:""}<label>Размер<input id="studio-size" type="range" min="9" max="92" value="${selected.size}"></label><div><button id="studio-bold" class="${selected.bold?"active":""}">Жирный</button><button id="studio-center">По центру</button></div>${selected.required?'<p class="studio-required-note">QR обязателен для проверки билета и не удаляется.</p>':'<button id="studio-delete" class="studio-delete">Удалить элемент</button>'}`:"<p>Выберите элемент на билете.</p>"}<hr><h3>Apple Wallet</h3><p>Дата и площадка связаны с мероприятием. После изменения Atlas отправит обновление в установленный билет.</p><span class="wallet-demo-badge"> Add to Apple Wallet</span></aside></div></div>`;

  document.querySelectorAll("[data-studio-element]").forEach(element=>{
    let dragging=null;
    element.onpointerdown=e=>{studioSelectedId=element.dataset.studioElement;dragging=studioElements.find(item=>item.id===studioSelectedId);document.querySelectorAll("[data-studio-element]").forEach(item=>item.classList.remove("selected"));element.classList.add("selected");element.setPointerCapture(e.pointerId)};
    element.onpointermove=e=>{if(!dragging||!element.hasPointerCapture(e.pointerId))return;const rect=document.querySelector("#studio-canvas").getBoundingClientRect();dragging.x=Math.max(2,Math.min(90,(e.clientX-rect.left)/rect.width*100));dragging.y=Math.max(2,Math.min(94,(e.clientY-rect.top)/rect.height*100));element.style.left=`${dragging.x}%`;element.style.top=`${dragging.y}%`};
    const stop=e=>{dragging=null;if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);ticketStudio()};
    element.onpointerup=stop;element.onpointercancel=stop;
    element.onclick=e=>{e.stopPropagation();studioSelectedId=element.dataset.studioElement;ticketStudio()};
  });
  document.querySelector("#studio-color").oninput=e=>{studioBackground=e.target.value;document.querySelector("#studio-canvas").style.backgroundColor=studioBackground};
  document.querySelector("#studio-size")?.addEventListener("input",e=>{const item=studioElements.find(element=>element.id===studioSelectedId);if(!item)return;item.size=Number(e.target.value);document.querySelector(`[data-studio-element="${item.id}"]`).style.fontSize=`${item.size}px`});
  document.querySelector("#studio-text")?.addEventListener("input",e=>{const item=studioElements.find(element=>element.id===studioSelectedId);if(!item)return;item.text=e.target.value;document.querySelector(`[data-studio-element="${item.id}"]`).textContent=item.text});
  document.querySelector("#studio-bold")?.addEventListener("click",()=>{const item=studioElements.find(element=>element.id===studioSelectedId);if(!item)return;item.bold=!item.bold;ticketStudio()});
  document.querySelector("#studio-center")?.addEventListener("click",()=>{const item=studioElements.find(element=>element.id===studioSelectedId);if(!item)return;item.x=Math.max(2,50-(item.type==="image"?12:18));ticketStudio()});
  document.querySelector("#studio-delete")?.addEventListener("click",()=>{studioElements=studioElements.filter(item=>item.id!==studioSelectedId);studioSelectedId=studioElements[0]?.id||"";ticketStudio()});
  document.querySelector("#studio-photo").onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(!["image/png","image/jpeg","image/webp"].includes(file.type)){alert("Выберите PNG, JPEG или WebP");return}if(file.size>8*1024*1024){alert("Файл должен быть меньше 8 МБ");return}const reader=new FileReader();reader.onload=()=>{const position=nextStudioPosition();const item={id:`photo-${Date.now()}`,type:"image",text:file.name,src:String(reader.result),...position,size:18,bold:false};studioElements.push(item);studioSelectedId=item.id;ticketStudio()};reader.readAsDataURL(file)};
  document.querySelector("#studio-save").onclick=e=>e.target.textContent="Шаблон сохранён ✓";
  document.querySelectorAll("[data-add-studio]").forEach(button=>button.onclick=()=>{const kind=button.dataset.addStudio;const position=nextStudioPosition();const values={text:"Новый текст",date:"18 сентября 2026 · 21:30",venue:"Hangar 11, Tel Aviv",guest:"Igor Levin",qr:"▦"};const item={id:`new-${Date.now()}`,type:kind==="qr"?"qr":"text",text:values[kind]||"Новый текст",...position,size:kind==="qr"?72:18,bold:false,required:kind==="qr"};studioElements.push(item);studioSelectedId=item.id;ticketStudio()});
}

function route() {
  const page = location.hash.slice(1) || "home";
  ({ home, event: eventPage, checkout, request: requestPage, ticket, admin, office, requests, team, scanner:scannerDemo, "ticket-studio":ticketStudio }[page] || home)();
  applyLanguage();
  scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
document.querySelector("#lang-ru").onclick = () => { state.locale = "ru"; localStorage.setItem("atlas-demo-locale-v2", state.locale); route(); };
document.querySelector("#lang-he").onclick = () => { state.locale = "he"; localStorage.setItem("atlas-demo-locale-v2", state.locale); route(); };
route();
