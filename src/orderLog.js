const { db, persist } = require("./db");

function logOrderCreated(order, ctx = {}) {
  const settings = db().settings;
  const total = Number(order.total) || 0;
  const platformCommission = Math.round((total * (ctx.commissionPct ?? settings.platformCommissionPct)) / 100);
  const partnerEarning = Math.max(0, Math.round((total - platformCommission) * 0.4));

  const entry = {
    id: order.id,
    serviceType: order.serviceType,
    serviceBrand: order.serviceBrand,
    status: order.status,
    items: order.items?.map((i) => ({ name: i.name, qty: i.qty, price: i.price })) || [],
    total,
    fare: order.fare || null,
    customerUserId: ctx.customerUserId || null,
    customerName: order.customer?.name || null,
    customerPhone: order.customer?.phone || null,
    customerAddress: order.customer?.address || null,
    businessId: ctx.businessId || null,
    businessName: order.restaurant?.name || null,
    pickup: order.pickup ? { address: order.pickup.address, lat: order.pickup.lat, lng: order.pickup.lng } : null,
    drop: order.drop ? { address: order.drop.address, lat: order.drop.lat, lng: order.drop.lng } : null,
    partnerUserId: null,
    partnerName: null,
    platformCommission,
    partnerEarning,
    deliveryFee: settings.deliveryFeeBase,
    createdAt: order.createdAt,
    acceptedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    cancelledAt: null
  };

  const idx = db().ordersLog.findIndex((x) => x.id === entry.id);
  if (idx >= 0) db().ordersLog[idx] = { ...db().ordersLog[idx], ...entry };
  else db().ordersLog.unshift(entry);
  if (db().ordersLog.length > 5000) db().ordersLog.length = 5000;
  persist();
  return entry;
}

function updateOrderLog(orderId, patch) {
  const o = db().ordersLog.find((x) => x.id === orderId);
  if (!o) return null;
  Object.assign(o, patch);
  if (patch.status === "delivered" && !o.deliveredAt) o.deliveredAt = new Date().toISOString();
  if (patch.status === "cancelled" && !o.cancelledAt) o.cancelledAt = new Date().toISOString();
  persist();
  return o;
}

function attachPartnerToLog(orderId, partner) {
  const o = db().ordersLog.find((x) => x.id === orderId);
  if (!o) return null;
  o.partnerUserId = partner?.id || null;
  o.partnerName = partner?.name || null;
  o.acceptedAt = new Date().toISOString();
  o.status = "accepted";
  persist();
  return o;
}

module.exports = { logOrderCreated, updateOrderLog, attachPartnerToLog };
