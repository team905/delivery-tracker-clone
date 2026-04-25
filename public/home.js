/* Food list — modernized.
 * Adds skeleton loaders, animated badges (trending/new/pro), distance pill,
 * a smoother filter pill experience, and a friendlier empty state.
 * No new functionality — just polish on what already exists.
 */

const grid = document.getElementById("restaurantsGrid");
const searchInput = document.getElementById("searchInput");

let allRestaurants = [];
let activeFilter = "all";
let userLatLng = null;

const OFFERS = [
  "60% OFF up to ₹120",
  "50% OFF up to ₹100",
  "₹100 OFF above ₹299",
  "BOGO on selected items"
];

const BADGE_KIND = ["trending", "pro", "new", null]; // null => no badge
const HOME_LATLNG = { lat: 19.117, lng: 72.906 }; // default if user has no saved loc

try {
  const saved = JSON.parse(localStorage.getItem("qg:location") || "null");
  if (saved && typeof saved.lat === "number") userLatLng = saved;
} catch {}
if (!userLatLng) userLatLng = HOME_LATLNG;

function offerForId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 13) % 4;
  return OFFERS[h];
}

function badgeForId(id) {
  const idx = (window.XP ? XP.hash(id) : 0) % BADGE_KIND.length;
  const kind = BADGE_KIND[idx];
  if (!kind) return "";
  if (kind === "trending") return '<span class="xp-badge xp-badge--trending">🔥 Trending</span>';
  if (kind === "pro") return '<span class="xp-badge xp-badge--pro">★ Pro</span>';
  if (kind === "new") return '<span class="xp-badge xp-badge--new">✨ New</span>';
  return "";
}

function distanceFor(r) {
  if (!r.location || !window.XP) return null;
  const km = XP.distanceKm(userLatLng.lat, userLatLng.lng, r.location.lat, r.location.lng);
  return km != null ? `${km} km` : null;
}

function isVegOnly(cuisine) {
  return /healthy|salad|green/i.test(cuisine) && !/chicken|fish|japanese|ramen|sushi|mutton|lamb|pepperoni/i.test(cuisine);
}

function applyFilters(list) {
  const q = searchInput.value.toLowerCase().trim();
  let r = list;
  if (q) {
    r = r.filter(
      (x) => x.name.toLowerCase().includes(q) || x.cuisine.toLowerCase().includes(q)
    );
  }
  if (activeFilter === "veg") {
    r = r.filter((x) => isVegOnly(x.cuisine));
  } else if (activeFilter === "fast") {
    r = r.filter((x) => x.deliveryMinutes <= 28);
  } else if (activeFilter === "rating") {
    r = [...r].sort((a, b) => b.rating - a.rating);
  } else if (activeFilter === "under") {
    r = r.filter((x) => x.deliveryMinutes <= 25);
  }
  return r;
}

function showSkeleton() {
  if (!grid || !window.XP) return;
  grid.innerHTML = `<div style="display:grid;gap:14px">${XP.skeletonCards(4, "restaurant")}</div>`;
}

function render(list) {
  if (!list.length) {
    grid.innerHTML = `<div class="z-empty xp-fade-in" style="text-align:center;padding:36px 18px">
      <div style="font-size:48px;margin-bottom:8px">🍽️</div>
      <p class="z-empty__title">Hmm, nothing here</p>
      <p class="z-empty__sub">Try a different search or remove a filter</p>
    </div>`;
    return;
  }
  grid.innerHTML = list
    .map((r, i) => {
      const dist = distanceFor(r);
      return `
    <a class="z-resto-card xp-fade-in" href="/restaurant.html?id=${r.id}" style="animation-delay:${Math.min(i, 6) * 40}ms" data-xp-tap>
      <div class="z-resto-card__img">
        ${badgeForId(r.id)}
        <img src="${r.image}" alt="" loading="lazy" />
        <span class="z-resto-card__off">${offerForId(r.id)}</span>
        <span class="z-resto-card__time">⏱ ${r.deliveryMinutes} min</span>
      </div>
      <div class="z-resto-card__body">
        <div class="z-resto-card__row1">
          <h2 class="z-resto-card__name">${r.name}</h2>
          <span class="z-rating-pill xp-rating-pill" title="Rating"><span class="z-rating-pill__star">★</span>${r.rating.toFixed(1)}</span>
        </div>
        <p class="z-resto-card__cuisine">${r.cuisine}</p>
        <div class="z-resto-card__meta" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span class="z-resto-card__cft">₹200 for two</span>
          <span class="z-dot" aria-hidden="true">·</span>
          <span>Free delivery above ₹199</span>
          ${dist ? `<span class="z-dot" aria-hidden="true">·</span><span class="xp-distance">${dist}</span>` : ""}
        </div>
      </div>
    </a>`;
    })
    .join("");
  if (window.XP) XP.attachRipple(".z-resto-card", grid);
}

async function loadRestaurants() {
  showSkeleton();
  try {
    const res = await fetch("/api/restaurants");
    const data = await res.json();
    allRestaurants = data.restaurants;
    render(applyFilters(allRestaurants));
  } catch {
    grid.innerHTML =
      '<p class="z-empty__sub" style="padding:24px">Could not load restaurants. Try refreshing.</p>';
  }
}

const debouncedRender = window.XP
  ? XP.debounce(() => render(applyFilters(allRestaurants)), 120)
  : () => render(applyFilters(allRestaurants));

searchInput.addEventListener("input", debouncedRender);

document.querySelectorAll(".z-cat").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".z-cat").forEach((b) => b.classList.remove("z-cat--on"));
    btn.classList.add("z-cat--on");
    activeFilter = btn.dataset.filter || "all";
    if (window.XP) XP.haptic(6);
    render(applyFilters(allRestaurants));
    /* gentle scroll back to the top of the list when the user changes filter */
    grid.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

loadRestaurants();
