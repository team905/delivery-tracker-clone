/* Grocery (Blinkit-style) frontend. */

const $ = (id) => document.getElementById(id);

const state = {
  store: null,
  categories: [],
  products: [],
  query: "",
  activeCat: "all",
  cart: new Map(),
  location: null,
  map: null,
  marker: null
};

const els = {
  storeName: $("storeName"),
  storeSub: $("storeSub"),
  etaPill: $("etaPill"),
  cats: $("grocCats"),
  grid: $("grocGrid"),
  search: $("grocSearch"),
  cartBar: $("cartBar"),
  cartItems: $("cartItems"),
  cartTotal: $("cartTotal"),
  checkoutBtn: $("cartCheckoutBtn"),
  modal: $("checkoutModal"),
  map: $("grocMap"),
  useLoc: $("grocUseLoc"),
  locLabel: $("grocLocLabel"),
  name: $("grocName"),
  addr: $("grocAddr"),
  phone: $("grocPhone"),
  instr: $("grocInstr"),
  summary: $("grocSummary"),
  pay: $("grocPay"),
  cancel: $("grocCancel"),
  toast: $("toast")
};

function toast(msg, ms = 2200) {
  els.toast.textContent = msg;
  els.toast.classList.add("is-on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove("is-on"), ms);
}

function showGridSkeleton() {
  if (!els.grid || !window.XP) return;
  els.grid.innerHTML = XP.skeletonCards(8, "product");
}

async function load() {
  showGridSkeleton();
  const res = await fetch("/api/grocery/stores");
  const data = await res.json();
  const store = data.stores?.[0];
  if (!store) return toast("No stores available");
  const detail = await (await fetch(`/api/grocery/stores/${store.id}`)).json();
  state.store = detail.store;
  state.categories = detail.categories;
  state.products = detail.products;
  renderStore();
  renderCats();
  renderGrid();
}

function renderStore() {
  els.storeName.textContent = state.store.name;
  els.storeSub.textContent = state.store.tagline;
  els.etaPill.textContent = `🏃 ${state.store.deliveryMinutes} min`;
}

function renderCats() {
  const all = [{ id: "all", name: "All", emoji: "✨" }, ...state.categories];
  els.cats.innerHTML = all
    .map(
      (c) =>
        `<button type="button" class="groc-cat${state.activeCat === c.id ? " groc-cat--on" : ""}" data-cat="${c.id}">
          <span class="groc-cat__emoji" aria-hidden="true">${c.emoji}</span>
          <span>${c.name}</span>
        </button>`
    )
    .join("");
}

function filteredProducts() {
  let list = state.products;
  if (state.activeCat !== "all") list = list.filter((p) => p.cat === state.activeCat);
  if (state.query.trim()) {
    const q = state.query.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q));
  }
  return list;
}

function renderGrid() {
  const list = filteredProducts();
  if (!list.length) {
    els.grid.innerHTML = `<p style="grid-column:1/-1;padding:24px;text-align:center;color:#888">No items found</p>`;
    return;
  }
  els.grid.innerHTML = list.map(renderCard).join("");
}

function renderCard(p) {
  const qty = state.cart.get(p.id)?.qty || 0;
  const off = p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
  return `
    <article class="groc-card" data-id="${p.id}">
      ${off ? `<span class="groc-save">${off}% OFF</span>` : ""}
      <div class="groc-card__img"><img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'" /></div>
      <div class="groc-card__unit">${p.unit}</div>
      <h3 class="groc-card__name">${p.name}</h3>
      <div class="groc-card__foot">
        <div>
          <span class="groc-card__price">₹${p.price}</span>
          ${p.mrp && p.mrp > p.price ? `<span class="groc-card__mrp">₹${p.mrp}</span>` : ""}
        </div>
        ${
          qty
            ? `<div class="groc-qty"><button type="button" data-act="dec" data-id="${p.id}">−</button><span class="groc-qty__n">${qty}</span><button type="button" data-act="inc" data-id="${p.id}">+</button></div>`
            : `<button type="button" class="groc-add" data-act="add" data-id="${p.id}">ADD</button>`
        }
      </div>
    </article>`;
}

function updateCartBar() {
  const totals = Array.from(state.cart.values()).reduce(
    (acc, it) => {
      acc.n += it.qty;
      acc.amt += it.qty * it.price;
      return acc;
    },
    { n: 0, amt: 0 }
  );
  els.cartItems.textContent = `${totals.n} item${totals.n > 1 ? "s" : ""}`;
  els.cartTotal.textContent = totals.amt;
  els.cartBar.classList.toggle("is-on", totals.n > 0);
}

function addToCart(id, delta = 1, originBtn) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  const cur = state.cart.get(id) || { id, name: p.name, price: p.price, unit: p.unit, qty: 0 };
  const before = cur.qty;
  cur.qty = Math.max(0, Math.min(20, cur.qty + delta));
  if (cur.qty === 0) state.cart.delete(id);
  else state.cart.set(id, cur);

  if (window.XP && delta > 0 && cur.qty > before && originBtn) {
    XP.flyToCart(originBtn, els.cartBar, { color: "radial-gradient(circle at 30% 30%,#fff,#0c831f 65%)" });
    originBtn.classList.add("xp-just-added");
    setTimeout(() => originBtn.classList.remove("xp-just-added"), 400);
    if (delta > 0 && before === 0) {
      XP.toast(`${p.name} added`, { kind: "success", emoji: "🥬", duration: 1300 });
    }
  }

  renderGrid();
  updateCartBar();
}

els.cats.addEventListener("click", (e) => {
  const btn = e.target.closest(".groc-cat");
  if (!btn) return;
  state.activeCat = btn.dataset.cat;
  renderCats();
  renderGrid();
});

els.grid.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const id = b.dataset.id;
  const act = b.dataset.act;
  if (act === "add" || act === "inc") addToCart(id, 1, b);
  else if (act === "dec") addToCart(id, -1);
});

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  renderGrid();
});

/* ---------- checkout ---------- */
els.checkoutBtn.addEventListener("click", openCheckout);
els.cancel.addEventListener("click", closeCheckout);

function openCheckout() {
  if (state.cart.size === 0) return toast("Your cart is empty");
  renderSummary();
  els.modal.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(initMap, 60);
}
function closeCheckout() {
  els.modal.setAttribute("hidden", "");
  document.body.style.overflow = "";
}

function renderSummary() {
  let items = 0,
    amt = 0;
  state.cart.forEach((i) => {
    items += i.qty;
    amt += i.qty * i.price;
  });
  const fee = amt >= 299 ? 0 : 25;
  const handling = 10;
  const total = amt + fee + handling;
  els.summary.innerHTML = `
    <div class="svc-checkout__row"><span>${items} item${items > 1 ? "s" : ""}</span><span>₹${amt}</span></div>
    <div class="svc-checkout__row"><span>Delivery fee</span><span>${fee === 0 ? "FREE" : "₹" + fee}</span></div>
    <div class="svc-checkout__row"><span>Handling & GST</span><span>₹${handling}</span></div>
    <div class="svc-checkout__row" style="border-top:1px dashed #e6e6df;padding-top:6px;margin-top:6px"><strong>Total to pay</strong><strong>₹${total}</strong></div>`;
  els.pay.textContent = `Pay ₹${total} · place order`;
}

function initMap() {
  if (state.map) {
    setTimeout(() => state.map.invalidateSize(), 50);
    return;
  }
  const base = state.store
    ? [state.store.lat, state.store.lng]
    : [19.119, 72.905];
  const map = L.map(els.map, { zoomControl: false, attributionControl: false }).setView(base, 15);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);
  const marker = L.marker(base, { draggable: true }).addTo(map);
  marker.on("dragend", () => {
    const ll = marker.getLatLng();
    state.location = { lat: ll.lat, lng: ll.lng };
    els.locLabel.textContent = `Pinned · ${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`;
  });
  map.on("click", (e) => {
    marker.setLatLng(e.latlng);
    state.location = { lat: e.latlng.lat, lng: e.latlng.lng };
    els.locLabel.textContent = `Pinned · ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
  });
  state.map = map;
  state.marker = marker;
  state.location = { lat: base[0], lng: base[1] };
  els.locLabel.textContent = `Pinned · ${base[0].toFixed(4)}, ${base[1].toFixed(4)}`;
}

els.useLoc.addEventListener("click", () => {
  if (!navigator.geolocation) return toast("Geolocation not supported");
  els.locLabel.textContent = "Locating…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      state.location = { lat: latitude, lng: longitude };
      if (state.map) {
        state.map.setView([latitude, longitude], 16);
        state.marker.setLatLng([latitude, longitude]);
      }
      els.locLabel.textContent = `Current · ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    },
    () => toast("Could not get location"),
    { enableHighAccuracy: true, timeout: 6000 }
  );
});

els.pay.addEventListener("click", async () => {
  if (!state.location) return toast("Pin your delivery location");
  if (!els.name.value.trim()) return toast("Please enter your name");
  if (!els.addr.value.trim()) return toast("Please enter your address");

  els.pay.disabled = true;
  els.pay.textContent = "Placing order…";
  try {
    const body = {
      storeId: state.store.id,
      items: Array.from(state.cart.values()).map((i) => ({ id: i.id, qty: i.qty })),
      customer: {
        name: els.name.value.trim(),
        phone: els.phone.value.trim() || "+91 99999 00000",
        address: els.addr.value.trim(),
        lat: state.location.lat,
        lng: state.location.lng
      },
      deliveryInstructions: els.instr.value.trim()
    };
    const r = await fetch("/api/grocery/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error((await r.json()).error || "Failed");
    const data = await r.json();
    if (window.XP) {
      XP.success({
        icon: "⚡",
        title: "Order placed!",
        sub: "We'll deliver in minutes — tracking now",
        duration: 1400,
        onDone: () => { window.location.href = `/track.html?orderId=${data.orderId}`; }
      });
    } else {
      window.location.href = `/track.html?orderId=${data.orderId}`;
    }
  } catch (e) {
    toast("Could not place order: " + e.message);
    if (window.XP) XP.toast("Could not place order", { kind: "error", emoji: "⚠️" });
    els.pay.disabled = false;
    renderSummary();
  }
});

updateCartBar();
load();
