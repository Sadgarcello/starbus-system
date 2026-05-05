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
  console.error("Failed to start server:", err?.message || err);
  process.exit(1);
});

