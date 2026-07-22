const app = document.querySelector("#app");
const state = {
  category: "General Admission",
  price: 149,
  quantity: 1,
  table: null,
  salesMode: "APPROVAL_REQUIRED",
  requestStatus: "NONE",
  applicant: "Игорь Рубин",
  eligibilityAnswer: "Клубная карта MLN-2841",
};

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
  const tables = ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8"];
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
          <h3>VIP-столы</h3>
          <div class="seats">${tables.map((table, index) => `<button class="seat ${state.table === table ? "selected" : ""} ${index === 6 ? "reserved" : ""}" ${index === 6 ? "disabled" : ""} data-table="${table}"><strong>${table}</strong><br><small>6 мест</small></button>`).join("")}</div>
          ${state.table ? "" : `<label class="field"><span>Количество</span><select id="quantity" class="input">${[1, 2, 3, 4, 5, 6].map((number) => `<option ${state.quantity === number ? "selected" : ""}>${number}</option>`).join("")}</select></label>`}
          <div class="total row"><div><small class="muted">${approvalRequired() ? "К оплате после одобрения" : "Итого"}</small><div class="price">${money(state.table ? 1890 : state.price * state.quantity)}</div></div><button id="continue" class="button">${approvalRequired() ? "Подать заявку" : "Продолжить"}</button></div>
        </div>
      </section>
    </div>
  </div></div>`;

  document.querySelectorAll("[data-cat]").forEach((button) => {
    button.onclick = () => {
      state.category = button.dataset.cat;
      state.price = Number(button.dataset.price);
      state.table = null;
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
  const quantity = document.querySelector("#quantity");
  if (quantity) quantity.onchange = (event) => { state.quantity = Number(event.target.value); eventPage(); };
  document.querySelector("#continue").onclick = () => (location.hash = "checkout");
}

function checkout() {
  const total = state.table ? 1890 : state.price * state.quantity;
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
      <aside class="panel summary"><span class="pill">${approvalRequired() ? "Запрашиваемый билет" : "Ваш заказ"}</span><h2>NOA ELECTRIC - LIVE</h2><p>${state.table ? `VIP-стол ${state.table}, 6 мест` : state.category}</p><div class="summary-line row"><span class="muted">Количество</span><strong>${state.table ? 6 : state.quantity}</strong></div><div class="summary-line row"><span>${approvalRequired() ? "После одобрения" : "Итого"}</span><strong class="price">${money(total)}</strong></div></aside>
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
    <article class="panel ticket"><div class="ticket-head"><div class="brand" style="color:white">ATL<span>AS</span></div><small>DIGITAL TICKET</small></div><div class="ticket-body"><span class="pill">VALID · DEMO</span><h2>NOA ELECTRIC - LIVE</h2><p>${state.table ? `VIP Table · ${state.table}` : state.category}<br><span class="muted">18 сентября 2026 · Hangar 11</span></p><img class="ticket-qr" src="./assets/demo-qr.png" alt="Демонстрационный QR-код"><div class="ticket-code">ATLAS_DEMO_NOT_VALID_FOR_ENTRY</div></div></article>
    <a class="button dark" href="#home" style="margin-top:22px">Вернуться к событиям</a>
  </section></div>`;
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
      <div class="section-head row"><h2>Заявки на вход</h2><span class="pill">${state.requestStatus === "PENDING" ? "1 ожидает" : "нет новых"}</span></div>
      <div class="table-wrap"><table><thead><tr><th>Клиент</th><th>Событие</th><th>Ответ</th><th>Решение</th></tr></thead><tbody>${pendingRow}</tbody></table></div>
    </section>
  </div></div></div>`;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.onclick = () => { state.salesMode = button.dataset.mode; admin(); };
  });
  const approve = document.querySelector("#approve");
  if (approve) approve.onclick = () => { state.requestStatus = "APPROVED"; location.hash = "request"; };
  const reject = document.querySelector("#reject");
  if (reject) reject.onclick = () => { state.requestStatus = "REJECTED"; location.hash = "request"; };
}

function route() {
  const page = location.hash.slice(1) || "home";
  ({ home, event: eventPage, checkout, request: requestPage, ticket, admin }[page] || home)();
  scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();
