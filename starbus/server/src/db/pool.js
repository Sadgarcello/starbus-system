import mysql from "mysql2/promise";
import { resolveDbServiceTimezone } from "./serviceTimezone.js";

const onRender = process.env.RENDER === "true";
const dbHostRaw = (process.env.DB_HOST ?? "").trim();
if (onRender && !dbHostRaw) {
  throw new Error(
    "DB_HOST is not set. On Render there is no local MySQL. In Environment → set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (and optional DB_PORT) to your cloud MySQL host (e.g. Railway, PlanetScale, Aiven)."
  );
}

const DB_HOST = dbHostRaw || "127.0.0.1";
const DB_PORT = (process.env.DB_PORT ?? "3306").trim() || "3306";
const DB_USER = (process.env.DB_USER ?? "root").trim() || "root";
const DB_PASSWORD = process.env.DB_PASSWORD ?? "";
const DB_NAME = (process.env.DB_NAME ?? "starbus").trim() || "starbus";

// Railway / many cloud proxies require TLS for remote clients (e.g. Render → Railway).
const isLocalDb = DB_HOST === "127.0.0.1" || DB_HOST === "localhost";
const tlsExplicitOff = process.env.DB_SSL === "0";
const tlsExplicitOn = process.env.DB_SSL === "1";
const useTls =
  !tlsExplicitOff &&
  (tlsExplicitOn || (onRender && !isLocalDb));

const poolConfig = {
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  /** Avoid hanging indefinitely when cloud DB DNS/TLS/handshake stalls */
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 12000),
  queueLimit: 0,
  namedPlaceholders: true,
  timezone: "Z",
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: true,
};

if (useTls) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const pool = mysql.createPool(poolConfig);

const serviceTz = resolveDbServiceTimezone();
if (serviceTz) {
  pool.on("connection", (conn) => {
    conn.query("SET time_zone = ?", [serviceTz], (err) => {
      if (err) {
        console.error("[db] SET time_zone failed:", err.message);
      }
    });
  });
}

export async function pingDb() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

