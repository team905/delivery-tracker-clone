const express = require("express");
const { db } = require("../db");

const router = express.Router();

router.get("/businesses", (req, res) => {
  const { serviceType } = req.query;
  let items = db().businesses.filter((b) => b.status === "active");
  if (serviceType) items = items.filter((b) => b.serviceType === serviceType);
  res.json({
    businesses: items.map((b) => ({
      id: b.id,
      name: b.name,
      serviceType: b.serviceType,
      description: b.description,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      image: b.image,
      cuisines: b.cuisines || [],
      rating: b.rating,
      isOpen: b.isOpen,
      hours: b.hours,
      featured: b.featured
    }))
  });
});

router.get("/businesses/:id", (req, res) => {
  const b = db().businesses.find((x) => x.id === req.params.id && x.status === "active");
  if (!b) return res.status(404).json({ error: "Not found" });
  const products = db().products.filter((p) => p.businessId === b.id && p.available);
  res.json({ business: b, products });
});

router.post("/promotions/validate", (req, res) => {
  const { code, businessId, total } = req.body || {};
  if (!code) return res.status(400).json({ error: "code required" });
  const promo = db().promotions.find(
    (p) => p.code === String(code).toUpperCase() && p.active && (p.scope === "platform" || p.businessId === businessId)
  );
  if (!promo) return res.status(404).json({ error: "Invalid coupon" });
  if (promo.validTo && new Date(promo.validTo).getTime() < Date.now()) return res.status(400).json({ error: "Coupon expired" });
  if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return res.status(400).json({ error: "Coupon limit reached" });
  if (promo.minOrder && (total || 0) < promo.minOrder) return res.status(400).json({ error: `Min order ₹${promo.minOrder}` });
  const discount = promo.discountType === "pct" ? Math.round(((total || 0) * promo.value) / 100) : promo.value;
  res.json({ promotion: promo, discount });
});

module.exports = router;
