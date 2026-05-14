/**
 * Calendar day for routes (CURDATE / “today”) on managed MySQL (often UTC).
 * Default +02:00 matches Sudan; set DB_SERVICE_TIMEZONE=SERVER to use the DB host default.
 */

export function resolveDbServiceTimezone() {
  const raw = (process.env.DB_SERVICE_TIMEZONE ?? "+02:00").trim();
  if (!raw || /^server$/i.test(raw)) return null;
  return raw;
}
