import jwt from "jsonwebtoken";

const { JWT_SECRET, JWT_EXPIRES_IN = "7d" } = process.env;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in environment");
}

export function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

