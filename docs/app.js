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
  mapObjects: [
    { id: "STAGE", type: "stage", label: "СЦЕНА", seats: 0, x: 50, y: 12, width: 440, height: 72 },
    { id: "DANCE", type: "zone", label: "ТАНЦПОЛ", seats: 0, x: 50, y: 48, width: 390, height: 280 },
    { id: "T1", type: "table", label: "T1", seats: 6, mode: "whole", price: 1890, category: "VIP Seating", x: 18, y: 35, width: 128, height: 76 },
    { id: "T2", type: "round-table", label: "T2", seats: 6, mode: "whole", price: 1890, category: "VIP Seating", x: 82, y: 35, width: 104, height: 104 },
    { id: "T3", type: "table", label: "T3", seats: 6, mode: "seat", price: 349, category: "VIP Seating", x: 18, y: 67, width: 128, height: 76 },
    { id: "S1", type: "sofa", label: "S1", seats: 4, mode: "whole", price: 1200, category: "VIP Seating", x: 36, y: 83, width: 172, height: 70 },
    { id: "S2", type: "sofa", label: "S2", seats: 4, mode: "seat", price: 299, category: "VIP Seating", x: 64, y: 83, width: 172, height: 70 },
    { id: "R1", type: "row", label: "Ряд A", seats: 8, mode: "seat", price: 239, category: "Golden Ring", x: 82, y: 67, width: 210, height: 54 },
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

function seatsMarkup(item, editor = false) {
  return `<span class="furniture-seats">${Array.from({length:item.seats},(_,index)=>`<button class="demo-chair seat-${index + 1} ${!editor && state.selectedSeats.includes(`${item.id}-${index+1}`) ? "selected" : ""}" ${item.mode === "whole" || editor ? "disabled" : ""} data-map-seat="${item.id}-${index+1}" data-parent="${item.id}">${index+1}</button>`).join("")}</span>`;
}

function furnitureMarkup(item, editor = false) {
  const selected = (editor ? state.editorObject : state.selectedMapObject) === item.id;
  const style = `left:${item.x}%;top:${item.y}%;width:${item.width || 130}px;height:${item.height || 70}px`;
  if (!sellableTypes.has(item.type)) return `<div class="venue-object decoration ${item.type} ${selected ? "selected" : ""}" style="${style}" ${editor ? `data-edit-object="${item.id}"` : ""}><strong>${item.label}</strong></div>`;
  return `<div class="venue-object furniture ${item.type} ${selected ? "selected" : ""}" style="${style}" data-${editor ? "edit" : "map"}-object="${item.id}"><div class="furniture-body"><strong>${item.label}</strong>${item.type === "sofa" ? `<span class="sofa-cushions">${Array.from({length:item.seats},()=>"<i></i>").join("")}</span>` : ""}</div>${seatsMarkup(item, editor)}${editor ? "" : `<small class="object-price">${money(item.price)} ${item.mode === "whole" ? "целиком" : "за место"}</small>`}</div>`;
}

function mapMarkup(editor = false) {
  return `<div class="demo-map ${editor ? "editor-map" : ""}">${state.mapObjects.map((item) => furnitureMarkup(item, editor)).join("")}</div>`;
}

function selectedMapItem() { return state.mapObjects.find((item) => item.id === state.selectedMapObject); }
function selectionTotal() { const item=selectedMapItem(); return item ? item.mode === "whole" ? item.price : item.price * state.selectedSeats.length : state.table ? 1890 : state.price * state.quantity; }
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
    <a class="button dark" href="#home" style="margin-top:22px">Вернуться к событиям</a>
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
      <div class="builder-actions"><button class="icon-action" title="Отменить">↶</button><button class="icon-action" title="Повторить">↷</button><button id="preview-map" class="button ghost">Превью</button><button id="save-map" class="button">Сохранить</button></div>
    </div>
    <div class="builder-demo-layout">
      <aside class="object-library"><strong>Добавить места</strong>${palette.slice(0,5).map(([type,label])=>`<button data-add-object="${type}"><span class="palette-visual ${type}"><i></i><i></i><i></i></span><span>${label}</span></button>`).join("")}<strong>Добавить объекты</strong>${palette.slice(5).map(([type,label])=>`<button data-add-object="${type}"><span class="palette-visual ${type}"><i></i></span><span>${label}</span></button>`).join("")}</aside>
      <div class="builder-workspace"><div class="floating-tools"><button>↖</button><button>☝</button><span></span><button data-zoom="out">−</button><strong>${Math.round(state.editorZoom * 100)}%</strong><button data-zoom="in">+</button></div><div class="builder-viewport"><div class="builder-world" style="transform:scale(${state.editorZoom})">${mapMarkup(true)}</div></div></div>
      <aside class="property-panel"><div class="capacity"><span>Вместимость площадки</span><strong>${capacity}</strong><small>посадочных мест</small></div>${selected ? `<div class="selected-kind"><span class="palette-visual ${selected.type}"><i></i><i></i><i></i></span><div><small>Выбран объект</small><strong>${selected.label}</strong></div></div><label class="field"><span>Название</span><input id="map-label" class="input" value="${selected.label}"></label>${state.editorTab === "design" ? `<label class="field"><span>Количество мест</span><input id="map-seats" class="input" type="number" min="${isSellable ? 1 : 0}" max="30" value="${selected.seats}"></label><div class="dimensions"><label class="field"><span>Ширина</span><input id="map-width" class="input" type="number" value="${selected.width || 130}"></label><label class="field"><span>Высота</span><input id="map-height" class="input" type="number" value="${selected.height || 70}"></label></div><label class="field"><span>Положение по горизонтали</span><input id="map-x" type="range" min="6" max="94" value="${selected.x}"></label><label class="field"><span>Положение по вертикали</span><input id="map-y" type="range" min="6" max="96" value="${selected.y}"></label>` : isSellable ? `<label class="field"><span>Категория билета</span><select id="map-category" class="input"><option ${selected.category === "VIP Seating" ? "selected" : ""}>VIP Seating</option><option ${selected.category === "Golden Ring" ? "selected" : ""}>Golden Ring</option></select></label><div><strong>Как продавать этот объект</strong><div class="map-mode"><button class="${selected.mode === "whole" ? "active" : ""}" data-map-mode="whole"><strong>Целиком</strong><small>Одна цена за весь объект</small></button><button class="${selected.mode === "seat" ? "active" : ""}" data-map-mode="seat"><strong>По местам</strong><small>Каждый стул отдельно</small></button></div></div><label class="field"><span>Цена, ₪ ${selected.mode === "whole" ? "за весь объект" : "за одно место"}</span><input id="map-price" class="input" type="number" min="1" value="${selected.price}"></label><div class="ticket-summary"><span>${selected.seats} мест</span><strong>${selected.mode === "whole" ? money(selected.price) : `${money(selected.price)} × ${selected.seats}`}</strong></div>` : `<div class="empty-inspector">Этот объект оформляет площадку и не продаётся.</div>`}<button id="remove-map-object" class="danger-link">Удалить объект</button>` : `<div class="empty-inspector">Выберите объект на схеме, чтобы настроить его.</div>`}</aside>
    </div>
  </section>`;
}

function admin() {
  const pendingRow = state.requestStatus === "PENDING" ? `<tr><td><strong>${state.applicant}</strong><br><small>+972 52 513 8899</small></td><td>NOA ELECTRIC</td><td>${state.eligibilityAnswer}</td><td><button class="button" id="approve">Одобрить</button> <button class="button ghost" id="reject">Отклонить</button></td></tr>` : `<tr><td colspan="4" class="muted">Новых заявок нет</td></tr>`;
  app.innerHTML = `<div class="page fade"><div class="shell"><div class="admin-layout">
    <aside class="sidebar"><strong>Atlas Office</strong><span class="active">Событие</span><span>Заявки ${state.requestStatus === "PENDING" ? "· 1" : ""}</span><span>Заказы</span><span>Сканер</span></aside>
    <section class="admin-main">
      <div class="admin-head row"><div><span class="eyebrow">Event manager</span><h1>NOA ELECTRIC</h1></div><a class="button ghost" href="#event">Посмотреть событие</a></div>
      <div class="panel form">
        <span class="eyebrow">Ключевая настройка</span><h2>Как продавать билеты</h2>
        <button class="option ${state.salesMode === "INSTANT" ? "selected" : ""}" data-mode="INSTANT"><span><strong>Автоматическая продажа</strong><small>Клиент сразу оплачивает и получает билет.</small></span><strong>○</strong></button>
        <button class="option ${state.salesMode === "APPROVAL_REQUIRED" ? "selected" : ""}" data-mode="APPROVAL_REQUIRED"><span><strong>Только после моего одобрения</strong><small>Заявка → проверка → оплата → билет.</small></span><strong>○</strong></button>
      </div>
      ${adminMapEditorMarkup()}
      <div class="section-head row"><h2>Заявки на вход</h2><span class="pill">${state.requestStatus === "PENDING" ? "1 ожидает" : "нет новых"}</span></div>
      <div class="table-wrap"><table><thead><tr><th>Клиент</th><th>Событие</th><th>Ответ</th><th>Решение</th></tr></thead><tbody>${pendingRow}</tbody></table></div>
    </section>
  </div></div></div>`;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.onclick = () => { state.salesMode = button.dataset.mode; admin(); };
  });
  document.querySelectorAll("[data-edit-object]").forEach((object) => { object.onclick = () => { state.editorObject = object.dataset.editObject; admin(); }; });
  document.querySelectorAll("[data-add-object]").forEach((button) => { button.onclick = () => addMapObject(button.dataset.addObject); });
  document.querySelectorAll("[data-editor-tab]").forEach((button) => { button.onclick = () => { state.editorTab = button.dataset.editorTab; admin(); }; });
  document.querySelectorAll("[data-zoom]").forEach((button) => { button.onclick = () => { state.editorZoom = Math.max(.45, Math.min(1.05, state.editorZoom + (button.dataset.zoom === "in" ? .1 : -.1))); admin(); }; });
  document.querySelectorAll("[data-map-mode]").forEach((button) => { button.onclick = () => { updateEditorObject({ mode: button.dataset.mapMode }); admin(); }; });
  const bindEditor = (selector, key, numeric = false) => { const input = document.querySelector(selector); if (input) input.onchange = () => { updateEditorObject({ [key]: numeric ? Number(input.value) : input.value }); admin(); }; };
  bindEditor("#map-label", "label"); bindEditor("#map-seats", "seats", true); bindEditor("#map-category", "category"); bindEditor("#map-price", "price", true); bindEditor("#map-width", "width", true); bindEditor("#map-height", "height", true); bindEditor("#map-x", "x", true); bindEditor("#map-y", "y", true);
  const remove = document.querySelector("#remove-map-object"); if (remove) remove.onclick = () => { state.mapObjects = state.mapObjects.filter((item) => item.id !== state.editorObject); state.editorObject = state.mapObjects[0]?.id || null; admin(); };
  document.querySelector("#save-map").onclick = () => { document.querySelector("#save-map").textContent = "Карта сохранена ✓"; };
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
  const item = { id: `${type[0].toUpperCase()}${Date.now()}`, type, label: `${label} ${number}`, seats, mode: type === "row" ? "seat" : "whole", price, category: sellableTypes.has(type) ? "VIP Seating" : null, width, height, x: 20 + (state.mapObjects.length * 11) % 60, y: 24 + (state.mapObjects.length * 9) % 62 };
  state.mapObjects.push(item); state.editorObject = item.id; admin();
}

function route() {
  const page = location.hash.slice(1) || "home";
  ({ home, event: eventPage, checkout, request: requestPage, ticket, admin }[page] || home)();
  applyLanguage();
  scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
document.querySelector("#lang-ru").onclick = () => { state.locale = "ru"; localStorage.setItem("atlas-demo-locale-v2", state.locale); route(); };
document.querySelector("#lang-he").onclick = () => { state.locale = "he"; localStorage.setItem("atlas-demo-locale-v2", state.locale); route(); };
route();
