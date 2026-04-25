const express = require("express");
const {
  ROLES,
  createUser,
  findUserByEmail,
  verifyPassword,
  issueSession,
  destroySession,
  publicUser,
  updateUser,
  hashPassword
} = require("../auth");
const { logAudit } = require("../audit");

const router = express.Router();

router.post("/signup", (req, res) => {
  try {
    const { email, password, name, phone, role, profile } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be 6+ characters" });
    const requestedRole = role && ROLES.includes(role) ? role : "customer";
    if (requestedRole === "super_admin") return res.status(403).json({ error: "Cannot self-signup as super admin" });

    const user = createUser({ email, password, name, phone, role: requestedRole, profile });
    const session = issueSession(user.id);
    logAudit({ actor: user, action: "signup", entityType: "user", entityId: user.id, meta: { role: requestedRole } });

    res.cookie("session", session.token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: session.expiresAt - Date.now()
    });
    res.json({ ok: true, user: publicUser(user), token: session.token });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ error: "Invalid email or password" });
  if (!verifyPassword(password, user.salt, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const session = issueSession(user.id);
  logAudit({ actor: user, action: "login", entityType: "user", entityId: user.id });
  res.cookie("session", session.token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: session.expiresAt - Date.now()
  });
  res.json({ ok: true, user: publicUser(user), token: session.token });
});

router.post("/logout", (req, res) => {
  const token = req.cookies?.session || req.headers["x-session-token"] || (req.headers.authorization || "").replace("Bearer ", "");
  if (token) destroySession(token);
  res.clearCookie("session");
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not signed in" });
  res.json({ user: publicUser(req.user) });
});

router.patch("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not signed in" });
  const { name, phone, profile, password } = req.body || {};
  const patch = {};
  if (name) patch.name = String(name);
  if (phone) patch.phone = String(phone);
  if (profile && typeof profile === "object") patch.profile = { ...(req.user.profile || {}), ...profile };
  if (password && password.length >= 6) {
    const { salt, hash } = hashPassword(password);
    patch.salt = salt;
    patch.passwordHash = hash;
  }
  const updated = updateUser(req.user.id, patch);
  logAudit({ actor: req.user, action: "profile_update", entityType: "user", entityId: req.user.id });
  res.json({ user: publicUser(updated) });
});

module.exports = router;
