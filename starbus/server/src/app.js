import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";

import authRoutes from "./routes/auth.js";
import busesRoutes from "./routes/buses.js";
import bookingsRoutes from "./routes/bookings.js";
import reportsRoutes from "./routes/reports.js";
import publicRoutes from "./routes/public.js";

export function createApp() {
  const app = express();
  // So req.ip reflects the real client behind Render/nginx (needed for /api/public rate limits).
  if (process.env.TRUST_PROXY !== "0") {
    app.set("trust proxy", 1);
  }
  // mysql2 may return BIGINT as BigInt; plain JSON.stringify throws.
  app.set("json replacer", (_key, value) => (typeof value === "bigint" ? value.toString() : value));

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uiDir = path.join(__dirname, "ui");

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: "200kb" }));

  const origins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: origins.length ? origins : true,
      credentials: false,
    })
  );

  app.use(morgan("dev"));

  // Minimal UI for soft launch (weak-internet friendly, no build step)
  app.get("/", (_req, res) => res.sendFile(path.join(uiDir, "customer.html")));
  app.get("/book", (_req, res) => res.sendFile(path.join(uiDir, "customer.html")));
  app.get("/worker", (_req, res) => res.sendFile(path.join(uiDir, "worker.html")));
  app.get("/admin", (_req, res) => res.sendFile(path.join(uiDir, "admin.html")));
  app.use(
    "/ui",
    express.static(uiDir, {
      etag: true,
      maxAge: "7d",
      immutable: true,
    })
  );

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/public", publicRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/buses", busesRoutes);
  app.use("/api/bookings", bookingsRoutes);
  app.use("/api/reports", reportsRoutes);

  // Basic error handler (keeps responses small for slow connections)
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.name === "ZodError") {
      const firstMsg = err.issues?.[0]?.message;
      return res.status(400).json({
        error: firstMsg || "البيانات غير مكتملة",
        details: err.issues?.map((i) => ({ path: i.path, message: i.message })),
      });
    }
    return res.status(500).json({ error: "Server error" });
  });

  return app;
}

