/**
 * Multi-tenant bus ownership: superadmin sees all; admin is scoped to own user id;
 * worker is scoped to employer_user_id (the bus owner they work for).
 */

/**
 * SQL fragment + params to restrict rows to buses the user may see.
 * @param {{ role?: string, id?: number, employer_user_id?: number | null }} user - JWT payload
 * @param {string} busAlias - table alias in the query (default `b`)
 * @returns {{ sql: string, params: Record<string, number> }}
 */
export function busOwnerScopeForUser(user, busAlias = "b") {
  const role = user?.role;
  if (role === "superadmin") {
    return { sql: "", params: {} };
  }
  if (role === "admin") {
    const id = Number(user?.id);
    if (!Number.isFinite(id)) return { sql: " AND 1=0", params: {} };
    return {
      sql: ` AND ${busAlias}.bus_owner_id = :_scope_owner`,
      params: { _scope_owner: id },
    };
  }
  if (role === "worker") {
    const emp = user?.employer_user_id;
    const eid = emp != null && emp !== "" ? Number(emp) : NaN;
    if (!Number.isFinite(eid)) {
      return { sql: " AND 1=0", params: {} };
    }
    return {
      sql: ` AND ${busAlias}.bus_owner_id = :_scope_owner`,
      params: { _scope_owner: eid },
    };
  }
  return { sql: " AND 1=0", params: {} };
}

/**
 * @param {{ role?: string, id?: number, employer_user_id?: number | null }} user
 * @param {{ bus_owner_id?: number | string }} busRow
 * @returns {boolean}
 */
export function userCanAccessBusRow(user, busRow) {
  if (!busRow) return false;
  const ownerId = Number(busRow.bus_owner_id);
  if (user?.role === "superadmin") return true;
  if (user?.role === "admin") {
    return Number.isFinite(ownerId) && ownerId === Number(user?.id);
  }
  if (user?.role === "worker") {
    const emp = user?.employer_user_id;
    const eid = emp != null && emp !== "" ? Number(emp) : NaN;
    return Number.isFinite(eid) && Number.isFinite(ownerId) && ownerId === eid;
  }
  return false;
}

/**
 * After loading a bus row in booking flows: worker/superadmin only.
 * @returns {{ ok: true } | { ok: false, status: number, message?: string }}
 */
export function assertBusAccessForBooking(user, busRow) {
  if (!busRow) return { ok: false, status: 404, message: "Bus not found" };
  if (user?.role === "superadmin") return { ok: true };
  if (user?.role === "worker") {
    if (userCanAccessBusRow(user, busRow)) return { ok: true };
    return { ok: false, status: 403, message: "Forbidden" };
  }
  return { ok: false, status: 403, message: "Forbidden" };
}

/**
 * Merge base params with scope params (same keys as busOwnerScopeForUser).
 */
export function mergeScopeParams(base, scopeParams) {
  return { ...base, ...scopeParams };
}
