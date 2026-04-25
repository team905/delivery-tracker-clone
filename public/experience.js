/* experience.js — shared micro-interactions & polish helpers
 * Exposes window.XP with: toast, flyToCart, confetti, success, ripple,
 * skeletonCards, timeGreeting, haptic, debounce, attachRipple
 *
 * Designed to be additive — never breaks existing behaviour.
 */
(function () {
  const XP = {};

  /* ---------- haptic ---------- */
  XP.haptic = function (pattern = 8) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
  };

  /* ---------- toast ---------- */
  let toastHost = null;
  function ensureToastHost() {
    if (toastHost && document.body.contains(toastHost)) return toastHost;
    toastHost = document.createElement("div");
    toastHost.className = "xp-toast-host";
    document.body.appendChild(toastHost);
    return toastHost;
  }
  XP.toast = function (message, opts = {}) {
    const host = ensureToastHost();
    const el = document.createElement("div");
    el.className = `xp-toast xp-toast--${opts.kind || "info"}`;
    if (opts.emoji) {
      const e = document.createElement("span");
      e.className = "xp-toast-emoji";
      e.textContent = opts.emoji;
      el.appendChild(e);
    }
    const t = document.createElement("span");
    t.textContent = message;
    el.appendChild(t);
    host.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .25s, transform .25s";
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(() => el.remove(), 280);
    }, opts.duration || 2200);
  };

  /* ---------- ripple ---------- */
  XP.ripple = function (event, target) {
    target = target || event.currentTarget;
    if (!target) return;
    target.classList.add("xp-rippler");
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.4;
    const ink = document.createElement("span");
    ink.className = "xp-ripple-ink";
    ink.style.width = ink.style.height = size + "px";
    const x = (event.clientX || rect.left + rect.width / 2) - rect.left;
    const y = (event.clientY || rect.top + rect.height / 2) - rect.top;
    ink.style.left = x + "px";
    ink.style.top = y + "px";
    target.appendChild(ink);
    setTimeout(() => ink.remove(), 650);
  };
  XP.attachRipple = function (selector, root = document) {
    root.querySelectorAll(selector).forEach((el) => {
      if (el.dataset.xpRipple) return;
      el.dataset.xpRipple = "1";
      el.addEventListener("pointerdown", (e) => XP.ripple(e, el));
    });
  };

  /* ---------- fly-to-cart ---------- */
  XP.flyToCart = function (originEl, targetEl, opts = {}) {
    if (!originEl) return;
    targetEl = targetEl || document.querySelector("[data-xp-cart-target]") ||
               document.querySelector(".xp-cart-dock") ||
               document.querySelector(".svc-cart-bar") ||
               document.querySelector(".z-cart");
    if (!targetEl) return;

    const o = originEl.getBoundingClientRect();
    const t = targetEl.getBoundingClientRect();

    const fly = document.createElement("div");
    fly.className = "xp-fly";
    if (opts.color) fly.style.background = opts.color;
    fly.style.left = o.left + o.width / 2 - 11 + "px";
    fly.style.top = o.top + o.height / 2 - 11 + "px";
    document.body.appendChild(fly);

    const dx = t.left + t.width / 2 - (o.left + o.width / 2);
    const dy = t.top + t.height / 2 - (o.top + o.height / 2);

    requestAnimationFrame(() => {
      fly.style.transform = `translate(${dx}px, ${dy}px) scale(0.4)`;
      fly.style.opacity = "0";
    });
    setTimeout(() => fly.remove(), 750);

    targetEl.classList.add("xp-pulse");
    setTimeout(() => targetEl.classList.remove("xp-pulse"), 600);

    XP.haptic(8);
  };

  /* ---------- confetti ---------- */
  XP.confetti = function (opts = {}) {
    const count = opts.count || 80;
    const colors = opts.colors || ["#ef4f5e", "#ffb300", "#1ca05a", "#2563eb", "#a855f7", "#ff7e5f"];
    const host = document.createElement("div");
    host.className = "xp-confetti";
    document.body.appendChild(host);
    for (let i = 0; i < count; i++) {
      const span = document.createElement("span");
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 240;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist - 60;
      span.style.background = colors[i % colors.length];
      span.style.setProperty("--xp-tx", tx + "px");
      span.style.setProperty("--xp-ty", ty + "px");
      span.style.animationDelay = (Math.random() * 0.15) + "s";
      span.style.animationDuration = (1 + Math.random() * 0.7) + "s";
      span.style.transform = `translate(-50%,-50%) rotate(${Math.random() * 360}deg)`;
      host.appendChild(span);
    }
    setTimeout(() => host.remove(), 2200);
  };

  /* ---------- success overlay (with confetti) ---------- */
  XP.success = function ({ icon = "✓", title = "Success!", sub = "", duration = 1300, onDone } = {}) {
    XP.confetti();
    const overlay = document.createElement("div");
    overlay.className = "xp-success";
    overlay.innerHTML = `
      <div class="xp-success__icon">${icon}</div>
      <div class="xp-success__title">${title}</div>
      ${sub ? `<div class="xp-success__sub">${sub}</div>` : ""}
    `;
    document.body.appendChild(overlay);
    XP.haptic([20, 40, 20]);
    setTimeout(() => {
      overlay.style.transition = "opacity .3s ease";
      overlay.style.opacity = "0";
      setTimeout(() => { overlay.remove(); onDone && onDone(); }, 300);
    }, duration);
  };

  /* ---------- skeleton card factory ---------- */
  XP.skeletonCards = function (n = 4, kind = "restaurant") {
    let html = "";
    for (let i = 0; i < n; i++) {
      if (kind === "restaurant") {
        html += `
          <div class="xp-skel-card">
            <div class="xp-skel-block"></div>
            <div class="xp-skel-line w-70"></div>
            <div class="xp-skel-line w-50"></div>
            <div class="xp-skel-line w-30"></div>
          </div>`;
      } else if (kind === "product") {
        html += `
          <div class="xp-skel-card" style="padding:10px">
            <div class="xp-skel-block" style="height:80px"></div>
            <div class="xp-skel-line w-70" style="height:10px"></div>
            <div class="xp-skel-line w-30" style="height:10px"></div>
          </div>`;
      } else if (kind === "menu") {
        html += `
          <div class="xp-skel-card" style="display:grid;grid-template-columns:1fr 80px;gap:14px">
            <div style="display:grid;gap:8px">
              <div class="xp-skel-line w-50"></div>
              <div class="xp-skel-line w-30"></div>
              <div class="xp-skel-line w-70" style="height:8px"></div>
              <div class="xp-skel-line" style="height:8px"></div>
            </div>
            <div class="xp-skel-block" style="height:80px"></div>
          </div>`;
      } else if (kind === "tile") {
        html += `<div class="xp-skel-card" style="aspect-ratio:1/1"></div>`;
      }
    }
    return html;
  };

  /* ---------- time-aware greeting ---------- */
  XP.timeGreeting = function (name) {
    const h = new Date().getHours();
    let g, emoji;
    if (h < 5) { g = "Burning the midnight oil"; emoji = "🌙"; }
    else if (h < 12) { g = "Good morning"; emoji = "☀️"; }
    else if (h < 16) { g = "Good afternoon"; emoji = "🌤"; }
    else if (h < 20) { g = "Good evening"; emoji = "🌆"; }
    else { g = "Good night"; emoji = "🌙"; }
    return name ? `${g}, ${name.split(" ")[0]} ${emoji}` : `${g} ${emoji}`;
  };

  /* ---------- rotate sub-tagline ---------- */
  XP.rotate = function (el, lines, intervalMs = 3500) {
    if (!el || !lines.length) return;
    let i = 0;
    el.textContent = lines[0];
    setInterval(() => {
      i = (i + 1) % lines.length;
      el.style.transition = "opacity .25s, transform .25s";
      el.style.opacity = "0";
      el.style.transform = "translateY(-4px)";
      setTimeout(() => {
        el.textContent = lines[i];
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }, 260);
    }, intervalMs);
  };

  /* ---------- debounce ---------- */
  XP.debounce = function (fn, ms = 200) {
    let t = null;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms);
    };
  };

  /* ---------- distance helper (Haversine) ---------- */
  XP.distanceKm = function (lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some((v) => typeof v !== "number")) return null;
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  };

  /* ---------- deterministic hash for badge variety ---------- */
  XP.hash = function (s) {
    let h = 0;
    s = String(s || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  };

  /* ---------- auto-attach rippler to common buttons on load ---------- */
  function autoAttach() {
    const sel = ".btn-primary,.btn-ghost,.svc-cart-bar__cta,.svc-checkout__actions button,.cab-vehicle,.parcel-vehicle,.super-quick,.super-tile,.z-cat,.z-add,.groc-cats button,.xp-cart-dock,[data-xp-ripple]";
    XP.attachRipple(sel);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoAttach);
  } else {
    autoAttach();
  }

  window.XP = XP;
})();
