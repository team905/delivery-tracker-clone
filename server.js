const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");

const { restaurants } = require("./src/restaurants");
const {
  createSimulation,
  advanceSimulation,
  currentPoint,
  currentHeading,
  buildStatusMessage,
  deriveOrderStatus,
  etaMinutes,
  remainingDistanceKm,
  totalDistanceKm,
  progressPercent,
  currentSpeedKmh,
  distanceCoveredKm,
  recentTrail
} = require("./src/simulator");
const { ensureName, getCachedName } = require("./src/reverse-geocode");
const {
  SERVICES,
  SERVICE_LIST,
  getService,
  publicServiceSummary
} = require("./src/services");
const {
  groceryStores,
  groceryCategories,
  groceryProducts,
  shopWarehouse,
  shopCategories,
  shopProducts,
  cabVehicles,
  parcelVehicles,
  parcelPackageTypes,
  distanceKm,
  estimateFare
} = require("./src/catalogs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const BASE_PORT = Number(process.env.PORT) || 4010;
const MAX_PORT_ATTEMPTS = 10;
const TICK_MS = 1500;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const orders = new Map();
const riderNotifications = new Map();

const riders = [
  {
    id: "rd1",
    name: "Ravi Kumar",
    phone: "+91 90000 12345",
    vehicle: "Honda Activa · MH 01 AB 7721",
    rating: 4.9,
    totalDeliveries: 2841,
    photo: "https://i.pravatar.cc/200?img=12",
    verified: true,
    backgroundCheckedOn: "2024-11-02",
    joinedOn: "2022-03-14"
  },
  {
    id: "rd2",
    name: "Aman Shaikh",
    phone: "+91 98765 43210",
    vehicle: "Hero Splendor · MH 02 CD 3341",
    rating: 4.8,
    totalDeliveries: 1976,
    photo: "https://i.pravatar.cc/200?img=33",
    verified: true,
    backgroundCheckedOn: "2025-01-18",
    joinedOn: "2023-06-02"
  },
  {
    id: "rd3",
    name: "Priya Nair",
    phone: "+91 91234 56780",
    vehicle: "TVS Jupiter · MH 03 EF 8899",
    rating: 4.95,
    totalDeliveries: 3412,
    photo: "https://i.pravatar.cc/200?img=47",
    verified: true,
    backgroundCheckedOn: "2024-09-05",
    joinedOn: "2021-08-21"
  }
];

/* ===== Kitchen prep stages (before a rider is assigned) ===== */
const PREP_STAGES = [
  { key: "received", label: "Order received", illustration: "receipt", durationMs: 6000 },
  { key: "chopping", label: "Chopping & prepping", illustration: "chopping", durationMs: 12000 },
  { key: "cooking", label: "Cooking your food", illustration: "cooking", durationMs: 18000 },
  { key: "packing", label: "Packing & sealing", illustration: "packing", durationMs: 10000 }
];

function genOrderId() {
  return "ZOM" + crypto.randomBytes(2).toString("hex").toUpperCase();
}

function genOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function genShareToken() {
  return crypto.randomBytes(8).toString("hex");
}

function getRestaurant(id) {
  return restaurants.find((r) => r.id === id);
}

function addEvent(order, type, message, meta = {}) {
  const entry = {
    type,
    message,
    at: new Date().toISOString(),
    ...meta
  };
  order.events.push(entry);
  order.statusHistory.push({ status: order.status, at: entry.at, message });
  return entry;
}

function getPrepStage(order) {
  if (!order.prep) return null;
  if (order.hasKitchenPrep === false || order.prep.fast) {
    const svc = getService(order.serviceType) || SERVICES.food;
    const labels = svc.labels;
    const elapsed = Date.now() - order.prep.startedAt;
    const overall = Math.min(100, Math.round((elapsed / order.prep.totalMs) * 100));
    return {
      key: "prep-fast",
      label: labels.finding,
      illustration: svc.id === "cab" || svc.id === "parcel" ? "searching" : "packing",
      progress: overall,
      stageIndex: 0,
      totalStages: 1,
      overallProgress: overall
    };
  }
  const elapsed = Date.now() - order.prep.startedAt;
  let acc = 0;
  for (const stage of PREP_STAGES) {
    if (elapsed < acc + stage.durationMs) {
      const localProgress = Math.min(1, (elapsed - acc) / stage.durationMs);
      return {
        key: stage.key,
        label: stage.label,
        illustration: stage.illustration,
        progress: Math.round(localProgress * 100),
        stageIndex: PREP_STAGES.indexOf(stage),
        totalStages: PREP_STAGES.length,
        overallProgress: Math.round(((acc + localProgress * stage.durationMs) / order.prep.totalMs) * 100)
      };
    }
    acc += stage.durationMs;
  }
  return {
    key: "ready",
    label: "Ready for pickup",
    illustration: "packing",
    progress: 100,
    stageIndex: PREP_STAGES.length - 1,
    totalStages: PREP_STAGES.length,
    overallProgress: 100
  };
}

/* ===== Build tracking payload (what the customer client receives) ===== */
function buildTrackingPayload(order, { publicMode = false } = {}) {
  const sim = order.simulation;
  const pos = sim ? currentPoint(sim) : null;
  const heading = sim ? currentHeading(sim) : 0;
  const eta = sim ? etaMinutes(sim) : order.restaurant.deliveryMinutes;
  const distanceRemainingKm = sim ? remainingDistanceKm(sim) : null;
  const totalKm = sim ? totalDistanceKm(sim) : null;
  const progress = sim ? progressPercent(sim) : 0;
  const speedKmh = sim ? currentSpeedKmh(sim) : 0;
  const coveredKm = sim ? distanceCoveredKm(sim) : 0;
  const trail = sim ? recentTrail(sim, 12) : null;

  let landmark = null;
  if (pos) {
    ensureName(pos.lat, pos.lng);
    landmark = getCachedName(pos.lat, pos.lng);
  }

  const prepStage = getPrepStage(order);

  const svc = getService(order.serviceType) || SERVICES.food;
  const L = svc.labels;
  let simMsg = null;
  if (sim) {
    simMsg = buildStatusMessage(sim);
    if (svc.id !== "food") {
      // Rewrite generic "Rider/restaurant/meal" words to service-appropriate terms
      simMsg = simMsg
        .replace(/enjoy your meal!/i, `${L.order} completed`)
        .replace(/Order delivered/i, L.delivered)
        .replace(/the restaurant/ig, L.source.toLowerCase())
        .replace(/Rider is heading to /i, `${L.partnerShort} is heading to `)
        .replace(/Rider is picking up your order/i,
          svc.id === "cab" ? "Driver arrived at pickup" :
          svc.id === "parcel" ? `${L.partnerShort} is picking up your parcel` :
          `${L.partnerShort} is picking up your order`)
        .replace(/Rider is arriving at your location/i,
          svc.id === "cab" ? "Arriving at drop" :
          `${L.partnerShort} is arriving at your location`)
        .replace(/Rider is very close/i,
          svc.id === "cab" ? "Almost at drop" : `${L.partnerShort} is very close`)
        .replace(/Rider is on the way with your order/i,
          svc.id === "cab" ? "Trip in progress" :
          svc.id === "parcel" ? `Parcel is on the way` :
          `${L.partnerShort} is on the way with your ${L.order}`);
    }
  }

  const payload = {
    orderId: order.id,
    status: order.status,
    serviceType: order.serviceType || "food",
    serviceLabels: order.serviceLabels || L,
    serviceBrand: order.serviceBrand || svc.brand,
    serviceEmoji: order.serviceEmoji || svc.emoji,
    serviceColor: order.serviceColor || svc.color,
    hasKitchenPrep: order.hasKitchenPrep !== false,
    allowsTip: order.allowsTip !== false,
    vehicleType: order.vehicleType || null,
    vehicleDetails: order.vehicleDetails || null,
    packageInfo: order.packageInfo || null,
    fare: order.fare || null,
    pickup: order.pickup || null,
    drop: order.drop || null,
    statusMessage: simMsg || (prepStage ? prepStage.label : L.finding + "..."),
    rider: order.rider,
    restaurant: {
      id: order.restaurant.id,
      name: order.restaurant.name,
      lat: order.restaurant.lat,
      lng: order.restaurant.lng,
      image: order.restaurant.image,
      cuisine: order.restaurant.cuisine || ""
    },
    customer: publicMode
      ? {
          lat: order.customer.lat,
          lng: order.customer.lng,
          address: "Delivery address hidden"
        }
      : order.customer,
    items: order.items,
    total: order.total,
    tip: order.tip || 0,
    rating: order.ratingSummary?.overall || 0,
    ratingSummary: order.ratingSummary,
    deliveryInstructions: order.deliveryInstructions || "Leave at the door",
    deliveryCategory: order.deliveryCategory,
    otp: publicMode ? "••••" : order.otp,
    routeMode: sim ? sim.mode : null,
    currentLocation: pos,
    heading,
    route: sim ? sim.path : null,
    trail,
    etaMinutes: eta,
    distanceRemainingKm,
    distanceCoveredKm: coveredKm,
    totalKm,
    progress,
    speedKmh,
    landmark,
    events: order.events,
    statusHistory: order.statusHistory,
    prepStage,
    customerNote: order.customerNote || null,
    riderMessage: order.riderMessage || null,
    chat: publicMode ? [] : order.chat,
    reports: publicMode ? [] : order.reports,
    watcherCount: order.watcherCount || 0,
    shareToken: publicMode ? null : order.shareToken,
    publicMode: !!publicMode,
    createdAt: order.createdAt,
    lastUpdatedAt: new Date().toISOString()
  };

  return payload;
}

function emitOrderUpdate(order) {
  io.to(order.id).emit("tracking-update", buildTrackingPayload(order));
  const publicRoom = `public:${order.shareToken}`;
  io.to(publicRoom).emit("tracking-update", buildTrackingPayload(order, { publicMode: true }));
  io.to("riders").emit("rider-orders", listRiderVisibleOrders());
  if (order.rider) {
    io.to(`rider:${order.rider.id}`).emit("rider-order-update", buildRiderOrderView(order));
  }
}

function buildRiderOrderView(order) {
  const svc = getService(order.serviceType) || SERVICES.food;
  return {
    id: order.id,
    status: order.status,
    serviceType: order.serviceType || "food",
    serviceLabels: order.serviceLabels || svc.labels,
    serviceBrand: order.serviceBrand || svc.brand,
    serviceEmoji: order.serviceEmoji || svc.emoji,
    serviceColor: order.serviceColor || svc.color,
    vehicleType: order.vehicleType || null,
    vehicleDetails: order.vehicleDetails || null,
    packageInfo: order.packageInfo || null,
    fare: order.fare || null,
    pickup: order.pickup || null,
    drop: order.drop || null,
    restaurant: {
      id: order.restaurant.id,
      name: order.restaurant.name,
      lat: order.restaurant.lat,
      lng: order.restaurant.lng,
      image: order.restaurant.image
    },
    customer: order.customer,
    items: order.items,
    total: order.total,
    tip: order.tip || 0,
    rider: order.rider,
    customerNote: order.customerNote || null,
    deliveryInstructions: order.deliveryInstructions,
    otp: order.otp,
    createdAt: order.createdAt,
    chat: order.chat,
    events: order.events
  };
}

function listRiderVisibleOrders() {
  return Array.from(orders.values())
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled")
    .map((o) => buildRiderOrderView(o));
}

function getOrderById(id) {
  if (!id) return null;
  return orders.get(String(id).toUpperCase());
}

function findOrderByShareToken(token) {
  for (const o of orders.values()) {
    if (o.shareToken === token) return o;
  }
  return null;
}

/* ===================== ORDER BUILDERS (service-aware) ===================== */

function normalizeLocation(loc, fallbackName = "Selected location") {
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;
  return {
    lat: loc.lat,
    lng: loc.lng,
    address: loc.address || fallbackName,
    name: loc.name || loc.contactName || fallbackName,
    phone: loc.phone || "",
    floorNote: loc.floorNote || ""
  };
}

function emptyOrderShell(service) {
  return {
    id: genOrderId(),
    status: "placed",
    shareToken: genShareToken(),
    serviceType: service.id,
    serviceLabels: service.labels,
    serviceBrand: service.brand,
    serviceEmoji: service.emoji,
    serviceColor: service.color,
    hasKitchenPrep: !!service.hasKitchenPrep,
    allowsTip: !!service.allowsTip,
    items: [],
    total: 0,
    fare: null,
    tip: 0,
    ratingSummary: null,
    deliveryInstructions: "",
    deliveryCategory: "standard",
    otp: genOtp(),
    rider: null,
    simulation: null,
    events: [],
    statusHistory: [],
    chat: [],
    reports: [],
    customerNote: null,
    riderMessage: null,
    watcherCount: 0,
    prep: null,
    createdAt: new Date().toISOString(),
    vehicleType: null,
    packageInfo: null,
    pickup: null,
    drop: null,
    restaurant: null
  };
}

/** Build a catalog-style order (food / grocery / shop). */
function buildCatalogOrder({ service, vendor, customer, items, deliveryInstructions, deliveryCategory }) {
  const order = emptyOrderShell(service);
  const total = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (it.qty || 1), 0);

  order.restaurant = {
    id: vendor.id,
    name: vendor.name,
    lat: vendor.lat,
    lng: vendor.lng,
    image: vendor.image || null,
    cuisine: vendor.cuisine || vendor.tagline || ""
  };
  order.pickup = {
    lat: vendor.lat,
    lng: vendor.lng,
    address: vendor.name,
    name: vendor.name,
    image: vendor.image || null
  };
  order.drop = normalizeLocation({
    lat: customer.lat,
    lng: customer.lng,
    address: customer.address || "Delivery address",
    name: customer.name || "You"
  }, "Delivery address");
  order.customer = {
    name: customer.name || "Guest",
    phone: customer.phone || "+91 99999 00000",
    address: customer.address || "Selected location",
    lat: customer.lat,
    lng: customer.lng
  };
  order.items = items.map((i) => ({ ...i }));
  order.total = total;
  order.deliveryInstructions = deliveryInstructions || "Leave at the door";
  order.deliveryCategory = deliveryCategory || "standard";

  if (service.hasKitchenPrep) {
    const prepTotal = PREP_STAGES.reduce((sum, s) => sum + s.durationMs, 0);
    order.prep = { startedAt: Date.now(), totalMs: prepTotal };
    addEvent(order, "placed", "Order placed successfully");
    addEvent(order, "restaurant_confirmed", `${vendor.name} confirmed your order`);
    addEvent(order, "prep_started", "Kitchen started preparing your food");
  } else {
    const prepTotal = 14000;
    order.prep = { startedAt: Date.now(), totalMs: prepTotal, fast: true };
    addEvent(order, "placed", service.labels.orderPlaced);
    addEvent(order, "vendor_confirmed", `${vendor.name} is packing your ${service.labels.order}`);
  }
  return order;
}

/** Build a transport-style order (cab / parcel). */
function buildTransportOrder({ service, pickup, drop, customer, vehicleType, packageInfo, deliveryInstructions, fare }) {
  const order = emptyOrderShell(service);
  const vehicleList = service.id === "cab" ? cabVehicles : parcelVehicles;
  const vehicle = vehicleList.find((v) => v.id === vehicleType) || vehicleList[0];

  order.vehicleType = vehicle.id;
  order.vehicleDetails = vehicle;
  order.packageInfo = packageInfo || null;
  order.pickup = pickup;
  order.drop = drop;
  order.restaurant = {
    id: `pickup-${order.id}`,
    name: pickup.name || pickup.address || service.labels.source,
    lat: pickup.lat,
    lng: pickup.lng,
    image: null,
    cuisine: service.tagline
  };
  order.customer = {
    name: customer?.name || drop.name || "Receiver",
    phone: customer?.phone || drop.phone || "+91 99999 00000",
    address: drop.address || "Drop address",
    lat: drop.lat,
    lng: drop.lng
  };
  order.deliveryInstructions = deliveryInstructions || "";
  order.deliveryCategory = service.id;
  order.fare = fare || null;
  order.total = fare?.total || 0;

  const items = [];
  if (service.id === "cab") {
    items.push({
      id: "ride",
      name: `${vehicle.emoji} ${vehicle.name} ride`,
      price: fare?.total || 0,
      qty: 1,
      description: `${fare?.km || "—"} km · ~${fare?.min || "—"} min`
    });
  } else {
    items.push({
      id: "parcel",
      name: `${vehicle.emoji} ${vehicle.name} · ${packageInfo?.typeLabel || "Parcel"}`,
      price: fare?.total || 0,
      qty: 1,
      description: packageInfo?.note || "Parcel delivery"
    });
  }
  order.items = items;

  order.prep = { startedAt: Date.now(), totalMs: 10000, fast: true };
  addEvent(order, "placed", service.labels.orderPlaced);
  addEvent(order, service.id === "cab" ? "searching_driver" : "searching_partner",
    service.labels.finding);
  return order;
}

function finalizeNewOrder(order) {
  orders.set(order.id, order);
  io.to("riders").emit("rider-orders", listRiderVisibleOrders());
  io.to("riders").emit("new-order", { orderId: order.id, serviceType: order.serviceType });
}

/* ===================== PUBLIC API ===================== */
app.get("/api/health", (_, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get("/api/restaurants", (_, res) => res.json({ restaurants }));
app.get("/api/riders", (_, res) => res.json({ riders }));

/* ===== Service discovery ===== */
app.get("/api/services", (_, res) => {
  res.json({ services: SERVICE_LIST.map(publicServiceSummary) });
});

app.get("/api/services/:id", (req, res) => {
  const svc = getService(req.params.id);
  if (!svc) return res.status(404).json({ error: "Unknown service" });
  res.json({ service: publicServiceSummary(svc) });
});

/* ===== Grocery catalog ===== */
app.get("/api/grocery/stores", (_, res) => {
  res.json({ stores: groceryStores, categories: groceryCategories });
});

app.get("/api/grocery/stores/:id", (req, res) => {
  const store = groceryStores.find((s) => s.id === req.params.id);
  if (!store) return res.status(404).json({ error: "Store not found" });
  res.json({
    store,
    categories: groceryCategories,
    products: groceryProducts
  });
});

/* ===== Shop catalog ===== */
app.get("/api/shop", (_, res) => {
  res.json({
    warehouse: shopWarehouse,
    categories: shopCategories,
    products: shopProducts
  });
});

app.get("/api/shop/products/:id", (req, res) => {
  const product = shopProducts.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json({ product });
});

/* ===== Cab & parcel vehicle lookup + fare preview ===== */
app.get("/api/cab/vehicles", (_, res) => res.json({ vehicles: cabVehicles }));
app.get("/api/parcel/vehicles", (_, res) => res.json({ vehicles: parcelVehicles, packageTypes: parcelPackageTypes }));

app.post("/api/cab/estimate", (req, res) => {
  const { pickup, drop } = req.body || {};
  if (!pickup || !drop || typeof pickup.lat !== "number" || typeof drop.lat !== "number") {
    return res.status(400).json({ error: "Pickup and drop required" });
  }
  const estimates = cabVehicles.map((v) => ({
    ...v,
    fare: estimateFare(v, pickup, drop)
  }));
  res.json({ estimates });
});

app.post("/api/parcel/estimate", (req, res) => {
  const { pickup, drop } = req.body || {};
  if (!pickup || !drop || typeof pickup.lat !== "number" || typeof drop.lat !== "number") {
    return res.status(400).json({ error: "Pickup and drop required" });
  }
  const estimates = parcelVehicles.map((v) => ({
    ...v,
    fare: estimateFare(v, pickup, drop)
  }));
  res.json({ estimates });
});

/* ===== Generic catalog-order endpoint (grocery / shop) ===== */
app.post("/api/grocery/orders", (req, res) => {
  const { storeId, items, customer, deliveryInstructions } = req.body || {};
  const store = groceryStores.find((s) => s.id === storeId);
  if (!store) return res.status(400).json({ error: "Invalid store" });
  if (!customer || typeof customer.lat !== "number" || typeof customer.lng !== "number") {
    return res.status(400).json({ error: "Customer location required" });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  const hydratedItems = items
    .map((it) => {
      const p = groceryProducts.find((x) => x.id === it.id);
      if (!p) return null;
      return { id: p.id, name: p.name, unit: p.unit, price: p.price, qty: Math.max(1, Math.min(20, Number(it.qty) || 1)) };
    })
    .filter(Boolean);
  if (!hydratedItems.length) return res.status(400).json({ error: "Invalid items" });

  const order = buildCatalogOrder({
    service: SERVICES.grocery,
    vendor: store,
    customer,
    items: hydratedItems,
    deliveryInstructions: deliveryInstructions || "Leave at the door",
    deliveryCategory: "grocery"
  });
  finalizeNewOrder(order);
  res.status(201).json({ orderId: order.id, shareToken: order.shareToken, order: buildTrackingPayload(order) });
});

app.post("/api/shop/orders", (req, res) => {
  const { items, customer, deliveryInstructions } = req.body || {};
  if (!customer || typeof customer.lat !== "number" || typeof customer.lng !== "number") {
    return res.status(400).json({ error: "Customer location required" });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Cart is empty" });
  }
  const hydrated = items
    .map((it) => {
      const p = shopProducts.find((x) => x.id === it.id);
      if (!p) return null;
      return { id: p.id, name: p.name, unit: p.unit, price: p.price, qty: Math.max(1, Math.min(5, Number(it.qty) || 1)) };
    })
    .filter(Boolean);
  if (!hydrated.length) return res.status(400).json({ error: "Invalid items" });

  const order = buildCatalogOrder({
    service: SERVICES.shop,
    vendor: shopWarehouse,
    customer,
    items: hydrated,
    deliveryInstructions: deliveryInstructions || "Leave with security",
    deliveryCategory: "shop"
  });
  finalizeNewOrder(order);
  res.status(201).json({ orderId: order.id, shareToken: order.shareToken, order: buildTrackingPayload(order) });
});

/* ===== Transport-order endpoints (cab / parcel) ===== */
app.post("/api/cab/orders", (req, res) => {
  const { pickup, drop, vehicleType, rider, deliveryInstructions } = req.body || {};
  const pu = normalizeLocation(pickup, "Pickup");
  const dp = normalizeLocation(drop, "Drop");
  if (!pu || !dp) return res.status(400).json({ error: "Valid pickup and drop required" });
  const vehicle = cabVehicles.find((v) => v.id === vehicleType) || cabVehicles[0];
  const fare = estimateFare(vehicle, pu, dp);

  const order = buildTransportOrder({
    service: SERVICES.cab,
    pickup: pu,
    drop: dp,
    customer: rider,
    vehicleType: vehicle.id,
    packageInfo: null,
    deliveryInstructions: deliveryInstructions || "",
    fare
  });
  finalizeNewOrder(order);
  res.status(201).json({ orderId: order.id, shareToken: order.shareToken, order: buildTrackingPayload(order) });
});

app.post("/api/parcel/orders", (req, res) => {
  const { pickup, drop, vehicleType, packageInfo, sender, receiver, deliveryInstructions } = req.body || {};
  const pu = normalizeLocation({ ...pickup, name: sender?.name, phone: sender?.phone }, "Pickup");
  const dp = normalizeLocation({ ...drop, name: receiver?.name, phone: receiver?.phone }, "Drop");
  if (!pu || !dp) return res.status(400).json({ error: "Valid pickup and drop required" });
  const vehicle = parcelVehicles.find((v) => v.id === vehicleType) || parcelVehicles[0];
  const fare = estimateFare(vehicle, pu, dp);
  const pkg = packageInfo && typeof packageInfo === "object"
    ? {
        typeId: String(packageInfo.typeId || "other"),
        typeLabel: String(packageInfo.typeLabel || "Other"),
        weightKg: Number(packageInfo.weightKg) || null,
        note: String(packageInfo.note || "").slice(0, 200)
      }
    : null;

  const order = buildTransportOrder({
    service: SERVICES.parcel,
    pickup: pu,
    drop: dp,
    customer: { name: sender?.name, phone: sender?.phone },
    vehicleType: vehicle.id,
    packageInfo: pkg,
    deliveryInstructions: deliveryInstructions || "",
    fare
  });
  finalizeNewOrder(order);
  res.status(201).json({ orderId: order.id, shareToken: order.shareToken, order: buildTrackingPayload(order) });
});

app.post("/api/orders", (req, res) => {
  const { restaurantId, customer, items, deliveryInstructions, deliveryCategory } = req.body || {};
  const restaurant = getRestaurant(restaurantId);

  if (!restaurant) return res.status(400).json({ error: "Invalid restaurant" });
  if (!customer || typeof customer.lat !== "number" || typeof customer.lng !== "number") {
    return res.status(400).json({ error: "Customer location is required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Order must contain at least one item" });
  }

  const order = buildCatalogOrder({
    service: SERVICES.food,
    vendor: restaurant,
    customer,
    items,
    deliveryInstructions: deliveryInstructions || "Leave at the door",
    deliveryCategory: deliveryCategory || "standard"
  });

  finalizeNewOrder(order);
  res.status(201).json({ orderId: order.id, shareToken: order.shareToken, order: buildTrackingPayload(order) });
});

app.get("/api/orders/:id", (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(buildTrackingPayload(order));
});

app.get("/api/share/:token", (req, res) => {
  const order = findOrderByShareToken(req.params.token);
  if (!order) return res.status(404).json({ error: "Invalid link" });
  res.json(buildTrackingPayload(order, { publicMode: true }));
});

app.post("/api/orders/:id/cancel", (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "placed") {
    return res.status(400).json({ error: "Cannot cancel once the rider is assigned" });
  }
  order.status = "cancelled";
  addEvent(order, "cancelled", "Order cancelled");
  emitOrderUpdate(order);
  res.json({ ok: true, order: buildTrackingPayload(order) });
});

app.post("/api/orders/:id/tip", (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const amount = Math.max(0, Math.min(5000, Math.round(Number(req.body?.amount) || 0)));
  order.tip = amount;
  addEvent(order, "tipped", `₹${amount} tip added for the rider`);
  emitOrderUpdate(order);
  res.json({ ok: true });
});

app.post("/api/orders/:id/rate", (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const body = req.body || {};
  const overall = Math.max(1, Math.min(5, Number(body.overall || body.rating) || 5));
  const food = Math.max(0, Math.min(5, Number(body.food) || 0));
  const rider = Math.max(0, Math.min(5, Number(body.rider) || 0));
  const packaging = Math.max(0, Math.min(5, Number(body.packaging) || 0));
  const tags = Array.isArray(body.tags) ? body.tags.slice(0, 12).map((t) => String(t).slice(0, 30)) : [];
  const comment = String(body.comment || "").slice(0, 400);
  const photo = typeof body.photo === "string" && body.photo.length < 800000 ? body.photo : null;

  order.ratingSummary = {
    overall,
    food,
    rider,
    packaging,
    tags,
    comment,
    photo,
    at: new Date().toISOString()
  };
  addEvent(order, "rated", `Rated ${overall}★`);
  emitOrderUpdate(order);
  res.json({ ok: true });
});

app.post("/api/orders/:id/instructions", (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  order.deliveryInstructions = String(req.body?.instructions || "").slice(0, 120);
  if (req.body?.category) order.deliveryCategory = String(req.body.category).slice(0, 20);
  addEvent(order, "instructions_updated", `Instructions updated: ${order.deliveryInstructions}`);
  emitOrderUpdate(order);
  res.json({ ok: true });
});

app.post("/api/orders/:id/note", (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const text = String(req.body?.text || "").slice(0, 240);
  if (!text) {
    order.customerNote = null;
  } else {
    order.customerNote = { text, at: new Date().toISOString() };
    addEvent(order, "note_added", `Customer note: ${text}`);
  }
  emitOrderUpdate(order);
  res.json({ ok: true, customerNote: order.customerNote });
});

app.post("/api/orders/:id/report", (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const category = String(req.body?.category || "other").slice(0, 40);
  const description = String(req.body?.description || "").slice(0, 600);
  const report = {
    id: crypto.randomBytes(4).toString("hex"),
    category,
    description,
    at: new Date().toISOString()
  };
  order.reports.push(report);
  addEvent(order, "issue_reported", `Issue reported: ${category}`);
  emitOrderUpdate(order);
  res.json({ ok: true, report });
});

app.post("/api/orders/:id/chat", (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const text = String(req.body?.text || "").slice(0, 500);
  const from = req.body?.from === "rider" ? "rider" : "customer";
  if (!text) return res.status(400).json({ error: "Empty message" });
  const msg = {
    id: crypto.randomBytes(4).toString("hex"),
    from,
    text,
    at: new Date().toISOString()
  };
  order.chat.push(msg);
  io.to(order.id).emit("chat-message", msg);
  if (order.rider) {
    io.to(`rider:${order.rider.id}`).emit("chat-message", { orderId: order.id, ...msg });
  }
  res.json({ ok: true, message: msg });
});

app.post("/api/orders/:id/rider-message", (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const text = String(req.body?.text || "").slice(0, 140);
  if (!text) {
    order.riderMessage = null;
  } else {
    order.riderMessage = { text, at: new Date().toISOString() };
    addEvent(order, "rider_message", text);
  }
  emitOrderUpdate(order);
  res.json({ ok: true, riderMessage: order.riderMessage });
});

app.post("/api/orders/:id/cheer", (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const emoji = String(req.body?.emoji || "❤️").slice(0, 4);
  io.to(order.id).emit("cheer", { emoji, at: Date.now() });
  io.to(`public:${order.shareToken}`).emit("cheer", { emoji, at: Date.now() });
  res.json({ ok: true });
});

/* ===================== RIDER API ===================== */
app.get("/api/rider/orders", (_, res) => res.json({ orders: listRiderVisibleOrders() }));

app.post("/api/rider/:orderId/accept", async (req, res) => {
  const order = getOrderById(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "placed") return res.status(400).json({ error: "Order already accepted or closed" });

  const { riderId } = req.body || {};
  const chosen = riders.find((r) => r.id === riderId) || riders[0];

  const svc = getService(order.serviceType) || SERVICES.food;
  const source = order.pickup
    ? { lat: order.pickup.lat, lng: order.pickup.lng, name: order.pickup.name }
    : order.restaurant;
  const dest = order.drop
    ? { lat: order.drop.lat, lng: order.drop.lng }
    : order.customer;

  try {
    order.simulation = await createSimulation(source, dest);
  } catch (err) {
    return res.status(500).json({ error: "Could not start delivery" });
  }

  order.rider = chosen;
  order.status = "accepted";
  order.prep = null;
  addEvent(order, "accepted", `${chosen.name}: ${svc.labels.accepted}`);

  emitOrderUpdate(order);
  res.json({ ok: true, order: buildTrackingPayload(order) });
});

/* ===================== SOCKETS ===================== */
io.on("connection", (socket) => {
  let joinedOrderId = null;
  let joinedPublic = null;
  let joinedRiderId = null;

  socket.on("join-order", ({ orderId }) => {
    const id = String(orderId || "").toUpperCase();
    const order = orders.get(id);
    if (!order) {
      socket.emit("tracking-error", { message: "Order not found" });
      return;
    }
    joinedOrderId = id;
    socket.join(id);
    order.watcherCount = io.sockets.adapter.rooms.get(id)?.size || 1;
    emitOrderUpdate(order);
  });

  socket.on("join-public", ({ token }) => {
    const order = findOrderByShareToken(token);
    if (!order) {
      socket.emit("tracking-error", { message: "Invalid link" });
      return;
    }
    joinedPublic = token;
    const room = `public:${token}`;
    socket.join(room);
    order.watcherCount = (io.sockets.adapter.rooms.get(order.id)?.size || 0) +
      (io.sockets.adapter.rooms.get(room)?.size || 1);
    emitOrderUpdate(order);
  });

  socket.on("join-riders", () => {
    socket.join("riders");
    socket.emit("rider-orders", listRiderVisibleOrders());
  });

  socket.on("join-rider", ({ riderId }) => {
    if (!riderId) return;
    joinedRiderId = riderId;
    socket.join(`rider:${riderId}`);
  });

  socket.on("typing", ({ orderId, from }) => {
    if (!orderId) return;
    socket.to(orderId).emit("typing", { from });
  });

  socket.on("disconnect", () => {
    if (joinedOrderId) {
      const order = orders.get(joinedOrderId);
      if (order) {
        setTimeout(() => {
          order.watcherCount = (io.sockets.adapter.rooms.get(joinedOrderId)?.size || 0) +
            (order.shareToken
              ? io.sockets.adapter.rooms.get(`public:${order.shareToken}`)?.size || 0
              : 0);
          emitOrderUpdate(order);
        }, 400);
      }
    }
    if (joinedPublic) {
      const order = findOrderByShareToken(joinedPublic);
      if (order) {
        setTimeout(() => {
          order.watcherCount = (io.sockets.adapter.rooms.get(order.id)?.size || 0) +
            (io.sockets.adapter.rooms.get(`public:${joinedPublic}`)?.size || 0);
          emitOrderUpdate(order);
        }, 400);
      }
    }
  });
});

/* ===================== SIMULATION TICK ===================== */
setInterval(() => {
  orders.forEach((order) => {
    if (order.status === "delivered" || order.status === "cancelled") return;

    // Kitchen prep ticks before accept (for illustrated progress)
    if (!order.simulation && order.prep) {
      emitOrderUpdate(order);
      return;
    }

    if (!order.simulation) return;

    const prevStatus = order.status;
    const prevPhase = order.simulation.path[order.simulation.index]?.phase;

    advanceSimulation(order.simulation);
    order.status = deriveOrderStatus(order.simulation);

    const newPhase = order.simulation.path[order.simulation.index]?.phase;
    const svc = getService(order.serviceType) || SERVICES.food;
    const L = svc.labels;

    if (prevPhase !== "at_restaurant" && newPhase === "at_restaurant") {
      addEvent(order, "at_restaurant", L.at_source);
    }
    if (prevPhase === "at_restaurant" && newPhase === "to_customer") {
      addEvent(order, "picked_up", L.picked_up);
    }
    if (prevStatus !== "delivered" && order.status === "delivered") {
      addEvent(order, "delivered", L.delivered);
    }

    emitOrderUpdate(order);
  });
}, TICK_MS);

function listenWithFallback(startPort, attemptsLeft) {
  server.removeAllListeners("listening");
  server
    .once("error", (error) => {
      if (error.code === "EADDRINUSE" && attemptsLeft > 1) {
        const nextPort = startPort + 1;
        console.warn(`Port ${startPort} is busy, retrying on ${nextPort}...`);
        listenWithFallback(nextPort, attemptsLeft - 1);
        return;
      }
      if (error.code === "EADDRINUSE") {
        console.error(`Could not find a free port after ${MAX_PORT_ATTEMPTS} attempts.`);
        process.exit(1);
      }
      throw error;
    })
    .once("listening", () => {
      const actualPort = server.address().port;
      console.log(`Delivery tracking server running at http://localhost:${actualPort}`);
      console.log(`Customer:       http://localhost:${actualPort}/`);
      console.log(`Rider console:  http://localhost:${actualPort}/rider.html`);
    })
    .listen(startPort, "0.0.0.0");
}

listenWithFallback(BASE_PORT, MAX_PORT_ATTEMPTS);
