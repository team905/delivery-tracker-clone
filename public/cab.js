/* cab.js — Uber/Ola-style cab booking flow.
 *
 * State machine:
 *   "start"    → map + pickup bar + "Where to?" CTA + saved places
 *   "search"   → full-screen search sheet for pickup AND drop
 *   "vehicles" → route drawn on map + vehicle picker + confirm
 *
 * Pickup is by default reverse-geocoded from device location.
 * The user can also drag the map — the centre pin acts as the pickup,
 * and the address auto-refreshes when the map stops moving.
 *
 * Drop is selected via the search sheet (autocomplete + saved places + map).
 *
 * Recent searches & saved places (Home/Work) live in localStorage.
 */

const $ = (id) => document.getElementById(id);

const DEFAULT_CENTER = [19.1197, 72.9056];
const LS_RECENT = "qg:cabRecent";
const LS_HOME = "qg:cabHome";
const LS_WORK = "qg:cabWork";
const LS_PAYMENT = "qg:cabPayment";

const PAY_OPTIONS = [
  { id: "upi", label: "UPI", emoji: "📱", sub: "Google Pay / PhonePe / Paytm" },
  { id: "cash", label: "Cash", emoji: "💵", sub: "Pay the driver directly" },
  { id: "card", label: "Card", emoji: "💳", sub: "Add via Razorpay (demo)" },
  { id: "wallet", label: "Wallet", emoji: "👛", sub: "QuickGo Wallet" }
];

const state = {
  view: "start", // "start" | "search" | "vehicles"
  map: null,
  pickup: null, // { lat, lng, label, sublabel, full }
  drop: null,
  estimates: [],
  chosen: null,
  pickupMarker: null,
  dropMarker: null,
  routeLine: null,
  /* search overlay can be opened in pickup-mode or drop-mode — that determines
   * which input is auto-focused and which side a search/result fills in. */
  searchTarget: "drop",
  surge: 1,
  payment: PAY_OPTIONS[0],
  note: "",
  reverseTimer: null,
  ignoreNextMoveEnd: false
};

const els = {
  map: $("cabMap"),
  centerPin: $("cabCenterPin"),
  centerHint: $("cabCenterPinHint"),
  topbarTitle: $("cab2Title"),
  locateBtn: $("cab2LocateBtn"),

  sheetStart: $("sheetStart"),
  pickupLabel: $("cab2PickupLabel"),
  pickupEdit: $("cab2PickupEdit"),
  whereToBtn: $("cab2WhereToBtn"),
  saved: $("cab2Saved"),

  sheetSearch: $("sheetSearch"),
  searchBack: $("cab2SearchBack"),
  inputPickup: $("cab2InputPickup"),
  inputDrop: $("cab2InputDrop"),
  results: $("cab2Results"),
  recent: $("cab2Recent"),
  recentWrap: $("cab2RecentWrap"),
  useGps: $("cab2UseGps"),
  pickOnMap: $("cab2PickOnMap"),
  saveHome: $("cab2SaveHome"),
  saveWork: $("cab2SaveWork"),
  homeLabel: $("cab2HomeLabel"),
  homeSub: $("cab2HomeSub"),
  workLabel: $("cab2WorkLabel"),
  workSub: $("cab2WorkSub"),

  sheetVehicles: $("sheetVehicles"),
  routePickup: $("cab2RoutePickup"),
  routeDrop: $("cab2RouteDrop"),
  routeEdit: $("cab2RouteEdit"),
  distKm: $("cab2DistKm"),
  tripMin: $("cab2TripMin"),
  surgeWrap: $("cab2Surge"),
  surgeMul: $("cab2SurgeMul"),
  vehicles: $("cab2Vehicles"),
  payBtn: $("cab2PayBtn"),
  payLabel: $("cab2PayLabel"),
  noteBtn: $("cab2NoteBtn"),
  noteLabel: $("cab2NoteLabel"),
  promoBtn: $("cab2PromoBtn"),
  confirmBtn: $("cab2ConfirmBtn"),
  confirmLabel: $("cab2ConfirmLabel"),

  modal: $("cab2Modal"),
  modalCard: $("cab2ModalCard"),
  toast: $("toast")
};

/* =========================================================
   Tiny utilities
   ========================================================= */
function toast(msg, ms = 2000) {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.classList.add("is-on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove("is-on"), ms);
}

function readLS(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function writeLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

function distanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(s)));
}

function setView(view) {
  state.view = view;
  document.body.classList.toggle("is-state-search", view === "search");
  document.body.classList.toggle("is-state-vehicles", view === "vehicles");

  els.sheetStart.classList.toggle("is-on", view === "start");
  els.sheetSearch.classList.toggle("is-on", view === "search");
  els.sheetVehicles.classList.toggle("is-on", view === "vehicles");

  if (view === "start") {
    els.topbarTitle.textContent = "Where to?";
    els.centerPin.classList.remove("is-hidden");
  } else if (view === "search") {
    els.topbarTitle.textContent = "Search address";
  } else if (view === "vehicles") {
    els.topbarTitle.textContent = "Choose your ride";
  }
}

/* =========================================================
   Map setup + centre-pin pickup
   ========================================================= */
function initMap() {
  const map = L.map(els.map, { zoomControl: false, attributionControl: false }).setView(DEFAULT_CENTER, 13);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap, © Carto"
  }).addTo(map);
  state.map = map;

  /* Show the bobbing-pin hint whenever the user pans the map. */
  map.on("movestart", () => {
    if (state.view !== "start") return;
    els.centerPin.classList.add("is-dragging");
    els.centerHint.textContent = "Move map to set pickup";
  });
  map.on("moveend", async () => {
    if (state.view !== "start") return;
    els.centerPin.classList.remove("is-dragging");
    if (state.ignoreNextMoveEnd) { state.ignoreNextMoveEnd = false; return; }
    const c = map.getCenter();
    await refreshPickupFromCenter(c.lat, c.lng);
  });

  /* Locate the user as soon as we can. */
  setTimeout(() => map.invalidateSize(), 80);
  locateMe(true);
}

function locateMe(silent) {
  if (!navigator.geolocation) {
    if (!silent) toast("Location not available");
    return;
  }
  els.pickupLabel.textContent = "Locating you…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      state.ignoreNextMoveEnd = true; // we're about to set the centre — don't double-fire reverse
      state.map.setView(ll, 16);
      refreshPickupFromCenter(ll[0], ll[1]);
    },
    () => {
      if (!silent) toast("Allow location to set pickup automatically");
      els.pickupLabel.textContent = "Tap to set pickup";
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
  );
}

/* Debounced reverse-geocode for the map centre. */
async function refreshPickupFromCenter(lat, lng) {
  clearTimeout(state.reverseTimer);
  els.pickupLabel.textContent = "Locating address…";
  state.reverseTimer = setTimeout(async () => {
    const addr = await reverseGeocode(lat, lng);
    state.pickup = {
      lat, lng,
      label: addr?.label || "Pinned location",
      sublabel: addr?.sublabel || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      full: addr?.full || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    };
    els.pickupLabel.textContent = state.pickup.label;
  }, 400);
}

/* =========================================================
   Geocoding helpers (proxy via /api/geocode/*)
   ========================================================= */
async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    const data = await r.json();
    return data.address || null;
  } catch { return null; }
}

async function searchGeocode(q, biasLatLng) {
  try {
    let url = `/api/geocode/search?q=${encodeURIComponent(q)}`;
    if (biasLatLng) url += `&lat=${biasLatLng.lat}&lng=${biasLatLng.lng}`;
    const r = await fetch(url);
    const data = await r.json();
    return data.results || [];
  } catch { return []; }
}

/* =========================================================
   Saved & recent places
   ========================================================= */
function getRecent() { return readLS(LS_RECENT, []); }
function pushRecent(place) {
  if (!place || !place.lat || !place.lng) return;
  const list = getRecent().filter((p) => p.label !== place.label);
  list.unshift(place);
  writeLS(LS_RECENT, list.slice(0, 5));
}

function getHome() { return readLS(LS_HOME); }
function getWork() { return readLS(LS_WORK); }

function renderSavedChips() {
  const home = getHome();
  const work = getWork();
  const recent = getRecent();
  const chips = [];
  chips.push(
    home
      ? { kind: "home", label: "Home", sub: home.label, place: home }
      : { kind: "home", label: "Add Home", sub: "Save your home" }
  );
  chips.push(
    work
      ? { kind: "work", label: "Work", sub: work.label, place: work }
      : { kind: "work", label: "Add Work", sub: "Save your work" }
  );
  recent.slice(0, 2).forEach((r) => {
    chips.push({ kind: "recent", label: r.label, sub: r.sublabel, place: r });
  });
  els.saved.innerHTML = chips
    .map(
      (c, i) => `
      <button type="button" class="cab2-savedchip" data-chip="${c.kind}" data-idx="${i}" data-xp-tap>
        <span class="cab2-savedchip__ic" aria-hidden="true">${c.kind === "home" ? "🏠" : c.kind === "work" ? "💼" : "📜"}</span>
        <span>
          <span>${c.label}</span>
          ${c.sub ? `<span class="cab2-savedchip__sub"> · ${c.sub}</span>` : ""}
        </span>
      </button>`
    )
    .join("");
  /* delegate clicks */
  els.saved.querySelectorAll(".cab2-savedchip").forEach((btn, i) => {
    btn.addEventListener("click", () => {
      const c = chips[i];
      if (!c.place) {
        openSearch("drop"); // prompt user to set this place first
        return;
      }
      pickDrop(c.place);
    });
  });
}

function refreshHomeWorkLabels() {
  const home = getHome();
  const work = getWork();
  els.homeLabel.textContent = home ? "Home" : "Add Home";
  els.homeSub.textContent = home ? home.label : "Save your home address";
  els.workLabel.textContent = work ? "Work" : "Add Work";
  els.workSub.textContent = work ? work.label : "Save your work address";
}

function renderRecentList() {
  const list = getRecent();
  if (!list.length) {
    els.recentWrap.style.display = "none";
    return;
  }
  els.recentWrap.style.display = "";
  els.recent.innerHTML = list
    .map(
      (p, i) => `
      <button type="button" class="cab2-resultitem" data-recent="${i}">
        <span class="cab2-resultitem__ic">📜</span>
        <div>
          <div class="cab2-resultitem__main">${p.label}</div>
          ${p.sublabel ? `<div class="cab2-resultitem__sub">${p.sublabel}</div>` : ""}
        </div>
      </button>`
    )
    .join("");
  els.recent.querySelectorAll("[data-recent]").forEach((b, i) => {
    b.addEventListener("click", () => {
      const place = list[i];
      if (state.searchTarget === "pickup") pickPickup(place);
      else pickDrop(place);
    });
  });
}

/* =========================================================
   Search overlay logic
   ========================================================= */
function openSearch(target = "drop") {
  state.searchTarget = target;
  setView("search");
  els.inputPickup.value = state.pickup?.label || "";
  els.inputDrop.value = state.drop?.label || "";
  refreshHomeWorkLabels();
  renderRecentList();
  els.results.innerHTML = "";
  setTimeout(() => {
    if (target === "pickup") els.inputPickup.focus();
    else els.inputDrop.focus();
  }, 280);
}

function closeSearch() {
  setView(state.drop && state.pickup ? "vehicles" : "start");
  if (state.view === "vehicles") drawRouteAndEstimate();
}

function pickPickup(place) {
  state.pickup = {
    lat: place.lat, lng: place.lng,
    label: place.label, sublabel: place.sublabel, full: place.full || place.raw || place.label
  };
  els.pickupLabel.textContent = state.pickup.label;
  pushRecent(state.pickup);
  if (state.drop) {
    setView("vehicles");
    drawRouteAndEstimate();
  } else {
    state.searchTarget = "drop";
    els.inputPickup.value = state.pickup.label;
    setTimeout(() => els.inputDrop.focus(), 100);
    els.results.innerHTML = "";
  }
}

function pickDrop(place) {
  state.drop = {
    lat: place.lat, lng: place.lng,
    label: place.label, sublabel: place.sublabel, full: place.full || place.raw || place.label
  };
  pushRecent(state.drop);
  setView("vehicles");
  drawRouteAndEstimate();
}

const debouncedPickupSearch = (window.XP ? XP.debounce : (fn) => fn)(async () => {
  const q = els.inputPickup.value.trim();
  if (q.length < 2) { els.results.innerHTML = ""; return; }
  els.results.innerHTML = `<div class="cab2-loading"><span class="xp-spinner"></span> Searching…</div>`;
  const items = await searchGeocode(q, state.pickup);
  renderSearchResults(items, "pickup");
}, 350);

const debouncedDropSearch = (window.XP ? XP.debounce : (fn) => fn)(async () => {
  const q = els.inputDrop.value.trim();
  if (q.length < 2) { els.results.innerHTML = ""; return; }
  els.results.innerHTML = `<div class="cab2-loading"><span class="xp-spinner"></span> Searching…</div>`;
  const items = await searchGeocode(q, state.pickup);
  renderSearchResults(items, "drop");
}, 350);

function renderSearchResults(items, target) {
  if (!items.length) {
    els.results.innerHTML = `<div class="cab2-empty">No matches. Try a landmark or full address.</div>`;
    return;
  }
  els.results.innerHTML = items
    .map(
      (r, i) => `
      <button type="button" class="cab2-resultitem" data-pick="${i}">
        <span class="cab2-resultitem__ic">📍</span>
        <div style="min-width:0">
          <div class="cab2-resultitem__main">${r.label || r.raw}</div>
          ${r.sublabel ? `<div class="cab2-resultitem__sub">${r.sublabel}</div>` : ""}
        </div>
      </button>`
    )
    .join("");
  els.results.querySelectorAll("[data-pick]").forEach((b, i) => {
    b.addEventListener("click", () => {
      const pick = items[i];
      if (target === "pickup") pickPickup(pick);
      else pickDrop(pick);
    });
  });
}

/* =========================================================
   Route + fare estimate
   ========================================================= */
function drawRouteAndEstimate() {
  if (!state.pickup || !state.drop) return;

  /* Drop the centre pin while we're in vehicle mode and use real pins. */
  const pickupLL = [state.pickup.lat, state.pickup.lng];
  const dropLL = [state.drop.lat, state.drop.lng];
  if (!state.pickupMarker) {
    state.pickupMarker = L.marker(pickupLL, { icon: bigPinIcon("ink", "A") }).addTo(state.map);
  } else state.pickupMarker.setLatLng(pickupLL);
  if (!state.dropMarker) {
    state.dropMarker = L.marker(dropLL, { icon: bigPinIcon("blue", "B") }).addTo(state.map);
  } else state.dropMarker.setLatLng(dropLL);

  if (state.routeLine) state.routeLine.remove();
  state.routeLine = L.polyline([pickupLL, dropLL], {
    color: "#0e1117", weight: 4, opacity: 0.85, dashArray: "6 8"
  }).addTo(state.map);

  state.map.fitBounds(L.latLngBounds(pickupLL, dropLL), { padding: [80, 80], maxZoom: 15 });

  els.routePickup.textContent = state.pickup.label;
  els.routeDrop.textContent = state.drop.label;
  /* Surge: small deterministic surge based on time of day */
  const hour = new Date().getHours();
  state.surge = (hour >= 8 && hour <= 11) || (hour >= 18 && hour <= 21) ? 1.2 : 1.0;
  if (state.surge > 1) {
    els.surgeWrap.hidden = false;
    els.surgeMul.textContent = state.surge.toFixed(1);
  } else els.surgeWrap.hidden = true;

  fetchEstimates();
}

function bigPinIcon(kind, label) {
  const bg = kind === "blue" ? "#0a5cff" : "#0e1117";
  const radius = kind === "blue" ? "4px" : "50%";
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:${radius};background:${bg};border:4px solid #fff;box-shadow:0 6px 16px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

async function fetchEstimates() {
  els.vehicles.innerHTML = `<div class="cab2-loading"><span class="xp-spinner"></span> Calculating fares…</div>`;
  try {
    const r = await fetch("/api/cab/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup: { lat: state.pickup.lat, lng: state.pickup.lng },
        drop: { lat: state.drop.lat, lng: state.drop.lng }
      })
    });
    if (!r.ok) throw new Error("estimate failed");
    const data = await r.json();
    state.estimates = data.estimates || [];
    if (!state.chosen || !state.estimates.find((e) => e.id === state.chosen)) {
      state.chosen = state.estimates[1]?.id || state.estimates[0]?.id; // default to "auto"
    }
    renderVehicles();
  } catch {
    els.vehicles.innerHTML = `<div class="cab2-empty">Could not fetch fares. Try again.</div>`;
  }
}

function renderVehicles() {
  if (!state.estimates.length) return;
  /* Cheapest gets a "Best price" badge. */
  const cheapestId = state.estimates.reduce((best, v) =>
    !best || v.fare.total < best.fare.total ? v : best, null).id;

  /* Surge effective fare */
  const fareFor = (v) => {
    const baseTotal = v.fare.total;
    const total = Math.round(baseTotal * state.surge);
    return { baseTotal, total };
  };

  const distanceKmTotal = state.estimates[0]?.fare?.km || distanceKm(state.pickup, state.drop);
  const tripMin = Math.max(2, Math.round(distanceKmTotal * 2.4));
  els.distKm.textContent = `${distanceKmTotal.toFixed(1)} km`;
  els.tripMin.textContent = `${tripMin} min`;

  els.vehicles.innerHTML = state.estimates
    .map((v) => {
      const { baseTotal, total } = fareFor(v);
      const isOn = state.chosen === v.id;
      const isSurge = state.surge > 1;
      const isCheapest = v.id === cheapestId;
      const badge = isCheapest && !isSurge
        ? `<span class="cab2-vehicle__badge">Best price</span>`
        : (isSurge && isOn
            ? `<span class="cab2-vehicle__badge cab2-vehicle__badge--surge">Surge × ${state.surge}</span>`
            : "");
      return `
        <button type="button" class="cab2-vehicle ${isOn ? "is-on" : ""}" data-id="${v.id}" data-xp-tap>
          ${badge}
          <span class="cab2-vehicle__emoji">${v.emoji}</span>
          <span class="cab2-vehicle__main">
            <span class="cab2-vehicle__title-row">
              <span class="cab2-vehicle__title">${v.name}</span>
              <span class="cab2-vehicle__seats">· ${v.seats} seats</span>
            </span>
            <span class="cab2-vehicle__sub">${v.desc}</span>
            <span class="cab2-vehicle__eta">${v.etaMinutes} min away · drop in ${v.etaMinutes + tripMin} min</span>
          </span>
          <span class="cab2-vehicle__fare-col">
            ${isSurge ? `<span class="cab2-vehicle__fare--strike">₹${baseTotal}</span>` : ""}
            <span class="cab2-vehicle__fare">₹${total}</span>
          </span>
        </button>`;
    })
    .join("");

  els.vehicles.querySelectorAll(".cab2-vehicle").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.chosen = btn.dataset.id;
      if (window.XP) XP.haptic(6);
      renderVehicles();
    });
  });

  const pick = state.estimates.find((v) => v.id === state.chosen);
  if (pick) {
    const { total } = fareFor(pick);
    els.confirmBtn.disabled = false;
    els.confirmLabel.textContent = `Confirm ${pick.name} · ₹${total}`;
  } else {
    els.confirmBtn.disabled = true;
    els.confirmLabel.textContent = "Choose a ride";
  }
}

/* =========================================================
   Modals (payment / note)
   ========================================================= */
function openModal(html) {
  els.modalCard.innerHTML = html;
  els.modal.removeAttribute("hidden");
}
function closeModal() {
  els.modal.setAttribute("hidden", "");
  els.modalCard.innerHTML = "";
}
els.modal.addEventListener("click", (e) => { if (e.target === els.modal) closeModal(); });

function openPaymentModal() {
  const html = `
    <h3>Payment method</h3>
    <div>
      ${PAY_OPTIONS.map((p) => `
        <button type="button" class="cab2-modal__opt ${state.payment.id === p.id ? "is-on" : ""}" data-pay="${p.id}">
          <span class="cab2-modal__opt-ic">${p.emoji}</span>
          <span>
            <span class="cab2-modal__opt-main">${p.label}</span>
            <span class="cab2-modal__opt-sub">${p.sub}</span>
          </span>
          <span>${state.payment.id === p.id ? "✓" : ""}</span>
        </button>
      `).join("")}
    </div>`;
  openModal(html);
  els.modalCard.querySelectorAll("[data-pay]").forEach((b) => {
    b.addEventListener("click", () => {
      const pid = b.dataset.pay;
      state.payment = PAY_OPTIONS.find((p) => p.id === pid) || state.payment;
      writeLS(LS_PAYMENT, state.payment.id);
      els.payLabel.textContent = state.payment.label;
      closeModal();
      toast(`Payment set to ${state.payment.label}`);
    });
  });
}

function openNoteModal() {
  const html = `
    <h3>Note for driver</h3>
    <textarea id="cab2NoteInput" placeholder="e.g. ring the bell once, gate 2, blue building">${state.note || ""}</textarea>
    <div class="cab2-modal__btn-row">
      <button type="button" class="cab2-modal__btn cab2-modal__btn--ghost" id="cab2NoteCancel">Cancel</button>
      <button type="button" class="cab2-modal__btn cab2-modal__btn--primary" id="cab2NoteSave">Save</button>
    </div>`;
  openModal(html);
  $("cab2NoteCancel").addEventListener("click", closeModal);
  $("cab2NoteSave").addEventListener("click", () => {
    state.note = ($("cab2NoteInput").value || "").trim();
    els.noteLabel.textContent = state.note ? "Note added" : "Note for driver";
    els.noteBtn.classList.toggle("has-note", !!state.note);
    closeModal();
  });
}

function openPromoModal() {
  openModal(`
    <h3>Offers &amp; coupons</h3>
    <p style="color:#6b7280;font-size:13px;margin-bottom:14px">No active offers right now. Check back soon!</p>
    <button type="button" class="cab2-modal__btn cab2-modal__btn--primary" onclick="document.getElementById('cab2Modal').setAttribute('hidden','')">OK</button>
  `);
}

/* =========================================================
   Saving Home / Work
   ========================================================= */
function trySaveAs(slot) {
  /* If user has a current pickup, save it as that slot; else open search. */
  const place = state.pickup || (state.drop || null);
  if (!place || !place.lat) {
    openSearch("pickup");
    toast("Set the location you want to save first");
    return;
  }
  if (slot === "home") writeLS(LS_HOME, place);
  else writeLS(LS_WORK, place);
  refreshHomeWorkLabels();
  renderSavedChips();
  toast(`${slot === "home" ? "Home" : "Work"} saved`);
}

/* =========================================================
   Wire-up
   ========================================================= */
function wire() {
  /* Saved + recent on the start sheet */
  renderSavedChips();

  /* Pickup edit & where-to → open search */
  els.pickupEdit.addEventListener("click", () => openSearch("pickup"));
  els.whereToBtn.addEventListener("click", () => openSearch("drop"));
  els.locateBtn.addEventListener("click", () => locateMe(false));

  /* Search overlay */
  els.searchBack.addEventListener("click", closeSearch);
  els.inputPickup.addEventListener("input", () => { state.searchTarget = "pickup"; debouncedPickupSearch(); });
  els.inputDrop.addEventListener("input", () => { state.searchTarget = "drop"; debouncedDropSearch(); });
  els.inputPickup.addEventListener("focus", () => { state.searchTarget = "pickup"; });
  els.inputDrop.addEventListener("focus", () => { state.searchTarget = "drop"; });

  document.querySelectorAll("[data-clear]").forEach((b) => {
    b.addEventListener("click", () => {
      const which = b.dataset.clear;
      if (which === "pickup") { els.inputPickup.value = ""; els.inputPickup.focus(); }
      else { els.inputDrop.value = ""; els.inputDrop.focus(); }
      els.results.innerHTML = "";
    });
  });

  els.useGps.addEventListener("click", () => {
    if (!navigator.geolocation) return toast("Location not available");
    toast("Locating you…");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const addr = await reverseGeocode(latitude, longitude);
      const place = {
        lat: latitude, lng: longitude,
        label: addr?.label || "Current location",
        sublabel: addr?.sublabel || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        full: addr?.full
      };
      if (state.searchTarget === "pickup") pickPickup(place);
      else pickDrop(place);
    }, () => toast("Could not get location"), { enableHighAccuracy: true, timeout: 8000 });
  });

  els.pickOnMap.addEventListener("click", () => {
    /* Close search and let user move the map. The centre pin will reverse-geocode pickup;
     * for "drop" we use a simple tap-on-map via map click handler below. */
    setView("start");
    if (state.searchTarget === "drop") {
      toast("Tap the map to set drop");
      const onMapClick = async (e) => {
        state.map.off("click", onMapClick);
        const { lat, lng } = e.latlng;
        const addr = await reverseGeocode(lat, lng);
        pickDrop({
          lat, lng,
          label: addr?.label || "Pinned drop",
          sublabel: addr?.sublabel || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          full: addr?.full
        });
      };
      state.map.on("click", onMapClick);
    } else {
      toast("Move the map and the centre pin sets your pickup");
    }
  });

  els.saveHome.addEventListener("click", () => trySaveAs("home"));
  els.saveWork.addEventListener("click", () => trySaveAs("work"));

  /* Vehicle sheet */
  els.routeEdit.addEventListener("click", () => openSearch("drop"));
  els.payBtn.addEventListener("click", openPaymentModal);
  els.noteBtn.addEventListener("click", openNoteModal);
  els.promoBtn.addEventListener("click", openPromoModal);

  els.confirmBtn.addEventListener("click", confirmBooking);

  /* Restore saved payment preference */
  const savedPayId = readLS(LS_PAYMENT);
  if (savedPayId) {
    const found = PAY_OPTIONS.find((p) => p.id === savedPayId);
    if (found) { state.payment = found; els.payLabel.textContent = found.label; }
  }
}

async function confirmBooking() {
  if (!state.pickup || !state.drop || !state.chosen) return;
  const pick = state.estimates.find((v) => v.id === state.chosen);
  if (!pick) return;
  els.confirmBtn.disabled = true;
  els.confirmLabel.textContent = "Booking your ride…";
  try {
    const res = await fetch("/api/cab/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup: { lat: state.pickup.lat, lng: state.pickup.lng, address: state.pickup.label },
        drop: { lat: state.drop.lat, lng: state.drop.lng, address: state.drop.label },
        vehicleType: state.chosen,
        rider: { name: "You", phone: "+91 99999 00000" },
        deliveryInstructions: state.note || ""
      })
    });
    if (!res.ok) throw new Error((await res.json()).error || "Could not book");
    const data = await res.json();
    if (window.XP) {
      XP.success({
        icon: "🚖",
        title: "Ride confirmed!",
        sub: `Looking for the closest ${pick.name}`,
        duration: 1300,
        onDone: () => { window.location.href = `/track.html?orderId=${data.orderId}`; }
      });
    } else {
      window.location.href = `/track.html?orderId=${data.orderId}`;
    }
  } catch (e) {
    toast(e.message || "Could not book");
    els.confirmBtn.disabled = false;
    renderVehicles();
  }
}

/* =========================================================
   Boot
   ========================================================= */
initMap();
wire();
setView("start");
