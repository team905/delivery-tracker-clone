/* Cab (Ola-style) — pickup+drop map, vehicle picker, fare estimate, book ride. */

const $ = (id) => document.getElementById(id);

const DEFAULT_CENTER = [19.1197, 72.9056];

const state = {
  map: null,
  pickup: null,
  drop: null,
  pickupMarker: null,
  dropMarker: null,
  routeLine: null,
  settingMode: "pickup",
  vehicles: [],
  estimates: [],
  chosen: null
};

const els = {
  map: $("cabMap"),
  pickupName: $("pickupName"),
  pickupAddr: $("pickupAddr"),
  dropName: $("dropName"),
  dropAddr: $("dropAddr"),
  vehicles: $("cabVehicles"),
  book: $("cabBook"),
  bookText: $("cabBookText"),
  toast: $("toast")
};

function toast(msg, ms = 2200) {
  els.toast.textContent = msg;
  els.toast.classList.add("is-on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove("is-on"), ms);
}

function initMap() {
  const map = L.map(els.map, { zoomControl: false, attributionControl: false }).setView(
    DEFAULT_CENTER,
    13
  );
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);
  map.on("click", (e) => handleMapClick(e.latlng));
  state.map = map;
  setTimeout(() => map.invalidateSize(), 80);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        map.setView(ll, 15);
        setPoint("pickup", ll);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }
}

function handleMapClick(latlng) {
  const ll = [latlng.lat, latlng.lng];
  if (state.settingMode === "pickup" || !state.pickup) {
    setPoint("pickup", ll);
    state.settingMode = "drop";
  } else {
    setPoint("drop", ll);
    state.settingMode = "pickup";
  }
}

function pinIcon(color, label) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:26px;height:26px;border-radius:50%;background:${color};
      border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;color:#fff;
      font-weight:800;font-size:11px">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
}

function setPoint(which, ll) {
  const point = { lat: ll[0], lng: ll[1] };
  if (which === "pickup") {
    state.pickup = point;
    if (state.pickupMarker) state.pickupMarker.setLatLng(ll);
    else state.pickupMarker = L.marker(ll, { icon: pinIcon("#0a7cff", "A"), draggable: true })
      .addTo(state.map)
      .on("dragend", (e) => setPoint("pickup", [e.target.getLatLng().lat, e.target.getLatLng().lng]));
    els.pickupAddr.textContent = `${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}`;
    els.pickupName.textContent = "Pickup location";
  } else {
    state.drop = point;
    if (state.dropMarker) state.dropMarker.setLatLng(ll);
    else state.dropMarker = L.marker(ll, { icon: pinIcon("#e23744", "B"), draggable: true })
      .addTo(state.map)
      .on("dragend", (e) => setPoint("drop", [e.target.getLatLng().lat, e.target.getLatLng().lng]));
    els.dropAddr.textContent = `${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}`;
    els.dropName.textContent = "Drop location";
  }
  refreshRoute();
  refreshEstimates();
}

function refreshRoute() {
  if (state.routeLine) {
    state.routeLine.remove();
    state.routeLine = null;
  }
  if (state.pickup && state.drop) {
    const pts = [
      [state.pickup.lat, state.pickup.lng],
      [state.drop.lat, state.drop.lng]
    ];
    state.routeLine = L.polyline(pts, { color: "#0a7cff", weight: 4, dashArray: "6 8" }).addTo(state.map);
    state.map.fitBounds(state.routeLine.getBounds(), { padding: [40, 40] });
  }
}

async function refreshEstimates() {
  if (!state.pickup || !state.drop) {
    els.vehicles.innerHTML = `<p style="padding:12px;text-align:center;color:#7b8088">Pick pickup & drop to see fares</p>`;
    els.book.disabled = true;
    els.bookText.textContent = "Choose pickup & drop";
    return;
  }
  const res = await fetch("/api/cab/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pickup: state.pickup, drop: state.drop })
  });
  if (!res.ok) return;
  const data = await res.json();
  state.estimates = data.estimates || [];
  if (!state.chosen) state.chosen = state.estimates[1]?.id || state.estimates[0]?.id;
  renderVehicles();
}

function renderVehicles() {
  els.vehicles.innerHTML = state.estimates
    .map(
      (v) => `
      <button type="button" class="cab-vehicle${state.chosen === v.id ? " cab-vehicle--on" : ""}" data-id="${v.id}">
        <span class="cab-vehicle__emoji" aria-hidden="true">${v.emoji}</span>
        <span>
          <span class="cab-vehicle__title">${v.name}</span>
          <span class="cab-vehicle__sub">${v.desc} · ${v.seats} seats</span>
        </span>
        <span class="cab-vehicle__fare">
          ₹${v.fare.total}
          <span class="cab-vehicle__eta">${v.etaMinutes} min away · ${v.fare.km} km</span>
        </span>
      </button>`
    )
    .join("");
  const pick = state.estimates.find((x) => x.id === state.chosen);
  els.book.disabled = !pick;
  els.bookText.textContent = pick ? `Confirm ${pick.name} · ₹${pick.fare.total}` : "Select a vehicle";
}

els.vehicles.addEventListener("click", (e) => {
  const b = e.target.closest(".cab-vehicle");
  if (!b) return;
  state.chosen = b.dataset.id;
  renderVehicles();
});

document.querySelectorAll("[data-field]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.settingMode = btn.dataset.field;
    toast(
      state.settingMode === "pickup"
        ? "Tap map for pickup"
        : "Tap map for drop"
    );
  });
});

els.book.addEventListener("click", async () => {
  if (!state.pickup || !state.drop || !state.chosen) return;
  els.book.disabled = true;
  els.bookText.textContent = "Booking…";
  try {
    const res = await fetch("/api/cab/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup: { ...state.pickup, address: els.pickupAddr.textContent },
        drop: { ...state.drop, address: els.dropAddr.textContent },
        vehicleType: state.chosen,
        rider: { name: "You", phone: "+91 99999 00000" }
      })
    });
    if (!res.ok) throw new Error((await res.json()).error || "Could not book");
    const data = await res.json();
    if (window.XP) {
      XP.success({
        icon: "🚖",
        title: "Ride confirmed!",
        sub: "Finding the closest driver — tracking now",
        duration: 1300,
        onDone: () => { window.location.href = `/track.html?orderId=${data.orderId}`; }
      });
    } else {
      window.location.href = `/track.html?orderId=${data.orderId}`;
    }
  } catch (e) {
    toast(e.message);
    els.book.disabled = false;
    renderVehicles();
  }
});

initMap();
