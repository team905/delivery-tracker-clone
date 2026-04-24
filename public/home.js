const grid = document.getElementById("restaurantsGrid");
const searchInput = document.getElementById("searchInput");

let allRestaurants = [];
let activeFilter = "all";

const OFFERS = [
  "60% OFF up to ₹120",
  "50% OFF up to ₹100",
  "₹100 OFF above ₹299",
  "BOGO on selected items"
];

function offerForId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 13) % 4;
  return OFFERS[h];
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

function render(list) {
  if (!list.length) {
    grid.innerHTML = `<div class="z-empty">
      <p class="z-empty__title">No restaurants found</p>
      <p class="z-empty__sub">Try a different search or filter</p>
    </div>`;
    return;
  }
  grid.innerHTML = list
    .map(
      (r) => `
    <a class="z-resto-card" href="/restaurant.html?id=${r.id}">
      <div class="z-resto-card__img">
        <img src="${r.image}" alt="" loading="lazy" />
        <span class="z-resto-card__off">${offerForId(r.id)}</span>
        <span class="z-resto-card__time">${r.deliveryMinutes} min</span>
      </div>
      <div class="z-resto-card__body">
        <div class="z-resto-card__row1">
          <h2 class="z-resto-card__name">${r.name}</h2>
          <span class="z-rating-pill" title="Rating"><span class="z-rating-pill__star">★</span>${r.rating.toFixed(1)}</span>
        </div>
        <p class="z-resto-card__cuisine">${r.cuisine}</p>
        <div class="z-resto-card__meta">
          <span class="z-resto-card__cft">₹200 for two</span>
          <span class="z-dot" aria-hidden="true">·</span>
          <span>Free delivery above ₹199</span>
        </div>
      </div>
    </a>`
    )
    .join("");
}

async function loadRestaurants() {
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

searchInput.addEventListener("input", () => {
  render(applyFilters(allRestaurants));
});

document.querySelectorAll(".z-cat").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".z-cat").forEach((b) => b.classList.remove("z-cat--on"));
    btn.classList.add("z-cat--on");
    activeFilter = btn.dataset.filter || "all";
    render(applyFilters(allRestaurants));
  });
});

loadRestaurants();
