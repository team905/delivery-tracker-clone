/* native.js — App-shell behaviours for a native feel.
 *
 * What it does (loaded on every page):
 *   1. Auto-injects manifest, theme-color, apple-touch-icon and apple
 *      mobile meta tags so each page is installable / standalone-ready.
 *   2. Registers /sw.js (PWA) and prompts install via beforeinstallprompt.
 *   3. Detects standalone mode → adds body.is-standalone for chrome tweaks.
 *   4. Same-origin link interception → fades the outgoing page (or uses
 *      the View Transitions API where available) for app-like nav.
 *   5. Generic drag-to-dismiss for any modal sheet (svc/parcel/cab2/native).
 *   6. Pull-to-refresh for any [data-native-refresh] container.
 *   7. Detects scroll on app-shell pages → toggles body.is-scrolled
 *      so sticky topbars get a subtle separator (UINavigationBar style).
 *   8. Wake-lock on /track.html so the screen stays on while watching.
 *   9. Nat.haptic / Nat.toast helpers for any page to use.
 *
 * The whole module exposes `window.Nat`. Failures degrade silently —
 * a user on a basic browser still gets a working website.
 */

(function () {
  if (window.Nat) return;
  const Nat = (window.Nat = {});
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    new URLSearchParams(location.search).get("source") === "pwa";

  Nat.isiOS = isiOS;
  Nat.isStandalone = isStandalone;

  /* =========================================================
     1. Inject head meta tags + manifest link (DRY across pages)
     ========================================================= */
  function ensureHeadAsset(selector, attrs) {
    if (document.head.querySelector(selector)) return;
    const tag = document.createElement(attrs.tag || "meta");
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "tag") return;
      tag.setAttribute(k, v);
    });
    document.head.appendChild(tag);
  }
  function injectAppMeta() {
    ensureHeadAsset('link[rel="manifest"]', {
      tag: "link", rel: "manifest", href: "/manifest.webmanifest"
    });
    ensureHeadAsset('link[rel="apple-touch-icon"]', {
      tag: "link", rel: "apple-touch-icon", href: "/icons/icon.svg"
    });
    ensureHeadAsset('link[rel="icon"][type="image/svg+xml"]', {
      tag: "link", rel: "icon", type: "image/svg+xml", href: "/icons/icon.svg"
    });
    ensureHeadAsset('meta[name="apple-mobile-web-app-capable"]', {
      name: "apple-mobile-web-app-capable", content: "yes"
    });
    ensureHeadAsset('meta[name="apple-mobile-web-app-title"]', {
      name: "apple-mobile-web-app-title", content: "QuickGo"
    });
    ensureHeadAsset('meta[name="apple-mobile-web-app-status-bar-style"]', {
      name: "apple-mobile-web-app-status-bar-style", content: "black-translucent"
    });
    ensureHeadAsset('meta[name="mobile-web-app-capable"]', {
      name: "mobile-web-app-capable", content: "yes"
    });
    ensureHeadAsset('meta[name="format-detection"]', {
      name: "format-detection", content: "telephone=no"
    });
    /* color-scheme so the system picks correct text-input chrome */
    ensureHeadAsset('meta[name="color-scheme"]', {
      name: "color-scheme", content: "light"
    });
  }
  injectAppMeta();

  if (isStandalone) document.documentElement.classList.add("is-standalone");
  document.addEventListener("DOMContentLoaded", () => {
    if (isStandalone) document.body.classList.add("is-standalone");
  });

  /* =========================================================
     2. Service-worker registration + update flow
     ========================================================= */
  Nat.registerSW = function () {
    if (!("serviceWorker" in navigator)) return;
    /* Don't register on localhost when running over `file://` etc. */
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    window.addEventListener("load", async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        /* Detect updated SW and prompt page to refresh */
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              Nat.toast("Update available — refresh to apply", { duration: 4000 });
            }
          });
        });
      } catch (e) {
        /* SW failed — usually fine on dev / private mode */
      }
    });
  };
  Nat.registerSW();

  /* =========================================================
     3. Standalone install prompt (Chrome / Edge / Android)
     ========================================================= */
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    /* Only show our subtle banner if user dismissed less than 7 days ago */
    const dismissedAt = Number(localStorage.getItem("nat:installDismissed") || 0);
    const SEVEN_D = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - dismissedAt < SEVEN_D) return;
    if (location.pathname !== "/" && location.pathname !== "/index.html") return;
    setTimeout(showInstallBanner, 4000);
  });
  function showInstallBanner() {
    if (!deferredPrompt) return;
    if (document.querySelector(".nat-install")) return;
    const el = document.createElement("div");
    el.className = "nat-install";
    el.innerHTML = `
      <div class="nat-install__icon" aria-hidden="true">Q</div>
      <div class="nat-install__main">
        <div class="nat-install__title">Install QuickGo</div>
        <div class="nat-install__sub">One-tap access from your home screen</div>
      </div>
      <button class="nat-install__btn" type="button" data-action="install">Install</button>
      <button class="nat-install__close" type="button" data-action="dismiss" aria-label="Dismiss">×</button>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-on"));
    el.addEventListener("click", async (e) => {
      const action = e.target.closest("[data-action]")?.dataset?.action;
      if (action === "install" && deferredPrompt) {
        deferredPrompt.prompt();
        try { await deferredPrompt.userChoice; } catch {}
        deferredPrompt = null;
        el.remove();
      } else if (action === "dismiss") {
        localStorage.setItem("nat:installDismissed", String(Date.now()));
        el.classList.remove("is-on");
        setTimeout(() => el.remove(), 240);
      }
    });
  }
  /* Manual call so any page can trigger the prompt */
  Nat.promptInstall = showInstallBanner;

  /* =========================================================
     4. Page transitions
        Use cross-document View Transitions when supported (declared via
        @view-transition in CSS); for fallback browsers, fade out the
        outgoing page on internal link click.
     ========================================================= */
  function isInternalLink(a) {
    if (!a) return false;
    if (a.target && a.target !== "_self") return false;
    if (a.hasAttribute("download")) return false;
    if (a.dataset.nativeNoTransition === "true") return false;
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") ||
        href.startsWith("tel:") || href.startsWith("javascript:")) return false;
    try {
      const url = new URL(a.href, location.href);
      return url.origin === location.origin;
    } catch { return false; }
  }
  document.addEventListener("click", (e) => {
    /* Skip if View Transitions API will already handle it */
    if ("startViewTransition" in document) return;
    const a = e.target.closest("a");
    if (!isInternalLink(a)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    /* Skip on map-heavy pages so the canvas doesn't flash */
    if (document.body.classList.contains("app-cab") ||
        document.body.classList.contains("app-track")) return;
    e.preventDefault();
    document.body.classList.add("is-leaving");
    /* Haptic tap */
    Nat.haptic(8);
    setTimeout(() => { window.location.href = a.href; }, 170);
  }, { capture: true });

  /* If user comes back via bfcache, clear leaving state */
  window.addEventListener("pageshow", () => {
    document.body.classList.remove("is-leaving");
  });

  /* =========================================================
     5. Drag-to-dismiss bottom sheets
        Auto-applies to:
          • [data-native-sheet]
          • .svc-checkout-modal__card  (close parent .svc-checkout-modal)
          • .parcel-modal              (whole element)
          • .cab2-modal__card          (close parent .cab2-modal)
          • .cab2-sheet                (collapse to start view via state)
     ========================================================= */
  function setupSheetDrag() {
    const root = document.body;
    let active = null;

    function findSheet(target) {
      return target.closest(
        "[data-native-sheet]," +
        ".svc-checkout-modal__card," +
        ".cab2-modal__card," +
        ".parcel-modal__card," +
        ".cab2-sheet--vehicles"
      );
    }
    function findContainer(sheet) {
      /* Container is the backdrop that we close (display:none) */
      if (sheet.matches(".svc-checkout-modal__card")) return sheet.closest(".svc-checkout-modal");
      if (sheet.matches(".cab2-modal__card")) return sheet.closest(".cab2-modal");
      if (sheet.matches(".parcel-modal__card")) return sheet.closest(".parcel-modal");
      return sheet;
    }

    function onPointerDown(e) {
      if (e.target.closest("input, textarea, select, button, a, [contenteditable], .leaflet-container")) return;
      const sheet = findSheet(e.target);
      if (!sheet) return;
      /* Only allow drag from the top portion (handle area, ~24px) */
      const rect = sheet.getBoundingClientRect();
      const fromTop = e.clientY - rect.top;
      if (fromTop > 36) return;
      active = {
        sheet, container: findContainer(sheet),
        startY: e.clientY, currentY: e.clientY,
        height: rect.height
      };
      sheet.classList.add("is-dragging");
      sheet.style.transition = "none";
      sheet.setPointerCapture?.(e.pointerId);
    }
    function onPointerMove(e) {
      if (!active) return;
      active.currentY = e.clientY;
      const dy = Math.max(0, e.clientY - active.startY);
      active.sheet.style.transform = `translateY(${dy}px)`;
    }
    function onPointerUp() {
      if (!active) return;
      const dy = active.currentY - active.startY;
      const sheet = active.sheet;
      const container = active.container;
      sheet.classList.remove("is-dragging");
      sheet.style.transition = "";
      if (dy > Math.min(140, active.height * 0.28)) {
        sheet.style.transform = `translateY(${active.height + 60}px)`;
        Nat.haptic(10);
        setTimeout(() => {
          sheet.style.transform = "";
          /* Try common close methods. Cab2 modal uses [hidden] attribute. */
          if (container.matches(".svc-checkout-modal, .parcel-modal, .cab2-modal")) {
            container.setAttribute("hidden", "");
            document.body.style.overflow = ""; // restore scroll
          } else if (container.matches(".cab2-sheet--vehicles")) {
            /* Cab2 sheet: dispatch a click on the back-edit affordance */
            document.body.classList.remove("is-state-vehicles");
            container.classList.remove("is-on");
          }
        }, 220);
      } else {
        sheet.style.transform = "";
      }
      active = null;
    }

    root.addEventListener("pointerdown", onPointerDown, { passive: true });
    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerUp);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupSheetDrag);
  } else {
    setupSheetDrag();
  }

  /* =========================================================
     6. Pull-to-refresh for [data-native-refresh="callbackName"]
     ========================================================= */
  Nat.attachPullToRefresh = function (container, onRefresh) {
    if (!container) return;
    const indicator = document.createElement("div");
    indicator.className = "nat-ptr";
    indicator.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M21 12a9 9 0 11-3-6.7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      </svg>`;
    document.body.appendChild(indicator);
    let startY = 0, pulling = false, pulled = 0;
    container.addEventListener("touchstart", (e) => {
      if (container.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    }, { passive: true });
    container.addEventListener("touchmove", (e) => {
      if (!pulling) return;
      pulled = e.touches[0].clientY - startY;
      if (pulled > 0 && container.scrollTop === 0) {
        indicator.classList.add("is-pulling");
        const t = Math.min(pulled, 120);
        indicator.style.transform = `translateY(${t * 0.4}px) scale(${0.8 + t / 400})`;
      }
    }, { passive: true });
    container.addEventListener("touchend", async () => {
      if (!pulling) return;
      pulling = false;
      if (pulled > 70) {
        indicator.classList.add("is-refreshing");
        Nat.haptic(15);
        try { await onRefresh?.(); } finally {
          setTimeout(() => {
            indicator.classList.remove("is-refreshing", "is-pulling");
            indicator.style.transform = "";
          }, 600);
        }
      } else {
        indicator.classList.remove("is-pulling");
        indicator.style.transform = "";
      }
      pulled = 0;
    });
  };
  /* Auto-attach for declarative usage: data-native-refresh="windowGlobal" */
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-native-refresh]").forEach((el) => {
      const cbName = el.dataset.nativeRefresh;
      const cb = window[cbName];
      if (typeof cb === "function") Nat.attachPullToRefresh(el, cb);
    });
  });

  /* =========================================================
     7. is-scrolled flag for blur-on-scroll headers
     ========================================================= */
  function trackScroll() {
    const onScroll = () => {
      document.body.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", trackScroll);
  } else {
    trackScroll();
  }

  /* =========================================================
     8. Wake Lock for /track.html
     ========================================================= */
  let wakeLock = null;
  Nat.requestWakeLock = async function () {
    if (!("wakeLock" in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request("screen"); } catch {}
  };
  document.addEventListener("visibilitychange", async () => {
    if (wakeLock !== null && document.visibilityState === "visible") {
      Nat.requestWakeLock();
    }
  });
  if (location.pathname.startsWith("/track")) {
    document.addEventListener("DOMContentLoaded", Nat.requestWakeLock);
  }

  /* =========================================================
     9. Tiny shared utilities
     ========================================================= */
  Nat.haptic = function (ms = 10) {
    try { navigator.vibrate?.(ms); } catch {}
  };
  Nat.toast = function (msg, opts = {}) {
    let host = document.querySelector(".nat-toast");
    if (!host) {
      host = document.createElement("div");
      host.className = "nat-toast";
      document.body.appendChild(host);
    }
    host.textContent = msg;
    requestAnimationFrame(() => host.classList.add("is-on"));
    clearTimeout(Nat.toast._t);
    Nat.toast._t = setTimeout(
      () => host.classList.remove("is-on"),
      Math.max(1200, opts.duration || 2200)
    );
  };
  Nat.share = async function ({ title, text, url } = {}) {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return true; }
      catch { return false; }
    }
    /* Fallback — copy to clipboard */
    if (navigator.clipboard && url) {
      try { await navigator.clipboard.writeText(url); Nat.toast("Link copied"); return true; }
      catch {}
    }
    return false;
  };

  /* =========================================================
     10. Visual viewport — keep focused inputs above the keyboard
         in modal sheets (iOS Safari especially).
     ========================================================= */
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const onResize = () => {
      const focused = document.activeElement;
      if (!focused || !focused.matches?.("input, textarea, select")) return;
      const inSheet = focused.closest(".svc-checkout-modal__card, .cab2-modal__card, .cab2-search, [data-native-sheet]");
      if (!inSheet) return;
      setTimeout(() => focused.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
    };
    vv.addEventListener("resize", onResize);
  }

  /* Convenience tag if wider page chrome wants to know it's running native */
  document.documentElement.classList.add("nat-ready");
})();
