const API_BASE = "";

function $(sel) {
  return document.querySelector(sel);
}
function fmtTime(isoOrStr) {
  const d = new Date(isoOrStr);
  if (Number.isNaN(d.getTime())) return String(isoOrStr || "");
  return d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(isoOrStr) {
  const d = new Date(isoOrStr);
  if (Number.isNaN(d.getTime())) return String(isoOrStr || "");
  return d.toLocaleDateString("ar");
}

function todayLocalYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ROLE_AR = {
  worker: "موظف",
  admin: "أدمن",
  superadmin: "سوبر أدمن",
};
function roleAr(r) {
  return ROLE_AR[String(r || "").toLowerCase()] || String(r || "");
}

const LIFECYCLE_AR = {
  reserved: "محجوز مؤقت",
  full: "محجوز",
  empty: "فارغ",
};
const PAY_AR = {
  paid: "مدفوع",
  half: "نصف",
  unpaid: "غير مدفوع",
};
const BUS_STATUS_AR = {
  scheduled: "مجدولة",
  in_transit: "جارية",
  completed: "اكتملت",
  cancelled: "ملغاة",
};

function routeLabelFromBooking(r) {
  const from = String(r?.from_location || "").trim();
  const to = String(r?.to_location || "").trim();
  if (from && to) return `${from} ← ${to}`;
  const ro = String(r?.route_origin || "").trim();
  const rd = String(r?.route_destination || "").trim();
  if (ro && rd) return `${ro} ← ${rd}`;
  return "—";
}

function getToken() {
  return localStorage.getItem("starbus_token") || "";
}
function setToken(token) {
  if (token) localStorage.setItem("starbus_token", token);
  else localStorage.removeItem("starbus_token");
}
function getUser() {
  const raw = localStorage.getItem("starbus_user");
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function setUser(user) {
  if (user) localStorage.setItem("starbus_user", JSON.stringify(user));
  else localStorage.removeItem("starbus_user");
}

async function api(path, { method = "GET", body, token = getToken(), timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = data?.error || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

let _toastTimer = null;
function showToast(kind, msg) {
  const el = $("#toast");
  if (!el) return;
  el.classList.remove("ok", "warn", "dangerText", "danger");
  if (kind === "ok") el.classList.add("ok");
  if (kind === "warn") el.classList.add("warn");
  if (kind === "danger") el.classList.add("danger");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

function setAuthUI() {
  const user = getUser();
  const token = getToken();
  const btn = $("#logoutBtn");
  const loginNav = $("#loginNavBtn");
  if (btn) btn.hidden = !(user && token);
  if (loginNav) loginNav.hidden = !!(user && token);
}

async function initLogin() {
  const form = $("#loginForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#loginBtn").disabled = true;
    try {
      const email = $("#email").value.trim();
      const password = $("#password").value;
      const out = await api("/api/auth/login", { method: "POST", body: { email, password } });
      setToken(out.token);
      setUser(out.user);
      setAuthUI();
      showToast("ok", "تم الدخول");
      setTimeout(() => location.reload(), 350);
    } catch (err) {
      showToast("danger", err.message || "فشل الدخول");
    } finally {
      $("#loginBtn").disabled = false;
    }
  });
}

async function loadBus(busId) {
  return api(`/api/buses/${busId}`, { timeoutMs: 12000 });
}
async function loadActiveBuses(serviceDayYmd) {
  const qs =
    serviceDayYmd && /^\d{4}-\d{2}-\d{2}$/.test(serviceDayYmd)
      ? `?date=${encodeURIComponent(serviceDayYmd)}`
      : "";
  return api(`/api/buses/active${qs}`, { timeoutMs: 12000 });
}
async function loadSeatMap(busId) {
  return api(`/api/buses/${busId}/seat-map`, { timeoutMs: 12000 });
}
async function loadBookings(busId) {
  return api(`/api/bookings/bus/${busId}`, { timeoutMs: 12000 });
}

const WORKER_BOOTH_ROLES = ["worker", "superadmin"];

function workerGuestLockHtml() {
  return `سجل دخول بحساب <span class="pill">موظف</span> أو <span class="pill">سوبر أدمن</span> عشان تشتغل على المقاعد والحجوزات.`;
}

function applyWorkerBoothVisibility({ canUseBooth, wrongRole } = {}) {
  const login = $("#workerLoginCard");
  const lock = $("#workerLock");
  const route = $("#workerRouteCard");
  const map = $("#workerMapCard");
  const recent = $("#workerRecentCard");
  const lockBody = $("#workerLockBody");

  if (canUseBooth) {
    if (login) login.hidden = true;
    if (lock) lock.hidden = true;
    if (route) route.hidden = false;
    if (map) map.hidden = false;
    if (recent) recent.hidden = false;
    return;
  }

  if (login) login.hidden = !!wrongRole;
  if (lock) lock.hidden = false;
  if (route) route.hidden = true;
  if (map) map.hidden = true;
  if (recent) recent.hidden = true;

  if (lockBody) {
    if (wrongRole) {
      const name = escapeHtml(wrongRole.name || "");
      const roleLabel = escapeHtml(roleAr(wrongRole.role) || wrongRole.role || "");
      lockBody.innerHTML = `أنت داخل بحساب <span class="pill">${name}</span> (${roleLabel}). شباك التذاكر يحتاج <span class="pill">موظف</span> أو <span class="pill">سوبر أدمن</span>. روح <a href="/admin" style="color: var(--brand);">الأدمن</a> أو سجل خروج.`;
    } else {
      lockBody.innerHTML = workerGuestLockHtml();
    }
  }
}

function statePillHtml(life) {
  const k = String(life || "full");
  const label = LIFECYCLE_AR[k] || k;
  return `<span class="statePill ${escapeHtml(k)}">${escapeHtml(label)}</span>`;
}
function payPillHtml(p) {
  const k = String(p || "");
  const label = PAY_AR[k] || k;
  return `<span class="payPill ${escapeHtml(k)}">${escapeHtml(label)}</span>`;
}

function renderBookings(rows) {
  const tbody = $("#bookingsBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    const routeLabel = routeLabelFromBooking({
      ...r,
      route_origin: r.route_origin ?? r.origin,
      route_destination: r.route_destination ?? r.destination,
    });
    const dateTime = `${fmtDate(r.created_at)} ${fmtTime(r.created_at)}`;
    const life = r.lifecycle || "full";
    const name = r.passenger_name ? escapeHtml(r.passenger_name) : "—";
    tr.innerHTML = `
      <td class="mono">#${r.id}</td>
      <td class="mono">${r.seat_number}</td>
      <td>${statePillHtml(life)}</td>
      <td>${name}</td>
      <td>${escapeHtml(routeLabel)}</td>
      <td>${payPillHtml(r.payment_status)}</td>
      <td class="mono">${escapeHtml(dateTime)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderBusSeatRowsMulti(map, pickedArr, onPick) {
  const container = $("#busRows");
  if (!container || !map?.layout_rows) return;

  const picked = new Set(pickedArr || []);

  function tile(n) {
    const st = map.seats[String(n)] || map.seats[n] || "empty";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `seatTile ${st}`;
    btn.textContent = String(n);
    if (st === "full") btn.disabled = true;
    if (picked.has(n)) btn.classList.add("picked");
    btn.addEventListener("click", () => onPick(n, st));
    return btn;
  }

  function pair(nums) {
    const wrap = document.createElement("div");
    wrap.className = "busPair";
    if (!nums || !nums.length) {
      wrap.style.minWidth = "92px";
      wrap.innerHTML = '<span class="muted" style="font-size:10px;">باب</span>';
      return wrap;
    }
    for (const n of nums) wrap.appendChild(tile(n));
    return wrap;
  }

  container.innerHTML = "";
  for (const row of map.layout_rows) {
    const div = document.createElement("div");
    div.className = "busRow";
    div.appendChild(pair(row.left));
    const aisle = document.createElement("div");
    aisle.className = "busAisle";
    div.appendChild(aisle);
    div.appendChild(pair(row.right));
    container.appendChild(div);
  }
}

async function initWorkerPage() {
  const workerRoot = $("#workerRoot");
  const isWorkerPage = !!workerRoot && !!$("#workerMapCard");
  if (!isWorkerPage) return;

  setAuthUI();
  const user = getUser();
  const token = getToken();

  if (!token || !user) {
    applyWorkerBoothVisibility({ canUseBooth: false });
    return;
  }
  const roleNorm = String(user.role || "").toLowerCase();
  if (!WORKER_BOOTH_ROLES.includes(roleNorm)) {
    applyWorkerBoothVisibility({ canUseBooth: false, wrongRole: { name: user.name, role: user.role } });
    return;
  }

  applyWorkerBoothVisibility({ canUseBooth: true });

  try {
    const me = await api("/api/auth/me", { timeoutMs: 8000 });
    if (me?.user) setUser(me.user);
    setAuthUI();
  } catch {
    setToken("");
    setUser(null);
    setAuthUI();
    applyWorkerBoothVisibility({ canUseBooth: false });
    showToast("danger", "الجلسة غير صحيحة، سجل دخول من جديد.");
    return;
  }

  let selectedBusId = null;
  let pickedSeats = [];
  let ticketCount = 1;
  const WORKER_MAX_TICKETS = 20;

  function pickedListLabel() {
    if (!pickedSeats.length) return "—";
    return pickedSeats.map((n) => `#${n}`).join("، ");
  }

  function setPicked() {
    const lblLegend = $("#pickedLabel");
    const summary = $("#pickedSummaryText");
    const hint = $("#formSeatHint");
    const act = $("#workerActions");

    if (lblLegend) lblLegend.textContent = `اخترت ${pickedSeats.length} من ${ticketCount}`;

    if (summary) {
      if (!pickedSeats.length) {
        summary.textContent = "اختار مقعد للبدء";
      } else {
        summary.innerHTML = `اخترت <b>${pickedSeats.length}</b> من <b>${ticketCount}</b><span class="seatList">${escapeHtml(pickedListLabel())}</span>`;
      }
    }
    if (hint) {
      hint.textContent = pickedSeats.length
        ? `مقاعد ${pickedListLabel()}`
        : "مقعد —";
    }
    if (act) act.hidden = pickedSeats.length === 0;

    const resBlock = $("#reserveContactBlock");
    if (resBlock) resBlock.hidden = pickedSeats.length === 0;

    const ready = pickedSeats.length > 0 && pickedSeats.length === ticketCount;
    const r = $("#btnReserve");
    const f = $("#btnFocusFull");
    if (r) r.disabled = !ready;
    if (f) f.disabled = !ready;
    const bb = $("#bookBtn");
    if (bb) bb.disabled = !ready;
  }

  function clearPicked() {
    pickedSeats = [];
    if ($("#rname")) $("#rname").value = "";
    if ($("#rphone")) $("#rphone").value = "";
    if ($("#remail")) $("#remail").value = "";
    setPicked();
  }

  function updateCounterUI() {
    const num = $("#cntNum");
    const minus = $("#cntMinus");
    const plus = $("#cntPlus");
    if (num) num.textContent = String(ticketCount);
    if (minus) minus.disabled = ticketCount <= 1;
    if (plus) plus.disabled = ticketCount >= WORKER_MAX_TICKETS;
    if (pickedSeats.length > ticketCount) {
      pickedSeats = pickedSeats.slice(0, ticketCount);
    }
    setPicked();
  }

  function setTicketCount(n) {
    ticketCount = Math.max(1, Math.min(WORKER_MAX_TICKETS, n));
    updateCounterUI();
  }

  function openBookForm() {
    const wrap = $("#bookFormWrap");
    if (wrap) wrap.classList.remove("collapsed");
  }
  function toggleBookForm() {
    const wrap = $("#bookFormWrap");
    if (wrap) wrap.classList.toggle("collapsed");
  }

  async function populateRoutes() {
    const sel = $("#routeSelect");
    if (!sel) return;
    const prevVal = sel.value;
    sel.innerHTML = `<option value="">جاري التحميل…</option>`;
    sel.disabled = true;
    let buses = [];
    try {
      const out = await loadActiveBuses();
      buses = out.buses || [];
    } catch (err) {
      const hint =
        err.status === 401
          ? "انتهت الجلسة — سجل دخول"
          : err.message || "ما قدرنا نحمل الباصات";
      sel.innerHTML = `<option value="">${escapeHtml(hint)}</option>`;
      sel.disabled = true;
      throw err;
    }

    sel.innerHTML = "";
    if (!buses.length) {
      sel.innerHTML = `<option value="">ما في باصات اليوم</option>`;
      sel.disabled = true;
      return;
    }
    for (const b of buses) {
      const opt = document.createElement("option");
      opt.value = String(b.id);
      opt.textContent = `${b.origin} ← ${b.destination} (باص ${b.bus_number})`;
      sel.appendChild(opt);
    }
    sel.disabled = false;
    const saved = localStorage.getItem("starbus_selected_bus");
    const keep =
      buses.find((x) => String(x.id) === prevVal) ||
      buses.find((x) => String(x.id) === saved) ||
      buses[0];
    sel.value = String(keep.id);
    selectedBusId = Number(sel.value);
  }

  async function refresh() {
    $("#refreshBtn")?.setAttribute("disabled", "disabled");
    try {
      await populateRoutes();
      const sel = $("#routeSelect");
      if (sel && !sel.disabled) selectedBusId = Number(sel.value);
      if (!Number.isFinite(selectedBusId) || selectedBusId <= 0) return;

      localStorage.setItem("starbus_selected_bus", String(selectedBusId));

      const [map, busOut, bookingsOut] = await Promise.all([
        loadSeatMap(selectedBusId),
        loadBus(selectedBusId),
        loadBookings(selectedBusId),
      ]);

      const bus = busOut.bus;
      if ($("#busMeta"))
        $("#busMeta").textContent = `${bus.origin} ← ${bus.destination} · باص #${bus.bus_number} · ${bus.departure_time} · ${bus.date}`;

      let empty = 0;
      let reserved = 0;
      let full = 0;
      const total = Number(map.total_seats) || 46;
      for (let i = 1; i <= total; i++) {
        const st = map.seats[String(i)] || "empty";
        if (st === "empty") empty++;
        else if (st === "reserved") reserved++;
        else full++;
      }
      if ($("#cntEmpty")) $("#cntEmpty").textContent = String(empty);
      if ($("#cntReserved")) $("#cntReserved").textContent = String(reserved);
      if ($("#cntFull")) $("#cntFull").textContent = String(full);
      if ($("#busStatus")) {
        const k = String(bus.status || "").toLowerCase();
        $("#busStatus").textContent = BUS_STATUS_AR[k] || k || "—";
      }

      const fromLoc = $("#fromLoc");
      const toLoc = $("#toLoc");
      if (fromLoc) fromLoc.value = bus.origin;
      if (toLoc) toLoc.value = bus.destination;

      function paintMap() {
        renderBusSeatRowsMulti(map, pickedSeats, (n, st) => {
          if (st === "full") return;
          const idx = pickedSeats.indexOf(n);
          if (idx >= 0) {
            pickedSeats.splice(idx, 1);
          } else {
            if (pickedSeats.length >= ticketCount) {
              showToast("warn", `اخترت ${ticketCount} تذكرة، زود العدد أو ألغ مقعد`);
              return;
            }
            pickedSeats.push(n);
          }
          setPicked();
          paintMap();
        });
      }
      paintMap();

      renderBookings((bookingsOut.bookings || []).slice(0, 40));
    } catch (err) {
      if (err.status === 401) {
        setToken("");
        setUser(null);
        setAuthUI();
        applyWorkerBoothVisibility({ canUseBooth: false });
        showToast("danger", "انتهت الجلسة. سجل دخول من جديد.");
      } else {
        showToast("warn", err.message || "فشل التحديث");
      }
    } finally {
      $("#refreshBtn")?.removeAttribute("disabled");
    }
  }

  $("#routeSelect")?.addEventListener("change", () => {
    selectedBusId = Number($("#routeSelect").value);
    clearPicked();
    refresh();
  });

  $("#refreshBtn")?.addEventListener("click", refresh);

  $("#cntMinus")?.addEventListener("click", () => setTicketCount(ticketCount - 1));
  $("#cntPlus")?.addEventListener("click", () => setTicketCount(ticketCount + 1));
  updateCounterUI();

  $("#bookFormHeader")?.addEventListener("click", toggleBookForm);

  $("#btnReserve")?.addEventListener("click", async () => {
    if (!selectedBusId || pickedSeats.length === 0) return;
    if (pickedSeats.length !== ticketCount) {
      showToast("warn", `اختار ${ticketCount} مقعد بالظبط`);
      return;
    }
    const name = $("#rname").value.trim();
    const phone = ($("#rphone")?.value || "").trim();
    const email = ($("#remail")?.value || "").trim();
    if (name.length < 2) {
      showToast("warn", "اكتب اسم الراكب");
      $("#rname")?.focus();
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 7 && !email) {
      showToast("warn", "اكتب هاتف أو بريد");
      $("#rphone")?.focus();
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("warn", "البريد مش صحيح");
      $("#remail")?.focus();
      return;
    }
    $("#btnReserve").disabled = true;
    try {
      const seats = pickedSeats.slice().sort((a, b) => a - b);
      await api("/api/bookings/reserve-bulk", {
        method: "POST",
        body: {
          bus_id: selectedBusId,
          seat_numbers: seats,
          passenger_name: name,
          passenger_phone: phone,
          passenger_email: email,
        },
        timeoutMs: 18000,
      });
      showToast(
        "ok",
        seats.length === 1 ? "تم الحجز المؤقت" : `تم حجز ${seats.length} مقاعد مؤقتاً`
      );
      clearPicked();
      await refresh();
    } catch (err) {
      showToast("danger", err.message || "فشل الحجز المؤقت");
    } finally {
      $("#btnReserve").disabled = false;
    }
  });

  $("#btnFocusFull")?.addEventListener("click", () => {
    if (pickedSeats.length !== ticketCount) {
      showToast("warn", `اختار ${ticketCount} مقعد بالظبط`);
      return;
    }
    openBookForm();
    $("#bookFormWrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("#pname")?.focus(), 250);
  });

  $("#bookForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedBusId || pickedSeats.length === 0) {
      showToast("warn", "اختار مقعد من الخريطة أولاً");
      return;
    }
    if (pickedSeats.length !== ticketCount) {
      showToast("warn", `اختار ${ticketCount} مقعد بالظبط`);
      return;
    }
    $("#bookBtn").disabled = true;
    try {
      const seats = pickedSeats.slice().sort((a, b) => a - b);
      await api("/api/bookings/full-bulk", {
        method: "POST",
        body: {
          bus_id: selectedBusId,
          seat_numbers: seats,
          passenger_name: $("#pname").value.trim(),
          passenger_phone: ($("#pphone")?.value || "").trim(),
          passenger_email: ($("#pemail")?.value || "").trim(),
          from_location: $("#fromLoc").value.trim(),
          to_location: $("#toLoc").value.trim(),
          booking_type: "booth",
          payment_status: $("#pay").value,
        },
        timeoutMs: 22000,
      });
      showToast(
        "ok",
        seats.length === 1
          ? "تم حفظ الحجز الكامل"
          : `تم حفظ ${seats.length} حجوزات (مجموعة)`
      );
      $("#pname").value = "";
      if ($("#pphone")) $("#pphone").value = "";
      if ($("#pemail")) $("#pemail").value = "";
      clearPicked();
      $("#bookFormWrap")?.classList.add("collapsed");
      await refresh();
    } catch (err) {
      showToast("danger", err.message || "فشل الحفظ");
    } finally {
      $("#bookBtn").disabled = false;
    }
  });

  await refresh();
}

async function initAdminPage() {
  const adminRoot = $("#adminRoot");
  const isAdminPage = !!adminRoot && !!$("#adminBody");
  if (!isAdminPage) return;

  setAuthUI();
  const user = getUser();
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    if ($("#adminLock")) $("#adminLock").hidden = false;
    return;
  }

  if ($("#adminAnalyticsDeck")) $("#adminAnalyticsDeck").hidden = false;

  const isSuper = user.role === "superadmin";
  let adminBusId = null;

  async function populateAdminRoutes() {
    const sel = $("#adminRouteSelect");
    if (!sel) return;
    const prev = sel.value;
    const day = $("#day")?.value || todayLocalYmd();
    const out = await loadActiveBuses(day);
    const buses = out.buses || [];
    sel.innerHTML = "";
    adminBusId = null;
    if (!buses.length) {
      sel.innerHTML = `<option value="">ما في باصات اليوم</option>`;
      sel.disabled = true;
      return;
    }
    for (const b of buses) {
      const opt = document.createElement("option");
      opt.value = String(b.id);
      opt.textContent = `${b.origin} ← ${b.destination} (باص ${b.bus_number})`;
      sel.appendChild(opt);
    }
    sel.disabled = false;
    const keep = buses.find((x) => String(x.id) === prev) || buses[0];
    sel.value = String(keep.id);
    adminBusId = Number(sel.value);
  }

  function setOvText(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  /** @param {{ date?: string }} [opts] */
  function formatReportDateLine(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(`${iso}T12:00:00`);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("ar", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return String(iso);
    }
  }

  function fillStackedBar(hostId, parts, labelsRowId) {
    const host = document.getElementById(hostId);
    const labels = labelsRowId ? document.getElementById(labelsRowId) : null;
    if (!host) return;
    host.innerHTML = "";
    if (labels) labels.innerHTML = "";
    const total = parts.reduce((a, p) => a + (Number(p.value) || 0), 0);
    if (total <= 0) {
      host.innerHTML = `<div class="stack-seg stack-empty" style="width:100%"></div>`;
      return;
    }
    for (const p of parts) {
      const w = Math.max(0.75, ((Number(p.value) || 0) / total) * 100);
      const seg = document.createElement("div");
      seg.className = `stack-seg ${p.className || ""}`;
      seg.style.width = `${w}%`;
      seg.title = `${p.label}: ${p.value}`;
      host.appendChild(seg);
    }
    if (labels) {
      for (const p of parts) {
        const pct = Math.round((((Number(p.value) || 0) / total) * 100 + Number.EPSILON) * 10) / 10;
        const li = document.createElement("span");
        li.className = "meter-legend-item";
        li.innerHTML = `<i class="dot ${p.className || ""}" aria-hidden="true"></i> ${escapeHtml(p.label)} <b>${pct}%</b> (${escapeHtml(String(p.value))})`;
        labels.appendChild(li);
      }
    }
  }

  function renderAdminOverview(ov) {
    if (!$("#adminAnalyticsDeck")) return;
    const dash = "—";

    const fleet = ov?.fleet_day;
    const dt = ov?.day_totals;
    const destinations = ov?.by_destination || [];
    const trend = ov?.trend || [];

    if (!fleet || !dt) {
      setOvText("ovDayBookings", dash);
      setOvText("ovDayPaid", dash);
      setOvText("ovDayOnline", dash);
      setOvText("ovFleetOccupancy", dash);
      setOvText("fleetCountHead", dash);
      const rails = document.getElementById("fleetRails");
      if (rails) rails.innerHTML = `<p class="muted">ما في بيانات</p>`;
      const tb = document.getElementById("trendBars");
      if (tb) tb.innerHTML = "";
      const rm = document.getElementById("routeMix");
      if (rm) rm.innerHTML = "";
      fillStackedBar("meterPay", [], "meterPayLeg");
      fillStackedBar("meterLife", [], "meterLifeLeg");
      fillStackedBar("meterChan", [], "meterChanLeg");
      return;
    }

    setOvText("adminReportDate", formatReportDateLine(ov.date));
    setOvText("ovDayBookings", String(dt.bookings_count ?? 0));
    setOvText("ovDayPaid", String(dt.paid_count ?? 0));
    const bookN = Number(dt.bookings_count) || 0;
    const onN = Number(dt.online_count) || 0;
    const onPct = bookN > 0 ? Math.round((onN / bookN) * 1000) / 10 : 0;
    setOvText("ovDayOnline", bookN ? `${onPct}%` : "0%");
    const fr = fleet.fill_ratio_pct;
    setOvText("ovFleetOccupancy", fr != null ? `${fr}%` : dash);
    setOvText("fleetCountHead", String(fleet.buses_on_network ?? 0));

    const rails = document.getElementById("fleetRails");
    if (rails) {
      rails.innerHTML = "";
      const list = fleet.buses || [];
      if (!list.length) {
        rails.innerHTML = `<p class="muted">ما في رحلات مجدولة ليوم ${escapeHtml(ov.date)}.</p>`;
      } else {
        for (const b of list) {
          const cap = Number(b.total_seats) || 0;
          const bk = Math.min(Number(b.seats_booked) || 0, cap);
          const pct = cap > 0 ? Math.round((bk / cap) * 1000) / 10 : 0;
          const art = document.createElement("article");
          art.className = "fleet-card";
          art.innerHTML = `
            <div class="fleet-ring" style="--occ:${Math.min(100, Math.max(0, pct))}" role="img" aria-label="نسبة الإشغال ${pct}%"></div>
            <div class="fleet-card-body">
              <div class="fleet-dest">${escapeHtml(b.destination || "—")}</div>
              <div class="fleet-sub mono">باص ${escapeHtml(String(b.bus_number))} · ${bk}/${cap} مقعد</div>
            </div>
          `;
          rails.appendChild(art);
        }
      }
    }

    const tb = document.getElementById("trendBars");
    if (tb) {
      tb.innerHTML = "";
      const maxB = Math.max(1, ...trend.map((t) => Number(t.bookings) || 0));
      for (const row of trend) {
        const n = Number(row.bookings) || 0;
        const h = Math.round((n / maxB) * 100);
        const col = document.createElement("div");
        col.className = "trend-col";
        const label = String(row.date || "").slice(8, 10);
        col.innerHTML = `
          <div class="trend-bar" style="height:${h}%"></div>
          <div class="trend-lbl mono">${escapeHtml(label)}</div>
        `;
        col.title = `${row.date}: ${n} حجز`;
        tb.appendChild(col);
      }
    }

    const rm = document.getElementById("routeMix");
    if (rm) {
      rm.innerHTML = "";
      const maxR = Math.max(1, ...destinations.map((r) => Number(r.bookings_count) || 0));
      const top = destinations.slice(0, 8);
      if (!top.length) {
        rm.innerHTML = `<p class="muted">لا حجوزات مسجّلة في التاريخ المختار.</p>`;
      } else {
        for (const r of top) {
          const c = Number(r.bookings_count) || 0;
          const w = Math.round((c / maxR) * 100);
          const row = document.createElement("div");
          row.className = "route-mix-row";
          row.innerHTML = `
            <div class="route-name">${escapeHtml(r.destination || "—")}</div>
            <div class="route-bar-wrap" aria-hidden="true"><div class="route-bar" style="width:${w}%"></div></div>
            <div class="route-n mono">${c}</div>
          `;
          rm.appendChild(row);
        }
      }
    }

    fillStackedBar(
      "meterPay",
      [
        { className: "pay-paid", value: dt.paid_count, label: "مدفوع" },
        { className: "pay-half", value: dt.half_count, label: "نصف" },
        { className: "pay-unpaid", value: dt.unpaid_count, label: "غير مدفوع" },
      ],
      "meterPayLeg"
    );
    fillStackedBar(
      "meterLife",
      [
        { className: "life-res", value: dt.reserved_count, label: "محجوز مؤقت" },
        { className: "life-full", value: dt.full_count, label: "محجوز" },
      ],
      "meterLifeLeg"
    );
    fillStackedBar(
      "meterChan",
      [
        { className: "ch-online", value: dt.online_count, label: "أونلاين" },
        { className: "ch-booth", value: dt.booth_count, label: "شباك" },
      ],
      "meterChanLeg"
    );
  }

  async function refreshOverview(day) {
    try {
      const ov = await api(`/api/reports/overview?date=${encodeURIComponent(day)}&days=14`, {
        timeoutMs: 14000,
      });
      renderAdminOverview(ov);
    } catch {
      renderAdminOverview(null);
    }
  }

  async function refresh() {
    $("#adminRefreshBtn").disabled = true;
    try {
      const day = $("#day").value || todayLocalYmd();
      await populateAdminRoutes();
      await refreshOverview(day);

      const qsBus = adminBusId ? `&bus_id=${adminBusId}` : "";
      const out = await api(`/api/reports/daily?date=${encodeURIComponent(day)}${qsBus}&limit=200`, {
        timeoutMs: 14000,
      });
      $("#dayLabel").textContent = out.date;
      const scopeEl = $("#adminScopeBadge");
      if (scopeEl) {
        scopeEl.textContent = adminBusId
          ? "الأرقام التحت لفلتر: الباص المختار والجدول"
          : "الأرقام التحت: كل خطوط نفس اليوم (ما في باص محدد)";
      }
      const s = out.summary || {};
      $("#kpiBookings").textContent = String(s.bookings_count ?? 0);
      if ($("#kpiReserved")) $("#kpiReserved").textContent = String(s.reserved_count ?? 0);
      if ($("#kpiFull")) $("#kpiFull").textContent = String(s.full_count ?? 0);
      $("#kpiPaid").textContent = String(s.paid_count ?? 0);
      if ($("#kpiHalf")) $("#kpiHalf").textContent = String(s.half_count ?? 0);
      $("#kpiUnpaid").textContent = String(s.unpaid_count ?? 0);

      const tbody = $("#adminBody");
      tbody.innerHTML = "";
      for (const r of out.bookings || []) {
        const tr = document.createElement("tr");
        const routeLabel = routeLabelFromBooking(r);
        const dateTime = `${fmtDate(r.created_at)} ${fmtTime(r.created_at)}`;
        const life = r.lifecycle || "full";
        const name = r.passenger_name ? escapeHtml(r.passenger_name) : "—";
        const cancelTd = isSuper
          ? `<td><button type="button" class="danger cancel-booking" data-id="${r.id}" style="padding:6px 12px;width:auto;font-size:12px;">إلغاء</button></td>`
          : `<td class="muted">—</td>`;
        tr.innerHTML = `
          <td class="mono">#${r.id}</td>
          <td class="mono">${r.seat_number}</td>
          <td>${statePillHtml(life)}</td>
          <td>${name}</td>
          <td>${escapeHtml(routeLabel)}</td>
          <td>${payPillHtml(r.payment_status)}</td>
          <td class="mono">${escapeHtml(dateTime)}</td>
          ${cancelTd}
        `;
        tbody.appendChild(tr);
      }

      tbody.querySelectorAll(".cancel-booking").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          if (!id || !confirm("إلغاء الحجز وتحرير المقعد؟")) return;
          btn.disabled = true;
          try {
            await api(`/api/bookings/${id}`, { method: "DELETE", timeoutMs: 15000 });
            await refresh();
          } catch (err) {
            showToast("danger", err.message || "فشل الإلغاء");
          } finally {
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      if (err.status === 401) {
        setToken("");
        setUser(null);
        showToast("danger", "انتهت الجلسة. سجل دخول من جديد.");
      } else {
        showToast("warn", err.message || "فشل التحديث");
      }
    } finally {
      $("#adminRefreshBtn").disabled = false;
    }
  }

  $("#adminRouteSelect")?.addEventListener("change", refresh);
  $("#adminRefreshBtn").addEventListener("click", refresh);
  $("#day")?.addEventListener("change", refresh);
  $("#day").value = todayLocalYmd();
  await refresh();
}

function initLogout() {
  const btn = $("#logoutBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    setToken("");
    setUser(null);
    location.href = "/worker";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initLogout();
  initLogin();
  initWorkerPage();
  initAdminPage();
});
