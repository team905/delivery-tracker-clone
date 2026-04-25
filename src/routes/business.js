const express = require("express");
const { db, persist, genId } = require("../db");
const { requireRole } = require("../auth");
const { logAudit, notify } = require("../audit");

const router = express.Router();

router.use(requireRole("business_owner"));

function getMyBusinesses(userId) {
  return db().businesses.filter((b) => b.ownerId === userId);
}

function findOwnedBusiness(userId, businessId) {
  return db().businesses.find((b) => b.id === businessId && b.ownerId === userId);
}

router.get("/businesses", (req, res) => {
  res.json({ businesses: getMyBusinesses(req.user.id) });
});

router.post("/businesses", (req, res) => {
  const { name, serviceType, address, lat, lng, phone, image, description, cuisines, hours } = req.body || {};
  if (!name || !serviceType) return res.status(400).json({ error: "name and serviceType required" });
  const business = {
    id: genId("biz"),
    ownerId: req.user.id,
    name,
    serviceType,
    description: description || "",
    address: address || "",
    lat: typeof lat === "number" ? lat : 19.076,
    lng: typeof lng === "number" ? lng : 72.8777,
    phone: phone || req.user.phone || "",
    image: image || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=60",
    cuisines: cuisines || [],
    hours: hours || { open: "09:00", close: "23:00" },
    status: "pending",
    isOpen: true,
    rating: 0,
    totalOrders: 0,
    totalRevenue: 0,
    commissionPct: db().settings.platformCommissionPct,
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db().businesses.push(business);
  persist();
  logAudit({ actor: req.user, action: "create_business", entityType: "business", entityId: business.id, meta: { name, serviceType } });
  const adminUsers = db().users.filter((u) => u.role === "super_admin");
  adminUsers.forEach((a) => notify(a.id, { type: "approval_request", title: "New business pending approval", body: `${name} (${serviceType})` }));
  res.json({ business });
});

router.patch("/businesses/:id", (req, res) => {
  const b = findOwnedBusiness(req.user.id, req.params.id);
  if (!b) return res.status(404).json({ error: "Not found" });
  const { name, description, address, lat, lng, phone, image, cuisines, hours, isOpen } = req.body || {};
  if (name) b.name = name;
  if (description !== undefined) b.description = description;
  if (address) b.address = address;
  if (typeof lat === "number") b.lat = lat;
  if (typeof lng === "number") b.lng = lng;
  if (phone) b.phone = phone;
  if (image) b.image = image;
  if (cuisines) b.cuisines = cuisines;
  if (hours) b.hours = hours;
  if (typeof isOpen === "boolean") b.isOpen = isOpen;
  b.updatedAt = new Date().toISOString();
  persist();
  logAudit({ actor: req.user, action: "update_business", entityType: "business", entityId: b.id });
  res.json({ business: b });
});

router.get("/businesses/:id/products", (req, res) => {
  const b = findOwnedBusiness(req.user.id, req.params.id);
  if (!b) return res.status(404).json({ error: "Not found" });
  const products = db().products.filter((p) => p.businessId === b.id);
  res.json({ products });
});

router.post("/businesses/:id/products", (req, res) => {
  const b = findOwnedBusiness(req.user.id, req.params.id);
  if (!b) return res.status(404).json({ error: "Not found" });
  const { name, description, price, image, category, available, stock, vegetarian } = req.body || {};
  if (!name || typeof price !== "number") return res.status(400).json({ error: "name and price required" });
  const product = {
    id: genId("prd"),
    businessId: b.id,
    name,
    description: description || "",
    price,
    image: image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=60",
    category: category || "Other",
    available: available !== false,
    stock: typeof stock === "number" ? stock : 99,
    vegetarian: !!vegetarian,
    createdAt: new Date().toISOString()
  };
  db().products.push(product);
  persist();
  logAudit({ actor: req.user, action: "create_product", entityType: "product", entityId: product.id, meta: { businessId: b.id, name } });
  res.json({ product });
});

router.patch("/products/:id", (req, res) => {
  const p = db().products.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  const b = findOwnedBusiness(req.user.id, p.businessId);
  if (!b) return res.status(403).json({ error: "Forbidden" });
  const { name, description, price, image, category, available, stock, vegetarian } = req.body || {};
  if (name) p.name = name;
  if (description !== undefined) p.description = description;
  if (typeof price === "number") p.price = price;
  if (image) p.image = image;
  if (category) p.category = category;
  if (typeof available === "boolean") p.available = available;
  if (typeof stock === "number") p.stock = stock;
  if (typeof vegetarian === "boolean") p.vegetarian = vegetarian;
  persist();
  logAudit({ actor: req.user, action: "update_product", entityType: "product", entityId: p.id });
  res.json({ product: p });
});

router.delete("/products/:id", (req, res) => {
  const i = db().products.findIndex((x) => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  const p = db().products[i];
  const b = findOwnedBusiness(req.user.id, p.businessId);
  if (!b) return res.status(403).json({ error: "Forbidden" });
  db().products.splice(i, 1);
  persist();
  logAudit({ actor: req.user, action: "delete_product", entityType: "product", entityId: p.id });
  res.json({ ok: true });
});

router.get("/orders", (req, res) => {
  const myBizIds = getMyBusinesses(req.user.id).map((b) => b.id);
  const orders = db().ordersLog
    .filter((o) => myBizIds.includes(o.businessId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ orders });
});

router.get("/earnings", (req, res) => {
  const myBizIds = getMyBusinesses(req.user.id).map((b) => b.id);
  const orders = db().ordersLog.filter((o) => myBizIds.includes(o.businessId) && o.status === "delivered");
  const grossRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const platformCommission = orders.reduce((s, o) => s + (o.platformCommission || 0), 0);
  const netRevenue = grossRevenue - platformCommission;
  const myPayouts = db().payouts.filter((p) => p.businessId && myBizIds.includes(p.businessId));
  const paidOut = myPayouts.filter((p) => p.status === "processed").reduce((s, p) => s + p.amount, 0);
  res.json({
    grossRevenue,
    platformCommission,
    netRevenue,
    paidOut,
    pendingBalance: netRevenue - paidOut,
    payouts: myPayouts,
    orderCount: orders.length
  });
});

router.post("/payouts/request", (req, res) => {
  const { businessId, amount } = req.body || {};
  const b = findOwnedBusiness(req.user.id, businessId);
  if (!b) return res.status(404).json({ error: "Business not found" });
  if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
  const payout = {
    id: genId("po"),
    businessId: b.id,
    userId: req.user.id,
    amount,
    status: "pending",
    requestedAt: new Date().toISOString()
  };
  db().payouts.push(payout);
  persist();
  logAudit({ actor: req.user, action: "request_payout", entityType: "payout", entityId: payout.id, meta: { amount } });
  const admins = db().users.filter((u) => u.role === "super_admin");
  admins.forEach((a) => notify(a.id, { type: "payout_request", title: "Payout requested", body: `${b.name} requested ₹${amount}` }));
  res.json({ payout });
});

router.get("/promotions", (req, res) => {
  const myBizIds = getMyBusinesses(req.user.id).map((b) => b.id);
  res.json({ promotions: db().promotions.filter((p) => p.scope === "business" && myBizIds.includes(p.businessId)) });
});

router.post("/promotions", (req, res) => {
  const { businessId, code, discountType, value, minOrder, validTo, usageLimit } = req.body || {};
  const b = findOwnedBusiness(req.user.id, businessId);
  if (!b) return res.status(404).json({ error: "Business not found" });
  if (!code || !discountType || typeof value !== "number") return res.status(400).json({ error: "code, discountType, value required" });
  const promo = {
    id: genId("pr"),
    businessId: b.id,
    code: String(code).toUpperCase(),
    discountType,
    value,
    scope: "business",
    minOrder: minOrder || 0,
    validFrom: new Date().toISOString(),
    validTo: validTo || null,
    usageLimit: usageLimit || null,
    usedCount: 0,
    active: true,
    createdAt: new Date().toISOString()
  };
  db().promotions.push(promo);
  persist();
  logAudit({ actor: req.user, action: "create_promo", entityType: "promotion", entityId: promo.id, meta: { businessId, code } });
  res.json({ promotion: promo });
});

router.get("/reviews", (req, res) => {
  const myBizIds = getMyBusinesses(req.user.id).map((b) => b.id);
  res.json({ reviews: db().reviews.filter((r) => myBizIds.includes(r.businessId)) });
});

router.post("/reviews/:id/respond", (req, res) => {
  const r = db().reviews.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "Not found" });
  const b = findOwnedBusiness(req.user.id, r.businessId);
  if (!b) return res.status(403).json({ error: "Forbidden" });
  r.ownerResponse = { body: req.body?.message || "", at: new Date().toISOString() };
  persist();
  res.json({ review: r });
});

module.exports = router;
