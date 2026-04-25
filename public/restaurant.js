const params = new URLSearchParams(window.location.search);
const restaurantId = params.get("id");

const heroImage = document.getElementById("heroImage");
const heroName = document.getElementById("heroName");
const heroCuisine = document.getElementById("heroCuisine");
const heroRating = document.getElementById("heroRating");
const heroTime = document.getElementById("heroTime");
const restoTopbarTitle = document.getElementById("restoTopbarTitle");
const menuList = document.getElementById("menuList");
const menuSearch = document.getElementById("menuSearch");
const cartItems = document.getElementById("cartItems");
const billSection = document.getElementById("billSection");
const billSub = document.getElementById("billSub");
const billTax = document.getElementById("billTax");
const billTotal = document.getElementById("billTotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const checkoutModal = document.getElementById("checkoutModal");
const orderMsg = document.getElementById("orderMsg");

const state = {
  restaurant: null,
  cart: [],
  customerLatLng: { lat: 19.0634, lng: 72.8568 }
};

const descriptions = [
  "A house favourite, deeply spiced and slow-cooked.",
  "Creamy, buttery, and rich — best with fresh bread.",
  "Soft and warm, baked in the tandoor.",
  "Fresh, smoky and tender — topped with chutney.",
  "Hot bowl, rich broth and chewy noodles.",
  "Crispy outside, juicy inside — served with rice.",
  "Hand-rolled with fresh fish and seasoned rice.",
  "Lightly salted — a perfect starter.",
  "Classic wood-fired base, rich tomato and basil.",
  "Loaded with spicy pepperoni and mozzarella.",
  "Fresh from the oven, herb-infused.",
  "Rich, creamy Italian dessert layered in coffee."
];

function showMenuSkeleton() {
  if (!menuList || !window.XP) return;
  menuList.innerHTML = `<div style="display:grid;gap:14px;padding:8px 0">${XP.skeletonCards(4, "menu")}</div>`;
}

async function loadRestaurant() {
  showMenuSkeleton();
  const res = await fetch("/api/restaurants");
  const data = await res.json();
  const restaurant = data.restaurants.find((r) => r.id === restaurantId);
  if (!restaurant) {
    document.querySelector(".z-resto-hero").innerHTML =
      "<p class='z-empty' style='padding:40px 20px'>Restaurant not found.</p>";
    return;
  }
  state.restaurant = restaurant;
  renderHero();
  renderMenu();
  document.title = `${restaurant.name} · zomato`;
  /* Trigger the slow parallax zoom on the hero */
  requestAnimationFrame(() => document.body.classList.add("loaded"));
}

function renderHero() {
  const r = state.restaurant;
  heroImage.src = r.image;
  heroImage.alt = r.name;
  heroName.textContent = r.name;
  if (restoTopbarTitle) restoTopbarTitle.textContent = r.name;
  heroCuisine.textContent = r.cuisine;
  heroRating.textContent = r.rating.toFixed(1);
  heroTime.textContent = r.deliveryMinutes;
}

let menuQuery = "";
function getFilteredMenu() {
  if (!state.restaurant) return [];
  const q = menuQuery.trim().toLowerCase();
  if (!q) return state.restaurant.menu;
  return state.restaurant.menu.filter((m) => m.name.toLowerCase().includes(q));
}

function renderMenu() {
  if (!state.restaurant) return;
  const list = getFilteredMenu();
  if (!list.length) {
    menuList.innerHTML = `<div class="z-dish z-dish--empty">No dishes match your search</div>`;
    return;
  }
  menuList.innerHTML = list
    .map((m) => {
        const idx = state.restaurant.menu.indexOf(m);
        const d = descriptions[idx % descriptions.length];
        const isNv = /chicken|mutton|fish|salmon|pork|beef|pepperoni|egg/i.test(m.name);
        const vegMark = isNv
          ? '<div class="z-dish__veg z-dish__veg--nv" title="Non-veg">◉</div>'
          : '<div class="z-dish__veg" title="Veg">◎</div>';
        return `
        <div class="z-dish" data-id="${m.id}">
          <div class="z-dish__text">
            ${vegMark}
            <h4 class="z-dish__name">${m.name}</h4>
            <p class="z-dish__price">₹${m.price}</p>
            <p class="z-dish__desc">${d}</p>
          </div>
          <div class="z-dish__action" id="action-${m.id}"></div>
        </div>`;
    })
    .join("");
  refreshMenuActions();
}

if (menuSearch) {
  menuSearch.addEventListener("input", () => {
    menuQuery = menuSearch.value;
    renderMenu();
  });
}

function refreshMenuActions() {
  if (!state.restaurant) return;
  getFilteredMenu().forEach((m) => {
    const el = document.getElementById(`action-${m.id}`);
    if (!el) return;
    const item = state.cart.find((c) => c.id === m.id);
    if (!item) {
      el.innerHTML = `<button class="z-add" type="button" data-add="${m.id}">ADD</button>`;
    } else {
      el.innerHTML = `
        <div class="z-qty">
          <button type="button" data-qty="${m.id}" data-delta="-1" aria-label="Decrease">−</button>
          <span>${item.qty}</span>
          <button type="button" data-qty="${m.id}" data-delta="1" aria-label="Increase">+</button>
        </div>`;
    }
  });

  menuList.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", (e) => addToCart(btn.dataset.add, e.currentTarget));
  });
  menuList.querySelectorAll("[data-qty]").forEach((btn) => {
    btn.addEventListener("click", () => changeQty(btn.dataset.qty, Number(btn.dataset.delta)));
  });
}

function addToCart(itemId, originBtn) {
  const item = state.restaurant.menu.find((m) => m.id === itemId);
  if (!item) return;
  const existing = state.cart.find((c) => c.id === itemId);
  if (existing) existing.qty += 1;
  else state.cart.push({ ...item, qty: 1 });

  if (window.XP && originBtn) {
    XP.flyToCart(originBtn, document.getElementById("xpCartDock") || document.querySelector(".z-cart"));
    XP.toast(`${item.name} added`, { kind: "success", emoji: "🛒", duration: 1500 });
    /* pop-class animation on the action cell */
    const cell = document.getElementById(`action-${itemId}`);
    if (cell) {
      cell.classList.remove("xp-just-added");
      void cell.offsetWidth;
      cell.classList.add("xp-just-added");
    }
  }

  renderCart();
  refreshMenuActions();
}

function changeQty(itemId, delta) {
  const item = state.cart.find((c) => c.id === itemId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) state.cart = state.cart.filter((c) => c.id !== itemId);
  renderCart();
  refreshMenuActions();
}

function renderCart() {
  document.body.classList.toggle("app-resto--has-cart", state.cart.length > 0);
  syncStickyCartDock();
  if (!state.cart.length) {
    cartItems.className = "cart-empty z-cart__items";
    cartItems.textContent = "Add items to start an order";
    billSection.hidden = true;
    return;
  }
  cartItems.className = "z-cart__items";
  cartItems.innerHTML = state.cart
    .map(
      (c) => `
        <div class="cart-item z-cart-item">
          <div class="cart-item-info">
            <strong>${c.name}</strong>
            <span>₹${c.price} × ${c.qty}</span>
          </div>
          <div class="z-qty z-qty--sm">
            <button type="button" data-cart="${c.id}" data-delta="-1">−</button>
            <span>${c.qty}</span>
            <button type="button" data-cart="${c.id}" data-delta="1">+</button>
          </div>
        </div>
      `
    )
    .join("");

  cartItems.querySelectorAll("[data-cart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      changeQty(btn.dataset.cart, Number(btn.dataset.delta));
    });
  });

  const subtotal = state.cart.reduce((s, c) => s + c.price * c.qty, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + 29 + tax;
  billSub.textContent = `₹${subtotal}`;
  billTax.textContent = `₹${tax}`;
  billTotal.textContent = `₹${total}`;
  billSection.hidden = false;

  if (checkoutBtn) {
    const n = state.cart.reduce((s, c) => s + c.qty, 0);
    checkoutBtn.textContent = `Pay ₹${total}  ·  ${n} ${n === 1 ? "item" : "items"}`;
  }
}

/* Sync the sticky bottom dock with current cart state. */
function syncStickyCartDock() {
  const dock = document.getElementById("xpCartDock");
  if (!dock) return;
  const n = state.cart.reduce((s, c) => s + c.qty, 0);
  if (!n) {
    dock.classList.remove("is-on");
    return;
  }
  const subtotal = state.cart.reduce((s, c) => s + c.price * c.qty, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + 29 + tax;
  document.getElementById("xpCartCount").textContent = `${n} ${n === 1 ? "item" : "items"} added`;
  document.getElementById("xpCartTotal").textContent = `View cart · ₹${total}`;
  dock.classList.add("is-on");
}

document.getElementById("xpCartGo")?.addEventListener("click", () => {
  if (!state.cart.length) return;
  openCheckout();
});

/* === Checkout === */
let addressMap;
let addressMarker;

function initAddressMap() {
  if (addressMap) return;
  addressMap = L.map("addressMap", { zoomControl: false }).setView(
    [state.customerLatLng.lat, state.customerLatLng.lng],
    14
  );
  L.tileLayer("https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    subdomains: "abcd"
  }).addTo(addressMap);

  const pinIcon = L.divIcon({
    className: "",
    html: '<div class="location-pin-inline"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
  addressMarker = L.marker(
    [state.customerLatLng.lat, state.customerLatLng.lng],
    { icon: pinIcon, draggable: true }
  ).addTo(addressMap);

  addressMarker.on("dragend", (e) => {
    const ll = e.target.getLatLng();
    state.customerLatLng = { lat: ll.lat, lng: ll.lng };
  });
  addressMap.on("click", (e) => {
    state.customerLatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
    addressMarker.setLatLng(e.latlng);
  });

  setTimeout(() => addressMap.invalidateSize(), 200);
}

function openCheckout() {
  checkoutModal.classList.add("open");
  checkoutModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("z-modal-on");
  initAddressMap();
  setTimeout(() => addressMap && addressMap.invalidateSize(), 280);
}

function closeCheckout() {
  checkoutModal.classList.remove("open");
  checkoutModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("z-modal-on");
}

checkoutModal.addEventListener("click", (e) => {
  if (e.target === checkoutModal) closeCheckout();
});

if (checkoutBtn) checkoutBtn.addEventListener("click", openCheckout);

document.getElementById("locateBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    orderMsg.textContent = "Location not available in this browser.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      state.customerLatLng = ll;
      addressMarker.setLatLng(ll);
      addressMap.setView(ll, 15);
    },
    () => {
      orderMsg.textContent = "Could not get your location.";
    }
  );
});

document.getElementById("placeOrderBtn").addEventListener("click", async () => {
  if (!state.cart.length) {
    orderMsg.textContent = "Your cart is empty.";
    return;
  }
  orderMsg.textContent = "Placing your order…";
  const name = document.getElementById("customerName").value.trim() || "Guest";
  const phone = document.getElementById("customerPhone").value.trim();
  const address = document.getElementById("customerAddress").value.trim();

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: state.restaurant.id,
        customer: { name, phone, address, ...state.customerLatLng },
        items: state.cart.map((c) => ({
          id: c.id,
          name: c.name,
          price: c.price,
          qty: c.qty
        }))
      })
    });
    if (!res.ok) throw new Error("failed");
    const data = await res.json();
    if (window.XP) {
      XP.success({
        icon: "🎉",
        title: "Order placed!",
        sub: "Hang tight — we're connecting you to a rider",
        duration: 1400,
        onDone: () => { window.location.href = `/track.html?orderId=${data.orderId}`; }
      });
    } else {
      window.location.href = `/track.html?orderId=${data.orderId}`;
    }
  } catch {
    orderMsg.textContent = "Could not place order. Please try again.";
    if (window.XP) XP.toast("Could not place order", { kind: "error", emoji: "⚠️" });
  }
});

/* Share */
document.querySelector(".z-resto-topbar__share")?.addEventListener("click", async () => {
  const url = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: state.restaurant?.name || "Restaurant", url });
    } else {
      await navigator.clipboard.writeText(url);
      if (window.XP) XP.toast("Link copied to clipboard", { kind: "success", emoji: "🔗" });
    }
  } catch {}
});

loadRestaurant();
