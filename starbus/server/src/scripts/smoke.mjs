/**
 * Soft-launch smoke checks against a running Starbus API.
 * Usage: npm run smoke
 * Env:   SMOKE_BASE_URL (default http://127.0.0.1:4000), optional SMOKE_EMAIL + SMOKE_PASSWORD
 */
const base = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

async function request(path, { method = "GET", body, token } = {}) {
  const url = base + path;
  const headers = {};
  if (body != null) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { res, data };
}

function fail(msg, extra) {
  console.error("FAIL:", msg, extra ?? "");
  return true;
}

async function main() {
  let bad = false;
  /** @type {string} */
  let smokeServiceDay = "";

  const health = await request("/api/health");
  if (!health.res.ok || !health.data?.ok) {
    bad = fail("/api/health", health.data) || bad;
  } else {
    console.log("OK /api/health");
  }

  const ready = await request("/api/ready");
  if (!ready.res.ok || !ready.data?.ok || !ready.data?.db) {
    bad = fail("/api/ready", ready.data) || bad;
  } else {
    console.log("OK /api/ready (db)");
  }

  const cfg = await request("/api/public/config");
  if (!cfg.res.ok || !cfg.data?.service_today) {
    bad = fail("/api/public/config", cfg.data) || bad;
  } else {
    console.log(
      "OK /api/public/config (service_today=",
      cfg.data.service_today,
      ")",
    );
    const ymd = String(cfg.data.service_today || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) smokeServiceDay = ymd;
    const tlUrl =
      /^\d{4}-\d{2}-\d{2}$/.test(ymd)
        ? `/api/public/travel-lines?date=${encodeURIComponent(ymd)}`
        : null;
    if (tlUrl) {
      const tl = await request(tlUrl);
      if (!tl.res.ok || !Array.isArray(tl.data?.items)) {
        bad = fail("/api/public/travel-lines", tl.data) || bad;
      } else {
        const book = tl.data.items.filter((x) => x?.kind === "bookable").length;
        const lines = tl.data.items.length;
        console.log(`OK /api/public/travel-lines (${lines} rows, ${book} bookable)`);
      }
    }
  }

  const buses = await request("/api/public/buses/active");
  if (!buses.res.ok) {
    bad = fail("/api/public/buses/active", buses.data) || bad;
  } else {
    const n = buses.data?.buses?.length ?? 0;
    console.log(`OK /api/public/buses/active (${n} buses)`);
    if (
      typeof process.env.SMOKE_FETCH_SEATMAP === "string" &&
      process.env.SMOKE_FETCH_SEATMAP === "1" &&
      n > 0
    ) {
      const id = buses.data.buses[0].id;
      const q =
        smokeServiceDay &&
        `/api/public/buses/${id}/seat-map?date=${encodeURIComponent(smokeServiceDay)}`;
      const mpPath = q || `/api/public/buses/${id}/seat-map`;
      const mp = await request(mpPath);
      if (!mp.res.ok || !mp.data?.seats) {
        bad = fail("/api/public/buses/:id/seat-map", mp.data) || bad;
      } else {
        console.log("OK /api/public/buses/:id/seat-map");
      }
    }
  }

  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;
  if (email && password) {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (!login.res.ok || !login.data?.token) {
      bad = fail("/api/auth/login", login.data) || bad;
    } else {
      console.log("OK /api/auth/login");
      const me = await request("/api/auth/me", { token: login.data.token });
      if (!me.res.ok) {
        bad = fail("/api/auth/me", me.data) || bad;
      } else {
        console.log("OK /api/auth/me");
      }
    }
  } else {
    console.log("SKIP /api/auth/login (set SMOKE_EMAIL and SMOKE_PASSWORD to test JWT)");
  }

  if (bad) {
    console.error("\nSmoke test failed. Is the server running at", base, "?");
    process.exit(1);
  }
  console.log("\nSmoke test passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
