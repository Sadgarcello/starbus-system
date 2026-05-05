import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

const paymentSchema = z.enum(["paid", "unpaid", "half"]);

const reservePassengerContact = {
  passenger_name: z.string().trim().min(2).max(120),
  passenger_phone: z.string().trim().max(32).optional().or(z.literal("")),
  passenger_email: z.string().trim().max(255).optional().or(z.literal("")),
};

function addPassengerContactRefine(schema) {
  return schema.superRefine((data, ctx) => {
    const digits = String(data.passenger_phone || "").replace(/\D/g, "");
    const em = String(data.passenger_email || "").trim();
    if (digits.length >= 7) return;
    if (em.length > 0 && z.string().email().safeParse(em).success) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "يجب إدخال هاتف (7 أرقام على الأقل) أو بريد صحيح",
      path: ["passenger_phone"],
    });
  });
}

const reserveSchema = addPassengerContactRefine(
  z
    .object({
      // Coerce so numeric strings (mysql2 BIGINT-as-string echoed from clients) are accepted.
      bus_id: z.coerce.number().int().positive(),
      seat_number: z.coerce.number().int().positive().max(999),
    })
    .extend(reservePassengerContact)
);

const fullSchema = z.object({
  bus_id: z.coerce.number().int().positive(),
  seat_number: z.coerce.number().int().positive().max(999),
  passenger_name: z.string().min(1).max(120),
  passenger_phone: z.string().min(3).max(32).optional().or(z.literal("")).optional(),
  passenger_email: z.string().email().max(255).optional().or(z.literal("")).optional(),
  from_location: z.string().min(1).max(120),
  to_location: z.string().min(1).max(120),
  booking_type: z.enum(["online", "booth"]),
  payment_status: paymentSchema.optional(),
});

const WORKER_MAX_SEATS_PER_BOOKING = 20;

const reserveBulkSchema = addPassengerContactRefine(
  z
    .object({
      bus_id: z.coerce.number().int().positive(),
      seat_numbers: z
        .array(z.coerce.number().int().positive().max(999))
        .min(1)
        .max(WORKER_MAX_SEATS_PER_BOOKING),
    })
    .extend(reservePassengerContact)
);

const fullBulkSchema = z.object({
  bus_id: z.coerce.number().int().positive(),
  seat_numbers: z
    .array(z.coerce.number().int().positive().max(999))
    .min(1)
    .max(WORKER_MAX_SEATS_PER_BOOKING),
  passenger_name: z.string().min(1).max(120),
  passenger_phone: z.string().min(3).max(32).optional().or(z.literal("")).optional(),
  passenger_email: z.string().email().max(255).optional().or(z.literal("")).optional(),
  from_location: z.string().min(1).max(120),
  to_location: z.string().min(1).max(120),
  booking_type: z.enum(["online", "booth"]),
  payment_status: paymentSchema.optional(),
});

async function syncSeatsBooked(conn, busId) {
  const [rows] = await conn.execute(`SELECT COUNT(*) AS c FROM bookings WHERE bus_id = :busId`, { busId });
  const c = Number(rows?.[0]?.c ?? 0);
  await conn.execute(`UPDATE buses SET seats_booked = :c WHERE id = :busId`, { c, busId });
}

/** Worker: empty seat → reserved (orange). */
router.post("/reserve", requireRole(["worker", "superadmin"]), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const body = reserveSchema.parse(req.body);
    const workerId = Number(req.user.id);

    await conn.beginTransaction();

    const [busRows] = await conn.execute(
      `SELECT b.id, b.total_seats, b.status, r.origin, r.destination
       FROM buses b
       JOIN routes r ON r.id = b.route_id
       WHERE b.id = :bus_id
       FOR UPDATE`,
      { bus_id: body.bus_id }
    );
    const bus = busRows?.[0];
    if (!bus) {
      await conn.rollback();
      return res.status(404).json({ error: "Bus not found" });
    }
    if (bus.status !== "scheduled") {
      await conn.rollback();
      return res.status(409).json({ error: "Bus not open" });
    }
    if (body.seat_number > bus.total_seats) {
      await conn.rollback();
      return res.status(400).json({ error: "Invalid seat" });
    }

    const [taken] = await conn.execute(
      `SELECT id FROM bookings WHERE bus_id = :bus_id AND seat_number = :seat_number FOR UPDATE`,
      { bus_id: body.bus_id, seat_number: body.seat_number }
    );
    if (taken?.length) {
      await conn.rollback();
      return res.status(409).json({ error: "Seat not available" });
    }

    const [occ] = await conn.execute(`SELECT COUNT(*) AS c FROM bookings WHERE bus_id = :bus_id`, {
      bus_id: body.bus_id,
    });
    if (Number(occ?.[0]?.c) >= Number(bus.total_seats)) {
      await conn.rollback();
      return res.status(409).json({ error: "Bus is full" });
    }

    const phoneClean = String(body.passenger_phone || "").replace(/[^\d+]/g, "").trim() || null;
    const emailClean = String(body.passenger_email || "").trim() || null;

    const [result] = await conn.execute(
      `INSERT INTO bookings (
        bus_id, worker_id, passenger_name, passenger_phone, passenger_email,
        from_location, to_location, seat_number, booking_type, payment_status, lifecycle
      ) VALUES (
        :bus_id, :worker_id, :passenger_name, :passenger_phone, :passenger_email,
        :from_location, :to_location, :seat_number, 'booth', 'unpaid', 'reserved'
      )`,
      {
        bus_id: body.bus_id,
        worker_id: workerId,
        passenger_name: body.passenger_name,
        passenger_phone: phoneClean,
        passenger_email: emailClean,
        from_location: bus.origin,
        to_location: bus.destination,
        seat_number: body.seat_number,
      }
    );

    await syncSeatsBooked(conn, body.bus_id);
    await conn.commit();
    return res.status(201).json({ id: result.insertId, lifecycle: "reserved" });
  } catch (err) {
    await conn.rollback();
    if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Seat not available" });
    return next(err);
  } finally {
    conn.release();
  }
});

/** Worker: empty → full, or reserved → full (red / confirmed). */
router.post("/full", requireRole(["worker", "superadmin"]), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const body = fullSchema.parse(req.body);
    const workerId = Number(req.user.id);
    const paymentStatus = body.payment_status ?? "unpaid";

    await conn.beginTransaction();

    const [busRows] = await conn.execute(
      `SELECT b.id, b.total_seats, b.status
       FROM buses b
       WHERE b.id = :bus_id
       FOR UPDATE`,
      { bus_id: body.bus_id }
    );
    const bus = busRows?.[0];
    if (!bus) {
      await conn.rollback();
      return res.status(404).json({ error: "Bus not found" });
    }
    if (bus.status !== "scheduled") {
      await conn.rollback();
      return res.status(409).json({ error: "Bus not open" });
    }
    if (body.seat_number > bus.total_seats) {
      await conn.rollback();
      return res.status(400).json({ error: "Invalid seat" });
    }

    const [existingRows] = await conn.execute(
      `SELECT id, lifecycle FROM bookings WHERE bus_id = :bus_id AND seat_number = :seat_number FOR UPDATE`,
      { bus_id: body.bus_id, seat_number: body.seat_number }
    );
    const existing = existingRows?.[0];

    if (existing?.lifecycle === "full") {
      await conn.rollback();
      return res.status(409).json({ error: "Seat already booked" });
    }

    if (existing?.lifecycle === "reserved") {
      await conn.execute(
        `UPDATE bookings SET
          worker_id = :worker_id,
          passenger_name = :passenger_name,
          passenger_phone = :passenger_phone,
          passenger_email = :passenger_email,
          from_location = :from_location,
          to_location = :to_location,
          booking_type = :booking_type,
          payment_status = :payment_status,
          lifecycle = 'full'
        WHERE id = :id`,
        {
          id: existing.id,
          worker_id: workerId,
          passenger_name: body.passenger_name,
          passenger_phone: body.passenger_phone || null,
          passenger_email: body.passenger_email || null,
          from_location: body.from_location,
          to_location: body.to_location,
          booking_type: body.booking_type,
          payment_status: paymentStatus,
        }
      );
      await syncSeatsBooked(conn, body.bus_id);
      await conn.commit();
      return res.json({ id: existing.id, lifecycle: "full" });
    }

    const [occ] = await conn.execute(`SELECT COUNT(*) AS c FROM bookings WHERE bus_id = :bus_id`, {
      bus_id: body.bus_id,
    });
    if (Number(occ?.[0]?.c) >= Number(bus.total_seats)) {
      await conn.rollback();
      return res.status(409).json({ error: "Bus is full" });
    }

    const [result] = await conn.execute(
      `INSERT INTO bookings (
        bus_id, worker_id, passenger_name, passenger_phone, passenger_email,
        from_location, to_location, seat_number, booking_type, payment_status, lifecycle
      ) VALUES (
        :bus_id, :worker_id, :passenger_name, :passenger_phone, :passenger_email,
        :from_location, :to_location, :seat_number, :booking_type, :payment_status, 'full'
      )`,
      {
        bus_id: body.bus_id,
        worker_id: workerId,
        passenger_name: body.passenger_name,
        passenger_phone: body.passenger_phone || null,
        passenger_email: body.passenger_email || null,
        from_location: body.from_location,
        to_location: body.to_location,
        seat_number: body.seat_number,
        booking_type: body.booking_type,
        payment_status: paymentStatus,
      }
    );

    await syncSeatsBooked(conn, body.bus_id);
    await conn.commit();
    return res.status(201).json({ id: result.insertId, lifecycle: "full" });
  } catch (err) {
    await conn.rollback();
    if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Seat not available" });
    return next(err);
  } finally {
    conn.release();
  }
});

/** Worker: bulk reserve N empty seats (orange). All-or-nothing. */
router.post("/reserve-bulk", requireRole(["worker", "superadmin"]), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const body = reserveBulkSchema.parse(req.body);
    const workerId = Number(req.user.id);

    const seats = [...new Set(body.seat_numbers)].sort((a, b) => a - b);
    if (seats.length !== body.seat_numbers.length) {
      return res.status(400).json({ error: "مقعد مكرر في الطلب" });
    }

    await conn.beginTransaction();

    const [busRows] = await conn.execute(
      `SELECT b.id, b.total_seats, b.status, r.origin, r.destination
       FROM buses b
       JOIN routes r ON r.id = b.route_id
       WHERE b.id = :bus_id
       FOR UPDATE`,
      { bus_id: body.bus_id }
    );
    const bus = busRows?.[0];
    if (!bus) {
      await conn.rollback();
      return res.status(404).json({ error: "Bus not found" });
    }
    if (bus.status !== "scheduled") {
      await conn.rollback();
      return res.status(409).json({ error: "Bus not open" });
    }
    for (const s of seats) {
      if (s > Number(bus.total_seats)) {
        await conn.rollback();
        return res.status(400).json({ error: `Invalid seat ${s}` });
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
      const taken = existing.map((r) => `#${r.seat_number}`).join(", ");
      return res.status(409).json({ error: `Seats ${taken} not available` });
    }

    const [occRows] = await conn.execute(
      `SELECT COUNT(*) AS c FROM bookings WHERE bus_id = :bus_id`,
      { bus_id: body.bus_id }
    );
    if (Number(occRows[0].c) + seats.length > Number(bus.total_seats)) {
      await conn.rollback();
      return res.status(409).json({ error: "Not enough seats" });
    }

    const phoneClean = String(body.passenger_phone || "").replace(/[^\d+]/g, "").trim() || null;
    const emailClean = String(body.passenger_email || "").trim() || null;

    const bookingIds = [];
    for (const seat of seats) {
      const [result] = await conn.execute(
        `INSERT INTO bookings (
          bus_id, worker_id, passenger_name, passenger_phone, passenger_email,
          from_location, to_location, seat_number, booking_type, payment_status, lifecycle
        ) VALUES (
          :bus_id, :worker_id, :passenger_name, :passenger_phone, :passenger_email,
          :from_location, :to_location, :seat_number, 'booth', 'unpaid', 'reserved'
        )`,
        {
          bus_id: body.bus_id,
          worker_id: workerId,
          passenger_name: body.passenger_name,
          passenger_phone: phoneClean,
          passenger_email: emailClean,
          from_location: bus.origin,
          to_location: bus.destination,
          seat_number: seat,
        }
      );
      bookingIds.push(result.insertId);
    }

    await syncSeatsBooked(conn, body.bus_id);
    await conn.commit();
    return res
      .status(201)
      .json({ ok: true, booking_ids: bookingIds, seat_numbers: seats, lifecycle: "reserved" });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Seat already taken, try again" });
    }
    return next(err);
  } finally {
    conn.release();
  }
});

/** Worker: bulk full booking (one lead passenger applies to all selected seats). */
router.post("/full-bulk", requireRole(["worker", "superadmin"]), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const body = fullBulkSchema.parse(req.body);
    const workerId = Number(req.user.id);
    const paymentStatus = body.payment_status ?? "unpaid";

    const seats = [...new Set(body.seat_numbers)].sort((a, b) => a - b);
    if (seats.length !== body.seat_numbers.length) {
      return res.status(400).json({ error: "مقعد مكرر في الطلب" });
    }

    await conn.beginTransaction();

    const [busRows] = await conn.execute(
      `SELECT b.id, b.total_seats, b.status FROM buses b WHERE b.id = :bus_id FOR UPDATE`,
      { bus_id: body.bus_id }
    );
    const bus = busRows?.[0];
    if (!bus) {
      await conn.rollback();
      return res.status(404).json({ error: "Bus not found" });
    }
    if (bus.status !== "scheduled") {
      await conn.rollback();
      return res.status(409).json({ error: "Bus not open" });
    }
    for (const s of seats) {
      if (s > Number(bus.total_seats)) {
        await conn.rollback();
        return res.status(400).json({ error: `Invalid seat ${s}` });
      }
    }

    const placeholders = seats.map(() => "?").join(",");
    const [existingRows] = await conn.query(
      `SELECT id, seat_number, lifecycle FROM bookings
       WHERE bus_id = ? AND seat_number IN (${placeholders})
       FOR UPDATE`,
      [body.bus_id, ...seats]
    );
    const existingBySeat = new Map();
    for (const row of existingRows || []) {
      existingBySeat.set(Number(row.seat_number), row);
      if (row.lifecycle === "full") {
        await conn.rollback();
        return res.status(409).json({ error: `Seat #${row.seat_number} already booked` });
      }
    }

    const newSeats = seats.filter((s) => !existingBySeat.has(s));

    const [occRows] = await conn.execute(
      `SELECT COUNT(*) AS c FROM bookings WHERE bus_id = :bus_id`,
      { bus_id: body.bus_id }
    );
    if (Number(occRows[0].c) + newSeats.length > Number(bus.total_seats)) {
      await conn.rollback();
      return res.status(409).json({ error: "Not enough seats" });
    }

    const bookingIds = [];

    for (const seat of seats) {
      const existing = existingBySeat.get(seat);
      if (existing) {
        await conn.execute(
          `UPDATE bookings SET
             worker_id = :worker_id,
             passenger_name = :passenger_name,
             passenger_phone = :passenger_phone,
             passenger_email = :passenger_email,
             from_location = :from_location,
             to_location = :to_location,
             booking_type = :booking_type,
             payment_status = :payment_status,
             lifecycle = 'full'
           WHERE id = :id`,
          {
            id: existing.id,
            worker_id: workerId,
            passenger_name: body.passenger_name,
            passenger_phone: body.passenger_phone || null,
            passenger_email: body.passenger_email || null,
            from_location: body.from_location,
            to_location: body.to_location,
            booking_type: body.booking_type,
            payment_status: paymentStatus,
          }
        );
        bookingIds.push(existing.id);
      } else {
        const [result] = await conn.execute(
          `INSERT INTO bookings (
            bus_id, worker_id, passenger_name, passenger_phone, passenger_email,
            from_location, to_location, seat_number, booking_type, payment_status, lifecycle
          ) VALUES (
            :bus_id, :worker_id, :passenger_name, :passenger_phone, :passenger_email,
            :from_location, :to_location, :seat_number, :booking_type, :payment_status, 'full'
          )`,
          {
            bus_id: body.bus_id,
            worker_id: workerId,
            passenger_name: body.passenger_name,
            passenger_phone: body.passenger_phone || null,
            passenger_email: body.passenger_email || null,
            from_location: body.from_location,
            to_location: body.to_location,
            seat_number: seat,
            booking_type: body.booking_type,
            payment_status: paymentStatus,
          }
        );
        bookingIds.push(result.insertId);
      }
    }

    await syncSeatsBooked(conn, body.bus_id);
    await conn.commit();
    return res.json({ ok: true, booking_ids: bookingIds, seat_numbers: seats, lifecycle: "full" });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Seat already taken, try again" });
    }
    return next(err);
  } finally {
    conn.release();
  }
});

/** Superadmin only: cancel booking and free the seat. */
router.delete("/:id", requireRole(["superadmin"]), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    await conn.beginTransaction();
    const [rows] = await conn.execute(`SELECT id, bus_id FROM bookings WHERE id = :id FOR UPDATE`, { id });
    const row = rows?.[0];
    if (!row) {
      await conn.rollback();
      return res.status(404).json({ error: "Not found" });
    }

    await conn.execute(`DELETE FROM bookings WHERE id = :id`, { id });
    await syncSeatsBooked(conn, row.bus_id);
    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    return next(err);
  } finally {
    conn.release();
  }
});

router.get("/bus/:busId", async (req, res, next) => {
  try {
    const busId = Number(req.params.busId);
    if (!Number.isFinite(busId)) return res.status(400).json({ error: "Invalid busId" });

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
         bk.seat_number,
         bk.booking_type,
         bk.payment_status,
         bk.lifecycle,
         bk.created_at,
         b.date AS bus_date,
         b.departure_time,
         r.origin,
         r.destination
       FROM bookings bk
       JOIN buses b ON b.id = bk.bus_id
       JOIN routes r ON r.id = b.route_id
       WHERE bk.bus_id = :busId
       ORDER BY bk.created_at DESC, bk.id DESC`,
      { busId }
    );

    return res.json({ bookings: rows });
  } catch (err) {
    return next(err);
  }
});

export default router;
