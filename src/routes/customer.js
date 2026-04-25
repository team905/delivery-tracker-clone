const express = require("express");
const { db, persist, genId } = require("../db");
const { requireRole } = require("../auth");

const router = express.Router();

router.use(requireRole("customer"));

router.get("/profile", (req, res) => {
  const profile = req.user.profile || {};
  const wallet = profile.wallet || 0;
  const txns = db().walletTxns.filter((t) => t.userId === req.user.id).sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json({
    user: { id: req.user.id, name: req.user.name, email: req.user.email, phone: req.user.phone, avatar: req.user.avatar },
    addresses: profile.addresses || [],
    favorites: profile.favorites || [],
    wallet,
    walletTxns: txns
  });
});

router.post("/addresses", (req, res) => {
  const { label, line1, line2, lat, lng, instructions } = req.body || {};
  if (!line1 || typeof lat !== "number" || typeof lng !== "number") return res.status(400).json({ error: "line1 and coords required" });
  const addr = { id: genId("addr"), label: label || "Home", line1, line2: line2 || "", lat, lng, instructions: instructions || "", createdAt: new Date().toISOString() };
  const profile = req.user.profile || {};
  profile.addresses = [...(profile.addresses || []), addr];
  req.user.profile = profile;
  persist();
  res.json({ address: addr });
});

router.delete("/addresses/:id", (req, res) => {
  const profile = req.user.profile || {};
  profile.addresses = (profile.addresses || []).filter((a) => a.id !== req.params.id);
  req.user.profile = profile;
  persist();
  res.json({ ok: true });
});

router.get("/orders", (req, res) => {
  const orders = db().ordersLog.filter((o) => o.customerUserId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ orders });
});

router.post("/favorites/:businessId", (req, res) => {
  const profile = req.user.profile || {};
  const fav = new Set(profile.favorites || []);
  if (fav.has(req.params.businessId)) fav.delete(req.params.businessId);
  else fav.add(req.params.businessId);
  profile.favorites = Array.from(fav);
  req.user.profile = profile;
  persist();
  res.json({ favorites: profile.favorites });
});

router.post("/reviews", (req, res) => {
  const { orderId, businessId, partnerId, ratings, comment } = req.body || {};
  if (!orderId || !ratings) return res.status(400).json({ error: "orderId and ratings required" });
  const review = {
    id: genId("rv"),
    orderId,
    businessId: businessId || null,
    partnerId: partnerId || null,
    userId: req.user.id,
    ratings,
    comment: comment || "",
    createdAt: new Date().toISOString()
  };
  db().reviews.push(review);
  if (businessId) {
    const b = db().businesses.find((x) => x.id === businessId);
    if (b) {
      const all = db().reviews.filter((r) => r.businessId === businessId);
      const avg = all.reduce((s, r) => s + (r.ratings.overall || r.ratings.food || 4), 0) / all.length;
      b.rating = Number(avg.toFixed(2));
    }
  }
  persist();
  res.json({ review });
});

router.get("/notifications", (req, res) => {
  const notifications = db().notifications.filter((n) => n.userId === req.user.id);
  res.json({ notifications });
});

router.post("/notifications/:id/read", (req, res) => {
  const n = db().notifications.find((x) => x.id === req.params.id && x.userId === req.user.id);
  if (!n) return res.status(404).json({ error: "Not found" });
  n.read = true;
  persist();
  res.json({ ok: true });
});

router.post("/support", (req, res) => {
  const { subject, message, orderId } = req.body || {};
  if (!subject || !message) return res.status(400).json({ error: "subject and message required" });
  const ticket = {
    id: genId("tk"),
    userId: req.user.id,
    orderId: orderId || null,
    subject,
    status: "open",
    messages: [{ from: "user", body: message, at: new Date().toISOString() }],
    createdAt: new Date().toISOString()
  };
  db().supportTickets.push(ticket);
  persist();
  res.json({ ticket });
});

router.get("/support", (req, res) => {
  res.json({ tickets: db().supportTickets.filter((t) => t.userId === req.user.id) });
});

router.get("/promotions", (req, res) => {
  const now = Date.now();
  const promos = db().promotions.filter((p) => p.active && (!p.validTo || new Date(p.validTo).getTime() > now));
  res.json({ promotions: promos });
});

module.exports = router;
