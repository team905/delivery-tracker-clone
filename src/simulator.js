const { fetchRoute } = require("./osrm");

const PICKUP_RESAMPLE = 14;
const DROP_RESAMPLE = 32;
const PICKUP_PAUSE_TICKS = 4;

function toRad(v) {
  return (v * Math.PI) / 180;
}

function toDeg(v) {
  return (v * 180) / Math.PI;
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearing(a, b) {
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function interpolate(a, b, steps) {
  const points = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    points.push({
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t
    });
  }
  return points;
}

function resample(points, target) {
  if (points.length <= target) return points.slice();
  const result = [];
  const step = (points.length - 1) / (target - 1);
  for (let i = 0; i < target; i++) {
    const idx = Math.round(i * step);
    result.push(points[Math.min(idx, points.length - 1)]);
  }
  return result;
}

function tagPhase(points, phase) {
  return points.map((p) => ({ ...p, phase }));
}

function buildPickupPause(at) {
  return Array.from({ length: PICKUP_PAUSE_TICKS }, () => ({
    ...at,
    phase: "at_restaurant"
  }));
}

async function buildRealPath(riderStart, restaurant, customer) {
  let mode = "fallback";
  let pickupLeg;
  let dropLeg;

  try {
    const [leg1, leg2] = await Promise.all([
      fetchRoute(riderStart, restaurant),
      fetchRoute(restaurant, customer)
    ]);
    pickupLeg = resample(leg1.coords, PICKUP_RESAMPLE);
    dropLeg = resample(leg2.coords, DROP_RESAMPLE);
    mode = "osrm";
    console.log(`[simulator] OSRM route: pickup=${leg1.coords.length} pts, drop=${leg2.coords.length} pts`);
  } catch (err) {
    console.warn("[simulator] OSRM failed, using fallback path:", err.message);
    pickupLeg = [riderStart, ...interpolate(riderStart, restaurant, PICKUP_RESAMPLE - 1)];
    dropLeg = [restaurant, ...interpolate(restaurant, customer, DROP_RESAMPLE - 1)];
  }

  const path = [
    ...tagPhase(pickupLeg, "to_restaurant"),
    ...buildPickupPause(restaurant),
    ...tagPhase(dropLeg, "to_customer")
  ];

  return { path, mode };
}

function pointAt(sim, i) {
  return sim.path[Math.min(Math.max(i, 0), sim.path.length - 1)];
}

function currentPoint(sim) {
  return pointAt(sim, sim.index);
}

function currentHeading(sim) {
  if (sim.index <= 0) return 0;
  const prev = pointAt(sim, sim.index - 1);
  const curr = pointAt(sim, sim.index);
  if (prev.lat === curr.lat && prev.lng === curr.lng) {
    return sim.lastHeading || 0;
  }
  const h = bearing(prev, curr);
  sim.lastHeading = h;
  return h;
}

function currentPhase(sim) {
  return currentPoint(sim).phase || "to_restaurant";
}

function deriveOrderStatus(sim) {
  if (sim.index >= sim.path.length - 1) return "delivered";
  const phase = currentPhase(sim);
  if (phase === "to_restaurant") return "accepted";
  if (phase === "at_restaurant") return "accepted";
  if (phase === "to_customer") return "picked_up";
  return "accepted";
}

function buildStatusMessage(sim) {
  const phase = currentPhase(sim);
  if (sim.index >= sim.path.length - 1) return "Order delivered. Enjoy your meal!";
  if (phase === "to_restaurant") return "Rider is heading to the restaurant";
  if (phase === "at_restaurant") return "Rider is picking up your order";

  const remainingPoints = sim.path.length - 1 - sim.index;
  if (remainingPoints <= 3) return "Rider is arriving at your location";
  if (remainingPoints <= 8) return "Rider is very close";
  return "Rider is on the way with your order";
}

function remainingDistanceKm(sim) {
  let d = 0;
  for (let i = sim.index; i < sim.path.length - 1; i++) {
    d += haversineKm(sim.path[i], sim.path[i + 1]);
  }
  return d;
}

function totalDistanceKm(sim) {
  let d = 0;
  for (let i = 0; i < sim.path.length - 1; i++) {
    d += haversineKm(sim.path[i], sim.path[i + 1]);
  }
  return d;
}

function etaMinutes(sim) {
  if (sim.index >= sim.path.length - 1) return 0;
  const km = remainingDistanceKm(sim);
  const minutes = (km / 22) * 60 + 1.5;
  return Math.max(1, Math.round(minutes));
}

function progressPercent(sim) {
  if (sim.path.length <= 1) return 0;
  return Math.round((sim.index / (sim.path.length - 1)) * 100);
}

function currentSpeedKmh(sim) {
  const phase = currentPhase(sim);
  if (phase === "at_restaurant") return 0;
  const remaining = remainingDistanceKm(sim);
  const jitter = (Math.sin(sim.index * 1.37) + Math.cos(sim.index * 0.83)) * 3;
  if (remaining < 0.25) return Math.max(6, 14 + jitter);
  if (remaining < 0.8) return Math.max(10, 20 + jitter);
  return Math.max(16, 30 + jitter);
}

function distanceCoveredKm(sim) {
  let d = 0;
  for (let i = 0; i < sim.index; i++) {
    d += haversineKm(sim.path[i], sim.path[i + 1]);
  }
  return d;
}

function recentTrail(sim, count = 10) {
  const start = Math.max(0, sim.index - count);
  return sim.path.slice(start, sim.index + 1).map((p) => ({ lat: p.lat, lng: p.lng }));
}

async function createSimulation(restaurant, customer) {
  const riderStart = {
    lat: restaurant.lat + 0.005,
    lng: restaurant.lng + 0.006
  };
  const { path, mode } = await buildRealPath(riderStart, restaurant, customer);

  const sim = {
    path,
    index: 0,
    mode,
    lastHeading: 0
  };
  sim.totalKm = totalDistanceKm(sim);
  return sim;
}

function advanceSimulation(sim) {
  if (sim.index < sim.path.length - 1) {
    sim.index += 1;
  }
  return sim;
}

module.exports = {
  createSimulation,
  advanceSimulation,
  currentPoint,
  currentHeading,
  currentPhase,
  buildStatusMessage,
  deriveOrderStatus,
  etaMinutes,
  remainingDistanceKm,
  totalDistanceKm,
  progressPercent,
  currentSpeedKmh,
  distanceCoveredKm,
  recentTrail
};
