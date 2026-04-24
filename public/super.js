/* Super-app landing — loads the service registry and renders the picker tiles. */

const grid = document.getElementById("servicesGrid");
const quickRow = document.getElementById("quickRow");
const locPill = document.getElementById("superLocPill");
const locText = document.getElementById("superLocText");

const QUICK_TO_PATH = {
  reorder: "/food.html",
  grocery: "/grocery.html",
  ride: "/cab.html"
};

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
      (s) => `
      <a class="super-tile" href="${s.entryPath}" data-service="${s.id}" style="--tile-bg:${s.gradient};--tile-color:${s.color}">
        <span class="super-tile__glow" aria-hidden="true"></span>
        <span class="super-tile__emoji" aria-hidden="true">${s.emoji}</span>
        <span class="super-tile__title">${s.name}</span>
        <span class="super-tile__sub">${s.tagline}</span>
        <span class="super-tile__eta">${s.etaMin}-${s.etaMax} min</span>
        <span class="super-tile__brand">like ${s.brand}</span>
      </a>`
    )
    .join("");
}

quickRow?.addEventListener("click", (e) => {
  const btn = e.target.closest(".super-quick");
  if (!btn) return;
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
    },
    () => {
      locText.textContent = "Allow location to personalize";
    },
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
  );
});

loadServices();
