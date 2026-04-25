const socket = io();
const params = new URLSearchParams(window.location.search);
const orderId = (params.get("orderId") || "").toUpperCase();
const shareToken = params.get("share") || null;
const publicMode = !!shareToken;

/* Expose shared state so track-extras.js can hook in */
window.TRACK = {
  socket,
  orderId,
  shareToken,
  publicMode,
  lastData: null,
  prefs: {
    theme: localStorage.getItem("trackTheme") || "system",
    motion: localStorage.getItem("trackMotion") || "full",
    sound: localStorage.getItem("trackSound") || "on",
    lang: localStorage.getItem("trackLang") || "en"
  }
};
// Apply i18n once at boot
try { window.I18N && window.I18N.apply(); } catch {}

/* ============================================================
 *  Viewport height fix (iOS dynamic bar)
 * ============================================================ */
function setVh() {
  const vh = (window.visualViewport?.height || window.innerHeight) * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}
setVh();
window.addEventListener("resize", setVh);
window.visualViewport?.addEventListener("resize", setVh);

/* ============================================================
 *  DOM
 * ============================================================ */
const $ = (id) => document.getElementById(id);
const topbarStatus = $("topbarStatus");
const topbarOrderId = $("topbarOrderId");

const peekStatusText = $("peekStatusText");
const etaCountdown = $("etaCountdown");
const etaWord = $("etaWord");
const peekDistance = $("peekDistance");
const peekRiderThumb = $("peekRiderThumb");
const peekRiderPhoto = $("peekRiderPhoto");
const peekCallBtn = $("peekCallBtn");
const progressFill = $("progressFill");
const stepper = $("stepper");

const riderCard = $("riderCard");
const riderPhotoBig = $("riderPhotoBig");
const riderName = $("riderName");
const riderRating = $("riderRating");
const riderDeliveries = $("riderDeliveries");
const riderVehicle = $("riderVehicle");
const liveStats = $("liveStats");
const statSpeed = $("statSpeed");
const statDistance = $("statDistance");
const statEta = $("statEta");
const riderLocation = $("riderLocation");
const riderLandmark = $("riderLandmark");

const otpCard = $("otpCard");
const otpDigits = $("otpDigits");
const customerAddress = $("customerAddress");
const instructionsText = $("instructionsText");
const restImage = $("restImage");
const restaurantName = $("restaurantName");
const restaurantCuisine = $("restaurantCuisine");
const timelineEl = $("timeline"); // legacy; kept for backward compat. May be null.
const orderItems = $("orderItems");
const orderTotal = $("orderTotal");

const arrivalBanner = $("arrivalBanner");
const cancelBtn = $("cancelBtn");
const tipBtn = $("tipBtn");
const rateBtn = $("rateBtn");
const shareBtn = $("shareBtn");
const toast = $("toast");

/* New v3 refs */
const stageHero = $("stageHero");
const stageArt = $("stageArt");
const kitchenPrep = $("kitchenPrep");
const kpArt = $("kpArt");
const kpStageName = $("kpStageName");
const kpStageSub = $("kpStageSub");
const kpSteps = $("kpSteps");
const kpProgress = $("kpProgress");
const verifiedBadge = $("verifiedBadge");
const timelineRich = $("timelineRich");
const watcherBadge = $("watcherBadge");
const watcherCount = $("watcherCount");
const riderMsgBanner = $("riderMsgBanner");
const riderMsgAvatar = $("riderMsgAvatar");
const riderMsgFrom = $("riderMsgFrom");
const riderMsgText = $("riderMsgText");
const cheerOverlay = $("cheerOverlay");
const arrivalTakeover = $("arrivalTakeover");
const atOtp = $("atOtp");
const atRiderPhoto = $("atRiderPhoto");
const atRiderName = $("atRiderName");
const atRiderVehicle = $("atRiderVehicle");
const atCallBtn = $("atCallBtn");
const atDismissBtn = $("atDismissBtn");
const customerNoteText = $("customerNoteText");
const customerNoteCard = $("customerNoteCard");
const chatUnread = $("chatUnread");

const STATUS_ORDER = ["placed", "accepted", "picked_up", "delivered"];
const EVENT_LABELS = {
  placed: "Order placed",
  restaurant_confirmed: "Restaurant confirmed",
  accepted: "Rider assigned",
  at_restaurant: "Rider at restaurant",
  picked_up: "Order picked up",
  delivered: "Delivered",
  cancelled: "Order cancelled",
  tipped: "Tip added",
  rated: "Order rated"
};

/* ============================================================
 *  MAP + TILE LAYERS (standard / satellite hybrid)
 * ============================================================ */
const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  tap: true,
  tapTolerance: 15,
  zoomSnap: 0.25,
  wheelPxPerZoomLevel: 100
}).setView([19.078, 72.88], 13);

/* Esri World Imagery — `services` host + explicit z-index so overlays stack above basemap. */
const ESRI_IMG =
  "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const TILE_LAYERS = {
  standard: [
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png",
      { maxZoom: 19, subdomains: "abcd", detectRetina: true }
    )
  ],
  satellite: [
    L.tileLayer(ESRI_IMG, {
      maxZoom: 20,
      minZoom: 2,
      className: "esri-basemap",
      zIndex: 200
    }),
    L.tileLayer(
      "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 20, minZoom: 2, opacity: 0.7, className: "hybrid-label-layer", zIndex: 210 }
    ),
    L.tileLayer(
      "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 20, minZoom: 2, opacity: 0.65, className: "hybrid-label-layer", zIndex: 220 }
    )
  ]
};

/* Night mode auto detection — activates dark tiles after sunset */
function isNightNow() {
  const h = new Date().getHours();
  return h < 6 || h >= 19;
}
TILE_LAYERS.dark = [
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    { maxZoom: 19, subdomains: "abcd", detectRetina: true }
  ),
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
    { maxZoom: 19, subdomains: "abcd", detectRetina: true, opacity: 0.85, className: "hybrid-label-layer" }
  )
];

/* Default to SATELLITE on first entry. We also one-time-migrate users
 * whose previous default was the auto-picked standard/dark, while still
 * respecting any explicit choice they made via the layer toggle. */
const userManual = localStorage.getItem("trackMapMode:manual") === "1";
const savedMapMode = localStorage.getItem("trackMapMode");
let currentMapMode = userManual && savedMapMode ? savedMapMode : "satellite";

function applyMapMode(mode) {
  Object.values(TILE_LAYERS)
    .flat()
    .forEach((l) => {
      if (map.hasLayer(l)) map.removeLayer(l);
    });
  (TILE_LAYERS[mode] || TILE_LAYERS.standard).forEach((l) => l.addTo(map));
  currentMapMode = mode;
  document.body.dataset.mapMode = mode;
  localStorage.setItem("trackMapMode", mode);
  const btn = document.getElementById("layerBtn");
  if (btn) {
    /* Satellite is the default — show "active" only when the user has
     * switched away from it. */
    btn.classList.toggle("active", mode !== "satellite");
    btn.setAttribute(
      "title",
      mode === "satellite" ? "Tap for street view"
        : mode === "standard" ? "Tap for dark map"
        : "Tap for satellite view"
    );
  }
  // Ensure tiles re-layout after a mode switch (fixes blank map on some DPR / mobile views).
  setTimeout(() => {
    try {
      map.invalidateSize({ animate: false });
    } catch {}
  }, 0);
  setTimeout(() => {
    try {
      map.invalidateSize({ animate: false });
    } catch {}
  }, 180);
}
applyMapMode(currentMapMode);
/* Night auto-switch only kicks in if the user has explicitly chosen a
 * non-satellite mode. New default is satellite, so we leave it alone. */
setInterval(() => {
  if (!localStorage.getItem("trackMapMode:manual")) return;
  if (currentMapMode === "satellite") return;
  const shouldBe = isNightNow() ? "dark" : "standard";
  if (shouldBe !== currentMapMode) applyMapMode(shouldBe);
}, 30 * 60 * 1000);

const scooterSvg = `
  <svg viewBox="0 0 48 48" width="24" height="24" xmlns="http://www.w3.org/2000/svg" class="rider-scooter-svg">
    <g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 36h16" />
      <path d="M12 31l5-15h8l5 13" />
      <path d="M32 24h6" />
      <path d="M25 16h-4" />
      <g class="rider-wheel" style="transform-origin:12px 36px">
        <circle cx="12" cy="36" r="5" />
        <line x1="12" y1="31.5" x2="12" y2="40.5" stroke-width="1.3" />
        <line x1="7.5" y1="36" x2="16.5" y2="36" stroke-width="1.3" />
      </g>
      <g class="rider-wheel" style="transform-origin:38px 36px">
        <circle cx="38" cy="36" r="5" />
        <line x1="38" y1="31.5" x2="38" y2="40.5" stroke-width="1.3" />
        <line x1="33.5" y1="36" x2="42.5" y2="36" stroke-width="1.3" />
      </g>
    </g>
  </svg>`;

const riderDivIcon = L.divIcon({
  className: "",
  html: `
    <div class="rider-marker rider-marker-v2">
      <div class="rider-marker-pulse"></div>
      <div class="rider-marker-pulse delay"></div>
      <div class="rider-marker-dot">
        <span class="rider-exhaust"></span>
        <span class="rider-exhaust d2"></span>
        ${scooterSvg}
      </div>
    </div>
  `,
  iconSize: [64, 64],
  iconAnchor: [32, 32]
});

const restIconHtml = `
  <div class="mappin-wrap">
    <div class="mappin-halo mappin-halo-rest"></div>
    <div class="mappin mappin-rest">
      <div class="mappin-inner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 2v8a5 5 0 0010 0V2M7 22v-6M17 22v-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
    </div>
  </div>`;
const homeIconHtml = `
  <div class="mappin-wrap">
    <div class="mappin-halo mappin-halo-home"></div>
    <div class="mappin mappin-home">
      <div class="mappin-inner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-6h-6v6H5a2 2 0 01-2-2V10z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
      </div>
    </div>
  </div>`;
const restaurantIcon = L.divIcon({ className: "", html: restIconHtml, iconSize: [60, 70], iconAnchor: [30, 60] });
const customerIcon = L.divIcon({ className: "", html: homeIconHtml, iconSize: [60, 70], iconAnchor: [30, 60] });

let riderMarker, restaurantMarker, customerMarker;
let routeLine, coveredLine, trailLine;
let markerAnimFrame;
let currentHeading = 0;
let followMode = true;
let lastTrackingData = null;
let userInteracting = false;

const centerBtn = $("centerBtn");
const layerBtn = $("layerBtn");
const overviewBtn = $("overviewBtn");

centerBtn.addEventListener("click", () => {
  followMode = true;
  centerBtn.classList.add("active");
  if (riderMarker) {
    flyToRider(riderMarker.getLatLng(), 16.5);
  } else if (lastTrackingData) {
    fitAllBounds(lastTrackingData, true);
  }
});
layerBtn.addEventListener("click", () => {
  /* Satellite is the default; tapping cycles to a clean street view, then
   * dark, then back to satellite. */
  const order = ["satellite", "standard", "dark"];
  const idx = order.indexOf(currentMapMode);
  const next = order[(idx + 1) % order.length];
  applyMapMode(next);
  localStorage.setItem("trackMapMode:manual", "1");
  const labels = { standard: "Street view", dark: "Dark map", satellite: "Satellite view" };
  showToast(labels[next]);
});
overviewBtn.addEventListener("click", () => {
  followMode = false;
  centerBtn.classList.remove("active");
  if (lastTrackingData) fitAllBounds(lastTrackingData, true);
});

map.on("dragstart", () => {
  userInteracting = true;
  followMode = false;
  centerBtn.classList.remove("active");
});
map.on("dragend", () => {
  setTimeout(() => (userInteracting = false), 100);
});

/* Returns how many pixels to shift the map center DOWN so rider appears
 * centered in the visible map area (above the bottom sheet). */
function computeFollowOffset() {
  const isMobile = window.innerWidth <= 900;
  if (!isMobile) return 0;
  const snap = document.body.dataset.sheetSnap || "half";
  const vh = window.visualViewport?.height || window.innerHeight;
  const topSafe = 80;
  let visibleBottom;
  if (snap === "peek") visibleBottom = vh - 168;
  else if (snap === "half") visibleBottom = vh * 0.5;
  else visibleBottom = topSafe + 1;
  const visibleCenter = topSafe + (visibleBottom - topSafe) / 2;
  const viewportCenter = vh / 2;
  return Math.max(0, viewportCenter - visibleCenter);
}

function centerForLatLng(latlng, zoom) {
  const offset = computeFollowOffset();
  if (offset <= 0) return latlng;
  const z = zoom != null ? zoom : map.getZoom();
  const p = map.project(latlng, z);
  p.y += offset;
  return map.unproject(p, z);
}

function followRiderInstant(latlng) {
  if (!followMode) return;
  const target = centerForLatLng(latlng);
  map.panTo(target, { animate: false });
}

function flyToRider(latlng, zoom) {
  const target = centerForLatLng(latlng, zoom);
  map.flyTo(target, zoom != null ? zoom : map.getZoom(), {
    duration: 0.6,
    easeLinearity: 0.2
  });
}

function animateMarkerTo(latlng, heading) {
  if (!riderMarker) return;
  if (markerAnimFrame) cancelAnimationFrame(markerAnimFrame);
  const start = riderMarker.getLatLng();
  const duration = 1300;
  const startTime = performance.now();
  const startHeading = currentHeading;
  const diff = ((heading - startHeading + 540) % 360) - 180;
  const targetHeading = startHeading + diff;

  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const lat = start.lat + (latlng.lat - start.lat) * t;
    const lng = start.lng + (latlng.lng - start.lng) * t;
    const h = startHeading + (targetHeading - startHeading) * t;
    riderMarker.setLatLng([lat, lng]);
    rotateMarker(h);
    if (followMode && !userInteracting) followRiderInstant(L.latLng(lat, lng));
    if (t < 1) markerAnimFrame = requestAnimationFrame(step);
    else currentHeading = targetHeading;
  }
  markerAnimFrame = requestAnimationFrame(step);
}

function rotateMarker(deg) {
  const el = riderMarker && riderMarker.getElement();
  if (!el) return;
  const inner = el.querySelector(".rider-marker-dot");
  if (inner) inner.style.transform = `rotate(${deg}deg)`;
}

centerBtn.classList.add("active");

/* ============================================================
 *  MINI-MAP (overview widget)
 * ============================================================ */
let miniMap = null;
let miniRiderMarker = null;
let miniRestMarker = null;
let miniHomeMarker = null;
let miniRoute = null;

function initMiniMap() {
  if (miniMap) return;
  miniMap = L.map("miniMap", {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    doubleClickZoom: false,
    scrollWheelZoom: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false,
    tap: false
  }).setView([19.078, 72.88], 12);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/voyager_nolabels/{z}/{x}/{y}{r}.png", {
    maxZoom: 17,
    subdomains: "abcd"
  }).addTo(miniMap);
  $("miniMapWidget").addEventListener("click", () => {
    followMode = false;
    centerBtn.classList.remove("active");
    if (lastTrackingData) fitAllBounds(lastTrackingData, true);
  });
}

function updateMiniMap(data) {
  if (!data.currentLocation) return;
  if (!miniMap) initMiniMap();
  $("miniMapWidget").hidden = false;
  const rest = [data.restaurant.lat, data.restaurant.lng];
  const home = [data.customer.lat, data.customer.lng];
  const cur = [data.currentLocation.lat, data.currentLocation.lng];

  if (!miniRestMarker) {
    miniRestMarker = L.circleMarker(rest, { radius: 4, color: "#267e3e", fillColor: "#267e3e", fillOpacity: 1, weight: 2 }).addTo(miniMap);
  }
  if (!miniHomeMarker) {
    miniHomeMarker = L.circleMarker(home, { radius: 4, color: "#e23744", fillColor: "#e23744", fillOpacity: 1, weight: 2 }).addTo(miniMap);
  }
  if (!miniRiderMarker) {
    miniRiderMarker = L.circleMarker(cur, { radius: 5, color: "#fff", fillColor: "#e23744", fillOpacity: 1, weight: 2 }).addTo(miniMap);
  } else {
    miniRiderMarker.setLatLng(cur);
  }
  if (data.route && !miniRoute) {
    miniRoute = L.polyline(data.route.map((p) => [p.lat, p.lng]), {
      color: "#e23744",
      weight: 2,
      opacity: 0.7
    }).addTo(miniMap);
  }
  const b = L.latLngBounds([rest, home, cur]);
  miniMap.fitBounds(b, { padding: [10, 10], animate: false, maxZoom: 14 });
}

/* Arrival radar: pulse around the home pin when rider is < 200m */
let arrivalRadar = null;
function updateArrivalRadar(data) {
  const el = customerMarker && customerMarker.getElement();
  if (!el) return;
  const halo = el.querySelector(".mappin-halo");
  if (!halo) return;
  const close = data.status === "picked_up" && data.distanceRemainingKm != null && data.distanceRemainingKm < 0.25;
  halo.classList.toggle("arriving", close);
}

/* ============================================================
 *  BOTTOM SHEET (robust native-first)
 * ============================================================ */
class BottomSheet {
  constructor(el) {
    this.el = el;
    this.snap = "half";
    this.snapTops = { peek: 0, half: 0, full: 0 };
    this.dragging = false;
    this.moved = false;
    this._onMoveBound = this._onMove.bind(this);
    this._onEndBound = this._onEnd.bind(this);
    this._compute();
    this._attach();
    this.goTo("half", false);
    window.addEventListener("resize", () => {
      this._compute();
      this.goTo(this.snap, false);
    });
  }

  _compute() {
    const vh = window.visualViewport?.height || window.innerHeight;
    const topSafe = Math.max(56, this._safeTop() + 48);
    if (window.innerWidth > 900) {
      this.isMobile = false;
      return;
    }
    this.isMobile = true;
    this.vh = vh;
    this.snapTops = {
      peek: Math.round(vh - 168),
      half: Math.round(vh * 0.5),
      full: Math.round(topSafe)
    };
  }

  _safeTop() {
    const root = getComputedStyle(document.documentElement);
    const v = root.getPropertyValue("--safe-top").trim();
    return parseInt(v) || 0;
  }

  _attach() {
    const zones = this.el.querySelectorAll("[data-drag]");
    zones.forEach((z) => {
      z.addEventListener("pointerdown", (e) => this._onStart(e));
    });
  }

  _onStart(e) {
    if (!this.isMobile) return;
    if (e.button != null && e.button !== 0) return;
    if (this.snap === "full" && this.el.scrollTop > 0) return;
    if (e.target.closest("button, a, .inline-link, input, .step")) return;

    this.dragging = true;
    this.moved = false;
    this.startY = e.clientY;
    this.startTop = this._currentTop();
    this.lastY = e.clientY;
    this.lastT = performance.now();
    this.velocity = 0;
    this.el.classList.add("dragging");

    document.addEventListener("pointermove", this._onMoveBound, { passive: false });
    document.addEventListener("pointerup", this._onEndBound);
    document.addEventListener("pointercancel", this._onEndBound);
  }

  _onMove(e) {
    if (!this.dragging) return;
    const dy = e.clientY - this.startY;
    if (Math.abs(dy) > 3) this.moved = true;
    e.preventDefault();
    let newTop = this.startTop + dy;
    newTop = Math.max(this.snapTops.full - 10, Math.min(this.snapTops.peek + 40, newTop));
    this._setTop(newTop);

    const now = performance.now();
    const dt = now - this.lastT;
    if (dt > 0) this.velocity = (e.clientY - this.lastY) / dt;
    this.lastY = e.clientY;
    this.lastT = now;
  }

  _onEnd() {
    if (!this.dragging) return;
    this.dragging = false;
    this.el.classList.remove("dragging");
    document.removeEventListener("pointermove", this._onMoveBound);
    document.removeEventListener("pointerup", this._onEndBound);
    document.removeEventListener("pointercancel", this._onEndBound);

    if (!this.moved) {
      // Tap on handle: cycle up
      const next =
        this.snap === "peek" ? "half" : this.snap === "half" ? "full" : "peek";
      this.goTo(next);
      return;
    }

    const current = this._currentTop();
    let target;
    if (Math.abs(this.velocity) > 0.6) {
      if (this.velocity > 0) {
        target = this.snap === "full" ? "half" : "peek";
      } else {
        target = this.snap === "peek" ? "half" : "full";
      }
    } else {
      const d = {
        peek: Math.abs(current - this.snapTops.peek),
        half: Math.abs(current - this.snapTops.half),
        full: Math.abs(current - this.snapTops.full)
      };
      target = "peek";
      if (d.half < d[target]) target = "half";
      if (d.full < d[target]) target = "full";
    }
    this.goTo(target);
  }

  _currentTop() {
    const m = /translate3d\(\s*0px\s*,\s*([-\d.]+)px/.exec(this.el.style.transform);
    if (m) return parseFloat(m[1]);
    return this.snapTops[this.snap];
  }

  _setTop(px) {
    this.el.style.transform = `translate3d(0px, ${px}px, 0)`;
  }

  goTo(snap, animate = true) {
    if (!this.snapTops[snap]) snap = "half";
    const previous = this.snap;
    this.snap = snap;
    this.el.dataset.snap = snap;
    document.body.dataset.sheetSnap = snap;
    this.el.dataset.scrollable = snap === "full" ? "true" : "false";

    if (snap !== "full") this.el.scrollTop = 0;

    if (animate) this.el.classList.add("animating");
    if (this.isMobile) this._setTop(this.snapTops[snap]);

    if (animate) {
      setTimeout(() => {
        this.el.classList.remove("animating");
      }, 400);
    }

    if (previous !== snap) {
      this.el.dispatchEvent(new CustomEvent("snapchange", { detail: { snap } }));
    }
  }
}

const sheet = new BottomSheet($("sheet"));
$("sheet").addEventListener("snapchange", () => {
  if (riderMarker && followMode) {
    const target = centerForLatLng(riderMarker.getLatLng());
    map.panTo(target, { animate: true, duration: 0.4 });
  } else if (lastTrackingData) {
    fitAllBounds(lastTrackingData, true);
  }
});
window.addEventListener("resize", () => {
  if (riderMarker && followMode) {
    const target = centerForLatLng(riderMarker.getLatLng());
    map.panTo(target, { animate: false });
  }
});

/* ============================================================
 *  MODAL CONTROLLER (action-sheet style)
 * ============================================================ */
function openModal(el) {
  el.setAttribute("aria-hidden", "false");
  el.classList.add("open");
  document.body.classList.add("modal-open");
}
function closeModal(el) {
  el.setAttribute("aria-hidden", "true");
  el.classList.remove("open");
  document.body.classList.remove("modal-open");
}
document.querySelectorAll(".modal-backdrop").forEach((back) => {
  back.addEventListener("click", (e) => {
    if (e.target === back) closeModal(back);
  });
});

/* ============================================================
 *  LOCAL COUNTDOWN
 * ============================================================ */
let lastEtaMinutes = null;
let lastEtaReceivedAt = null;
setInterval(() => {
  if (lastEtaMinutes == null || lastEtaReceivedAt == null) {
    etaCountdown.textContent = "--";
    return;
  }
  if (currentStatus === "delivered") {
    etaCountdown.textContent = "00";
    return;
  }
  if (currentStatus === "cancelled") {
    etaCountdown.textContent = "--";
    return;
  }
  const elapsedSec = (Date.now() - lastEtaReceivedAt) / 1000;
  const totalSec = Math.max(0, lastEtaMinutes * 60 - elapsedSec);
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  etaCountdown.textContent = `${m}`;
  etaWord.textContent = totalSec < 60 ? "less than a min" : "min arrival";
}, 1000);

/* ============================================================
 *  STEPPER
 * ============================================================ */
function setStepper(status) {
  const idx = STATUS_ORDER.indexOf(status);
  stepper.querySelectorAll(".step").forEach((el) => {
    const stepIdx = STATUS_ORDER.indexOf(el.dataset.step);
    el.classList.toggle("done", stepIdx < idx);
    el.classList.toggle("active", stepIdx === idx);
  });
}

/* ============================================================
 *  ANIMATED NUMBER
 * ============================================================ */
function animateNumber(el, toValue, decimals = 0) {
  const from = parseFloat(el.dataset.val || "0");
  if (Math.abs(from - toValue) < 0.05) {
    el.textContent = decimals > 0 ? toValue.toFixed(decimals) : Math.round(toValue);
    el.dataset.val = toValue;
    return;
  }
  const duration = 520;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = from + (toValue - from) * eased;
    el.textContent = decimals > 0 ? v.toFixed(decimals) : Math.round(v);
    if (t < 1) requestAnimationFrame(step);
    else el.dataset.val = toValue;
  }
  requestAnimationFrame(step);
}

/* ============================================================
 *  TOAST
 * ============================================================ */
function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("visible"));
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => (toast.hidden = true), 300);
  }, 2500);
}

/* ============================================================
 *  CONFETTI
 * ============================================================ */
const confettiCanvas = $("confettiCanvas");
const confettiCtx = confettiCanvas.getContext("2d");
function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeConfetti);
resizeConfetti();
function celebrateConfetti() {
  const colors = ["#e23744", "#f97316", "#267e3e", "#fdd05c", "#3b5bdb"];
  const particles = [];
  for (let i = 0; i < 140; i++) {
    particles.push({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: window.innerHeight / 3,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -14 - 4,
      size: 4 + Math.random() * 6,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3
    });
  }
  confettiCanvas.classList.add("active");
  const start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    particles.forEach((p) => {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.color;
      confettiCtx.globalAlpha = Math.max(0, 1 - elapsed / 3200);
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
      confettiCtx.restore();
    });
    if (elapsed < 3500) requestAnimationFrame(frame);
    else {
      confettiCanvas.classList.remove("active");
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }
  requestAnimationFrame(frame);
}

/* ============================================================
 *  STAGE ART — illustrated SVG scenes for each stage
 * ============================================================ */
const STAGE_ARTS = {
  receipt: `
    <svg viewBox="0 0 120 90" width="100%" height="100%">
      <rect x="42" y="14" width="44" height="62" rx="6" fill="#fff" stroke="#e23744" stroke-width="2.5"/>
      <rect x="50" y="24" width="28" height="3" rx="1.5" fill="#e23744"/>
      <rect x="50" y="32" width="22" height="2.5" rx="1.25" fill="#cbd5e1"/>
      <rect x="50" y="38" width="28" height="2.5" rx="1.25" fill="#cbd5e1"/>
      <rect x="50" y="44" width="18" height="2.5" rx="1.25" fill="#cbd5e1"/>
      <path d="M42 76l4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6" stroke="#e23744" stroke-width="2" fill="none"/>
      <circle cx="90" cy="30" r="10" fill="#fdd05c"><animate attributeName="r" values="9;11;9" dur="2s" repeatCount="indefinite"/></circle>
      <text x="90" y="34" text-anchor="middle" font-size="11" font-weight="700">✓</text>
    </svg>`,
  chopping: `
    <svg viewBox="0 0 120 90" width="100%" height="100%">
      <rect x="18" y="58" width="84" height="10" rx="3" fill="#8c6239"/>
      <rect x="18" y="56" width="84" height="4" fill="#a97b4e"/>
      <g transform="translate(60 45)">
        <circle r="9" fill="#f97316"/>
        <circle r="4" fill="#c2410c"/>
      </g>
      <g transform="translate(38 48)"><ellipse rx="7" ry="5" fill="#22c55e"/></g>
      <g transform="translate(82 48)"><ellipse rx="7" ry="5" fill="#ef4444"/></g>
      <g transform="translate(68 20)">
        <g>
          <animateTransform attributeName="transform" type="rotate" values="-30;10;-30" dur="0.7s" repeatCount="indefinite"/>
          <rect x="-3" y="0" width="6" height="28" rx="2" fill="#64748b"/>
          <path d="M-12 28 L12 28 L16 40 L-16 40 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
        </g>
      </g>
    </svg>`,
  cooking: `
    <svg viewBox="0 0 120 90" width="100%" height="100%">
      <ellipse cx="60" cy="76" rx="36" ry="4" fill="rgba(0,0,0,0.08)"/>
      <path d="M28 50 Q60 70 92 50 L98 56 Q60 78 22 56 Z" fill="#2a3645"/>
      <rect x="22" y="44" width="76" height="10" rx="3" fill="#334155"/>
      <rect x="96" y="44" width="16" height="6" rx="2" fill="#64748b"/>
      <g>
        <circle cx="46" cy="48" r="4" fill="#f97316"><animate attributeName="cy" values="48;42;48" dur="1.6s" repeatCount="indefinite"/></circle>
        <circle cx="60" cy="50" r="5" fill="#facc15"><animate attributeName="cy" values="50;44;50" dur="1.9s" repeatCount="indefinite"/></circle>
        <circle cx="74" cy="48" r="4" fill="#ef4444"><animate attributeName="cy" values="48;41;48" dur="1.4s" repeatCount="indefinite"/></circle>
      </g>
      <g stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.8">
        <path d="M42 34 Q38 26 42 20">
          <animate attributeName="d" values="M42 34 Q38 26 42 20; M42 34 Q46 26 42 20; M42 34 Q38 26 42 20" dur="2.2s" repeatCount="indefinite"/>
        </path>
        <path d="M58 30 Q54 22 58 16">
          <animate attributeName="d" values="M58 30 Q54 22 58 16; M58 30 Q62 22 58 16; M58 30 Q54 22 58 16" dur="2.4s" repeatCount="indefinite"/>
        </path>
        <path d="M74 34 Q70 26 74 20">
          <animate attributeName="d" values="M74 34 Q70 26 74 20; M74 34 Q78 26 74 20; M74 34 Q70 26 74 20" dur="2.0s" repeatCount="indefinite"/>
        </path>
      </g>
    </svg>`,
  packing: `
    <svg viewBox="0 0 120 90" width="100%" height="100%">
      <rect x="32" y="32" width="56" height="40" rx="3" fill="#d97706"/>
      <rect x="32" y="32" width="56" height="6" fill="#b45309"/>
      <path d="M32 38 L88 38" stroke="#78350f" stroke-width="1"/>
      <rect x="54" y="28" width="12" height="12" fill="#d97706" stroke="#78350f" stroke-width="1"/>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,-8;0,0;0,-8" dur="2s" repeatCount="indefinite"/>
        <rect x="48" y="12" width="24" height="16" rx="2" fill="#fff" stroke="#e23744" stroke-width="2"/>
        <text x="60" y="24" text-anchor="middle" font-size="10" font-weight="700" fill="#e23744">🍔</text>
      </g>
    </svg>`,
  assigned: `
    <svg viewBox="0 0 120 90" width="100%" height="100%">
      <circle cx="60" cy="45" r="30" fill="#fde68a"/>
      <circle cx="60" cy="40" r="10" fill="#fff" stroke="#e23744" stroke-width="2.5"/>
      <path d="M48 56 Q60 68 72 56" fill="#e23744"/>
      <text x="60" y="84" text-anchor="middle" font-size="9" font-weight="700" fill="#1b2430">Rider found!</text>
    </svg>`,
  rider_onway: `
    <svg viewBox="0 0 120 90" width="100%" height="100%">
      <g>
        <animateTransform attributeName="transform" type="translate" values="-40,40;40,40" dur="3s" repeatCount="indefinite"/>
        <g transform="translate(0 0) scale(1.4)">
          <circle cx="10" cy="26" r="4" fill="#1b2430"><animateTransform attributeName="transform" type="rotate" from="0 10 26" to="360 10 26" dur="0.4s" repeatCount="indefinite"/></circle>
          <circle cx="28" cy="26" r="4" fill="#1b2430"><animateTransform attributeName="transform" type="rotate" from="0 28 26" to="360 28 26" dur="0.4s" repeatCount="indefinite"/></circle>
          <path d="M13 26h12l-4-14h-5l-3 14z" fill="#e23744"/>
          <rect x="12" y="4" width="12" height="10" rx="2" fill="#7c2d12"/>
        </g>
      </g>
      <path d="M10 78 L110 78" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 4"/>
    </svg>`,
  delivered: `
    <svg viewBox="0 0 120 90" width="100%" height="100%">
      <circle cx="60" cy="45" r="30" fill="#d1fae5">
        <animate attributeName="r" values="28;32;28" dur="2s" repeatCount="indefinite"/>
      </circle>
      <path d="M48 46 L56 54 L72 38" stroke="#047857" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  cancelled: `
    <svg viewBox="0 0 120 90" width="100%" height="100%">
      <circle cx="60" cy="45" r="26" fill="#fee2e2"/>
      <path d="M48 33 L72 57 M72 33 L48 57" stroke="#b91c1c" stroke-width="5" stroke-linecap="round"/>
    </svg>`
};

function artForStage(data) {
  if (data.status === "cancelled") return STAGE_ARTS.cancelled;
  if (data.status === "delivered") return STAGE_ARTS.delivered;
  if (data.status === "picked_up") return STAGE_ARTS.rider_onway;
  if (data.status === "accepted") return STAGE_ARTS.assigned;
  // placed → choose kitchen art based on prep stage
  const illus = data.prepStage?.illustration || "receipt";
  return STAGE_ARTS[illus] || STAGE_ARTS.receipt;
}

/* ============================================================
 *  HAPTICS + SUBTLE SOUND
 * ============================================================ */
const HAPTICS = {
  light() {
    if (window.TRACK.prefs.sound !== "on") return;
    try { navigator.vibrate && navigator.vibrate(10); } catch {}
  },
  medium() {
    if (window.TRACK.prefs.sound !== "on") return;
    try { navigator.vibrate && navigator.vibrate([15, 30, 15]); } catch {}
  },
  success() {
    if (window.TRACK.prefs.sound !== "on") return;
    try { navigator.vibrate && navigator.vibrate([20, 60, 40, 60, 20]); } catch {}
  }
};

let audioCtx = null;
function ctx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
  return audioCtx;
}
function tone({ freq = 660, duration = 180, volume = 0.05, type = "sine" } = {}) {
  if (window.TRACK.prefs.sound !== "on") return;
  const ac = ctx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(ac.destination);
  const now = ac.currentTime;
  osc.start(now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
  osc.stop(now + duration / 1000 + 0.02);
}
const SOUND = {
  chime() { tone({ freq: 660, duration: 180 }); setTimeout(() => tone({ freq: 880, duration: 260 }), 140); },
  ping() { tone({ freq: 1040, duration: 140, volume: 0.04 }); },
  success() {
    tone({ freq: 523, duration: 160 });
    setTimeout(() => tone({ freq: 659, duration: 160 }), 120);
    setTimeout(() => tone({ freq: 784, duration: 280 }), 240);
  },
  arrive() {
    tone({ freq: 880, duration: 220 });
    setTimeout(() => tone({ freq: 1175, duration: 280 }), 180);
  }
};

/* ============================================================
 *  DYNAMIC TAB TITLE + FAVICON
 * ============================================================ */
function updateTabAndFavicon(data) {
  const eta = data.etaMinutes != null ? `${data.etaMinutes} min · ` : "";
  const short = data.orderId || orderId || "";
  const emoji =
    data.status === "delivered" ? "✅" :
    data.status === "cancelled" ? "❌" :
    data.status === "picked_up" ? "🛵" :
    data.status === "accepted" ? "👨‍🍳" : "⏳";
  document.title = `${emoji} ${eta}${short} · zomato tracker`;

  const color =
    data.status === "delivered" ? "#22c55e" :
    data.status === "cancelled" ? "#94a3b8" :
    "#e23744";
  setFavicon(emoji, color);
}

function setFavicon(glyph, color) {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = color;
  g.beginPath();
  g.roundRect ? g.roundRect(0, 0, size, size, 14) : g.rect(0, 0, size, size);
  g.fill();
  g.fillStyle = "#fff";
  g.font = "42px system-ui, 'Segoe UI Emoji', 'Apple Color Emoji'";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(glyph, size / 2, size / 2 + 4);
  let link = document.querySelector('link[rel~="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.href = c.toDataURL("image/png");
}

/* ============================================================
 *  WEB PUSH NOTIFICATIONS
 * ============================================================ */
const Notify = {
  supported: "Notification" in window,
  permission() { return this.supported ? Notification.permission : "denied"; },
  async ensure() {
    if (!this.supported) return "unsupported";
    if (Notification.permission === "default") {
      try { return await Notification.requestPermission(); } catch { return "denied"; }
    }
    return Notification.permission;
  },
  send(title, opts = {}) {
    if (!this.supported || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible" && !opts.force) return;
    try {
      const n = new Notification(title, {
        body: opts.body || "",
        icon: "/favicon.png",
        tag: opts.tag || "zomato-track",
        renotify: true,
        silent: false
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {}
  }
};

function notifyStatusChange(prev, data) {
  if (publicMode) return;
  if (!prev || prev === data.status) return;
  const titles = {
    accepted: "Rider assigned!",
    picked_up: "Your food is on the way!",
    delivered: "Order delivered ✅",
    cancelled: "Order cancelled"
  };
  const bodies = {
    accepted: `${data.rider?.name || "Rider"} is heading to the restaurant.`,
    picked_up: `Your order is on its way. ETA ${data.etaMinutes} min.`,
    delivered: "Enjoy your meal!",
    cancelled: "Your order was cancelled."
  };
  if (titles[data.status]) {
    Notify.send(titles[data.status], { body: bodies[data.status], tag: `status-${data.orderId}` });
  }
}

/* ============================================================
 *  BACKGROUND SYNC on reconnect
 * ============================================================ */
let socketDisconnectedAt = null;
socket.on("disconnect", () => {
  socketDisconnectedAt = Date.now();
  document.body.classList.add("offline");
  showToast("Offline · reconnecting...");
});
socket.io.on("reconnect", async () => {
  document.body.classList.remove("offline");
  if (socketDisconnectedAt && Date.now() - socketDisconnectedAt > 1500) {
    showToast("Back online · syncing...");
    try {
      const url = publicMode ? `/api/share/${shareToken}` : `/api/orders/${orderId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        renderTracking(data);
      }
    } catch {}
  }
  socketDisconnectedAt = null;
});

/* ============================================================
 *  WATCHER BADGE
 * ============================================================ */
function updateWatcherBadge(data) {
  const n = data.watcherCount || 0;
  if (n > 1) {
    watcherBadge.hidden = false;
    watcherCount.textContent = n;
  } else {
    watcherBadge.hidden = true;
  }
}

/* ============================================================
 *  CHEER overlay — floating emojis
 * ============================================================ */
function spawnCheerEmoji(emoji) {
  if (window.TRACK.prefs.motion === "reduce") return;
  const el = document.createElement("div");
  el.className = "cheer-emoji";
  el.textContent = emoji;
  const left = 10 + Math.random() * 80;
  el.style.left = `${left}%`;
  el.style.bottom = `${20 + Math.random() * 10}%`;
  cheerOverlay.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}
socket.on("cheer", ({ emoji }) => spawnCheerEmoji(emoji));

/* ============================================================
 *  RIDER MESSAGE banner
 * ============================================================ */
let lastRiderMessageAt = null;
function showRiderMessage(msg, rider) {
  if (!msg || !msg.text) {
    riderMsgBanner.hidden = true;
    return;
  }
  if (msg.at === lastRiderMessageAt) return;
  lastRiderMessageAt = msg.at;
  riderMsgText.textContent = msg.text;
  riderMsgFrom.textContent = rider ? rider.name : "Your rider";
  if (rider?.photo) {
    riderMsgAvatar.style.backgroundImage = `url(${rider.photo})`;
  }
  riderMsgBanner.hidden = false;
  HAPTICS.light();
  SOUND.ping();
  Notify.send(`${rider?.name || "Rider"}: ${msg.text}`, { tag: "rider-msg" });
  clearTimeout(showRiderMessage._t);
  showRiderMessage._t = setTimeout(() => { riderMsgBanner.hidden = true; }, 7000);
}
$("riderMsgClose").addEventListener("click", () => { riderMsgBanner.hidden = true; });

/* ============================================================
 *  ARRIVAL TAKEOVER
 * ============================================================ */
let arrivalTakeoverShown = false;
function maybeShowArrivalTakeover(data) {
  if (publicMode) return;
  if (data.status !== "picked_up") return;
  if (data.distanceRemainingKm == null) return;
  if (data.distanceRemainingKm >= 0.12 && !arrivalTakeoverShown) return;
  if (arrivalTakeoverShown) return;
  if (data.distanceRemainingKm < 0.12) {
    arrivalTakeoverShown = true;
    atOtp.textContent = data.otp || "----";
    atRiderPhoto.src = data.rider?.photo || "";
    atRiderName.textContent = data.rider?.name || "Rider";
    atRiderVehicle.textContent = data.rider?.vehicle || "";
    arrivalTakeover.hidden = false;
    arrivalTakeover.setAttribute("aria-hidden", "false");
    document.body.classList.add("arrival-on");
    HAPTICS.success();
    SOUND.arrive();
    Notify.send("Your rider has arrived!", { body: `OTP: ${data.otp}`, tag: "arrive", force: true });
  }
}
atDismissBtn.addEventListener("click", () => {
  arrivalTakeover.hidden = true;
  arrivalTakeover.setAttribute("aria-hidden", "true");
  document.body.classList.remove("arrival-on");
});
atCallBtn.addEventListener("click", () => {
  if (window.TrackExtras) window.TrackExtras.startCall();
});

/* ============================================================
 *  KITCHEN PREP render
 * ============================================================ */
const PREP_STEPS = ["received", "chopping", "cooking", "packing"];
const PREP_LABELS = {
  received: "Received",
  chopping: "Prepping",
  cooking: "Cooking",
  packing: "Packing"
};
function renderKitchenPrep(data) {
  if (!data.prepStage || data.status !== "placed" || publicMode) {
    kitchenPrep.hidden = true;
    return;
  }
  kitchenPrep.hidden = false;
  const { key, label, illustration, overallProgress, stageIndex } = data.prepStage;
  kpStageName.textContent = label;
  kpStageSub.textContent = `Stage ${stageIndex + 1} of ${PREP_STEPS.length}`;
  kpArt.innerHTML = STAGE_ARTS[illustration] || STAGE_ARTS.cooking;
  kpProgress.style.width = `${overallProgress}%`;
  kpSteps.innerHTML = PREP_STEPS
    .map((s, i) => {
      const state = i < stageIndex ? "done" : i === stageIndex ? "active" : "pending";
      return `<div class="kp-step ${state}"><span></span>${PREP_LABELS[s]}</div>`;
    })
    .join("");
}

/* ============================================================
 *  RICH TIMELINE
 * ============================================================ */
const RICH_TIMELINE_KEYS = [
  { key: "placed", label: "Order placed", emoji: "📝" },
  { key: "restaurant_confirmed", label: "Restaurant confirmed", emoji: "🍽" },
  { key: "prep_started", label: "Cooking started", emoji: "👨‍🍳" },
  { key: "accepted", label: "Rider assigned", emoji: "🛵" },
  { key: "at_restaurant", label: "Picked up", emoji: "📦" },
  { key: "picked_up", label: "On the way", emoji: "🏃" },
  { key: "delivered", label: "Delivered", emoji: "✅" }
];

const TIMELINE_BY_SERVICE = {
  food: RICH_TIMELINE_KEYS,
  grocery: [
    { key: "placed", label: "Order placed", emoji: "📝" },
    { key: "vendor_confirmed", label: "Store confirmed", emoji: "🏬" },
    { key: "accepted", label: "Partner assigned", emoji: "🛵" },
    { key: "at_restaurant", label: "Picked up", emoji: "📦" },
    { key: "picked_up", label: "On the way", emoji: "🏃" },
    { key: "delivered", label: "Delivered", emoji: "✅" }
  ],
  cab: [
    { key: "placed", label: "Ride booked", emoji: "📝" },
    { key: "searching_driver", label: "Finding driver", emoji: "🔎" },
    { key: "accepted", label: "Driver assigned", emoji: "🚕" },
    { key: "at_restaurant", label: "Driver at pickup", emoji: "📍" },
    { key: "picked_up", label: "Trip started", emoji: "🏁" },
    { key: "delivered", label: "Trip completed", emoji: "✅" }
  ],
  parcel: [
    { key: "placed", label: "Parcel booked", emoji: "📝" },
    { key: "searching_partner", label: "Finding partner", emoji: "🔎" },
    { key: "accepted", label: "Partner assigned", emoji: "🛵" },
    { key: "at_restaurant", label: "At pickup", emoji: "📦" },
    { key: "picked_up", label: "Parcel picked up", emoji: "🚚" },
    { key: "delivered", label: "Delivered", emoji: "✅" }
  ],
  shop: [
    { key: "placed", label: "Order placed", emoji: "📝" },
    { key: "vendor_confirmed", label: "Order packed", emoji: "📦" },
    { key: "accepted", label: "Out for delivery", emoji: "🚚" },
    { key: "at_restaurant", label: "At warehouse", emoji: "🏬" },
    { key: "picked_up", label: "On the way", emoji: "🏃" },
    { key: "delivered", label: "Delivered", emoji: "✅" }
  ]
};

function keysForService(data) {
  const s = (data && data.serviceType) || "food";
  return TIMELINE_BY_SERVICE[s] || RICH_TIMELINE_KEYS;
}

function renderRichTimeline(data) {
  if (!data.events) { timelineRich.innerHTML = ""; return; }
  const eventMap = {};
  data.events.forEach((e) => { if (!eventMap[e.type]) eventMap[e.type] = e; });

  timelineRich.innerHTML = keysForService(data)
    .map((t) => {
      const event = eventMap[t.key];
      const state = event ? "done" : "pending";
      const time = event
        ? new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "--:--";
      return `
        <div class="tr-step ${state}">
          <div class="tr-emoji">${t.emoji}</div>
          <strong>${t.label}</strong>
          <span class="tr-time">${time}</span>
        </div>`;
    })
    .join('<div class="tr-connector"></div>');
}

/* ============================================================
 *  RENDER TRACKING
 * ============================================================ */
let currentStatus = null;
let arrivalAlertShown = false;

function niceTopbar(data) {
  const L = data.serviceLabels || {};
  const svc = data.serviceType || "food";
  switch (data.status) {
    case "placed": return L.finding || "Waiting for a partner";
    case "accepted": return L.accepted || "Heading to pickup";
    case "picked_up":
      if (svc === "cab") return "Trip in progress";
      if (svc === "parcel") return "Parcel on the way";
      return (L.partnerShort || "Partner") + " " + (L.partnerAction || "on the way");
    case "delivered": return L.delivered || "Completed";
    case "cancelled": return (L.order ? "Your " + L.order : "Order") + " cancelled";
    default: return svc === "cab" ? "Tracking your ride" : svc === "parcel" ? "Tracking your parcel" : "Tracking your order";
  }
}
function nicePeekStatus(data) {
  const L = data.serviceLabels || {};
  const svc = data.serviceType || "food";
  if (data.status === "delivered")
    return svc === "cab" ? "Trip completed" : svc === "parcel" ? "Parcel delivered" : "Delivered · enjoy!";
  if (data.status === "cancelled") return "Cancelled";
  if (data.status === "placed") return L.finding || "Finding a partner";
  if (data.status === "accepted") {
    const m = data.statusMessage || "";
    if (m.includes("picking") || m.includes("at_")) return svc === "cab" ? "Reaching pickup" : "Picking up your order";
    return L.accepted || "Heading to pickup";
  }
  if (data.status === "picked_up") {
    if (svc === "cab") return "Trip in progress";
    if (svc === "parcel") return "Parcel on the way";
    return (L.partnerShort || "Partner") + " is on the way";
  }
  return "Tracking";
}

function renderTimeline(events) {
  if (!timelineEl) return; // legacy list replaced by rich timeline
  timelineEl.innerHTML = events
    .slice()
    .reverse()
    .map((e) => {
      const ts = new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `
        <li>
          <span class="time">${ts}</span>
          <span class="tdot"></span>
          <div>
            <strong>${EVENT_LABELS[e.type] || e.type}</strong>
            <p>${e.message}</p>
          </div>
        </li>`;
    })
    .join("");
}

function applyServiceAdaptation(data) {
  const L = data.serviceLabels || {};
  const svc = data.serviceType || "food";
  document.body.dataset.serviceType = svc;
  if (data.serviceColor) {
    document.documentElement.style.setProperty("--svc-color", data.serviceColor);
  }

  // Update static DOM labels
  const fromLbl = document.querySelector('[data-i18n="from"]');
  if (fromLbl) fromLbl.textContent = (L.source || "FROM").toUpperCase();

  const orderLbl = document.querySelector('[data-i18n="yourOrder"]');
  if (orderLbl) {
    orderLbl.textContent =
      svc === "cab" ? "YOUR TRIP" :
      svc === "parcel" ? "YOUR PARCEL" :
      "YOUR ORDER";
  }

  const delLbl = document.querySelector('[data-i18n="deliveryAddress"]');
  if (delLbl) {
    delLbl.textContent =
      svc === "cab" ? "DROP ADDRESS" :
      svc === "parcel" ? "DROP LOCATION" :
      "DELIVERY ADDRESS";
  }

  const codeLbl = document.querySelector('[data-i18n="deliveryCode"]');
  if (codeLbl) codeLbl.textContent = svc === "cab" ? "RIDE OTP" : "DELIVERY CODE";

  const codeSubLbl = document.querySelector('[data-i18n="shareWithRider"]');
  if (codeSubLbl) codeSubLbl.textContent = "Share with the " + (L.partnerShort || "partner").toLowerCase();

  const tipBtn = document.getElementById("tipBtn");
  if (tipBtn) {
    if (!data.allowsTip) tipBtn.hidden = true;
    else if (svc === "cab") tipBtn.textContent = "Tip your driver";
    else if (svc === "parcel") tipBtn.textContent = "Tip your partner";
  }

  // Kitchen prep — only for food
  if (!data.hasKitchenPrep && typeof kitchenPrep !== "undefined" && kitchenPrep) {
    kitchenPrep.hidden = true;
  }

  // Cheer bar — only really makes sense for food
  const cheerBar = document.querySelector(".cheer-bar");
  if (cheerBar) cheerBar.hidden = svc === "cab"; // trips don't cheer
}

function renderTracking(data) {
  lastTrackingData = data;
  window.TRACK.lastData = data;
  const prevStatus = currentStatus;
  currentStatus = data.status;

  applyServiceAdaptation(data);

  topbarStatus.textContent = niceTopbar(data);
  const orderPrefix =
    data.serviceType === "cab" ? "Ride #" :
    data.serviceType === "parcel" ? "Parcel #" :
    "Order #";
  topbarOrderId.textContent = `${orderPrefix}${data.orderId}`;

  peekStatusText.textContent = nicePeekStatus(data);
  lastEtaMinutes = data.etaMinutes;
  lastEtaReceivedAt = Date.now();

  peekDistance.textContent =
    data.distanceRemainingKm != null
      ? `${data.distanceRemainingKm.toFixed(1)} km · ${Math.round(data.speedKmh || 0)} km/h`
      : "";

  progressFill.style.width = `${data.progress || 0}%`;
  setStepper(data.status);

  // Stage hero illustration
  stageArt.innerHTML = artForStage(data);
  stageHero.dataset.stage = data.status;

  // Kitchen prep card
  renderKitchenPrep(data);

  // Verified badge
  if (data.rider && data.rider.verified) {
    verifiedBadge.hidden = false;
  } else {
    verifiedBadge.hidden = true;
  }

  // Rich timeline
  renderRichTimeline(data);

  // Customer note display
  if (data.customerNote && data.customerNote.text) {
    customerNoteText.textContent = data.customerNote.text;
    customerNoteCard.classList.add("has-note");
  } else {
    customerNoteText.textContent = I18N.t("noteEmpty");
    customerNoteCard.classList.remove("has-note");
  }

  // Rider message banner
  if (data.riderMessage) showRiderMessage(data.riderMessage, data.rider);

  // Watcher badge
  updateWatcherBadge(data);

  // Title + favicon
  updateTabAndFavicon(data);

  // Notifications on status change
  notifyStatusChange(prevStatus, data);

  // Arrival takeover
  maybeShowArrivalTakeover(data);

  if (data.rider) {
    riderCard.hidden = false;
    liveStats.hidden = false;
    otpCard.hidden = false;
    peekRiderThumb.hidden = false;
    peekCallBtn.hidden = false;
    peekRiderPhoto.src = data.rider.photo;
    riderPhotoBig.src = data.rider.photo;
    riderPhotoBig.alt = data.rider.name;
    riderName.textContent = data.rider.name;
    riderRating.textContent = data.rider.rating.toFixed(1);
    riderDeliveries.textContent = `${data.rider.totalDeliveries.toLocaleString()} deliveries`;
    riderVehicle.textContent = data.rider.vehicle;
    otpDigits.textContent = data.otp || "----";

    animateNumber(statSpeed, Math.round(data.speedKmh || 0));
    animateNumber(statDistance, Number(data.distanceRemainingKm || 0), 1);
    animateNumber(statEta, data.etaMinutes || 0);
  }

  if (data.landmark) {
    riderLocation.hidden = false;
    riderLandmark.textContent = `Near ${data.landmark}`;
  }

  customerAddress.textContent = (data.drop && data.drop.address) || data.customer.address;
  instructionsText.textContent =
    data.deliveryInstructions ||
    (data.serviceType === "cab" ? "—" : "Leave at the door");

  if (data.serviceType === "food" || data.serviceType === "grocery" || data.serviceType === "shop") {
    restaurantName.textContent = data.restaurant.name;
    restImage.src = data.restaurant.image || "";
    restImage.style.display = data.restaurant.image ? "" : "none";
    restaurantCuisine.textContent =
      data.serviceType === "grocery" ? "Groceries · 10 min delivery" :
      data.serviceType === "shop" ? "Warehouse dispatch" :
      "Tap restaurant for details";
  } else {
    restImage.style.display = "none";
    restaurantName.textContent = (data.pickup && data.pickup.address) || data.restaurant.name;
    const vd = data.vehicleDetails;
    restaurantCuisine.textContent = vd
      ? `${vd.emoji} ${vd.name}${data.serviceType === "cab" ? ` · ${data.fare?.km || "—"} km` : ""}`
      : (data.pickup && data.pickup.name) || "";
  }

  orderItems.innerHTML = data.items
    .map((it) => `<div class="order-row"><span>${it.qty} × ${it.name}</span><span>₹${it.price * it.qty}</span></div>`)
    .join("");
  orderTotal.textContent = `₹${data.total + (data.tip || 0)}`;

  if (data.events) renderTimeline(data.events);

  const L_ = data.serviceLabels || {};
  if (!restaurantMarker) {
    restaurantMarker = L.marker([data.restaurant.lat, data.restaurant.lng], { icon: restaurantIcon })
      .addTo(map)
      .bindPopup(L_.source ? `${L_.source}: ${data.restaurant.name}` : data.restaurant.name);
  }
  if (!customerMarker) {
    customerMarker = L.marker([data.customer.lat, data.customer.lng], { icon: customerIcon })
      .addTo(map)
      .bindPopup(L_.destination || "Drop location");
  }

  if (data.route && data.currentLocation) {
    if (!routeLine) {
      routeLine = L.polyline(data.route.map((p) => [p.lat, p.lng]), {
        color: "#ffbcc0",
        weight: 6,
        opacity: 0.75,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);
    }
    if (coveredLine) coveredLine.remove();
    const idx = Math.max(1, Math.round(((data.progress || 0) / 100) * (data.route.length - 1)));
    const covered = data.route.slice(0, idx + 1);
    coveredLine = L.polyline(covered.map((p) => [p.lat, p.lng]), {
      color: "#e23744",
      weight: 6,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);

    if (data.trail && data.trail.length > 1) {
      if (trailLine) trailLine.remove();
      trailLine = L.polyline(data.trail.map((p) => [p.lat, p.lng]), {
        color: "#e23744",
        weight: 10,
        opacity: 0.2,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);
    }

    if (!riderMarker) {
      riderMarker = L.marker([data.currentLocation.lat, data.currentLocation.lng], {
        icon: riderDivIcon,
        zIndexOffset: 1000
      }).addTo(map);
      currentHeading = data.heading || 0;
      rotateMarker(currentHeading);
      const initialZoom = window.innerWidth <= 900 ? 16.5 : 16;
      setTimeout(() => {
        const target = centerForLatLng(riderMarker.getLatLng(), initialZoom);
        map.setView(target, initialZoom, { animate: true });
      }, 80);
    } else {
      animateMarkerTo(data.currentLocation, data.heading || currentHeading);
    }
    updateMiniMap(data);
    updateArrivalRadar(data);
  } else if (!riderMarker) {
    fitAllBounds(data);
  }

  if (
    data.status === "picked_up" &&
    data.distanceRemainingKm != null &&
    data.distanceRemainingKm < 0.4 &&
    !arrivalAlertShown
  ) {
    arrivalAlertShown = true;
    arrivalBanner.hidden = false;
    showToast("Your rider is arriving!");
    setTimeout(() => (arrivalBanner.hidden = true), 8000);
  }

  if (publicMode) {
    cancelBtn.hidden = true;
    tipBtn.hidden = true;
    rateBtn.hidden = true;
    $("reportBtn").hidden = true;
    $("settingsBtn").hidden = true;
    $("editInstructionsBtn").hidden = true;
    $("editNoteBtn").hidden = true;
    customerNoteCard.classList.add("readonly");
  } else {
    cancelBtn.hidden = data.status !== "placed";
    tipBtn.hidden = !(data.status === "picked_up" || data.status === "delivered");
    rateBtn.hidden = data.status !== "delivered";
  }

  if (data.tip > 0) tipBtn.textContent = `Tip added · ₹${data.tip}`;
  else tipBtn.textContent = "Tip your rider";
  if (data.rating > 0) rateBtn.textContent = `Rated ${data.rating}★ — Thanks!`;

  if (prevStatus && prevStatus !== data.status) {
    HAPTICS.medium();
    if (data.status === "accepted") SOUND.chime();
    else if (data.status === "picked_up") SOUND.ping();
  }

  if (prevStatus && prevStatus !== "delivered" && data.status === "delivered") {
    const cuisine = (data.restaurant.cuisine || "").toLowerCase();
    celebrateConfettiForCuisine(cuisine);
    SOUND.success();
    HAPTICS.success();
    showToast("Order delivered! Enjoy your meal.");
    if (!publicMode && window.TrackExtras) {
      setTimeout(() => window.TrackExtras.playStory(data), 1600);
      setTimeout(() => window.TrackExtras.openScratch(data), 4200);
    }
  }
  if (prevStatus && prevStatus !== "cancelled" && data.status === "cancelled") {
    showToast("Order cancelled");
  }
}

/* ============================================================
 *  CUISINE-AWARE CONFETTI
 * ============================================================ */
function celebrateConfettiForCuisine(cuisineStr) {
  const mapEmojis = [
    { match: /pizza/, emoji: "🍕" },
    { match: /burger/, emoji: "🍔" },
    { match: /biryani|indian/, emoji: "🍛" },
    { match: /sushi|japanese/, emoji: "🍣" },
    { match: /chinese|noodle/, emoji: "🍜" },
    { match: /salad|healthy/, emoji: "🥗" },
    { match: /taco|mexican/, emoji: "🌮" },
    { match: /dessert|cake|sweet/, emoji: "🍰" }
  ];
  const emojis = mapEmojis.filter((m) => m.match.test(cuisineStr)).map((m) => m.emoji);
  if (!emojis.length) emojis.push("🎉", "✨", "❤️");
  celebrateEmojiConfetti(emojis);
  celebrateConfetti();
}
function celebrateEmojiConfetti(emojis) {
  if (window.TRACK.prefs.motion === "reduce") return;
  const count = 28;
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const el = document.createElement("div");
      el.className = "cheer-emoji";
      el.textContent = emojis[i % emojis.length];
      const left = 5 + Math.random() * 90;
      el.style.left = `${left}%`;
      el.style.bottom = `${10 + Math.random() * 20}%`;
      el.style.fontSize = `${1.8 + Math.random() * 1.2}rem`;
      cheerOverlay.appendChild(el);
      setTimeout(() => el.remove(), 2700);
    }, i * 45);
  }
}

function fitAllBounds(data, animate = true) {
  if (!data || !data.restaurant || !data.customer) return;
  const pts = [
    [data.restaurant.lat, data.restaurant.lng],
    [data.customer.lat, data.customer.lng]
  ];
  if (data.currentLocation) pts.push([data.currentLocation.lat, data.currentLocation.lng]);
  const bounds = L.latLngBounds(pts);

  const isDesktop = window.innerWidth > 900;
  const vh = window.visualViewport?.height || window.innerHeight;
  let pad;
  if (isDesktop) {
    pad = { paddingTopLeft: [60, 80], paddingBottomRight: [460, 60] };
  } else {
    let bottomPadding = 168;
    const snap = document.body.dataset.sheetSnap || "half";
    if (snap === "half") bottomPadding = vh * 0.5 + 20;
    else if (snap === "full") bottomPadding = 50;
    pad = {
      paddingTopLeft: [30, 100],
      paddingBottomRight: [30, bottomPadding]
    };
  }
  map.fitBounds(bounds, { ...pad, maxZoom: 16, animate });
}

/* ============================================================
 *  SHARE + CALL + CHAT
 * ============================================================ */
shareBtn.addEventListener("click", async () => {
  const shareData = {
    title: "Track my order",
    text: `Track my food order ${orderId}`,
    url: window.location.href
  };
  try {
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Tracking link copied");
    }
  } catch {}
});
/* Call + Chat handled by track-extras.js */
$("callBtn").addEventListener("click", () => window.TrackExtras?.startCall());
$("chatBtn").addEventListener("click", () => window.TrackExtras?.openChat());
peekCallBtn.addEventListener("click", () => window.TrackExtras?.startCall());

/* ============================================================
 *  CANCEL
 * ============================================================ */
const cancelModal = $("cancelModal");
cancelBtn.addEventListener("click", () => openModal(cancelModal));
$("cancelNoBtn").addEventListener("click", () => closeModal(cancelModal));
$("cancelYesBtn").addEventListener("click", async () => {
  try {
    const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
    if (!res.ok) throw new Error();
    closeModal(cancelModal);
  } catch {
    showToast("Could not cancel");
  }
});

/* ============================================================
 *  INSTRUCTIONS
 * ============================================================ */
const instructionsModal = $("instructionsModal");
const instructionOptions = $("instructionOptions");
const INSTRUCTION_CHOICES = [
  { icon: "🚪", text: "Leave at the door" },
  { icon: "🤝", text: "Hand it to me" },
  { icon: "🔕", text: "Avoid ringing the bell" },
  { icon: "📵", text: "Contactless delivery" },
  { icon: "🗝", text: "Meet at the gate" }
];
let selectedInstruction = null;
function renderInstructionOptions(current) {
  instructionOptions.innerHTML = INSTRUCTION_CHOICES.map(
    (c) => `
      <button class="ins-opt ${c.text === current ? "selected" : ""}" data-v="${c.text}">
        <span>${c.icon}</span><span>${c.text}</span>
      </button>`
  ).join("");
  instructionOptions.querySelectorAll(".ins-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      instructionOptions.querySelectorAll(".ins-opt").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedInstruction = btn.dataset.v;
    });
  });
}
$("editInstructionsBtn").addEventListener("click", () => {
  renderInstructionOptions(instructionsText.textContent);
  selectedInstruction = instructionsText.textContent;
  openModal(instructionsModal);
});
$("saveInstructionsBtn").addEventListener("click", async () => {
  if (!selectedInstruction) return;
  try {
    await fetch(`/api/orders/${orderId}/instructions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructions: selectedInstruction })
    });
    instructionsText.textContent = selectedInstruction;
    closeModal(instructionsModal);
    showToast("Instructions updated");
  } catch {
    showToast("Could not update");
  }
});

/* ============================================================
 *  TIP
 * ============================================================ */
const tipModal = $("tipModal");
const tipOptions = $("tipOptions");
const confirmTipBtn = $("confirmTipBtn");
const tipCustomInput = $("tipCustomInput");
let selectedTip = null;
tipBtn.addEventListener("click", () => openModal(tipModal));
tipOptions.querySelectorAll("button").forEach((b) => {
  b.addEventListener("click", () => {
    tipOptions.querySelectorAll("button").forEach((x) => x.classList.remove("selected"));
    b.classList.add("selected");
    selectedTip = Number(b.dataset.tip);
    tipCustomInput.value = "";
    confirmTipBtn.disabled = false;
    confirmTipBtn.textContent = `Add ₹${selectedTip} tip`;
  });
});
tipCustomInput.addEventListener("input", () => {
  const v = Math.max(0, Math.min(5000, Math.round(Number(tipCustomInput.value) || 0)));
  if (v > 0) {
    tipOptions.querySelectorAll("button").forEach((x) => x.classList.remove("selected"));
    selectedTip = v;
    confirmTipBtn.disabled = false;
    confirmTipBtn.textContent = `Add ₹${v} tip`;
  } else {
    selectedTip = null;
    confirmTipBtn.disabled = true;
    confirmTipBtn.textContent = I18N.t("selectTip");
  }
});
confirmTipBtn.addEventListener("click", async () => {
  if (!selectedTip) return;
  try {
    await fetch(`/api/orders/${orderId}/tip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: selectedTip })
    });
    closeModal(tipModal);
    showToast(`₹${selectedTip} tip added · Thank you!`);
    HAPTICS.success();
  } catch {
    showToast("Could not add tip");
  }
});

/* Rate is handled by track-extras.js (rich rating) */
rateBtn.addEventListener("click", () => window.TrackExtras?.openRichRate(lastTrackingData));

/* ============================================================
 *  CHEER BAR wiring
 * ============================================================ */
document.querySelectorAll("#cheerBar .cheer-row button").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const emoji = btn.dataset.emoji;
    spawnCheerEmoji(emoji);
    HAPTICS.light();
    if (publicMode) {
      // public watchers cheer via POST with share token → server broadcasts to order room
      try {
        const order = lastTrackingData?.orderId;
        if (order) {
          await fetch(`/api/orders/${order}/cheer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emoji })
          });
        }
      } catch {}
    } else if (orderId) {
      try {
        await fetch(`/api/orders/${orderId}/cheer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji })
        });
      } catch {}
    }
  });
});

/* ============================================================
 *  BOOT
 * ============================================================ */
async function boot() {
  if (publicMode) {
    try {
      const res = await fetch(`/api/share/${shareToken}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      document.body.classList.add("public-mode");
      renderTracking(data);
      socket.emit("join-public", { token: shareToken });
    } catch {
      topbarStatus.textContent = "Invalid share link";
    }
    return;
  }
  if (!orderId) {
    topbarStatus.textContent = "No order selected";
    return;
  }
  try {
    const res = await fetch(`/api/orders/${orderId}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderTracking(data);
    socket.emit("join-order", { orderId });
  } catch {
    topbarStatus.textContent = "Order not found";
  }
}

socket.on("connect", () => {
  if (publicMode) socket.emit("join-public", { token: shareToken });
  else if (orderId) socket.emit("join-order", { orderId });
});
socket.on("tracking-update", renderTracking);
socket.on("tracking-error", (e) => showToast(e.message || "Tracking error"));

/* ============================================================
 *  SHARE — improved to expose public link
 * ============================================================ */
shareBtn.removeEventListener && shareBtn.removeEventListener("click", () => {});
shareBtn.onclick = async () => {
  const token = lastTrackingData?.shareToken;
  const url = token
    ? `${window.location.origin}/track.html?share=${token}`
    : window.location.href;
  const shareData = {
    title: "Track my order",
    text: `Track my food order ${orderId || ""}`,
    url
  };
  try {
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(url);
      showToast("Public tracking link copied");
    }
  } catch {}
};

setTimeout(() => map.invalidateSize(), 200);
boot();
