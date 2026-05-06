import "dotenv/config";
import { createApp } from "./app.js";
import { pingDb } from "./db/pool.js";

const PORT = Number(process.env.PORT || 4000);

async function main() {
  await pingDb();

  const app = createApp();
  app.listen(PORT, () => {
    // Keep console output minimal for low-resource machines
    console.log(`Starbus API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  const msg = err?.message || String(err);
  console.error("Failed to start server:", msg);
  if (msg.includes("ECONNREFUSED") && msg.includes("3306")) {
    console.error(
      "Hint: DB is not on localhost in production. Set DB_HOST to your cloud MySQL hostname in Render → Environment."
    );
  }
  process.exit(1);
});

