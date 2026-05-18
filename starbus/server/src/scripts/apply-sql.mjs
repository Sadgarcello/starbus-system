/**
 * Apply a single .sql file to the DB (same connection rules as apply-seed).
 *
 * Paths are resolved from starbus/server cwd, e.g.:
 *   node src/scripts/apply-sql.mjs ../database/migration_add_employer_user_id.sql
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
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

async function main() {
  const rel = typeof process.argv[2] === "string" ? process.argv[2].trim() : "";
  if (!rel) {
    console.error("Usage: node src/scripts/apply-sql.mjs <path-to.sql>");
    process.exit(1);
  }
  const sqlPath = resolve(serverRoot, rel);
  if (!existsSync(sqlPath)) {
    console.error("File not found:", sqlPath);
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
  const sql = readFileSync(sqlPath, "utf8");
  console.log("Applying", sqlPath.split(/[/\\]/).pop(), "to", DB_HOST, "database", DB_NAME, "…");
  const conn = await mysql.createConnection(buildConnectionConfig());
  try {
    const tz = resolveDbServiceTimezone();
    if (tz) await conn.query("SET time_zone = ?", [tz]);
    await conn.query(sql);
  } finally {
    await conn.end();
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
