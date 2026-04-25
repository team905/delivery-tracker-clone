const { db, persist, genId } = require("./db");

function logAudit({ actor, action, entityType, entityId, meta }) {
  const entry = {
    id: genId("aud"),
    actorUserId: actor?.id || null,
    actorRole: actor?.role || "system",
    actorName: actor?.name || "System",
    action,
    entityType: entityType || null,
    entityId: entityId || null,
    meta: meta || null,
    at: new Date().toISOString()
  };
  db().auditLogs.unshift(entry);
  if (db().auditLogs.length > 5000) db().auditLogs.length = 5000;
  persist();
  return entry;
}

function notify(userId, { type, title, body, meta }) {
  const n = {
    id: genId("ntf"),
    userId,
    type: type || "info",
    title: title || "",
    body: body || "",
    meta: meta || null,
    read: false,
    createdAt: new Date().toISOString()
  };
  db().notifications.unshift(n);
  if (db().notifications.length > 5000) db().notifications.length = 5000;
  persist();
  return n;
}

module.exports = { logAudit, notify };
