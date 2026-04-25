const express = require("express");
const { db, persist, genId } = require("../db");
const { requireRole, requireActive } = require("../auth");
const { logAudit, notify } = require("../audit");

const router = express.Router();

router.use(requireRole("delivery_partner"));

router.get("/profile", (req, res) => {
  const status = db().partnerStatus[req.user.id] || { isOnline: false, location: null, vehicle: req.user.profile?.vehicle || "" };
  res.json({ partner: req.user, status });
});

router.post("/online", requireActive, (req, res) => {
  const { isOnline, lat, lng } = req.body || {};
  const cur = db().partnerStatus[req.user.id] || {};
  const next = {
    ...cur,
    isOnline: !!isOnline,
    location: typeof lat === "number" && typeof lng === "number" ? { lat, lng } : cur.location,
    updatedAt: new Date().toISOString()
  };
  db().partnerStatus[req.user.id] = next;
  persist();
  logAudit({ actor: req.user, action: "partner_status", entityType: "partner", entityId: req.user.id, meta: { isOnline } });
  res.json({ status: next });
});

router.get("/trips", (req, res) => {
  const trips = db().ordersLog
    .filter((o) => o.partnerUserId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ trips });
});

router.get("/earnings", (req, res) => {
  const trips = db().ordersLog.filter((o) => o.partnerUserId === req.user.id && o.status === "delivered");
  const totalEarnings = trips.reduce((s, o) => s + (o.partnerEarning || 0), 0);
  const myPayouts = db().payouts.filter((p) => p.userId === req.user.id && !p.businessId);
  const paidOut = myPayouts.filter((p) => p.status === "processed").reduce((s, p) => s + p.amount, 0);
  const today = new Date().toDateString();
  const todayTrips = trips.filter((o) => new Date(o.deliveredAt || o.createdAt).toDateString() === today);
  const todayEarning = todayTrips.reduce((s, o) => s + (o.partnerEarning || 0), 0);
  res.json({
    totalEarnings,
    paidOut,
    pendingBalance: totalEarnings - paidOut,
    todayEarning,
    todayTrips: todayTrips.length,
    totalTrips: trips.length,
    payouts: myPayouts
  });
});

router.post("/payouts/request", (req, res) => {
  const { amount } = req.body || {};
  if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
  const payout = {
    id: genId("po"),
    userId: req.user.id,
    amount,
    status: "pending",
    requestedAt: new Date().toISOString()
  };
  db().payouts.push(payout);
  persist();
  logAudit({ actor: req.user, action: "request_payout", entityType: "payout", entityId: payout.id });
  const admins = db().users.filter((u) => u.role === "super_admin");
  admins.forEach((a) => notify(a.id, { type: "payout_request", title: "Partner payout requested", body: `${req.user.name} requested ₹${amount}` }));
  res.json({ payout });
});

module.exports = router;
