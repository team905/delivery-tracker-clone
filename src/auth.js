const crypto = require("crypto");
const { db, persist, genId } = require("./db");

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ROLES = ["super_admin", "business_owner", "delivery_partner", "customer"];

function hashPassword(password, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

function issueSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const session = { token, userId, createdAt: now, expiresAt: now + SESSION_TTL_MS };
  db().sessions.push(session);
  persist();
  return session;
}

function findSession(token) {
  if (!token) return null;
  const s = db().sessions.find((x) => x.token === token);
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    db().sessions = db().sessions.filter((x) => x.token !== token);
    persist();
    return null;
  }
  return s;
}

function destroySession(token) {
  db().sessions = db().sessions.filter((x) => x.token !== token);
  persist();
}

function findUserById(id) {
  return db().users.find((u) => u.id === id) || null;
}

function findUserByEmail(email) {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  return db().users.find((u) => u.email === e) || null;
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, salt, ...rest } = user;
  return rest;
}

function createUser({ email, phone, name, password, role, profile }) {
  if (!ROLES.includes(role)) throw new Error("Invalid role");
  if (!email || !password) throw new Error("Email and password are required");
  const e = String(email).trim().toLowerCase();
  if (findUserByEmail(e)) throw new Error("Email already in use");

  const { salt, hash } = hashPassword(password);
  const user = {
    id: genId("u"),
    email: e,
    phone: phone || "",
    name: name || e.split("@")[0],
    role,
    status: role === "super_admin" || role === "customer" ? "active" : "pending",
    salt,
    passwordHash: hash,
    profile: profile || {},
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || e)}&backgroundColor=ff5b5b,ff7e7e,ffaa6b,49b86d,4a90e2&backgroundType=gradientLinear`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db().users.push(user);
  persist();
  return user;
}

function updateUser(id, patch) {
  const u = findUserById(id);
  if (!u) return null;
  Object.assign(u, patch, { updatedAt: new Date().toISOString() });
  persist();
  return u;
}

function tokenFromReq(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  if (req.cookies && req.cookies.session) return req.cookies.session;
  if (req.query && req.query._token) return String(req.query._token);
  if (req.headers["x-session-token"]) return String(req.headers["x-session-token"]);
  return null;
}

function attachUser(req, _res, next) {
  const token = tokenFromReq(req);
  const session = findSession(token);
  if (session) {
    const user = findUserById(session.userId);
    if (user) {
      req.user = user;
      req.session = session;
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  if (req.user.status === "suspended") return res.status(403).json({ error: "Account suspended" });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    if (req.user.status === "suspended") return res.status(403).json({ error: "Account suspended" });
    next();
  };
}

function requireActive(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  if (req.user.status !== "active") {
    return res.status(403).json({ error: `Account ${req.user.status}. Wait for admin approval.` });
  }
  next();
}

function ensureSuperAdmin() {
  const existing = db().users.find((u) => u.role === "super_admin");
  if (existing) return existing;
  const admin = createUser({
    email: process.env.SUPER_ADMIN_EMAIL || "admin@platform.local",
    password: process.env.SUPER_ADMIN_PASSWORD || "admin@123",
    name: "Platform Admin",
    role: "super_admin",
    phone: ""
  });
  console.log(`[auth] Seeded super admin: ${admin.email} / ${process.env.SUPER_ADMIN_PASSWORD || "admin@123"}`);
  return admin;
}

module.exports = {
  ROLES,
  hashPassword,
  verifyPassword,
  issueSession,
  findSession,
  destroySession,
  findUserById,
  findUserByEmail,
  publicUser,
  createUser,
  updateUser,
  attachUser,
  requireAuth,
  requireRole,
  requireActive,
  ensureSuperAdmin
};
