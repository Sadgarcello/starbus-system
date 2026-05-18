(function () {
  "use strict";

  const MAX_TICKETS = 8;
  const POLL_MS_VISIBLE = 14500 + Math.floor(Math.random() * 3000);
  const POLL_MS_HIDDEN = 62000;

  // ===== Helpers =====
  function $(sel) {
    return document.querySelector(sel);
  }
  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clientTodayYmd() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function toast(kind, msg) {
    const t = $("#toast");
    if (!t) return;
    t.className = "toast " + (kind || "");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._h);
    toast._h = setTimeout(() => {
      t.hidden = true;
    }, 3200);
  }

  async function api(path, { method = "GET", body, timeoutMs = 12000 } = {}) {
    const ctrl = new AbortController();
    const tmr = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const txt = await res.text();
      let data = null;
      try {
        data = txt ? JSON.parse(txt) : null;
      } catch {
        data = { raw: txt };
      }
      if (!res.ok) {
        const err = new Error(data?.error || "HTTP " + res.status);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(tmr);
    }
  }

  function fmtTime(t) {
    if (!t) return "—";
    const m = String(t).match(/^(\d{2}):(\d{2})/);
    if (!m) return String(t);
    return m[1] + ":" + m[2];
  }

  function fmtPrice(p) {
    const n = Number(p);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return n.toLocaleString("ar-EG") + " ج.س";
  }

  function fmtDateLongAr(rawYmd) {
    const raw = String(rawYmd || "").split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "—";
    const d = new Date(raw + "T12:00:00");
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("ar", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  /** @param {number} days */
  function addDaysFromYmd(anchorYmd, days) {
    const base = String(anchorYmd || "").split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) {
      const x = clientTodayYmd().split("-");
      const d = new Date(Number(x[0]), Number(x[1]) - 1, Number(x[2]));
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    const d = new Date(base + "T12:00:00");
    if (Number.isNaN(d.getTime())) return base;
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function seatsRemainingPill(r) {
    const n = Number(r);
    if (!Number.isFinite(n) || n <= 0) return { cls: "full", text: "محجوزة بالكامل" };
    if (n <= 5) return { cls: "warn", text: "آخر " + n + " مقاعد" };
    return { cls: "ok", text: n + " مقعد متاح" };
  }

  function setStep(id) {
    document.querySelectorAll(".step").forEach((s) => {
      s.hidden = s.id !== id;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** @param {'empty'|'ok'|'err'} phase */
  function setRoutesAria(phase, detail) {
    const live = $("#routesLive");
    if (!live) return;
    let msg =
      phase === "loading"
        ? "جاري تحميل الرحلات"
        : phase === "ok"
          ? "تم تحميل الرحلات"
          : phase === "empty"
            ? detail || "لا توجد رحلات في التاريخ المختار"
            : detail || "تعذر تحميل الرحلات حالياً";
    live.textContent = msg;
  }

  function nextSeatPollDelayMs() {
    return document.hidden ? POLL_MS_HIDDEN : POLL_MS_VISIBLE;
  }

  // ===== State =====
  const state = {
    buses: [],
    selected: null,
    seatMap: null,
    ticketCount: 1,
    pickedSeats: [],
    refreshTimer: null,
    whatsapp: "",
    booking: null,
    /** @type {{ service_today: string, max_offset: number }} */
    calendar: { service_today: "", max_offset: 6 },
    travelYmd: "",
    routesHadNetworkError: false,
    routesHadValidationError: false,
    __focusRefresh: false,
    __seatVisibilityHandler: null,
  };

  function travelQs() {
    const d = state.travelYmd;
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return `?date=${encodeURIComponent(d)}`;
    return "";
  }

  function populateTravelDates() {
    const sel = $("#travelDateSel");
    if (!sel) return;
    const anchor =
      state.calendar.service_today && /^\d{4}-\d{2}-\d{2}$/.test(state.calendar.service_today)
        ? state.calendar.service_today
        : clientTodayYmd();
    state.calendar.service_today = anchor;

    sel.innerHTML = "";
    const n = Number(state.calendar.max_offset);
    const max =
      Number.isFinite(n) && n >= 0 && n <= 60 ? Math.floor(n) : 6;
    state.calendar.max_offset = max;

    let keep = state.travelYmd;
    if (!keep || !/^\d{4}-\d{2}-\d{2}$/.test(keep)) keep = anchor;

    for (let i = 0; i <= max; i++) {
      const ymd = addDaysFromYmd(anchor, i);
      const opt = el("option", "", fmtDateLongAr(ymd));
      opt.value = ymd;
      if (ymd === keep) opt.selected = true;
      sel.appendChild(opt);
    }
    state.travelYmd = sel.value || anchor;

    const sub = $("#routesSubhead");
    if (sub) {
      sub.textContent =
        "اختر تاريخ الرحلة، ثم وجهة من أم درمان";
    }

    $("#travelDateHint").textContent =
      "اليوم الخدمي وفق وقت السيرفر: " + anchor;
  }

  // ===== Step 1: Routes =====
  async function loadRoutes() {
    const list = $("#routesList");
    const empty = $("#routesEmpty");
    const error = $("#routesError");
    empty.hidden = true;
    error.hidden = true;
    state.routesHadNetworkError = false;
    state.routesHadValidationError = false;

    list.innerHTML =
      '<div class="skeleton route-skel"></div>' +
      '<div class="skeleton route-skel"></div>' +
      '<div class="skeleton route-skel"></div>';
    setRoutesAria("loading", "");

    try {
      const out = await api("/api/public/buses/active" + travelQs());
      state.buses = out.buses || [];
      list.innerHTML = "";
      if (!state.buses.length) {
        empty.hidden = false;
        const dayLabel = fmtDateLongAr(state.travelYmd);
        $("#routesEmptyReason").textContent =
          `ما في رحلات متاحة لـ ${dayLabel}. جرّب تاريخ ثاني أو كلمّنا لو محتاج معلومات — واتساب.`;
        setRoutesAria("empty", "");
        return;
      }
      for (const b of state.buses) {
        list.appendChild(routeCard(b));
      }
      setRoutesAria("ok", "");
    } catch (e) {
      list.innerHTML = "";
      state.routesHadNetworkError = !e.status || e.status >= 500;
      state.routesHadValidationError =
        !!(e.status && e.status >= 400 && e.status < 500);
      if (state.routesHadValidationError) {
        empty.hidden = false;
        $("#routesEmptyReason").textContent =
          e.message || "التاريخ خارج نطاق الحجز. اختار تاريخاً بين اليوم والأيام المسموحة.";
        toast("warn", e.message || "تاريخ غير صالح");
      } else {
        error.hidden = false;
        error.textContent =
          state.routesHadNetworkError
            ? "ما قدرنا نحمل الرحلات الآن (شبكة أو السيرفر). حاول بعد شوي."
            : "حصل خطأ غير متوقع. حاول تاني.";
      }
      setRoutesAria("err", "");
    }
  }

  function routeCard(b) {
    const card = el("div", "routeCard");
    const remain = Number(b.seats_remaining);
    const pill = seatsRemainingPill(remain);
    if (pill.cls === "full") card.classList.add("disabled");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute(
      "aria-label",
      (b.origin || "") + " إلى " + (b.destination || "") + " · " + pill.text
    );

    const main = el("div", "routeMain");
    const route = el("div", "routeRoute");
    route.textContent = b.origin + " ← " + b.destination;
    main.appendChild(route);

    const sub = el("div", "routeSub");
    sub.appendChild(
      el("span", null, fmtTime(b.departure_time))
    );
    sub.appendChild(
      el(
        "span",
        null,
        " · باص #" + String(b.bus_number || "—")
      )
    );
    sub.appendChild(
      el("span", null, " · السعر " + fmtPrice(b.price))
    );
    main.appendChild(sub);

    const stat = el("span", "statePill " + pill.cls, pill.text);

    card.appendChild(main);
    card.appendChild(stat);

    if (pill.cls !== "full") {
      card.addEventListener("click", () => selectBus(b));
      card.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          selectBus(b);
        }
      });
    }
    return card;
  }

  // ===== Step 2: Count + seat picker =====
  async function selectBus(b) {
    state.selected = b;
    state.pickedSeats = [];
    state.ticketCount = 1;
    setStep("stepSeats");
    const dateLine =
      fmtDateLongAr(state.travelYmd || b.date) +
      " — " +
      fmtTime(b.departure_time);
    $("#seatBusMeta").textContent =
      b.origin + " ← " + b.destination + " · " + dateLine;
    updateCounterUI();
    await refreshSeats();
    startSeatRefresh();
  }

  function startSeatRefresh() {
    stopSeatRefresh();
    const tick = async () => {
      if (!state.selected) return;
      if (!document.hidden) await refreshSeats();
      queueSeatPoll();
    };
    const queueSeatPoll = () => {
      if (state.refreshTimer) clearTimeout(state.refreshTimer);
      state.refreshTimer = setTimeout(tick, nextSeatPollDelayMs());
    };

    queueSeatPoll();
    state.__focusRefresh = async () => {
      if (!document.hidden && state.selected) await refreshSeats();
    };
    window.addEventListener("focus", state.__focusRefresh);

    state.__seatVisibilityHandler = () => queueSeatPoll();
    document.addEventListener("visibilitychange", state.__seatVisibilityHandler);

    void refreshSeats();
  }

  function stopSeatRefresh() {
    if (state.refreshTimer) clearTimeout(state.refreshTimer);
    state.refreshTimer = null;
    if (state.__focusRefresh) window.removeEventListener("focus", state.__focusRefresh);
    state.__focusRefresh = false;
    if (state.__seatVisibilityHandler)
      document.removeEventListener(
        "visibilitychange",
        state.__seatVisibilityHandler
      );
    state.__seatVisibilityHandler = null;
  }

  function maxTicketsAllowed() {
    const totalAvail = countAvailableSeats(state.seatMap);
    return Math.max(1, Math.min(MAX_TICKETS, totalAvail || 1));
  }

  function countAvailableSeats(map) {
    if (!map) return MAX_TICKETS;
    let c = 0;
    for (const k in map.seats) if (map.seats[k] === "empty") c++;
    return c;
  }

  function setTicketCount(n) {
    const max = maxTicketsAllowed();
    state.ticketCount = Math.max(1, Math.min(max, n));
    if (state.pickedSeats.length > state.ticketCount) {
      state.pickedSeats = state.pickedSeats.slice(0, state.ticketCount);
    }
    updateCounterUI();
    paintBus();
  }

  function updateCounterUI() {
    $("#cNum").textContent = String(state.ticketCount);
    const max = maxTicketsAllowed();
    $("#cMinus").disabled = state.ticketCount <= 1;
    $("#cPlus").disabled = state.ticketCount >= max;
    const hint = $("#counterHint");
    if (max < MAX_TICKETS) hint.textContent = "متاح " + max + " مقعد فقط";
    else hint.textContent = "حتى " + MAX_TICKETS + " مقاعد في الحجز الواحد";
  }

  async function refreshSeats() {
    if (!state.selected) return;
    try {
      const map = await api(
        "/api/public/buses/" + state.selected.id + "/seat-map" + travelQs()
      );
      state.seatMap = map;
      const before = state.pickedSeats.length;
      state.pickedSeats = state.pickedSeats.filter(
        (n) => (map.seats[String(n)] || "empty") === "empty"
      );
      if (state.pickedSeats.length < before) {
        toast(
          "warn",
          "مقعد أو أكثر من اختيارك أصبح محجوزاً؛ اختر مقاعد بديلة"
        );
      }
      const mx = maxTicketsAllowed();
      if (state.ticketCount > mx) state.ticketCount = mx;
      updateCounterUI();
      paintBus();
    } catch (e) {
      toast("warn", "تعذر تحديث المقاعد");
    }
  }

  function paintBus() {
    const map = state.seatMap;
    const grid = $("#seatGrid");
    if (!map || !grid) return;
    grid.innerHTML = "";

    function tile(n) {
      const st = map.seats[String(n)] || "empty";
      const b = el("button", "seatTile " + st, String(n));
      b.type = "button";
      b.setAttribute("aria-pressed", state.pickedSeats.includes(n) ? "true" : "false");
      const isPicked = state.pickedSeats.includes(n);
      if (isPicked) b.classList.add("picked");
      if (st === "empty") {
        b.addEventListener("click", () => onSeatTap(n));
      } else {
        b.disabled = true;
      }
      return b;
    }

    function pair(nums) {
      const w = el("div", "busPair");
      if (!nums || !nums.length) {
        const ph = el("div", "seatTile door", "•");
        ph.setAttribute("aria-hidden", "true");
        w.appendChild(ph);
        return w;
      }
      nums.forEach((n) => w.appendChild(tile(n)));
      return w;
    }

    map.layout_rows.forEach((row) => {
      const rdiv = el("div", "busRow");
      rdiv.appendChild(pair(row.left));
      rdiv.appendChild(el("div", "busAisle"));
      rdiv.appendChild(pair(row.right));
      grid.appendChild(rdiv);
    });

    updatePickedBar();
  }

  function onSeatTap(n) {
    const idx = state.pickedSeats.indexOf(n);
    if (idx >= 0) state.pickedSeats.splice(idx, 1);
    else if (state.pickedSeats.length >= state.ticketCount) {
      toast("warn", "اختار " + state.ticketCount + " مقعد فقط أو زود العدد");
      return;
    } else {
      state.pickedSeats.push(n);
    }
    paintBus();
  }

  function updatePickedBar() {
    const bar = $("#pickedBar");
    const num = $("#pickedNum");
    const prog = $("#pickedProgress");
    const cont = $("#continueBtn");
    bar.hidden = false;
    const picked = state.pickedSeats.length;
    prog.textContent = "تم اختيار " + picked + " من " + state.ticketCount;
    if (picked === 0) num.textContent = "—";
    else num.textContent = state.pickedSeats.map((n) => "#" + n).join("، ");
    cont.disabled = picked !== state.ticketCount || picked === 0;
  }

  // ===== Step 3: Form =====
  function gotoForm() {
    if (state.pickedSeats.length !== state.ticketCount || state.ticketCount === 0) {
      toast("warn", "اختار " + state.ticketCount + " مقعد أولاً");
      return;
    }
    stopSeatRefresh();
    const b = state.selected;
    const seatList = state.pickedSeats.map((n) => "#" + n).join("، ");
    const totalPrice = (Number(b.price) || 0) * state.ticketCount;
    const priceLine =
      totalPrice > 0
        ? " · المجموع <b>" + escapeHtml(fmtPrice(totalPrice)) + "</b>"
        : "";
    $("#formSummary").innerHTML =
      "<b>" +
      escapeHtml(b.origin) +
      " ← " +
      escapeHtml(b.destination) +
      "</b>" +
      " · " +
      escapeHtml(fmtDateLongAr(state.travelYmd || b.date)) +
      " · " +
      escapeHtml(fmtTime(b.departure_time)) +
      " · <b>" +
      state.ticketCount +
      " مقاعد</b> (" +
      escapeHtml(seatList) +
      ")" +
      priceLine;
    setStep("stepForm");
    setTimeout(() => $("#cname")?.focus(), 200);
  }

  function submitForm(e) {
    e.preventDefault();
    const errBox = $("#formError");
    errBox.hidden = true;
    const name = $("#cname").value.trim();
    const phone = $("#cphone").value.trim();
    if (name.length < 2) {
      errBox.textContent = "الإسم لازم حرفين على الأقل";
      errBox.hidden = false;
      return;
    }
    if (!/^[\d+()\-\s]{7,}$/.test(phone)) {
      errBox.textContent = "رقم الهاتف غير صحيح";
      errBox.hidden = false;
      return;
    }

    const sel = state.selected;
    if (!sel) {
      errBox.textContent = "اختار رحلة أولاً";
      errBox.hidden = false;
      return;
    }

    const seats = state.pickedSeats.slice().sort((a, b) => a - b);
    const total_price = (Number(sel.price) || 0) * seats.length;

    state.booking = {
      bus_id: sel.id,
      booking_ids: [],
      seat_numbers: seats,
      origin: sel.origin,
      destination: sel.destination,
      departure_time: sel.departure_time,
      date: state.travelYmd || sel.date,
      travel_label: fmtDateLongAr(state.travelYmd || sel.date),
      price: sel.price,
      total_price,
      name,
      phone,
    };
    showDone();
  }

  // ===== Step 4: Done =====
  function showDone() {
    const b = state.booking;
    if (!b) return;
    const seats = (b.seat_numbers || []).map((n) => "#" + n).join("، ");
    const ids = b.booking_ids || [];
    const refs = ids.length
      ? ids.map((id) => "#" + id).join("، ")
      : "— (بانتظار تأكيد الموظف)";
    const total =
      b.total_price != null
        ? Number(b.total_price)
        : (Number(b.price) || 0) * (b.seat_numbers?.length || 1);

    const lines = [
      ["أرقام الحجز", `<span class="ref">${escapeHtml(refs)}</span>`],
      [
        "رقم الرحلة (للموظف)",
        `<span class="ref">${escapeHtml(String(b.bus_id ?? "—"))}</span>`,
      ],
      ["الراكب", escapeHtml(b.name)],
      ["الهاتف", escapeHtml(b.phone)],
      [
        "الرحلة",
        escapeHtml(b.origin) + " ← " + escapeHtml(b.destination),
      ],
      ["تاريخ الرحلة", escapeHtml(b.travel_label || fmtDateLongAr(b.date))],
      ["موعد الانطلاق", escapeHtml(fmtTime(b.departure_time))],
      [
        "المقاعد",
        escapeHtml(seats) +
          " (" +
          (b.seat_numbers?.length || 1) +
          " تذكرة)",
      ],
      ["المجموع المتوقع", escapeHtml(fmtPrice(total))],
      ["الحالة", "طلب من الموقع — أكمل على واتساب"],
    ];
    const recHtml = lines
      .map(
        ([lbl, val]) =>
          `<div class="row"><span class="lbl">${lbl}</span><span class="val">${val}</span></div>`
      )
      .join("");
    $("#receipt").innerHTML = recHtml;

    const wa = waLink(buildConfirmText(b));
    $("#waConfirmBtn").href = wa;
    setStep("stepDone");
  }

  function buildConfirmText(b) {
    const seats = (b.seat_numbers || []).map((n) => "#" + n).join("، ");
    const count = b.seat_numbers?.length || 1;
    const total =
      b.total_price != null
        ? Number(b.total_price)
        : (Number(b.price) || 0) * count;
    const dateLine = b.travel_label || fmtDateLongAr(b.date);
    const lines = [
      "السلام عليكم ستار باص",
      "",
      `طلب حجز ${count} ${count === 1 ? "تذكرة" : "تذاكر"} من الموقع (يحتاج تأكيد الموظف):`,
      "",
      "رقم الرحلة في النظام: " + String(b.bus_id ?? "—"),
      "التاريخ: " + dateLine,
      "الإسم: " + b.name,
      "الهاتف (واتساب): " + b.phone,
      "الرحلة: " + b.origin + " ← " + b.destination,
      "وقت الانطلاق: " + fmtTime(b.departure_time),
      "المقاعد المطلوبة: " + seats,
      "المجموع المتوقع: " + fmtPrice(total),
      "",
      "ما في رقم حجز بعد — يرجى التأكيد في النظام لو سمحتم.",
      "",
      "شكراً",
    ];
    return lines.join("\n");
  }

  function waLink(message) {
    const num = state.whatsapp || "";
    const text = encodeURIComponent(message || "السلام عليكم ستار باص");
    if (!num) return "https://wa.me/?text=" + text;
    return "https://wa.me/" + num + "?text=" + text;
  }

  // ===== Init =====
  async function loadCalendarAndConfig() {
    try {
      const cfg = await api("/api/public/config", { timeoutMs: 8000 });
      state.whatsapp = String(cfg.whatsapp || "").replace(/[^\d]/g, "");
      const st = String(cfg.service_today || "").trim();
      state.calendar.service_today = /^\d{4}-\d{2}-\d{2}$/.test(st)
        ? st
        : clientTodayYmd();
      const mx = Number(cfg.max_service_day_offset);
      state.calendar.max_offset =
        Number.isFinite(mx) && mx >= 0 && mx <= 60 ? Math.floor(mx) : 6;
    } catch {
      state.whatsapp = "";
      state.calendar.service_today = clientTodayYmd();
      state.calendar.max_offset = 6;
    }

    populateTravelDates();
  }

  function bindTravelDateChange() {
    $("#travelDateSel")?.addEventListener("change", () => {
      const sel = $("#travelDateSel");
      if (!sel) return;
      const v = sel.value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        state.travelYmd = v;
        loadRoutes();
      }
    });
  }

  function bindBacks() {
    document.querySelectorAll("[data-back]").forEach((b) => {
      b.addEventListener("click", () => {
        const target = b.getAttribute("data-back");
        if (target === "stepRoutes") {
          stopSeatRefresh();
          state.selected = null;
          state.pickedSeats = [];
          state.seatMap = null;
        }
        if (target === "stepSeats") {
          startSeatRefresh();
          refreshSeats();
        }
        setStep(target);
      });
    });
  }

  function bindCounter() {
    $("#cMinus")?.addEventListener("click", () =>
      setTicketCount(state.ticketCount - 1)
    );
    $("#cPlus")?.addEventListener("click", () =>
      setTicketCount(state.ticketCount + 1)
    );
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindBacks();
    bindCounter();
    bindTravelDateChange();
    $("#continueBtn")?.addEventListener("click", gotoForm);
    $("#bookForm")?.addEventListener("submit", submitForm);
    $("#anotherBtn")?.addEventListener("click", () => {
      state.booking = null;
      state.pickedSeats = [];
      state.seatMap = null;
      state.selected = null;
      state.ticketCount = 1;
      setStep("stepRoutes");
      loadRoutes();
    });

    const waMsg = "السلام عليكم ستار باص، عندي استفسار 🙏";
    const askMsg = "السلام عليكم ستار باص، عندي سؤال 🙏";

    await loadCalendarAndConfig();
    const link = waLink(waMsg);
    const topEl = $("#topWa");
    if (topEl) topEl.href = link;
    const navWa = $("#navWa');
    if (navWa) navWa.href = link;
    const cta = $("#ctaWa");
    if (cta) cta.href = waLink(askMsg);

    await loadRoutes();
  });
})();
