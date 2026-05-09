(function () {
  "use strict";

  const MAX_TICKETS = 8;

  // ===== Helpers =====
  function $(sel) { return document.querySelector(sel); }
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

  function toast(kind, msg) {
    const t = $("#toast");
    if (!t) return;
    t.className = "toast " + (kind || "");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._h);
    toast._h = setTimeout(() => { t.hidden = true; }, 3200);
  }

  async function api(path, { method = "GET", body, timeoutMs = 12000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const txt = await res.text();
      let data = null;
      try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }
      if (!res.ok) {
        const err = new Error(data?.error || ("HTTP " + res.status));
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } finally { clearTimeout(t); }
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
  function seatsRemainingPill(r) {
    const n = Number(r);
    if (!Number.isFinite(n) || n <= 0) return { cls: "full", text: "محجوزة بالكامل" };
    if (n <= 5) return { cls: "warn", text: "آخر " + n + " مقاعد" };
    return { cls: "ok", text: n + " مقعد متاح" };
  }
  function setStep(id) {
    document.querySelectorAll(".step").forEach((s) => { s.hidden = (s.id !== id); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ===== State =====
  const state = {
    buses: [],
    selected: null,         // bus object
    seatMap: null,          // server payload
    ticketCount: 1,         // how many tickets the customer wants
    pickedSeats: [],        // selected seat numbers (in tap order)
    refreshTimer: null,
    whatsapp: "",
    booking: null,          // local summary for receipt / WhatsApp (no DB rows yet)
  };

  // ===== Step 1: Routes =====
  async function loadRoutes() {
    const list = $("#routesList");
    const empty = $("#routesEmpty");
    const error = $("#routesError");
    empty.hidden = true; error.hidden = true;
    list.innerHTML =
      '<div class="skeleton route-skel"></div>' +
      '<div class="skeleton route-skel"></div>' +
      '<div class="skeleton route-skel"></div>';

    try {
      const out = await api("/api/public/buses/active");
      state.buses = out.buses || [];
      list.innerHTML = "";
      if (!state.buses.length) { empty.hidden = false; return; }
      for (const b of state.buses) {
        list.appendChild(routeCard(b));
      }
    } catch (e) {
      list.innerHTML = "";
      error.hidden = false;
    }
  }

  function routeCard(b) {
    const card = el("div", "routeCard");
    const remain = Number(b.seats_remaining);
    const pill = seatsRemainingPill(remain);
    if (pill.cls === "full") card.classList.add("disabled");

    const main = el("div", "routeMain");
    const route = el("div", "routeRoute");
    route.textContent = b.origin + " ← " + b.destination;
    main.appendChild(route);

    const sub = el("div", "routeSub");
    sub.appendChild(el("span", null, "🕒 " + fmtTime(b.departure_time)));
    sub.appendChild(el("span", null, "🚌 رقم " + (b.bus_number || "—")));
    sub.appendChild(el("span", null, "💵 " + fmtPrice(b.price)));
    main.appendChild(sub);

    const stat = el("span", "statePill " + pill.cls, pill.text);

    card.appendChild(main);
    card.appendChild(stat);

    if (pill.cls !== "full") {
      card.addEventListener("click", () => selectBus(b));
    }
    return card;
  }

  // ===== Step 2: Count + seat picker =====
  async function selectBus(b) {
    state.selected = b;
    state.pickedSeats = [];
    state.ticketCount = 1;
    setStep("stepSeats");
    $("#seatBusMeta").textContent = b.origin + " ← " + b.destination + " · " + fmtTime(b.departure_time);
    updateCounterUI();
    await refreshSeats();
    startSeatRefresh();
  }

  function startSeatRefresh() {
    stopSeatRefresh();
    state.refreshTimer = setInterval(refreshSeats, 15000);
    window.addEventListener("focus", refreshSeats);
  }
  function stopSeatRefresh() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = null;
    window.removeEventListener("focus", refreshSeats);
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
    // Trim picked seats to fit new count
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
      const map = await api("/api/public/buses/" + state.selected.id + "/seat-map");
      state.seatMap = map;
      // Drop any picked seat that is no longer empty.
      const before = state.pickedSeats.length;
      state.pickedSeats = state.pickedSeats.filter((n) => (map.seats[String(n)] || "empty") === "empty");
      if (state.pickedSeats.length < before) {
        toast("warn", "مقعد أو أكثر من اختيارك أصبح محجوزاً؛ اختر مقاعد بديلة");
      }
      // Cap ticket count to remaining availability
      const max = maxTicketsAllowed();
      if (state.ticketCount > max) state.ticketCount = max;
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
        const ph = el("div", "seatTile door", "🚪");
        ph.disabled = true;
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
    if (idx >= 0) {
      state.pickedSeats.splice(idx, 1);
    } else {
      if (state.pickedSeats.length >= state.ticketCount) {
        // Auto-replace oldest picked seat (drop first, push new)
        // Simpler UX: prevent over-pick and prompt user
        toast("warn", "اختار " + state.ticketCount + " مقعد فقط أو زود العدد");
        return;
      }
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
    if (picked === 0) {
      num.textContent = "—";
    } else {
      num.textContent = state.pickedSeats.map((n) => "#" + n).join("، ");
    }
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
    const priceLine = totalPrice > 0
      ? " · المجموع <b>" + escapeHtml(fmtPrice(totalPrice)) + "</b>"
      : "";
    $("#formSummary").innerHTML =
      "<b>" + escapeHtml(b.origin) + " ← " + escapeHtml(b.destination) + "</b>" +
      " · " + escapeHtml(fmtTime(b.departure_time)) +
      " · <b>" + state.ticketCount + " مقاعد</b> (" + escapeHtml(seatList) + ")" +
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
    if (name.length < 2) { errBox.textContent = "الإسم لازم حرفين على الأقل"; errBox.hidden = false; return; }
    if (!/^[\d+()\-\s]{7,}$/.test(phone)) { errBox.textContent = "رقم الهاتف غير صحيح"; errBox.hidden = false; return; }

    const sel = state.selected;
    if (!sel) { errBox.textContent = "اختار رحلة أولاً"; errBox.hidden = false; return; }

    const seats = state.pickedSeats.slice().sort((a, b) => a - b);
    const total_price = (Number(sel.price) || 0) * seats.length;

    state.booking = {
      bus_id: sel.id,
      booking_ids: [],
      seat_numbers: seats,
      origin: sel.origin,
      destination: sel.destination,
      departure_time: sel.departure_time,
      date: sel.date,
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
    const total = b.total_price != null ? Number(b.total_price) : (Number(b.price) || 0) * (b.seat_numbers?.length || 1);

    const lines = [
      ["أرقام الحجز", "<span class='ref'>" + escapeHtml(refs) + "</span>"],
      ["رقم الرحلة (للموظف)", "<span class='ref'>" + escapeHtml(String(b.bus_id ?? "—")) + "</span>"],
      ["الراكب", escapeHtml(b.name)],
      ["الهاتف", escapeHtml(b.phone)],
      ["الرحلة", escapeHtml(b.origin) + " ← " + escapeHtml(b.destination)],
      ["الموعد", escapeHtml(fmtTime(b.departure_time))],
      ["المقاعد", escapeHtml(seats) + " (" + (b.seat_numbers?.length || 1) + " تذكرة)"],
      ["المجموع المتوقع", escapeHtml(fmtPrice(total))],
      ["الحالة", "طلب من الموقع — أكمل على واتساب"],
    ];
    const recHtml = lines.map(([lbl, val]) =>
      '<div class="row"><span class="lbl">' + lbl + '</span><span class="val">' + val + "</span></div>"
    ).join("");
    $("#receipt").innerHTML = recHtml;

    const wa = waLink(buildConfirmText(b));
    $("#waConfirmBtn").href = wa;
    setStep("stepDone");
  }

  function buildConfirmText(b) {
    const seats = (b.seat_numbers || []).map((n) => "#" + n).join("، ");
    const count = b.seat_numbers?.length || 1;
    const total = b.total_price != null ? Number(b.total_price) : (Number(b.price) || 0) * count;
    return [
      "السلام عليكم ستار باص 🌟",
      `طلب حجز ${count} ${count === 1 ? "تذكرة" : "تذاكر"} من الموقع (يحتاج تأكيد الموظف):`,
      "",
      "رقم الرحلة في النظام: " + String(b.bus_id ?? "—"),
      "الإسم: " + b.name,
      "الهاتف (واتساب): " + b.phone,
      "الرحلة: " + b.origin + " ← " + b.destination,
      "الموعد: " + fmtTime(b.departure_time),
      "المقاعد المطلوبة: " + seats,
      "المجموع المتوقع: " + fmtPrice(total),
      "",
      "ما في رقم حجز بعد — يرجى التأكيد في النظام لو سمحتم.",
      "",
      "شكراً 🙏",
    ].join("\n");
  }

  function waLink(message) {
    const num = state.whatsapp || "";
    const text = encodeURIComponent(message || "السلام عليكم ستار باص");
    if (!num) return "https://wa.me/?text=" + text;
    return "https://wa.me/" + num + "?text=" + text;
  }

  // ===== Init =====
  async function loadConfig() {
    try {
      const cfg = await api("/api/public/config", { timeoutMs: 6000 });
      state.whatsapp = String(cfg.whatsapp || "").replace(/[^\d]/g, "");
    } catch { /* non-fatal */ }
    const waMsg = "السلام عليكم ستار باص، عندي استفسار 🙏";
    const askMsg = "السلام عليكم ستار باص، عندي سؤال 🙏";
    const link = waLink(waMsg);
    const top = $("#topWa");
    if (top) top.href = link;
    const navWa = $("#navWa");
    if (navWa) navWa.href = link;
    const cta = $("#ctaWa");
    if (cta) cta.href = waLink(askMsg);
  }

  function bindBacks() {
    document.querySelectorAll("[data-back]").forEach((b) => {
      b.addEventListener("click", () => {
        const target = b.getAttribute("data-back");
        if (target === "stepRoutes") {
          stopSeatRefresh();
          state.selected = null; state.pickedSeats = []; state.seatMap = null;
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
    $("#cMinus")?.addEventListener("click", () => setTicketCount(state.ticketCount - 1));
    $("#cPlus")?.addEventListener("click", () => setTicketCount(state.ticketCount + 1));
  }

  function initHeroGallery() {
    const wrap = document.querySelector(".hero-gallery");
    if (!wrap) return;
    const imgs = wrap.querySelectorAll("img");
    if (imgs.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    const periodMs = 7000;
    setInterval(() => {
      const next = (i + 1) % imgs.length;
      imgs[i].classList.remove("hero-gallery-active");
      imgs[next].classList.add("hero-gallery-active");
      i = next;
    }, periodMs);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    initHeroGallery();
    bindBacks();
    bindCounter();
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
    await loadConfig();
    await loadRoutes();
  });
})();
