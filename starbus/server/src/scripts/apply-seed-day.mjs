/**
 * Insert the three seeded Omdurman buses on a fixed calendar date (does not wipe any day).
 *
 * From starbus/server (same DB vars as apply-seed, e.g. .env.railway):
 *   npm run apply-seed-day -- 2026-05-16
 *
 * Or: SEED_SERVICE_DAY=2026-05-16 npm run apply-seed-day
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { resolveDbServiceTimezone } from "../db/serviceTimezone.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, "..", "..");
dotenv.config({ path: join(serverRoot, ".env") });
const railwayPath = join(serverRoot, ".env.railway");
if (existsSync(railwayPath)) {
  dotenv.config({ path: railwayPath, override: true });
}
const dbHostRaw = (process.env.DB_HOST ?? "").trim();
const DB_HOST = dbHostRaw || "127.0.0.1";
const DB_PORT = Number((process.env.DB_PORT ?? "3306").trim() || "3306");
const DB_USER = (process.env.DB_USER ?? "root").trim() || "root";
const DB_PASSWORD = process.env.DB_PASSWORD ?? "";
const DB_NAME = (process.env.DB_NAME ?? "starbus").trim() || "starbus";

const isLocalDb = DB_HOST === "127.0.0.1" || DB_HOST === "localhost";
const tlsExplicitOff = process.env.DB_SSL === "0";
const tlsExplicitOn = process.env.DB_SSL === "1";
const onRender = process.env.RENDER === "true";
const useTls =
  !tlsExplicitOff &&
  (tlsExplicitOn || (onRender && !isLocalDb) || (!isLocalDb && !!dbHostRaw));

const seedPath = join(serverRoot, "..", "database", "seed_fixed_day.sql");

function buildConnectionConfig() {
  const cfg = {
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
    timezone: "Z",
  };
  if (useTls) cfg.ssl = { rejectUnauthorized: false };
  return cfg;
}

function resolveServiceDayArg() {
  const fromArgv = typeof process.argv[2] === "string" ? process.argv[2].trim() : "";
  const fromEnv = typeof process.env.SEED_SERVICE_DAY === "string"
    ? process.env.SEED_SERVICE_DAY.trim()
    : "";
  const ymd = fromArgv || fromEnv;
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    console.error(
      "Pass a calendar day YYYY-MM-DD, e.g. npm run apply-seed-day -- 2026-05-16 (or set SEED_SERVICE_DAY)."
    );
    process.exit(1);
  }
  return ymd;
}

async function main() {
  const serviceDay = resolveServiceDayArg();
  if (!existsSync(seedPath)) {
    console.error("Missing seed file:", seedPath);
    process.exit(1);
  }
  if (existsSync(railwayPath)) {
    if (!dbHostRaw || !String(process.env.DB_PORT ?? "").trim()) {
      console.error(
        "With .env.railway, set DB_HOST and DB_PORT (copy from Railway MySQL → Connect)."
      );
      process.exit(1);
    }
  }
  const sql = readFileSync(seedPath, "utf8");
  console.log(
    "Applying fixed-day buses for",
    serviceDay,
    "to",
    DB_HOST,
    "database",
    DB_NAME,
    "…"
  );
  const conn = await mysql.createConnection(buildConnectionConfig());
  try {
    const tz = resolveDbServiceTimezone();
    if (tz) await conn.query("SET time_zone = ?", [tz]);
    await conn.query(`SET @service_day = '${serviceDay}'`);
    await conn.query(sql);
  } finally {
    await conn.end();
  }
  console.log(
    "Done. Worker/admin can choose that service day; public / still lists today only unless you add a date picker."
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
