const app = document.querySelector("#app");
const state = {
  locale: localStorage.getItem("atlas-demo-locale") || "ru",
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
  mapObjects: [
    { id: "T1", type: "table", label: "T1", seats: 6, mode: "whole", price: 1890, category: "VIP Seating", x: 22, y: 38 },
    { id: "T2", type: "table", label: "T2", seats: 6, mode: "whole", price: 1890, category: "VIP Seating", x: 50, y: 38 },
    { id: "T3", type: "table", label: "T3", seats: 6, mode: "seat", price: 349, category: "VIP Seating", x: 78, y: 38 },
    { id: "S1", type: "sofa", label: "S1", seats: 4, mode: "whole", price: 1200, category: "VIP Seating", x: 30, y: 72 },
    { id: "S2", type: "sofa", label: "S2", seats: 4, mode: "seat", price: 299, category: "VIP Seating", x: 70, y: 72 },
  ],
};

const hebrew = new Map(Object.entries({
  "События":"אירועים","Организаторам":"למפיקים","Сканер":"סורק","Demo back-office":"ממשק מפיק","Статическая демонстрация":"הדגמה סטטית","Оплата, база данных и сканирование отключены":"תשלום, מסד נתונים וסריקה אינם פעילים","Билеты, ради которых хочется выйти из дома.":"כרטיסים שבשבילם שווה לצאת מהבית.","Ближайшие события":"אירועים קרובים","Все события":"כל האירועים","Выберите билет":"בחירת כרטיס","Выберите место на карте":"בחירת מקום במפה","СЦЕНА":"במה","Итого":"סה״כ","Продолжить":"המשך","Подать заявку":"שליחת בקשה","Количество":"כמות","Заявка на билет":"בקשה לכרטיס","Данные для проверки":"פרטים לבדיקה","Имя и фамилия":"שם מלא","Телефон":"טלפון","Промокод":"קוד הטבה","Оплаты сейчас нет":"אין תשלום כעת","Отправить заявку организатору":"שליחת בקשה למפיק","Ваш заказ":"ההזמנה שלך","Заявка отправлена":"הבקשה נשלחה","Заявка одобрена":"הבקשה אושרה","Заявка отклонена":"הבקשה נדחתה","Открыть приложение организатора":"פתיחת ממשק המפיק","Редактор карты мероприятия":"עורך מפת האירוע","Добавить стол":"הוספת שולחן","Добавить диван":"הוספת ספה","Продажа целиком":"מכירה שלמה","Продажа по местам":"מכירה לפי מקומות","Цена":"מחיר","Категория билета":"קטגוריית כרטיס","Сохранить карту":"שמירת מפה","Как продавать билеты":"איך למכור כרטיסים","Автоматическая продажа":"מכירה אוטומטית","Только после моего одобрения":"רק לאחר האישור שלי","Заявки на вход":"בקשות כניסה","Одобрить":"אישור","Отклонить":"דחייה","Посмотреть событие":"צפייה באירוע","мест":"מקומות","целиком":"שלם","за место":"למקום"
}));
const russian = new Map([...hebrew.entries()].map(([ru, he]) => [he, ru]));

function applyLanguage() {
  const isHebrew = state.locale === "he";
  document.documentElement.lang = state.locale;
  document.documentElement.dir = isHebrew ? "rtl" : "ltr";
  const button = document.querySelector("#language");
  if (button) button.textContent = isHebrew ? "Русский" : "עברית";
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

function mapMarkup(editor = false) {
  return `<div class="demo-map"><div class="demo-stage">СЦЕНА</div>${state.mapObjects.map((item) => `<div class="demo-object ${item.type} ${(editor ? state.editorObject : state.selectedMapObject) === item.id ? "selected" : ""}" style="left:${item.x}%;top:${item.y}%" data-${editor ? "edit" : "map"}-object="${item.id}"><strong>${item.label}</strong><span class="demo-chairs">${Array.from({length:item.seats},(_,index)=>`<button class="demo-chair ${!editor && state.selectedSeats.includes(`${item.id}-${index+1}`) ? "selected" : ""}" ${item.mode === "whole" || editor ? "disabled" : ""} data-map-seat="${item.id}-${index+1}" data-parent="${item.id}">${index+1}</button>`).join("")}</span><small>${money(item.price)} ${item.mode === "whole" ? "целиком" : "за место"}</small></div>`).join("")}</div>`;
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
  return `<section class="panel" style="margin-top:22px"><div class="section-head row"><div><span class="eyebrow">Venue map builder</span><h2>Редактор карты мероприятия</h2></div><div class="row"><button id="add-table" class="button ghost">Добавить стол</button><button id="add-sofa" class="button ghost">Добавить диван</button></div></div><p class="muted">Создайте столы и диваны, назначьте категорию и выберите продажу целиком или отдельных мест.</p><div class="map-tools">${mapMarkup(true)}<div class="map-inspector">${selected ? `<label class="field"><span>Название</span><input id="map-label" class="input" value="${selected.label}"></label><label class="field"><span>Количество мест</span><input id="map-seats" class="input" type="number" min="1" max="12" value="${selected.seats}"></label><label class="field"><span>Категория билета</span><select id="map-category" class="input"><option ${selected.category === "VIP Seating" ? "selected" : ""}>VIP Seating</option><option ${selected.category === "Golden Ring" ? "selected" : ""}>Golden Ring</option></select></label><div><strong>Способ продажи</strong><div class="map-mode"><button class="button ${selected.mode === "whole" ? "" : "ghost"}" data-map-mode="whole">Продажа целиком</button><button class="button ${selected.mode === "seat" ? "" : "ghost"}" data-map-mode="seat">Продажа по местам</button></div></div><label class="field"><span>Цена, ₪ ${selected.mode === "whole" ? "целиком" : "за место"}</span><input id="map-price" class="input" type="number" min="1" value="${selected.price}"></label><label class="field"><span>Положение по горизонтали</span><input id="map-x" type="range" min="8" max="92" value="${selected.x}"></label><label class="field"><span>Положение по вертикали</span><input id="map-y" type="range" min="20" max="90" value="${selected.y}"></label><button id="remove-map-object" class="button ghost">Удалить объект</button>` : ""}<button id="save-map" class="button full">Сохранить карту</button></div></div></section>`;
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
  document.querySelector("#add-table").onclick = () => addMapObject("table");
  document.querySelector("#add-sofa").onclick = () => addMapObject("sofa");
  document.querySelectorAll("[data-map-mode]").forEach((button) => { button.onclick = () => { updateEditorObject({ mode: button.dataset.mapMode }); admin(); }; });
  const bindEditor = (selector, key, numeric = false) => { const input = document.querySelector(selector); if (input) input.onchange = () => { updateEditorObject({ [key]: numeric ? Number(input.value) : input.value }); admin(); }; };
  bindEditor("#map-label", "label"); bindEditor("#map-seats", "seats", true); bindEditor("#map-category", "category"); bindEditor("#map-price", "price", true); bindEditor("#map-x", "x", true); bindEditor("#map-y", "y", true);
  const remove = document.querySelector("#remove-map-object"); if (remove) remove.onclick = () => { state.mapObjects = state.mapObjects.filter((item) => item.id !== state.editorObject); state.editorObject = state.mapObjects[0]?.id || null; admin(); };
  document.querySelector("#save-map").onclick = () => { document.querySelector("#save-map").textContent = "Карта сохранена ✓"; };
  const approve = document.querySelector("#approve");
  if (approve) approve.onclick = () => { state.requestStatus = "APPROVED"; location.hash = "request"; };
  const reject = document.querySelector("#reject");
  if (reject) reject.onclick = () => { state.requestStatus = "REJECTED"; location.hash = "request"; };
  applyLanguage();
}

function updateEditorObject(patch) { state.mapObjects = state.mapObjects.map((item) => item.id === state.editorObject ? { ...item, ...patch } : item); }
function addMapObject(type) { const number = state.mapObjects.filter((item) => item.type === type).length + 1; const item = { id: `${type[0].toUpperCase()}${Date.now()}`, type, label: `${type === "table" ? "T" : "S"}${number}`, seats: type === "table" ? 6 : 4, mode: "whole", price: type === "table" ? 1890 : 1200, category: "VIP Seating", x: 18 + (state.mapObjects.length * 13) % 70, y: 30 + (state.mapObjects.length * 11) % 55 }; state.mapObjects.push(item); state.editorObject = item.id; admin(); }

function route() {
  const page = location.hash.slice(1) || "home";
  ({ home, event: eventPage, checkout, request: requestPage, ticket, admin }[page] || home)();
  applyLanguage();
  scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
document.querySelector("#language").onclick = () => { state.locale = state.locale === "ru" ? "he" : "ru"; localStorage.setItem("atlas-demo-locale", state.locale); route(); };
route();
