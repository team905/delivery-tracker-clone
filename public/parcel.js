/* Parcel (Porter-style) — sender+receiver details, package type, vehicle, book. */

const $ = (id) => document.getElementById(id);
const DEFAULT_CENTER = [19.1197, 72.9056];

const state = {
  map: null,
  pickupMarker: null,
  dropMarker: null,
  routeLine: null,
  modalMap: null,
  modalMarker: null,
  modalMode: null,
  pickup: null,
  drop: null,
  vehicles: [],
  packageTypes: [],
  packageType: null,
  chosen: null
};

const els = {
  pickupText: $("pickupText"),
  pickupWho: $("pickupWho"),
  dropText: $("dropText"),
  dropWho: $("dropWho"),
  map: $("parcelMap"),
  pkgChips: $("pkgChips"),
  pkgNote: $("pkgNote"),
  vehicles: $("parcelVehicles"),
  book: $("parcelBook"),
  toast: $("toast"),
  modal: $("parcelModal"),
  modalTitle: $("modalTitle"),
  mName: $("mName"),
  mPhone: $("mPhone"),
  mAddr: $("mAddr"),
  mSave: $("mSave"),
  mCancel: $("mCancel"),
  mUseLoc: $("mUseLoc"),
  mGeoLabel: $("mGeoLabel")
};

function toast(msg, ms = 2200) {
  els.toast.textContent = msg;
  els.toast.classList.add("is-on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove("is-on"), ms);
}

async function loadVehicles() {
  const res = await fetch("/api/parcel/vehicles");
  const data = await res.json();
  state.vehicles = data.vehicles || [];
  state.packageTypes = data.packageTypes || [];
  renderPkgChips();
  renderVehicles();
}

function renderPkgChips() {
  els.pkgChips.innerHTML = state.packageTypes
    .map(
      (p) =>
        `<button type="button" class="parcel-pkg-chip${state.packageType === p.id ? " parcel-pkg-chip--on" : ""}" data-pkg="${p.id}">${p.emoji} ${p.name}</button>`
    )
    .join("");
}

els.pkgChips.addEventListener("click", (e) => {
  const b = e.target.closest(".parcel-pkg-chip");
  if (!b) return;
  state.packageType = b.dataset.pkg;
  renderPkgChips();
});

function renderVehicles() {
  els.vehicles.innerHTML = state.vehicles
    .map(
      (v) => `
      <button type="button" class="parcel-vehicle${state.chosen === v.id ? " parcel-vehicle--on" : ""}" data-id="${v.id}">
        <div class="parcel-vehicle__head">
          <span class="parcel-vehicle__emoji">${v.emoji}</span>
          <span class="parcel-vehicle__title">${v.name}</span>
        </div>
        <div class="parcel-vehicle__payload">${v.payload}</div>
        <div class="parcel-vehicle__fare" id="fare-${v.id}">${vehicleFarePreview(v)}</div>
      </button>`
    )
    .join("");
  updateBookBtn();
}

function vehicleFarePreview(v) {
  if (state.pickup && state.drop) return "calculating…";
  return `starts ₹${v.baseFare}`;
}

async function refreshEstimates() {
  if (!state.pickup || !state.drop) return;
  const res = await fetch("/api/parcel/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pickup: state.pickup, drop: state.drop })
  });
  if (!res.ok) return;
  const data = await res.json();
  (data.estimates || []).forEach((v) => {
    const el = $(`fare-${v.id}`);
    if (el) el.textContent = `₹${v.fare.total} · ${v.fare.km} km · ~${v.etaMinutes} min`;
  });
  state.vehicles = data.estimates;
}

els.vehicles.addEventListener("click", (e) => {
  const b = e.target.closest(".parcel-vehicle");
  if (!b) return;
  state.chosen = b.dataset.id;
  renderVehicles();
});

function updateBookBtn() {
  const ready = state.pickup && state.drop && state.chosen;
  els.book.disabled = !ready;
  if (!state.pickup || !state.drop) els.book.textContent = "Set pickup & drop to continue";
  else if (!state.chosen) els.book.textContent = "Pick a vehicle";
  else {
    const v = state.vehicles.find((x) => x.id === state.chosen);
    const fare = v?.fare?.total;
    els.book.textContent = fare ? `Book parcel · ₹${fare}` : `Book ${v?.name || "parcel"}`;
  }
}

/* ---------- map on main page ---------- */
function initMap() {
  const map = L.map(els.map, { zoomControl: false, attributionControl: false }).setView(
    DEFAULT_CENTER,
    12
  );
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);
  state.map = map;
  setTimeout(() => map.invalidateSize(), 80);
}

function pinIcon(color, label) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:24px;height:24px;border-radius:50%;background:${color};
      border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;color:#fff;
      font-weight:800;font-size:10px">${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function updateMainMap() {
  if (!state.map) return;
  if (state.pickup) {
    const ll = [state.pickup.lat, state.pickup.lng];
    if (state.pickupMarker) state.pickupMarker.setLatLng(ll);
    else state.pickupMarker = L.marker(ll, { icon: pinIcon("#ff6a00", "A") }).addTo(state.map);
  }
  if (state.drop) {
    const ll = [state.drop.lat, state.drop.lng];
    if (state.dropMarker) state.dropMarker.setLatLng(ll);
    else state.dropMarker = L.marker(ll, { icon: pinIcon("#e23744", "B") }).addTo(state.map);
  }
  if (state.routeLine) state.routeLine.remove();
  if (state.pickup && state.drop) {
    state.routeLine = L.polyline(
      [
        [state.pickup.lat, state.pickup.lng],
        [state.drop.lat, state.drop.lng]
      ],
      { color: "#ff6a00", weight: 4, dashArray: "6 8" }
    ).addTo(state.map);
    state.map.fitBounds(state.routeLine.getBounds(), { padding: [20, 20] });
  } else if (state.pickup) {
    state.map.setView([state.pickup.lat, state.pickup.lng], 14);
  } else if (state.drop) {
    state.map.setView([state.drop.lat, state.drop.lng], 14);
  }
}

/* ---------- modal ---------- */
function openEditor(mode) {
  state.modalMode = mode;
  els.modalTitle.textContent = mode === "pickup" ? "Sender details" : "Receiver details";
  const existing = mode === "pickup" ? state.pickup : state.drop;
  els.mName.value = existing?.name || "";
  els.mPhone.value = existing?.phone || "";
  els.mAddr.value = existing?.address || "";
  els.mGeoLabel.textContent = existing
    ? `Pinned · ${existing.lat.toFixed(4)}, ${existing.lng.toFixed(4)}`
    : "Tap the map to pin or use current location";
  els.modal.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => initModalMap(existing), 60);
}

function closeEditor() {
  els.modal.setAttribute("hidden", "");
  document.body.style.overflow = "";
  state.modalMode = null;
}

function initModalMap(existing) {
  const container = $("parcelModal").querySelector(".parcel-modal__card");
  let mapHolder = container.querySelector(".p-modal-map");
  if (!mapHolder) {
    mapHolder = document.createElement("div");
    mapHolder.className = "p-modal-map";
    mapHolder.style.cssText = "height:180px;border-radius:10px;overflow:hidden;margin-bottom:10px";
    container.insertBefore(mapHolder, container.querySelector(".svc-row--geo") || container.children[4]);
  }
  if (state.modalMap) {
    state.modalMap.remove();
    state.modalMap = null;
  }
  const center = existing ? [existing.lat, existing.lng] : DEFAULT_CENTER;
  const map = L.map(mapHolder, { zoomControl: false, attributionControl: false }).setView(center, 14);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
  const marker = L.marker(center, { draggable: true, icon: pinIcon(state.modalMode === "pickup" ? "#ff6a00" : "#e23744", state.modalMode === "pickup" ? "A" : "B") }).addTo(map);
  marker.on("dragend", () => updateModalGeo(marker.getLatLng()));
  map.on("click", (e) => {
    marker.setLatLng(e.latlng);
    updateModalGeo(e.latlng);
  });
  state.modalMap = map;
  state.modalMarker = marker;
  setTimeout(() => map.invalidateSize(), 80);
}

function updateModalGeo(latlng) {
  els.mGeoLabel.textContent = `Pinned · ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
  state.modalMarker._lastLL = latlng;
}

els.mUseLoc.addEventListener("click", () => {
  if (!navigator.geolocation) return toast("Geolocation not supported");
  navigator.geolocation.getCurrentPosition(
    (p) => {
      const ll = L.latLng(p.coords.latitude, p.coords.longitude);
      state.modalMap?.setView(ll, 16);
      state.modalMarker?.setLatLng(ll);
      updateModalGeo(ll);
    },
    () => toast("Could not get location"),
    { enableHighAccuracy: true, timeout: 6000 }
  );
});

els.mCancel.addEventListener("click", closeEditor);
els.mSave.addEventListener("click", () => {
  if (!state.modalMarker) return toast("Please pin a location");
  const ll = state.modalMarker._lastLL || state.modalMarker.getLatLng();
  const name = els.mName.value.trim();
  const phone = els.mPhone.value.trim();
  const address = els.mAddr.value.trim();
  if (!name) return toast("Enter a name");
  if (!phone) return toast("Enter a phone number");
  if (!address) return toast("Enter an address");

  const stop = { lat: ll.lat, lng: ll.lng, name, phone, address };
  if (state.modalMode === "pickup") {
    state.pickup = stop;
    els.pickupText.textContent = address;
    els.pickupWho.textContent = `${name} · ${phone}`;
  } else {
    state.drop = stop;
    els.dropText.textContent = address;
    els.dropWho.textContent = `${name} · ${phone}`;
  }
  closeEditor();
  updateMainMap();
  refreshEstimates();
  updateBookBtn();
});

document.querySelectorAll("[data-edit]").forEach((b) => {
  b.addEventListener("click", () => openEditor(b.dataset.edit));
});

["pickupStop", "dropStop"].forEach((id) => {
  document.getElementById(id).addEventListener("click", (e) => {
    if (e.target.closest(".parcel-stop__btn")) return;
    openEditor(id === "pickupStop" ? "pickup" : "drop");
  });
});

els.book.addEventListener("click", async () => {
  if (!state.pickup || !state.drop || !state.chosen) return;
  const type = state.packageTypes.find((t) => t.id === state.packageType);
  els.book.disabled = true;
  els.book.textContent = "Booking…";
  try {
    const res = await fetch("/api/parcel/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup: { lat: state.pickup.lat, lng: state.pickup.lng, address: state.pickup.address },
        drop: { lat: state.drop.lat, lng: state.drop.lng, address: state.drop.address },
        sender: { name: state.pickup.name, phone: state.pickup.phone },
        receiver: { name: state.drop.name, phone: state.drop.phone },
        vehicleType: state.chosen,
        packageInfo: {
          typeId: state.packageType || "other",
          typeLabel: type?.name || "Other",
          note: els.pkgNote.value.trim()
        },
        deliveryInstructions: els.pkgNote.value.trim()
      })
    });
    if (!res.ok) throw new Error((await res.json()).error || "Could not book");
    const data = await res.json();
    window.location.href = `/track.html?orderId=${data.orderId}`;
  } catch (e) {
    toast(e.message);
    updateBookBtn();
  }
});

initMap();
loadVehicles();
