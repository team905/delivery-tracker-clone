const express = require("express");
const { db, persist, genId } = require("../db");
const { requireRole, publicUser, updateUser, createUser } = require("../auth");
const { logAudit, notify } = require("../audit");

const router = express.Router();

router.use(requireRole("super_admin"));

router.get("/overview", (_req, res) => {
  const d = db();
  const stats = {
    users: d.users.length,
    customers: d.users.filter((u) => u.role === "customer").length,
    businessOwners: d.users.filter((u) => u.role === "business_owner").length,
    deliveryPartners: d.users.filter((u) => u.role === "delivery_partner").length,
    pendingApprovals: d.users.filter((u) => u.status === "pending").length,
    businesses: d.businesses.length,
    activeBusinesses: d.businesses.filter((b) => b.status === "active").length,
    totalOrders: d.ordersLog.length,
    grossRevenue: d.ordersLog.reduce((s, o) => s + (o.total || 0), 0),
    platformCommission: d.ordersLog.reduce((s, o) => s + (o.platformCommission || 0), 0),
    pendingPayouts: d.payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0)
  };
  res.json({ stats, settings: d.settings });
});

router.patch("/settings", (req, res) => {
  const { platformCommissionPct, deliveryFeeBase, taxPct } = req.body || {};
  const s = db().settings;
  if (typeof platformCommissionPct === "number") s.platformCommissionPct = platformCommissionPct;
  if (typeof deliveryFeeBase === "number") s.deliveryFeeBase = deliveryFeeBase;
  if (typeof taxPct === "number") s.taxPct = taxPct;
  persist();
  logAudit({ actor: req.user, action: "settings_update", entityType: "settings", meta: req.body });
  res.json({ settings: s });
});

router.get("/users", (req, res) => {
  const { role, status, q } = req.query;
  let users = db().users;
  if (role) users = users.filter((u) => u.role === role);
  if (status) users = users.filter((u) => u.status === status);
  if (q) {
    const s = String(q).toLowerCase();
    users = users.filter((u) => (u.email || "").includes(s) || (u.name || "").toLowerCase().includes(s) || (u.phone || "").includes(s));
  }
  res.json({ users: users.map(publicUser) });
});

router.post("/users", (req, res) => {
  try {
    const { email, password, name, phone, role, profile } = req.body || {};
    const user = createUser({ email, password, name, phone, role, profile });
    if (role !== "customer") updateUser(user.id, { status: "active" });
    logAudit({ actor: req.user, action: "create_user", entityType: "user", entityId: user.id, meta: { role } });
    notify(user.id, { type: "welcome", title: "Account created", body: `Your ${role.replace("_", " ")} account is ready.` });
    res.json({ user: publicUser(user) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch("/users/:id", (req, res) => {
  const u = db().users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: "User not found" });
  const { status, name, phone, profile } = req.body || {};
  if (status && ["pending", "active", "suspended", "rejected"].includes(status)) u.status = status;
  if (name) u.name = name;
  if (phone) u.phone = phone;
  if (profile) u.profile = { ...(u.profile || {}), ...profile };
  u.updatedAt = new Date().toISOString();
  persist();
  logAudit({ actor: req.user, action: "update_user", entityType: "user", entityId: u.id, meta: { status } });
  if (status === "active") notify(u.id, { type: "approval", title: "Account approved", body: "You can now sign in." });
  if (status === "rejected") notify(u.id, { type: "approval", title: "Account rejected", body: "Contact support for details." });
  if (status === "suspended") notify(u.id, { type: "warning", title: "Account suspended", body: "Contact support." });
  res.json({ user: publicUser(u) });
});

router.delete("/users/:id", (req, res) => {
  const idx = db().users.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "User not found" });
  if (db().users[idx].role === "super_admin") return res.status(400).json({ error: "Cannot delete super admin" });
  const removed = db().users.splice(idx, 1)[0];
  db().sessions = db().sessions.filter((s) => s.userId !== removed.id);
  persist();
  logAudit({ actor: req.user, action: "delete_user", entityType: "user", entityId: removed.id });
  res.json({ ok: true });
});

router.get("/businesses", (_req, res) => {
  const businesses = db().businesses.map((b) => {
    const owner = db().users.find((u) => u.id === b.ownerId);
    return { ...b, ownerName: owner?.name, ownerEmail: owner?.email };
  });
  res.json({ businesses });
});

router.patch("/businesses/:id", (req, res) => {
  const b = db().businesses.find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: "Business not found" });
  const { status, commissionPct, featured } = req.body || {};
  if (status && ["pending", "active", "suspended"].includes(status)) b.status = status;
  if (typeof commissionPct === "number") b.commissionPct = commissionPct;
  if (typeof featured === "boolean") b.featured = featured;
  b.updatedAt = new Date().toISOString();
  persist();
  logAudit({ actor: req.user, action: "update_business", entityType: "business", entityId: b.id, meta: { status, commissionPct } });
  if (b.ownerId && status) notify(b.ownerId, { type: "approval", title: `Business ${status}`, body: `${b.name} is now ${status}.` });
  res.json({ business: b });
});

router.get("/categories", (_req, res) => {
  res.json({ categories: db().serviceCategories });
});

router.post("/categories", (req, res) => {
  const { name, parentService, icon, slug } = req.body || {};
  if (!name || !parentService) return res.status(400).json({ error: "name and parentService required" });
  const cat = {
    id: genId("cat"),
    name,
    parentService,
    icon: icon || "🏷️",
    slug: slug || String(name).toLowerCase().replace(/\s+/g, "-"),
    createdAt: new Date().toISOString()
  };
  db().serviceCategories.push(cat);
  persist();
  logAudit({ actor: req.user, action: "create_category", entityType: "category", entityId: cat.id, meta: cat });
  res.json({ category: cat });
});

router.delete("/categories/:id", (req, res) => {
  const i = db().serviceCategories.findIndex((c) => c.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  const removed = db().serviceCategories.splice(i, 1)[0];
  persist();
  logAudit({ actor: req.user, action: "delete_category", entityType: "category", entityId: removed.id });
  res.json({ ok: true });
});

router.get("/orders", (req, res) => {
  const { status, serviceType, businessId, limit } = req.query;
  let orders = db().ordersLog.slice();
  if (status) orders = orders.filter((o) => o.status === status);
  if (serviceType) orders = orders.filter((o) => o.serviceType === serviceType);
  if (businessId) orders = orders.filter((o) => o.businessId === businessId);
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (limit) orders = orders.slice(0, parseInt(limit, 10));
  res.json({ orders });
});

router.get("/payouts", (_req, res) => {
  res.json({ payouts: db().payouts });
});

router.post("/payouts/:id/process", (req, res) => {
  const p = db().payouts.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Payout not found" });
  if (p.status !== "pending") return res.status(400).json({ error: `Already ${p.status}` });
  p.status = "processed";
  p.processedAt = new Date().toISOString();
  p.processedBy = req.user.id;
  persist();
  logAudit({ actor: req.user, action: "payout_processed", entityType: "payout", entityId: p.id, meta: { amount: p.amount } });
  if (p.userId) notify(p.userId, { type: "payout", title: "Payout processed", body: `₹${p.amount} credited to your bank account.` });
  res.json({ payout: p });
});

router.get("/audit", (req, res) => {
  const limit = parseInt(req.query.limit || "200", 10);
  res.json({ logs: db().auditLogs.slice(0, limit) });
});

router.get("/promotions", (_req, res) => {
  res.json({ promotions: db().promotions.filter((p) => p.scope === "platform") });
});

router.post("/promotions", (req, res) => {
  const { code, discountType, value, validFrom, validTo, usageLimit, minOrder } = req.body || {};
  if (!code || !discountType || typeof value !== "number") return res.status(400).json({ error: "code, discountType, value required" });
  const promo = {
    id: genId("pr"),
    code: String(code).toUpperCase(),
    discountType,
    value,
    scope: "platform",
    minOrder: minOrder || 0,
    validFrom: validFrom || new Date().toISOString(),
    validTo: validTo || null,
    usageLimit: usageLimit || null,
    usedCount: 0,
    active: true,
    createdAt: new Date().toISOString()
  };
  db().promotions.push(promo);
  persist();
  logAudit({ actor: req.user, action: "create_promo", entityType: "promotion", entityId: promo.id, meta: promo });
  res.json({ promotion: promo });
});

router.delete("/promotions/:id", (req, res) => {
  const i = db().promotions.findIndex((p) => p.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  const removed = db().promotions.splice(i, 1)[0];
  persist();
  logAudit({ actor: req.user, action: "delete_promo", entityType: "promotion", entityId: removed.id });
  res.json({ ok: true });
});

router.get("/disputes", (_req, res) => {
  res.json({ tickets: db().supportTickets });
});

router.post("/disputes/:id/respond", (req, res) => {
  const t = db().supportTickets.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket not found" });
  const { message, status } = req.body || {};
  if (message) t.messages.push({ from: "admin", body: message, at: new Date().toISOString() });
  if (status && ["open", "closed", "in_progress"].includes(status)) t.status = status;
  persist();
  if (t.userId) notify(t.userId, { type: "support", title: "Support replied", body: message || "Status updated." });
  logAudit({ actor: req.user, action: "respond_dispute", entityType: "ticket", entityId: t.id });
  res.json({ ticket: t });
});

module.exports = router;
