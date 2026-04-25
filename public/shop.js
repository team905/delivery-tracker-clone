/* Shop (Flipkart-style) — categorized product listing + cart + checkout. */

const $ = (id) => document.getElementById(id);

const state = {
  warehouse: null,
  categories: [],
  products: [],
  activeCat: "all",
  query: "",
  cart: new Map(),
  map: null,
  marker: null,
  location: null
};

const els = {
  cats: $("shopCats"),
  grid: $("shopGrid"),
  search: $("shopSearch"),
  cartBar: $("shopCartBar"),
  cartMeta: $("shopCartMeta"),
  cartTotal: $("shopCartTotal"),
  checkoutBtn: $("shopCheckoutBtn"),
  modal: $("shopModal"),
  map: $("shopMap"),
  useLoc: $("shopUseLoc"),
  locLabel: $("shopLocLabel"),
  name: $("shopName"),
  addr: $("shopAddr"),
  phone: $("shopPhone"),
  instr: $("shopInstr"),
  summary: $("shopSummary"),
  pay: $("shopPay"),
  cancel: $("shopCancel"),
  toast: $("toast")
};

function toast(msg, ms = 2200) {
  els.toast.textContent = msg;
  els.toast.classList.add("is-on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove("is-on"), ms);
}

async function load() {
  const res = await fetch("/api/shop");
  const data = await res.json();
  state.warehouse = data.warehouse;
  state.categories = data.categories;
  state.products = data.products;
  renderCats();
  renderGrid();
}

function renderCats() {
  const all = [{ id: "all", name: "All", emoji: "🌟" }, ...state.categories];
  els.cats.innerHTML = all
    .map(
      (c) => `
      <button type="button" class="shop-cat${state.activeCat === c.id ? " shop-cat--on" : ""}" data-cat="${c.id}">
        <span class="shop-cat__emoji" aria-hidden="true">${c.emoji}</span>
        <span>${c.name}</span>
      </button>`
    )
    .join("");
}

function filtered() {
  let list = state.products;
  if (state.activeCat !== "all") list = list.filter((p) => p.cat === state.activeCat);
  if (state.query.trim()) {
    const q = state.query.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q));
  }
  return list;
}

function renderGrid() {
  const list = filtered();
  if (!list.length) {
    els.grid.innerHTML = `<p style="grid-column:1/-1;padding:32px;text-align:center;color:#888">No products match</p>`;
    return;
  }
  els.grid.innerHTML = list.map(renderCard).join("");
}

function renderCard(p) {
  const qty = state.cart.get(p.id)?.qty || 0;
  const off = p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
  return `
    <article class="shop-card" data-id="${p.id}">
      <div class="shop-card__img"><img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'" /></div>
      <h3 class="shop-card__name">${p.name}</h3>
      <div class="shop-card__rating">
        <span class="shop-rate-pill">${p.rating.toFixed(1)} ★</span>
        <span>(${(p.reviews / 1000).toFixed(1)}k)</span>
      </div>
      <div style="font-size:11px;color:#878787;margin-bottom:2px">${p.unit}</div>
      <div class="shop-card__price-row">
        <span class="shop-card__price">₹${p.price.toLocaleString()}</span>
        ${p.mrp && p.mrp > p.price ? `<span class="shop-card__mrp">₹${p.mrp.toLocaleString()}</span><span class="shop-card__off">${off}% off</span>` : ""}
      </div>
      <button type="button" class="shop-card__cta${qty ? " is-added" : ""}" data-add="${p.id}">
        ${qty ? `✓ Added (${qty})` : "Add to cart"}
      </button>
    </article>`;
}

function updateCartBar() {
  let n = 0,
    t = 0;
  state.cart.forEach((it) => {
    n += it.qty;
    t += it.qty * it.price;
  });
  els.cartMeta.textContent = `${n} item${n > 1 ? "s" : ""}`;
  els.cartTotal.textContent = `₹${t.toLocaleString()}`;
  els.cartBar.classList.toggle("is-on", n > 0);
}

els.cats.addEventListener("click", (e) => {
  const b = e.target.closest(".shop-cat");
  if (!b) return;
  state.activeCat = b.dataset.cat;
  renderCats();
  renderGrid();
});

els.grid.addEventListener("click", (e) => {
  const b = e.target.closest("[data-add]");
  if (!b) return;
  const id = b.dataset.add;
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  const cur = state.cart.get(id) || { id: p.id, name: p.name, price: p.price, qty: 0 };
  if (cur.qty < 5) cur.qty += 1;
  else {
    cur.qty = 0;
    state.cart.delete(id);
  }
  if (cur.qty) state.cart.set(id, cur);
  renderGrid();
  updateCartBar();
});

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  renderGrid();
});

/* checkout */
els.checkoutBtn.addEventListener("click", () => {
  if (state.cart.size === 0) return toast("Your cart is empty");
  renderSummary();
  els.modal.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(initMap, 60);
});
els.cancel.addEventListener("click", () => {
  els.modal.setAttribute("hidden", "");
  document.body.style.overflow = "";
});

function renderSummary() {
  let items = 0,
    amt = 0;
  state.cart.forEach((i) => {
    items += i.qty;
    amt += i.qty * i.price;
  });
  const fee = amt > 500 ? 0 : 40;
  const total = amt + fee;
  els.summary.innerHTML = `
    <div class="svc-checkout__row"><span>${items} item${items > 1 ? "s" : ""}</span><span>₹${amt.toLocaleString()}</span></div>
    <div class="svc-checkout__row"><span>Delivery</span><span>${fee ? "₹" + fee : "FREE"}</span></div>
    <div class="svc-checkout__row" style="border-top:1px dashed #e6e6df;padding-top:6px;margin-top:6px"><strong>Total</strong><strong>₹${total.toLocaleString()}</strong></div>`;
  els.pay.textContent = `Pay ₹${total.toLocaleString()} · place order`;
}

function initMap() {
  if (state.map) {
    setTimeout(() => state.map.invalidateSize(), 50);
    return;
  }
  const base = [19.1055, 72.8697];
  const map = L.map(els.map, { zoomControl: false, attributionControl: false }).setView(base, 14);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
  const marker = L.marker(base, { draggable: true }).addTo(map);
  const onMove = (latlng) => {
    state.location = { lat: latlng.lat, lng: latlng.lng };
    els.locLabel.textContent = `Pinned · ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
  };
  marker.on("dragend", () => onMove(marker.getLatLng()));
  map.on("click", (e) => {
    marker.setLatLng(e.latlng);
    onMove(e.latlng);
  });
  state.map = map;
  state.marker = marker;
  onMove(marker.getLatLng());
}

els.useLoc.addEventListener("click", () => {
  if (!navigator.geolocation) return toast("Geolocation not supported");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      state.map?.setView(ll, 16);
      state.marker?.setLatLng(ll);
      state.location = { lat: ll[0], lng: ll[1] };
      els.locLabel.textContent = `Current · ${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}`;
    },
    () => toast("Could not get location"),
    { enableHighAccuracy: true, timeout: 6000 }
  );
});

els.pay.addEventListener("click", async () => {
  if (!state.location) return toast("Pin a shipping location");
  if (!els.name.value.trim()) return toast("Enter your name");
  if (!els.addr.value.trim()) return toast("Enter your address");
  els.pay.disabled = true;
  els.pay.textContent = "Placing order…";
  try {
    const res = await fetch("/api/shop/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: Array.from(state.cart.values()).map((i) => ({ id: i.id, qty: i.qty })),
        customer: {
          name: els.name.value.trim(),
          phone: els.phone.value.trim() || "+91 99999 00000",
          address: els.addr.value.trim(),
          lat: state.location.lat,
          lng: state.location.lng
        },
        deliveryInstructions: els.instr.value.trim()
      })
    });
    if (!res.ok) throw new Error((await res.json()).error || "Could not order");
    const data = await res.json();
    if (window.XP) {
      XP.success({
        icon: "🛍",
        title: "Order placed!",
        sub: "We're packing it for you — tracking now",
        duration: 1300,
        onDone: () => { window.location.href = `/track.html?orderId=${data.orderId}`; }
      });
    } else {
      window.location.href = `/track.html?orderId=${data.orderId}`;
    }
  } catch (e) {
    toast(e.message);
    els.pay.disabled = false;
    renderSummary();
  }
});

updateCartBar();
load();
