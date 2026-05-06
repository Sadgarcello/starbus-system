/**
 * One-off: set a user's password using bcrypt + parameterized UPDATE.
 * Avoids Railway SQL UI mangling bcrypt hashes ($ characters).
 *
 * Usage (from starbus/server):
 *   npm run set-password -- admin@test.com "123"
 *
 * Loads .env, then if .env.railway exists, loads it with override (so local .env can
 * stay on 127.0.0.1 while cloud DB_* live in .env.railway). See .env.railway.example.
 */
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, "..", "..");
dotenv.config({ path: join(serverRoot, ".env") });
const railwayPath = join(serverRoot, ".env.railway");
if (existsSync(railwayPath)) {
  dotenv.config({ path: railwayPath, override: true });
  const h = (process.env.DB_HOST ?? "").trim();
  const p = (process.env.DB_PORT ?? "").trim();
  if (!h || !p) {
    console.error(
      "DB_HOST and DB_PORT in .env.railway must be set (copy from Railway MySQL → Connect). Empty host falls back to localhost."
    );
    process.exit(1);
  }
} else {
  const h = (process.env.DB_HOST ?? "").trim();
  if (h === "127.0.0.1" || h === "localhost" || !h) {
    console.warn(
      "set-password: DB is localhost from .env. To update Railway users without editing .env, create .env.railway — see .env.railway.example."
    );
  }
}

function buildPoolConfig() {
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

  const cfg = {
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
  };
  if (useTls) cfg.ssl = { rejectUnauthorized: false };
  return cfg;
}

async function main() {
  const email = process.argv[2]?.trim();
  const plain = process.argv[3];

  if (!email || plain === undefined || plain === "") {
    console.error('Usage: npm run set-password -- <email> <new-password>');
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Invalid email.");
    process.exit(1);
  }

  const pool = mysql.createPool(buildPoolConfig());
  try {
    const hash = await bcrypt.hash(plain, 10);
    const [result] = await pool.execute(
      "UPDATE users SET password = ? WHERE email = ?",
      [hash, email]
    );
    const affected = result.affectedRows ?? 0;
    if (affected === 0) {
      console.error("No user updated — check email exists in this database.");
      process.exit(1);
    }
    console.log("Updated:", email);
    console.log("Hash length:", hash.length, "| prefix:", hash.slice(0, 7));
    console.log("Done. Log in with the new password.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  const msg = err?.message || String(err);
  console.error(msg);
  if (msg.includes("ECONNREFUSED")) {
    const h = (process.env.DB_HOST ?? "").trim();
    if (h === "127.0.0.1" || h === "localhost" || !h) {
      console.error(
        "Hint: Nothing is listening on local MySQL. For Railway: copy .env.railway.example → .env.railway and paste Connect host/port/user/password/database."
      );
    }
  }
  process.exit(1);
});
