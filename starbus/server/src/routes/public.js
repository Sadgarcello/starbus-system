import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { BUS46_ROWS, BUS46_TOTAL_SEATS } from "../utils/busLayout.js";

const router = Router();

// In-memory IP rate limit (single-process, soft-launch friendly).
// Configurable via env. Set RESERVE_RATE_LIMIT_DISABLED=1 to disable entirely (dev/testing).
const RESERVE_WINDOW_MS = Number(process.env.RESERVE_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const RESERVE_MAX = Number(process.env.RESERVE_RATE_LIMIT_MAX || 12);
const RESERVE_LIMIT_DISABLED = String(process.env.RESERVE_RATE_LIMIT_DISABLED || "") === "1";
const reserveHits = new Map();

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

/** Pre-check (rejects if already over limit). Only counts hits AFTER a successful reserve. */
function checkReserveLimit(req, res, next) {
  if (RESERVE_LIMIT_DISABLED) return next();
  const key = clientKey(req);
  const now = Date.now();
  const arr = (reserveHits.get(key) || []).filter((t) => now - t < RESERVE_WINDOW_MS);
  if (arr.length >= RESERVE_MAX) {
    return res.status(429).json({ error: "محاولات كثيرة، حاول بعد قليل" });
  }
  reserveHits.set(key, arr);
  return next();
}

/** Record a successful reserve — failed attempts (400/409) do NOT count toward the limit. */
function recordReserveHit(req) {
  if (RESERVE_LIMIT_DISABLED) return;
  const key = clientKey(req);
  const now = Date.now();
  const arr = (reserveHits.get(key) || []).filter((t) => now - t < RESERVE_WINDOW_MS);
  arr.push(now);
  reserveHits.set(key, arr);
}

let onlineUserIdCache = null;
async function getOnlineUserId() {
  if (onlineUserIdCache) return onlineUserIdCache;
  const [rows] = await pool.execute(
    `SELECT id FROM users WHERE email = 'online@starbus.sd' LIMIT 1`
  );
  const id = rows?.[0]?.id;
  if (!id) throw new Error("Online channel user not configured");
  onlineUserIdCache = id;
  return id;
}

/** Public config (whatsapp number etc) — never expose secrets. */
router.get("/config", (_req, res) => {
  const raw = String(process.env.WHATSAPP_NUMBER || "").replace(/[^\d]/g, "");
  return res.json({ whatsapp: raw });
});

/** Today's available buses — same filter as worker /active. */
router.get("/buses/active", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
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
    return res.json({ buses: rows });
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

    const [busRows] = await pool.execute(
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

const reserveSchema = z.object({
  // mysql2 returns BIGINT as string with our pool config, so the client may echo
  // bus_id back as a numeric string. Coerce so both forms are accepted.
  bus_id: z.coerce.number().int().positive(),
  seat_number: z.coerce.number().int().positive().max(999),
  passenger_name: z.string().trim().min(2).max(120),
  passenger_phone: z
    .string()
    .trim()
    .min(7)
    .max(32)
    .regex(/^[\d+()\-\s]+$/),
});

const PUBLIC_MAX_SEATS_PER_BOOKING = 8;

const reserveBulkSchema = z.object({
  bus_id: z.coerce.number().int().positive(),
  seat_numbers: z
    .array(z.coerce.number().int().positive().max(999))
    .min(1)
    .max(PUBLIC_MAX_SEATS_PER_BOOKING),
  passenger_name: z.string().trim().min(2).max(120),
  passenger_phone: z
    .string()
    .trim()
    .min(7)
    .max(32)
    .regex(/^[\d+()\-\s]+$/),
});

/**
 * Public reserve — creates a `reserved` booking with booking_type='online'.
 * Uses the same SELECT FOR UPDATE / unique-key strategy as the worker reserve
 * route, so customer and worker bookings cannot collide on a seat.
 */
router.post("/bookings/reserve", checkReserveLimit, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const body = reserveSchema.parse(req.body);
    const onlineUserId = await getOnlineUserId();

    await conn.beginTransaction();

    const [busRows] = await conn.execute(
      `SELECT b.id, b.total_seats, b.status, b.date, b.departure_time,
              r.origin, r.destination, r.price
       FROM buses b
       JOIN routes r ON r.id = b.route_id
       WHERE b.id = :bus_id
         AND b.date = CURDATE()
         AND b.status = 'scheduled'
         AND r.origin = 'Omdurman'
       FOR UPDATE`,
      { bus_id: body.bus_id }
    );
    const bus = busRows?.[0];
    if (!bus) {
      await conn.rollback();
      return res.status(404).json({ error: "الرحلة غير متاحة" });
    }
    if (body.seat_number > bus.total_seats) {
      await conn.rollback();
      return res.status(400).json({ error: "رقم المقعد غير صحيح" });
    }

    const [taken] = await conn.execute(
      `SELECT id FROM bookings WHERE bus_id = :bus_id AND seat_number = :seat_number FOR UPDATE`,
      { bus_id: body.bus_id, seat_number: body.seat_number }
    );
    if (taken?.length) {
      await conn.rollback();
      return res.status(409).json({ error: "المقعد محجوز، اختر مقعد آخر" });
    }

    const [occ] = await conn.execute(
      `SELECT COUNT(*) AS c FROM bookings WHERE bus_id = :bus_id`,
      { bus_id: body.bus_id }
    );
    if (Number(occ?.[0]?.c) >= Number(bus.total_seats)) {
      await conn.rollback();
      return res.status(409).json({ error: "الرحلة ممتلئة" });
    }

    const phoneClean = body.passenger_phone.replace(/[^\d+]/g, "");

    const [result] = await conn.execute(
      `INSERT INTO bookings (
        bus_id, worker_id, passenger_name, passenger_phone, passenger_email,
        from_location, to_location, seat_number, booking_type, payment_status, lifecycle
      ) VALUES (
        :bus_id, :worker_id, :passenger_name, :passenger_phone, NULL,
        :from_location, :to_location, :seat_number, 'online', 'unpaid', 'reserved'
      )`,
      {
        bus_id: body.bus_id,
        worker_id: onlineUserId,
        passenger_name: body.passenger_name,
        passenger_phone: phoneClean,
        from_location: bus.origin,
        to_location: bus.destination,
        seat_number: body.seat_number,
      }
    );

    await conn.execute(
      `UPDATE buses SET seats_booked = (SELECT COUNT(*) FROM bookings WHERE bus_id = :bus_id) WHERE id = :bus_id`,
      { bus_id: body.bus_id }
    );

    await conn.commit();
    recordReserveHit(req);

    return res.status(201).json({
      ok: true,
      booking_id: result.insertId,
      seat_number: body.seat_number,
      origin: bus.origin,
      destination: bus.destination,
      departure_time: bus.departure_time,
      date: bus.date,
      price: bus.price,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "المقعد محجوز، اختر مقعد آخر" });
    }
    if (err?.name === "ZodError") {
      console.warn("[public/reserve] validation failed:", err.issues?.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return res.status(400).json({ error: "البيانات غير مكتملة" });
    }
    return next(err);
  } finally {
    conn.release();
  }
});

/**
 * Public reserve-bulk — group booking, atomic.
 * Creates N `reserved` online bookings under one lead passenger.
 * If ANY of the requested seats is already taken, the whole batch fails (no partial bookings).
 */
router.post("/bookings/reserve-bulk", checkReserveLimit, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const body = reserveBulkSchema.parse(req.body);

    const seats = [...new Set(body.seat_numbers)].sort((a, b) => a - b);
    if (seats.length !== body.seat_numbers.length) {
      return res.status(400).json({ error: "مقعد مكرر في الطلب" });
    }

    const onlineUserId = await getOnlineUserId();
    await conn.beginTransaction();

    const [busRows] = await conn.execute(
      `SELECT b.id, b.total_seats, b.status, b.date, b.departure_time,
              r.origin, r.destination, r.price
       FROM buses b
       JOIN routes r ON r.id = b.route_id
       WHERE b.id = :bus_id
         AND b.date = CURDATE()
         AND b.status = 'scheduled'
         AND r.origin = 'Omdurman'
       FOR UPDATE`,
      { bus_id: body.bus_id }
    );
    const bus = busRows?.[0];
    if (!bus) {
      await conn.rollback();
      return res.status(404).json({ error: "الرحلة غير متاحة" });
    }

    for (const s of seats) {
      if (s > Number(bus.total_seats)) {
        await conn.rollback();
        return res.status(400).json({ error: `رقم المقعد ${s} غير صحيح` });
      }
    }

    const placeholders = seats.map(() => "?").join(",");
    const [existing] = await conn.query(
      `SELECT seat_number FROM bookings
       WHERE bus_id = ? AND seat_number IN (${placeholders})
       FOR UPDATE`,
      [body.bus_id, ...seats]
    );
    if (existing && existing.length > 0) {
      await conn.rollback();
      const taken = existing.map((r) => `#${r.seat_number}`).join("، ");
      return res.status(409).json({ error: `المقاعد ${taken} اتحجزت للتو، اختر غيرها` });
    }

    const [occRows] = await conn.execute(
      `SELECT COUNT(*) AS c FROM bookings WHERE bus_id = :bus_id`,
      { bus_id: body.bus_id }
    );
    if (Number(occRows[0].c) + seats.length > Number(bus.total_seats)) {
      await conn.rollback();
      return res.status(409).json({ error: "ما في مقاعد كافية في الرحلة" });
    }

    const phoneClean = body.passenger_phone.replace(/[^\d+]/g, "");
    const bookingIds = [];
    for (const seat of seats) {
      const [result] = await conn.execute(
        `INSERT INTO bookings (
          bus_id, worker_id, passenger_name, passenger_phone, passenger_email,
          from_location, to_location, seat_number, booking_type, payment_status, lifecycle
        ) VALUES (
          :bus_id, :worker_id, :passenger_name, :passenger_phone, NULL,
          :from_location, :to_location, :seat_number, 'online', 'unpaid', 'reserved'
        )`,
        {
          bus_id: body.bus_id,
          worker_id: onlineUserId,
          passenger_name: body.passenger_name,
          passenger_phone: phoneClean,
          from_location: bus.origin,
          to_location: bus.destination,
          seat_number: seat,
        }
      );
      bookingIds.push(result.insertId);
    }

    await conn.execute(
      `UPDATE buses SET seats_booked = (SELECT COUNT(*) FROM bookings WHERE bus_id = :bus_id) WHERE id = :bus_id`,
      { bus_id: body.bus_id }
    );

    await conn.commit();
    recordReserveHit(req);

    return res.status(201).json({
      ok: true,
      booking_ids: bookingIds,
      seat_numbers: seats,
      origin: bus.origin,
      destination: bus.destination,
      departure_time: bus.departure_time,
      date: bus.date,
      price: bus.price,
      total_price: Number(bus.price || 0) * seats.length,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "أحد المقاعد اتحجز للتو، حاول تاني" });
    }
    if (err?.name === "ZodError") {
      console.warn("[public/reserve-bulk] validation failed:", err.issues?.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return res.status(400).json({ error: "البيانات غير مكتملة" });
    }
    return next(err);
  } finally {
    conn.release();
  }
});

export default router;
