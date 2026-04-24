const socket = io();

const orderInput = document.getElementById("orderInput");
const trackBtn = document.getElementById("trackBtn");
const statusPill = document.getElementById("statusPill");
const etaText = document.getElementById("etaText");
const riderName = document.getElementById("riderName");
const riderMeta = document.getElementById("riderMeta");
const orderIdEl = document.getElementById("orderId");
const lastUpdated = document.getElementById("lastUpdated");
const demoOrderText = document.getElementById("demoOrderText");

const map = L.map("map", {
  zoomControl: true
}).setView([19.078, 72.88], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const riderIcon = L.divIcon({
  className: "",
  html: '<div class="marker-rider"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

let riderMarker;
let restaurantMarker;
let customerMarker;
let routeLine;

function setLiveStatus(text, live = false) {
  statusPill.textContent = text;
  statusPill.classList.toggle("live", live);
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function renderTracking(data) {
  etaText.textContent = data.etaMessage;
  riderName.textContent = data.rider.name;
  riderMeta.textContent = `${data.rider.vehicle} • ${data.rider.rating.toFixed(1)} ★`;
  orderIdEl.textContent = data.orderId;
  lastUpdated.textContent = `Last updated: ${formatTime(data.lastUpdatedAt)}`;

  if (!restaurantMarker) {
    restaurantMarker = L.marker([data.restaurant.lat, data.restaurant.lng])
      .addTo(map)
      .bindPopup("Restaurant");
  }
  if (!customerMarker) {
    customerMarker = L.marker([data.customer.lat, data.customer.lng])
      .addTo(map)
      .bindPopup("Delivery location");
  }
  if (!riderMarker) {
    riderMarker = L.marker([data.currentLocation.lat, data.currentLocation.lng], {
      icon: riderIcon
    }).addTo(map);
  } else {
    riderMarker.setLatLng([data.currentLocation.lat, data.currentLocation.lng]);
  }

  if (routeLine) {
    routeLine.remove();
  }
  routeLine = L.polyline(
    data.route.map((point) => [point.lat, point.lng]),
    { color: "#ff5f68", weight: 5, opacity: 0.8 }
  ).addTo(map);

  const bounds = L.latLngBounds([
    [data.restaurant.lat, data.restaurant.lng],
    [data.customer.lat, data.customer.lng],
    [data.currentLocation.lat, data.currentLocation.lng]
  ]);
  map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });

  if (data.delivered) {
    setLiveStatus("Delivered", false);
  } else {
    setLiveStatus(data.status, true);
  }
}

async function loadDemoOrders() {
  try {
    const response = await fetch("/api/orders");
    const data = await response.json();
    demoOrderText.textContent = `Demo IDs: ${data.demoOrderIds.join(", ")}`;
  } catch {
    demoOrderText.textContent = "Could not load demo order IDs.";
  }
}

async function startTracking() {
  const orderId = orderInput.value.trim().toUpperCase();
  if (!orderId) {
    setLiveStatus("Enter order id", false);
    return;
  }

  try {
    setLiveStatus("Connecting...", false);
    const response = await fetch(`/api/tracking/${orderId}`);
    if (!response.ok) throw new Error("Order not found");
    const data = await response.json();
    renderTracking(data);
    socket.emit("join-order", { orderId });
    setLiveStatus("Live", true);
  } catch {
    setLiveStatus("Order not found", false);
  }
}

socket.on("tracking-update", (data) => renderTracking(data));
socket.on("tracking-error", (err) => setLiveStatus(err.message || "Tracking error", false));
socket.on("connect", () => setLiveStatus("Socket connected", true));
socket.on("disconnect", () => setLiveStatus("Reconnecting...", false));

trackBtn.addEventListener("click", startTracking);
orderInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startTracking();
});

loadDemoOrders().then(startTracking);
