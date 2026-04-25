/* Super-app landing — modernized.
 * Loads service registry, renders animated tiles, time-aware greeting,
 * dynamic "Resume" chips (recent orders if signed in), and a soft skeleton
 * while data is loading. No new functions; just polish on what exists.
 */

const grid = document.getElementById("servicesGrid");
const quickRow = document.getElementById("quickRow");
const locPill = document.getElementById("superLocPill");
const locText = document.getElementById("superLocText");

const QUICK_TO_PATH = {
  reorder: "/food.html",
  grocery: "/grocery.html",
  ride: "/cab.html"
};

/* ------------ Skeletons while we wait ------------ */
function showServicesSkeleton() {
  if (!grid || !window.XP) return;
  grid.innerHTML = XP.skeletonCards(6, "tile");
}
showServicesSkeleton();

async function loadServices() {
  try {
    const res = await fetch("/api/services");
    const data = await res.json();
    render(data.services || []);
  } catch (e) {
    grid.innerHTML =
      '<p style="padding:16px;color:#8a8f98">Could not load services. Please refresh.</p>';
  }
}

function render(services) {
  if (!services.length) {
    grid.innerHTML = "";
    return;
  }
  grid.innerHTML = services
    .map(
      (s, i) => `
      <a class="super-tile xp-fade-in" style="--tile-bg:${s.gradient};--tile-color:${s.color};animation-delay:${i * 50}ms" href="${s.entryPath}" data-service="${s.id}" data-xp-tap>
        <span class="super-tile__glow" aria-hidden="true"></span>
        <span class="super-tile__emoji" aria-hidden="true">${s.emoji}</span>
        <span class="super-tile__title">${s.name}</span>
        <span class="super-tile__sub">${s.tagline}</span>
        <span class="super-tile__eta">${s.etaMin}-${s.etaMax} min</span>
        <span class="super-tile__brand">like ${s.brand}</span>
      </a>`
    )
    .join("");
  if (window.XP) XP.attachRipple(".super-tile", grid);
}

/* ------------ Quick / resume row: prefer last orders if signed in ------------ */
async function refreshQuickRow() {
  if (!quickRow) return;
  try {
    const auth = window.Auth;
    if (!auth) return;
    const u = await auth.me();
    if (!u || u.role !== "customer") return;
    const data = await auth.api("/api/customer/orders");
    if (!data || !Array.isArray(data.orders) || data.orders.length === 0) return;
    const recent = data.orders.slice(0, 3);
    const map = {
      food: { emoji: "🍕", path: "/food.html", label: "Reorder" },
      grocery: { emoji: "🛒", path: "/grocery.html", label: "Quick basket" },
      cab: { emoji: "🚖", path: "/cab.html", label: "Book a ride" },
      parcel: { emoji: "📦", path: "/parcel.html", label: "Send parcel" },
      shop: { emoji: "🛍", path: "/shop.html", label: "Shop again" }
    };
    quickRow.innerHTML = recent
      .map((o) => {
        const m = map[o.serviceType] || map.food;
        const sub = o.businessName || o.businessId || "Recent order";
        return `
          <a class="super-quick xp-fade-in" href="${m.path}" data-xp-tap>
            <span class="super-quick__emoji" aria-hidden="true">${m.emoji}</span>
            <span class="super-quick__title">${m.label}</span>
            <span class="super-quick__sub">${sub}</span>
          </a>`;
      })
      .join("");
    if (window.XP) XP.attachRipple(".super-quick", quickRow);
  } catch (e) {
    /* silently keep static placeholders */
  }
}

quickRow?.addEventListener("click", (e) => {
  const btn = e.target.closest(".super-quick");
  if (!btn || btn.tagName === "A") return;
  const path = QUICK_TO_PATH[btn.dataset.action];
  if (path) window.location.href = path;
});

/* Use device location for the location pill if the user allows it. */
locPill?.addEventListener("click", () => {
  if (!navigator.geolocation) return;
  locText.textContent = "Locating you…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locText.textContent = `Current location · ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`;
      try {
        localStorage.setItem(
          "qg:location",
          JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            at: Date.now()
          })
        );
      } catch {}
      if (window.XP) XP.toast("Location updated", { kind: "success", emoji: "📍" });
    },
    () => {
      locText.textContent = "Allow location to personalize";
      if (window.XP) XP.toast("Location permission denied", { kind: "error", emoji: "⚠️" });
    },
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
  );
});

loadServices();
refreshQuickRow();
