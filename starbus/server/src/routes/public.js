import { Router } from "express";
import { pool } from "../db/pool.js";
import { BUS46_ROWS, BUS46_TOTAL_SEATS } from "../utils/busLayout.js";

const router = Router();

async function timeoutWrap(ms, name, promise) {
  let t;
  try {
    return await Promise.race([
      promise,
      new Promise((_, rej) => {
        t = setTimeout(
          () =>
            rej(Object.assign(new Error(`${name}: timed out after ${ms}ms`), { code: "ETIMEDOUT" })),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(t);
  }
}

// Every /api/public request counts (GET + POST). Stops naive scraping and spammy POSTs.
const GLOBAL_WINDOW_MS = Number(process.env.PUBLIC_GLOBAL_WINDOW_MS || 60_000);
const GLOBAL_MAX = Number(process.env.PUBLIC_GLOBAL_MAX || 120);
const GLOBAL_LIMIT_DISABLED = String(process.env.PUBLIC_GLOBAL_LIMIT_DISABLED || "") === "1";
const globalHits = new Map();

function clientKey(req) {
  return (req.ip || req.socket?.remoteAddress || "unknown").toString();
}

/** Blocks flood of reads or failed POSTs; relaxed enough for normal use + 15s seat refresh. */
function checkPublicGlobalLimit(req, res, next) {
  if (GLOBAL_LIMIT_DISABLED) return next();
  const key = clientKey(req);
  const now = Date.now();
  const arr = (globalHits.get(key) || []).filter((t) => now - t < GLOBAL_WINDOW_MS);
  if (arr.length >= GLOBAL_MAX) {
    return res.status(429).json({ error: "محاولات كثيرة، حاول بعد قليل" });
  }
  arr.push(now);
  globalHits.set(key, arr);
  return next();
}

router.use(checkPublicGlobalLimit);

/** Inclusive: today + this many future days → 7 bookable days when 6. */
const PUBLIC_MAX_SERVICE_DAY_OFFSET = Number(process.env.PUBLIC_MAX_SERVICE_DAY_OFFSET ?? 6);

/** @param {import("express").Request} req */
function parsePublicServiceDay(req) {
  const raw = typeof req.query?.date === "string" ? req.query.date.trim() : "";
  if (!raw) return { ok: true, ymd: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, error: "تاريخ غير صالح" };
  }
  return { ok: true, ymd: raw };
}

async function assertPublicServiceDayAllowed(ymd, maxOff) {
  const [[row]] = await pool.execute(
    `SELECT CASE
       WHEN :bus_day BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL :max_off DAY) THEN 1
       ELSE 0
     END AS ok`,
    { bus_day: ymd, max_off: maxOff }
  );
  return Number(row?.ok) === 1;
}

/** Public config (whatsapp, operational calendar for DB `CURDATE()`). */
router.get("/config", async (_req, res, next) => {
  try {
    const [[row]] = await pool.execute(
      `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS service_today`
    );
    const maxOff = Number.isFinite(PUBLIC_MAX_SERVICE_DAY_OFFSET)
      ? PUBLIC_MAX_SERVICE_DAY_OFFSET
      : 6;
    const raw = String(process.env.WHATSAPP_NUMBER || "").replace(/[^\d]/g, "");
    return res.json({
      whatsapp: raw,
      service_today: row?.service_today ? String(row.service_today) : "",
      max_service_day_offset: maxOff,
    });
  } catch (err) {
    return next(err);
  }
});

/** Available buses for a service day: `?date=YYYY-MM-DD` or default today; max ~7 days ahead. */
router.get("/buses/active", async (req, res, next) => {
  try {
    const parsed = parsePublicServiceDay(req);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const maxOff = Number.isFinite(PUBLIC_MAX_SERVICE_DAY_OFFSET) ? PUBLIC_MAX_SERVICE_DAY_OFFSET : 6;

    let rows;
    if (parsed.ymd) {
      const allowed = await assertPublicServiceDayAllowed(parsed.ymd, maxOff);
      if (!allowed) {
        return res.status(400).json({
          error: "التاريخ خارج نطاق الحجز (اليوم وحتى أسبوع قادم)",
        });
      }
      [rows] = await pool.execute(
        `SELECT
           b.id,
           b.bus_number,
           b.total_seats,
           b.seats_booked,
           (b.total_seats - b.seats_booked) AS seats_remaining,
           b.departure_time,
           b.date,
           b.status,
           r.origin,
           r.destination,
           r.price
         FROM buses b
         JOIN routes r ON r.id = b.route_id
         WHERE b.date = :bus_day
           AND b.date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL :max_off DAY)
           AND b.status = 'scheduled'
           AND r.origin = 'Omdurman'
         ORDER BY r.destination ASC, b.id ASC`,
        { bus_day: parsed.ymd, max_off: maxOff }
      );
    } else {
      [rows] = await pool.execute(
        `SELECT
           b.id,
           b.bus_number,
           b.total_seats,
           b.seats_booked,
           (b.total_seats - b.seats_booked) AS seats_remaining,
           b.departure_time,
           b.date,
           b.status,
           r.origin,
           r.destination,
           r.price
         FROM buses b
         JOIN routes r ON r.id = b.route_id
         WHERE b.date = CURDATE()
           AND b.status = 'scheduled'
           AND r.origin = 'Omdurman'
         ORDER BY r.destination ASC, b.id ASC`
      );
    }
    return res.json({ buses: rows });
  } catch (err) {
    return next(err);
  }
});

/**
 * All أمدرمان lines (`routes`) for a service day, with optional scheduled `buses`.
 * Requires `?date=YYYY-MM-DD`. Customers see route-only rows until workers attach a bus.
 */
router.get("/travel-lines", async (req, res, next) => {
  try {
    const parsed = parsePublicServiceDay(req);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    if (!parsed.ymd) {
      return res.status(400).json({ error: "حدّد تاريخ الرحلة" });
    }

    const maxOff = Number.isFinite(PUBLIC_MAX_SERVICE_DAY_OFFSET) ? PUBLIC_MAX_SERVICE_DAY_OFFSET : 6;
    const allowMs = Number(process.env.TRAVELLINES_ALLOW_SQL_MS || 8000);
    const selectMs = Number(process.env.TRAVELLINES_ROUTE_SQL_MS || 15000);

    const allowed = await timeoutWrap(
      allowMs,
      "travel-lines/allow-window",
      assertPublicServiceDayAllowed(parsed.ymd, maxOff),
    );
    if (!allowed) {
      return res.status(400).json({
        error: "التاريخ خارج نطاق الحجز (اليوم وحتى أسبوع قادم)",
      });
    }

    const q = timeoutWrap(
      selectMs,
      "travel-lines/routes-query",
      pool.execute(
      `SELECT
         r.id AS route_id,
         r.origin,
         r.destination,
         r.price,
         b.id AS bus_id,
         b.bus_number,
         b.total_seats,
         b.seats_booked,
         (b.total_seats - b.seats_booked) AS seats_remaining,
         b.departure_time,
         b.date AS service_date,
         b.status AS bus_status
       FROM routes r
       LEFT JOIN buses b ON b.route_id = r.id
         AND b.date = :bus_day
         AND b.status = 'scheduled'
       WHERE r.origin = 'Omdurman'
       ORDER BY r.destination ASC, b.id ASC`,
        { bus_day: parsed.ymd },
      ),
    );
    const [rows] = await q;

    const items = (rows || []).map((row) => {
      const busIdRaw = row.bus_id;
      const busId = busIdRaw != null ? Number(busIdRaw) : null;
      const ridRaw = row.route_id != null ? Number(row.route_id) : NaN;
      const base = {
        route_id: Number.isFinite(ridRaw) ? ridRaw : null,
        origin: row.origin,
        destination: row.destination,
        price: row.price,
      };
      if (busId != null && Number.isFinite(busId)) {
        let dateStr = parsed.ymd;
        if (row.service_date != null) {
          dateStr = String(row.service_date).split("T")[0];
        }
        return {
          kind: "bookable",
          ...base,
          id: busId,
          bus_number: row.bus_number,
          total_seats: row.total_seats != null ? Number(row.total_seats) : null,
          seats_booked:
            row.seats_booked != null ? Number(row.seats_booked) : 0,
          seats_remaining:
            row.seats_remaining != null ? Number(row.seats_remaining) : 0,
          departure_time: row.departure_time,
          date: dateStr,
          status: row.bus_status || "scheduled",
        };
      }
      return { kind: "route_only", ...base };
    });

    return res.json({ date: parsed.ymd, items });
  } catch (err) {
    return next(err);
  }
});

/**
 * Public seat map — identical structure to worker seat-map but with NO
 * booking_id (privacy). State per seat: empty | reserved | full.
 * Customer view stays in lockstep with the worker view because both read
 * the same `bookings` rows.
 */
router.get("/buses/:id/seat-map", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const parsed = parsePublicServiceDay(req);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const maxOff = Number.isFinite(PUBLIC_MAX_SERVICE_DAY_OFFSET) ? PUBLIC_MAX_SERVICE_DAY_OFFSET : 6;

    /** @type {unknown[]} */
    let busRows;
    if (parsed.ymd) {
      const allowed = await assertPublicServiceDayAllowed(parsed.ymd, maxOff);
      if (!allowed) {
        return res.status(400).json({
          error: "التاريخ خارج نطاق الحجز (اليوم وحتى أسبوع قادم)",
        });
      }
      [busRows] = await pool.execute(
        `SELECT b.id, b.total_seats, b.status, b.date, b.departure_time,
                r.origin, r.destination, r.price
         FROM buses b
         JOIN routes r ON r.id = b.route_id
         WHERE b.id = :id
           AND b.date = :bus_day
           AND b.date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL :max_off DAY)
           AND b.status = 'scheduled'
           AND r.origin = 'Omdurman'
         LIMIT 1`,
        { id, bus_day: parsed.ymd, max_off: maxOff }
      );
    } else {
      [busRows] = await pool.execute(
        `SELECT b.id, b.total_seats, b.status, b.date, b.departure_time,
                r.origin, r.destination, r.price
         FROM buses b
         JOIN routes r ON r.id = b.route_id
         WHERE b.id = :id
           AND b.date = CURDATE()
           AND b.status = 'scheduled'
           AND r.origin = 'Omdurman'
         LIMIT 1`,
        { id }
      );
    }
    const bus = busRows?.[0];
    if (!bus) return res.status(404).json({ error: "الرحلة غير متاحة" });

    const total = Number(bus.total_seats) || BUS46_TOTAL_SEATS;

    const [bookRows] = await pool.execute(
      `SELECT seat_number, lifecycle FROM bookings WHERE bus_id = :id`,
      { id }
    );

    const bySeat = {};
    for (const row of bookRows || []) {
      bySeat[row.seat_number] = row.lifecycle === "reserved" ? "reserved" : "full";
    }

    const seats = {};
    for (let n = 1; n <= total; n++) {
      seats[n] = bySeat[n] || "empty";
    }

    return res.json({
      bus_id: id,
      total_seats: total,
      layout: "46",
      layout_rows: BUS46_ROWS,
      origin: bus.origin,
      destination: bus.destination,
      price: bus.price,
      departure_time: bus.departure_time,
      date: bus.date,
      seats,
    });
  } catch (err) {
    return next(err);
  }
});

/** Only staff (worker UI) may insert DB holds; customers finish on WhatsApp. */
const PUBLIC_RESERVE_DISABLED =
  "الحجز في النظام يتم من الموظف فقط. أرسل تفاصيلك على واتساب ليتم التأكيد.";

router.post("/bookings/reserve", (_req, res) =>
  res.status(403).json({ error: PUBLIC_RESERVE_DISABLED })
);
router.post("/bookings/reserve-bulk", (_req, res) =>
  res.status(403).json({ error: PUBLIC_RESERVE_DISABLED })
);

export default router;
