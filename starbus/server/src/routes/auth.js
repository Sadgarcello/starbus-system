import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { verifyPassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(255),
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const [rows] = await pool.execute(
      `SELECT id, name, email, password, role
       FROM users
       WHERE email = :email
       LIMIT 1`,
      { email }
    );

    const user = rows?.[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await verifyPassword(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signAccessToken({
      sub: String(user.id),
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/me", requireAuth, async (req, res) => {
  // JWT is the source of truth for foundation stage.
  return res.json({ user: req.user });
});

export default router;

