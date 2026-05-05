import { hashPassword } from "../utils/password.js";

const plain = process.argv[2];
if (!plain) {
  console.error("Usage: node src/scripts/hash-password.js <password>");
  process.exit(1);
}

hashPassword(plain)
  .then((hash) => {
    console.log(hash);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

