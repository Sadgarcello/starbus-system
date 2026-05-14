import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { busOwnerScopeForUser, mergeScopeParams } from "../utils/ownerScope.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole(["admin", "superadmin"]));

const dailySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bus_id: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).max(50000).optional(),
});

/** YYYY-MM-DD + integer days delta (approx local calendar mid-day pivot). */
function offsetIsoDay(iso, deltaDays) {
  const t = Date.parse(`${iso}T12:00:00`) + deltaDays * 86400000;
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Normalize mysql DATE → YYYY-MM-DD string */
function isoDateKey(rowDay) {
  if (!rowDay) return "";
  if (rowDay instanceof Date) {
    const y = rowDay.getFullYear();
    const m = String(rowDay.getMonth() + 1).padStart(2, "0");
    const d = String(rowDay.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(rowDay);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

const overviewSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(7).max(60).optional(),
});

/**
 * Aggregate analytics for the admin dashboard: fleet occupancy (scheduled Omdurman runs),
 * day totals, breakdown by destination, rolling booking counts, bookings channel mix.
 */
router.get("/overview", async (req, res, next) => {
  try {
    const { date, days: daysParam } = overviewSchema.parse(req.query);
    const endDay =
      date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : new Date().toISOString().slice(0, 10);
    const spanDays = Math.min(60, Math.max(7, daysParam ?? 14));
    const interval = spanDays - 1;

    const scope = busOwnerScopeForUser(req.user);
    const fleetParams = mergeScopeParams({ endDay }, scope.params);

    const [fleetRows] = await pool.execute(
      `SELECT
         b.id,
         b.bus_number,
         b.total_seats,
         b.seats_booked,
         (b.total_seats - b.seats_booked) AS seats_remaining,
         r.origin,
         r.destination,
         TIME_FORMAT(b.departure_time, '%H:%i') AS departure_hm
       FROM buses b
       JOIN routes r ON r.id = b.route_id
       WHERE b.date = :endDay AND b.status = 'scheduled' AND r.origin = 'Omdurman'
       ${scope.sql}
       ORDER BY r.destination ASC, b.id ASC`,
      fleetParams
    );

    const buses = (fleetRows || []).map((b) => ({
      id: num(b.id),
      bus_number: b.bus_number,
      total_seats: num(b.total_seats),
      seats_booked: num(b.seats_booked),
      seats_remaining: num(b.seats_remaining),
      origin: b.origin,
      destination: b.destination,
      departure_hm: b.departure_hm || null,
    }));

    let seat_capacity_total = 0;
    let seats_booked_aggregate = 0;
    for (const b of buses) {
      seat_capacity_total += b.total_seats;
      seats_booked_aggregate += Math.min(b.seats_booked, b.total_seats);
    }
    const fill_ratio_pct =
      seat_capacity_total > 0
        ? Math.round(((seats_booked_aggregate / seat_capacity_total) * 100 + Number.EPSILON) * 10) /
          10
        : null;

    const sumParams = mergeScopeParams({ endDay }, scope.params);
    const [sumRows] = await pool.execute(
      `SELECT
         COUNT(*) AS bookings_count,
         SUM(CASE WHEN bk.lifecycle = 'reserved' THEN 1 ELSE 0 END) AS reserved_count,
         SUM(CASE WHEN bk.lifecycle = 'full' THEN 1 ELSE 0 END) AS full_count,
         SUM(CASE WHEN bk.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
         SUM(CASE WHEN bk.payment_status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid_count,
         SUM(CASE WHEN bk.payment_status = 'half' THEN 1 ELSE 0 END) AS half_count,
         SUM(CASE WHEN bk.booking_type = 'online' THEN 1 ELSE 0 END) AS online_count,
         SUM(CASE WHEN bk.booking_type = 'booth' THEN 1 ELSE 0 END) AS booth_count
       FROM bookings bk
       JOIN buses b ON b.id = bk.bus_id
       WHERE DATE(bk.created_at) = :endDay
       ${scope.sql}`,
      sumParams
    );

    const s0 = sumRows?.[0] || {};
    const day_totals = {
      bookings_count: num(s0.bookings_count),
      reserved_count: num(s0.reserved_count),
      full_count: num(s0.full_count),
      paid_count: num(s0.paid_count),
      unpaid_count: num(s0.unpaid_count),
      half_count: num(s0.half_count),
      online_count: num(s0.online_count),
      booth_count: num(s0.booth_count),
    };

    const [routeRows] = await pool.execute(
      `SELECT
         r.destination AS destination,
         COUNT(*) AS bookings_count
       FROM bookings bk
       JOIN buses b ON b.id = bk.bus_id
       JOIN routes r ON r.id = b.route_id
       WHERE DATE(bk.created_at) = :endDay
       ${scope.sql}
       GROUP BY r.id, r.destination
       ORDER BY bookings_count DESC`,
      sumParams
    );

    const [trendRows] = await pool.execute(
      `SELECT DATE(bk.created_at) AS d, COUNT(*) AS bookings_count
       FROM bookings bk
       JOIN buses b ON b.id = bk.bus_id
       WHERE DATE(bk.created_at) BETWEEN DATE_SUB(:endDay, INTERVAL ${interval} DAY) AND :endDay
       ${scope.sql}
       GROUP BY DATE(bk.created_at)
       ORDER BY d ASC`,
      sumParams
    );

    const byTrend = {};
    for (const row of trendRows || []) {
      const k = isoDateKey(row.d);
      if (k) byTrend[k] = num(row.bookings_count);
    }
    const startTrend = offsetIsoDay(endDay, -interval);

    /** @type {{ date:string, bookings:number }[]} */
    const trend = [];
    let cur = startTrend;
    while (true) {
      trend.push({ date: cur, bookings: num(byTrend[cur]) });
      if (cur === endDay) break;
      cur = offsetIsoDay(cur, 1);
      if (trend.length > spanDays + 5) break; // safety guard
    }

    return res.json({
      date: endDay,
      days: spanDays,
      fleet_day: {
        date: endDay,
        buses_on_network: buses.length,
        seat_capacity_total,
        seats_booked_aggregate,
        fill_ratio_pct,
        buses,
      },
      day_totals,
      by_destination: (routeRows || []).map((r) => ({
        destination: r.destination,
        bookings_count: num(r.bookings_count),
      })),
      trend,
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/daily", async (req, res, next) => {
  try {
    const { date, bus_id, limit = 200, offset = 0 } = dailySchema.parse(req.query);

    const day = date || new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

    /** Service day (bus.date) matches the admin "تشغيل / تقرير" calendar — not created_at. */
    const scope = busOwnerScopeForUser(req.user);
    const where = ["b.date = :day"];
    const whereParams = mergeScopeParams({ day }, scope.params);
    if (scope.sql.trim()) {
      const cond = scope.sql.trim().replace(/^\s*AND\s+/i, "");
      if (cond) where.push(cond);
    }
    if (bus_id) {
      where.push("bk.bus_id = :bus_id");
      whereParams.bus_id = bus_id;
    }

    const lim = Math.min(500, Math.max(1, Number(limit)));
    const off = Math.min(50000, Math.max(0, Number(offset)));

    const [summaryRows] = await pool.execute(
      `SELECT
         COUNT(*) AS bookings_count,
         SUM(CASE WHEN bk.lifecycle = 'reserved' THEN 1 ELSE 0 END) AS reserved_count,
         SUM(CASE WHEN bk.lifecycle = 'full' THEN 1 ELSE 0 END) AS full_count,
         SUM(CASE WHEN bk.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
         SUM(CASE WHEN bk.payment_status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid_count,
         SUM(CASE WHEN bk.payment_status = 'half' THEN 1 ELSE 0 END) AS half_count
       FROM bookings bk
       JOIN buses b ON b.id = bk.bus_id
       WHERE ${where.join(" AND ")}`,
      whereParams
    );

    const sRaw = summaryRows?.[0] || {};
    const summary = {
      bookings_count: num(sRaw.bookings_count),
      reserved_count: num(sRaw.reserved_count),
      full_count: num(sRaw.full_count),
      paid_count: num(sRaw.paid_count),
      unpaid_count: num(sRaw.unpaid_count),
      half_count: num(sRaw.half_count),
    };

    const [rows] = await pool.execute(
      `SELECT
         bk.id,
         bk.bus_id,
         bk.worker_id,
         bk.passenger_name,
         bk.passenger_phone,
         bk.passenger_email,
         bk.from_location,
         bk.to_location,
         rt.origin AS route_origin,
         rt.destination AS route_destination,
         bk.seat_number,
         bk.booking_type,
         bk.payment_status,
         bk.lifecycle,
         bk.created_at,
         b.date AS bus_date,
         b.departure_time AS bus_departure_time
       FROM bookings bk
       JOIN buses b ON b.id = bk.bus_id
       JOIN routes rt ON rt.id = b.route_id
       WHERE ${where.join(" AND ")}
       ORDER BY bk.created_at DESC, bk.id DESC
       LIMIT ${lim} OFFSET ${off}`,
      whereParams
    );

    return res.json({
      date: day,
      summary,
      bookings: rows,
      page: { limit: lim, offset: off, returned: rows.length },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;

