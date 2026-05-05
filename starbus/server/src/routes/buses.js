import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { BUS46_ROWS, BUS46_TOTAL_SEATS } from "../utils/busLayout.js";

const router = Router();

router.use(requireAuth);

router.get("/active", async (req, res, next) => {
  try {
    const dateParam =
      typeof req.query?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : null;

    const [rows] = await pool.execute(
      `SELECT
         b.id,
         b.bus_number,
         b.total_seats,
         b.seats_booked,
         (b.total_seats - b.seats_booked) AS seats_remaining,
         b.departure_time,
         b.route_id,
         b.date,
         b.status,
         r.origin,
         r.destination,
         r.price
       FROM buses b
       JOIN routes r ON r.id = b.route_id
       WHERE b.date = ${dateParam ? ":bus_day" : "CURDATE()"}
         AND b.status = 'scheduled'
         AND r.origin = 'Omdurman'
       ORDER BY r.destination ASC, b.id ASC`,
      dateParam ? { bus_day: dateParam } : {}
    );
    return res.json({ buses: rows });
  } catch (err) {
    return next(err);
  }
});

router.get("/:id/seat-map", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const [busRows] = await pool.execute(
      `SELECT b.id, b.total_seats, r.origin, r.destination
       FROM buses b
       JOIN routes r ON r.id = b.route_id
       WHERE b.id = :id
       LIMIT 1`,
      { id }
    );
    const bus = busRows?.[0];
    if (!bus) return res.status(404).json({ error: "Not found" });

    const total = Number(bus.total_seats) || BUS46_TOTAL_SEATS;

    const [bookRows] = await pool.execute(
      `SELECT seat_number, lifecycle, id AS booking_id
       FROM bookings
       WHERE bus_id = :id`,
      { id }
    );

    const bySeat = {};
    for (const row of bookRows || []) {
      bySeat[row.seat_number] = {
        state: row.lifecycle === "reserved" ? "reserved" : "full",
        booking_id: row.booking_id,
      };
    }

    const seats = {};
    for (let n = 1; n <= total; n++) {
      const b = bySeat[n];
      seats[n] = b ? b.state : "empty";
    }

    return res.json({
      bus_id: id,
      total_seats: total,
      layout: "46",
      layout_rows: BUS46_ROWS,
      origin: bus.origin,
      destination: bus.destination,
      seats,
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         b.id,
         b.bus_owner_id,
         b.bus_number,
         b.total_seats,
         b.seats_booked,
         (b.total_seats - b.seats_booked) AS seats_remaining,
         b.departure_time,
         b.route_id,
         b.date,
         b.status,
         r.origin,
         r.destination,
         r.price
       FROM buses b
       JOIN routes r ON r.id = b.route_id
       ORDER BY b.date DESC, b.departure_time ASC, b.id DESC`
    );

    return res.json({ buses: rows });
  } catch (err) {
    return next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const [rows] = await pool.execute(
      `SELECT
         b.id,
         b.bus_owner_id,
         b.bus_number,
         b.total_seats,
         b.seats_booked,
         (b.total_seats - b.seats_booked) AS seats_remaining,
         b.departure_time,
         b.route_id,
         b.date,
         b.status,
         r.origin,
         r.destination,
         r.price
       FROM buses b
       JOIN routes r ON r.id = b.route_id
       WHERE b.id = :id
       LIMIT 1`,
      { id }
    );

    const bus = rows?.[0];
    if (!bus) return res.status(404).json({ error: "Not found" });
    return res.json({ bus });
  } catch (err) {
    return next(err);
  }
});

const createBusSchema = z.object({
  bus_owner_id: z.number().int().positive(),
  bus_number: z.string().min(1).max(50),
  total_seats: z.number().int().positive().max(999),
  departure_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  route_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["scheduled", "departed", "cancelled", "sold_out"]).optional(),
});

router.post("/", requireRole(["admin", "superadmin"]), async (req, res, next) => {
  try {
    const body = createBusSchema.parse(req.body);
    const departureTime = body.departure_time.length === 5 ? `${body.departure_time}:00` : body.departure_time;

    const [result] = await pool.execute(
      `INSERT INTO buses (
        bus_owner_id, bus_number, total_seats, seats_booked, departure_time, route_id, date, status
      ) VALUES (
        :bus_owner_id, :bus_number, :total_seats, 0, :departure_time, :route_id, :date, :status
      )`,
      {
        ...body,
        departure_time: departureTime,
        status: body.status ?? "scheduled",
      }
    );

    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    // MariaDB duplicate key error
    if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Bus already exists for that slot" });
    return next(err);
  }
});

export default router;

