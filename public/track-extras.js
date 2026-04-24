/* Track page v3 — extras: chat, call-masking, note, report, rich rating,
 * receipt, settings, scratch-card, and post-delivery story recap.
 * Relies on window.TRACK and window.I18N defined in track.js / track-i18n.js. */
(() => {
  const T = window.TRACK;
  if (!T) return;
  const { socket, orderId, publicMode } = T;
  const I18N = window.I18N;

  const $ = (id) => document.getElementById(id);

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("visible"));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.classList.remove("visible");
      setTimeout(() => (el.hidden = true), 300);
    }, 2500);
  }

  function openModal(el) {
    el.setAttribute("aria-hidden", "false");
    el.classList.add("open");
    document.body.classList.add("modal-open");
  }
  function closeModal(el) {
    el.setAttribute("aria-hidden", "true");
    el.classList.remove("open");
    document.body.classList.remove("modal-open");
  }

  /* ============ PREFERENCES (theme/motion/lang/sound/notify) ============ */
  function applyTheme(theme) {
    const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const effective = theme === "system" ? sys : theme;
    document.body.dataset.theme = effective;
    T.prefs.theme = theme;
    localStorage.setItem("trackTheme", theme);
  }
  function applyMotion(mode) {
    T.prefs.motion = mode;
    localStorage.setItem("trackMotion", mode);
    document.body.classList.toggle("reduce-motion", mode === "reduce");
  }
  function applySound(mode) {
    T.prefs.sound = mode;
    localStorage.setItem("trackSound", mode);
  }
  function applyLang(lang) {
    T.prefs.lang = lang;
    I18N.setLang(lang);
  }
  // Apply stored prefs on boot
  applyTheme(T.prefs.theme);
  applyMotion(T.prefs.motion);
  applySound(T.prefs.sound);
  // Honor system preference changes
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)")
    .addEventListener && window.matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (T.prefs.theme === "system") applyTheme("system");
    });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches && T.prefs.motion === "full") {
    applyMotion("reduce");
  }

  /* ============ SETTINGS SHEET ============ */
  const settingsModal = $("settingsModal");
  $("settingsBtn").addEventListener("click", () => {
    openModal(settingsModal);
    syncSettingsUI();
  });
  $("settingsDoneBtn").addEventListener("click", () => closeModal(settingsModal));

  function syncSettingsUI() {
    const map = {
      themeSeg: T.prefs.theme,
      motionSeg: T.prefs.motion,
      langSeg: T.prefs.lang,
      soundSeg: T.prefs.sound
    };
    Object.entries(map).forEach(([id, v]) => {
      const seg = $(id);
      if (!seg) return;
      seg.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("active", b.dataset.v === v);
      });
    });
    // Notification button
    const btn = $("notifyToggle");
    if (!("Notification" in window)) {
      btn.disabled = true;
      btn.textContent = "Unsupported";
    } else {
      const p = Notification.permission;
      btn.textContent = p === "granted" ? I18N.t("enabled") : p === "denied" ? I18N.t("denied") : I18N.t("enable");
      btn.disabled = p === "denied";
    }
  }
  ["themeSeg", "motionSeg", "langSeg", "soundSeg"].forEach((id) => {
    $(id).querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        const v = b.dataset.v;
        if (id === "themeSeg") applyTheme(v);
        else if (id === "motionSeg") applyMotion(v);
        else if (id === "langSeg") applyLang(v);
        else if (id === "soundSeg") applySound(v);
        syncSettingsUI();
      });
    });
  });
  $("notifyToggle").addEventListener("click", async () => {
    if (!("Notification" in window)) return;
    try {
      const p = await Notification.requestPermission();
      syncSettingsUI();
      if (p === "granted") toast("Notifications enabled");
    } catch {}
  });
  window.addEventListener("langchange", syncSettingsUI);

  /* ============ CUSTOMER NOTE ============ */
  const noteModal = $("noteModal");
  const noteInput = $("noteInput");
  const notePresets = $("notePresets");
  const NOTE_PRESETS = [
    "Gate code is 1234",
    "Leave at reception",
    "Call when nearby",
    "2nd floor, flat 201",
    "Blue building on the right"
  ];
  function renderNotePresets() {
    notePresets.innerHTML = NOTE_PRESETS
      .map((p) => `<button class="np-chip" type="button">${p}</button>`)
      .join("");
    notePresets.querySelectorAll(".np-chip").forEach((c) => {
      c.addEventListener("click", () => {
        noteInput.value = noteInput.value
          ? `${noteInput.value}\n${c.textContent}`
          : c.textContent;
        noteInput.focus();
      });
    });
  }
  $("editNoteBtn").addEventListener("click", () => {
    if (publicMode) return;
    noteInput.value = T.lastData?.customerNote?.text || "";
    renderNotePresets();
    openModal(noteModal);
    setTimeout(() => noteInput.focus(), 120);
  });
  $("noteSaveBtn").addEventListener("click", async () => {
    const text = noteInput.value.trim();
    try {
      await fetch(`/api/orders/${orderId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      closeModal(noteModal);
      toast(text ? "Note sent to rider" : "Note cleared");
    } catch {
      toast("Could not save note");
    }
  });
  $("noteClearBtn").addEventListener("click", () => {
    noteInput.value = "";
  });

  /* ============ CHAT ============ */
  const chatModal = $("chatModal");
  const chatBody = $("chatBody");
  const chatForm = $("chatForm");
  const chatInput = $("chatInput");
  const chatQuick = $("chatQuick");
  const chatRiderPhoto = $("chatRiderPhoto");
  const chatRiderName = $("chatRiderName");
  const chatStatus = $("chatStatus");
  const CHAT_QUICKS = [
    "Where are you?",
    "Please ring the bell",
    "Leave it at the door",
    "I'm coming down",
    "Thank you!"
  ];
  let chatOpen = false;
  let unreadCount = 0;

  function renderChatHead() {
    const rider = T.lastData?.rider;
    if (rider) {
      chatRiderPhoto.src = rider.photo;
      chatRiderName.textContent = rider.name;
    } else {
      chatRiderName.textContent = "Rider";
    }
  }
  function renderChat(messages = []) {
    const list = messages.slice();
    if (!list.length) {
      chatBody.innerHTML = `<div class="chat-empty">${I18N.t("chatEmpty")}</div>`;
      return;
    }
    chatBody.innerHTML = list
      .map((m) => {
        const side = m.from === "customer" ? "you" : "them";
        const time = new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return `<div class="chat-msg ${side}"><div class="cm-bubble">${escapeHtml(m.text)}</div><span class="cm-time">${time}</span></div>`;
      })
      .join("");
    chatBody.scrollTop = chatBody.scrollHeight;
  }
  function renderChatQuick() {
    chatQuick.innerHTML = CHAT_QUICKS.map((q) => `<button type="button">${q}</button>`).join("");
    chatQuick.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        sendChatMessage(b.textContent);
      });
    });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function bumpUnread() {
    if (chatOpen) return;
    unreadCount++;
    const dot = $("chatUnread");
    dot.hidden = false;
    dot.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
  }
  function clearUnread() {
    unreadCount = 0;
    $("chatUnread").hidden = true;
  }

  async function openChat() {
    if (publicMode) return toast("Sharing link — chat disabled");
    if (!T.lastData?.rider) return toast("Rider not assigned yet");
    renderChatHead();
    renderChat(T.lastData.chat || []);
    renderChatQuick();
    openModal(chatModal);
    chatOpen = true;
    clearUnread();
    setTimeout(() => chatInput.focus(), 180);
  }
  $("chatCloseBtn").addEventListener("click", () => {
    closeModal(chatModal);
    chatOpen = false;
  });
  $("chatCallBtn").addEventListener("click", () => startCall());

  async function sendChatMessage(text) {
    const value = (text || chatInput.value).trim();
    if (!value) return;
    chatInput.value = "";
    try {
      const res = await fetch(`/api/orders/${orderId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, from: "customer" })
      });
      if (!res.ok) throw new Error();
    } catch {
      toast("Could not send message");
    }
  }
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sendChatMessage();
  });
  let typingTimer = null;
  chatInput.addEventListener("input", () => {
    socket.emit("typing", { orderId, from: "customer" });
    clearTimeout(typingTimer);
  });

  socket.on("chat-message", (msg) => {
    if (!T.lastData) return;
    const data = T.lastData;
    data.chat = data.chat || [];
    // Avoid duplicate append if full payload arrives right after
    if (!data.chat.find((m) => m.id === msg.id)) data.chat.push(msg);
    if (chatOpen) {
      renderChat(data.chat);
    } else if (msg.from === "rider") {
      bumpUnread();
      toast(`${data.rider?.name || "Rider"}: ${msg.text}`);
    }
  });
  socket.on("typing", ({ from }) => {
    if (from !== "rider") return;
    chatStatus.textContent = "typing…";
    clearTimeout(chatStatus._t);
    chatStatus._t = setTimeout(() => { chatStatus.textContent = I18N.t("chatOnline"); }, 1500);
  });

  /* ============ CALL MASKING ============ */
  const callModal = $("callModal");
  const callName = $("callName");
  const callNumber = $("callNumber");
  const callState = $("callState");
  const callPhoto = $("callPhoto");
  let callTimer = null;
  let callStartedAt = null;

  function startCall() {
    if (publicMode) return toast("Sharing link — call disabled");
    const rider = T.lastData?.rider;
    if (!rider) return toast("Rider not assigned yet");
    callName.textContent = rider.name;
    callPhoto.src = rider.photo;
    callNumber.textContent = "+91 1800-YUM-" + String(1000 + Math.floor(Math.random() * 8999));
    callState.textContent = I18N.t("connecting");
    callState.classList.remove("active");
    openModal(callModal);
    // navigator.vibrate - ringing pattern
    try { navigator.vibrate && navigator.vibrate([200, 300, 200, 300]); } catch {}
    setTimeout(() => {
      callState.textContent = "00:00";
      callState.classList.add("active");
      callStartedAt = Date.now();
      callTimer = setInterval(() => {
        const s = Math.floor((Date.now() - callStartedAt) / 1000);
        const m = String(Math.floor(s / 60)).padStart(2, "0");
        const sc = String(s % 60).padStart(2, "0");
        callState.textContent = `${m}:${sc}`;
      }, 1000);
    }, 2200);
  }
  function endCall() {
    clearInterval(callTimer);
    callTimer = null;
    callStartedAt = null;
    closeModal(callModal);
  }
  $("callEndBtn").addEventListener("click", endCall);
  $("callMuteBtn").addEventListener("click", (e) => e.currentTarget.classList.toggle("on"));
  $("callSpeakerBtn").addEventListener("click", (e) => e.currentTarget.classList.toggle("on"));

  /* ============ REPORT ISSUE ============ */
  const reportModal = $("reportModal");
  const reportCats = $("reportCats");
  const reportText = $("reportText");
  const reportSubmit = $("reportSubmitBtn");
  const REPORT_CATS = [
    { id: "missing", label: "Item missing", emoji: "❓" },
    { id: "cold", label: "Food arrived cold", emoji: "❄️" },
    { id: "wrong", label: "Wrong order", emoji: "🔁" },
    { id: "damaged", label: "Damaged / spilled", emoji: "💥" },
    { id: "rider", label: "Rider behaviour", emoji: "🙅" },
    { id: "address", label: "Wrong address", emoji: "📍" },
    { id: "other", label: "Something else", emoji: "💬" }
  ];
  let selectedReportCat = null;

  function renderReportCats() {
    reportCats.innerHTML = REPORT_CATS
      .map((c) => `<button class="rc-chip" data-id="${c.id}"><span>${c.emoji}</span>${c.label}</button>`)
      .join("");
    reportCats.querySelectorAll(".rc-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        reportCats.querySelectorAll(".rc-chip").forEach((x) => x.classList.remove("selected"));
        chip.classList.add("selected");
        selectedReportCat = chip.dataset.id;
        reportSubmit.disabled = false;
      });
    });
  }
  $("reportBtn").addEventListener("click", () => {
    selectedReportCat = null;
    reportText.value = "";
    reportSubmit.disabled = true;
    renderReportCats();
    openModal(reportModal);
  });
  reportSubmit.addEventListener("click", async () => {
    if (!selectedReportCat) return;
    const cat = REPORT_CATS.find((c) => c.id === selectedReportCat);
    try {
      const res = await fetch(`/api/orders/${orderId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat.label, description: reportText.value })
      });
      if (!res.ok) throw new Error();
      closeModal(reportModal);
      toast("Report submitted — we'll follow up");
    } catch {
      toast("Could not submit report");
    }
  });

  /* ============ RICH RATING ============ */
  const rateRichModal = $("rateRichModal");
  const rateRichSubmit = $("rateRichSubmit");
  const rateComment = $("rateComment");
  const ratePhotoInput = $("ratePhotoInput");
  const ratePhotoPreview = $("ratePhotoPreview");
  const ratePhotoTrigger = $("ratePhotoTrigger");
  const rateTagsEl = $("rateTags");
  let rateState = { overall: 0, food: 0, rider: 0, packaging: 0, tags: [], photo: null };

  const RATE_TAGS = {
    positive: ["Hot food", "Quick delivery", "Great packaging", "Polite rider", "Well cooked", "Fresh ingredients"],
    negative: ["Too slow", "Food was cold", "Spilled", "Rude behaviour", "Wrong item", "Small portion"]
  };
  function renderRateTags() {
    const group = rateState.overall >= 4 ? "positive" : rateState.overall >= 1 ? "negative" : "positive";
    const tags = RATE_TAGS[group];
    rateTagsEl.innerHTML = tags
      .map((t) => `<button class="rt-chip${rateState.tags.includes(t) ? " on" : ""}" data-v="${t}">${t}</button>`)
      .join("");
    rateTagsEl.querySelectorAll(".rt-chip").forEach((c) => {
      c.addEventListener("click", () => {
        const v = c.dataset.v;
        if (rateState.tags.includes(v)) {
          rateState.tags = rateState.tags.filter((x) => x !== v);
          c.classList.remove("on");
        } else {
          rateState.tags.push(v);
          c.classList.add("on");
        }
      });
    });
  }
  function refreshRateSubmit() {
    rateRichSubmit.disabled = !rateState.overall;
    rateRichSubmit.textContent = rateState.overall
      ? `Submit ${rateState.overall}★`
      : I18N.t("submitReview");
  }
  function wireStarRows() {
    document.querySelectorAll("#rateRichModal .star-row").forEach((row) => {
      const key = row.dataset.rate;
      row.querySelectorAll("span").forEach((s) => {
        s.addEventListener("click", () => {
          const val = Number(s.dataset.star);
          rateState[key] = val;
          row.querySelectorAll("span").forEach((x) => {
            x.classList.toggle("on", Number(x.dataset.star) <= val);
          });
          if (key === "overall") renderRateTags();
          refreshRateSubmit();
        });
      });
    });
  }
  wireStarRows();
  ratePhotoTrigger.addEventListener("click", () => ratePhotoInput.click());
  ratePhotoInput.addEventListener("change", () => {
    const file = ratePhotoInput.files?.[0];
    if (!file) return;
    if (file.size > 500000) {
      toast("Photo is too large, pick under 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      rateState.photo = reader.result;
      ratePhotoPreview.src = reader.result;
      ratePhotoPreview.hidden = false;
      ratePhotoTrigger.textContent = "Replace photo";
    };
    reader.readAsDataURL(file);
  });

  function openRichRate(data) {
    rateState = { overall: 0, food: 0, rider: 0, packaging: 0, tags: [], photo: null };
    document.querySelectorAll("#rateRichModal .star-row span").forEach((s) => s.classList.remove("on"));
    rateComment.value = "";
    ratePhotoPreview.hidden = true;
    ratePhotoPreview.src = "";
    ratePhotoTrigger.textContent = I18N.t("addPhoto");
    rateTagsEl.innerHTML = "";
    refreshRateSubmit();
    openModal(rateRichModal);
  }
  rateRichSubmit.addEventListener("click", async () => {
    if (!rateState.overall) return;
    try {
      await fetch(`/api/orders/${orderId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overall: rateState.overall,
          food: rateState.food,
          rider: rateState.rider,
          packaging: rateState.packaging,
          tags: rateState.tags,
          comment: rateComment.value,
          photo: rateState.photo
        })
      });
      closeModal(rateRichModal);
      toast("Thanks for your review!");
    } catch {
      toast("Could not submit");
    }
  });

  /* ============ RECEIPT DRAWER ============ */
  const receiptModal = $("receiptModal");
  $("viewReceiptBtn").addEventListener("click", () => {
    const d = T.lastData;
    if (!d) return;
    $("rcpRestImg").src = d.restaurant.image;
    $("rcpRestName").textContent = d.restaurant.name;
    $("rcpOrderId").textContent = `Order #${d.orderId}`;
    $("rcpItems").innerHTML = d.items
      .map((it) => `<li><span>${it.qty} × ${it.name}</span><span>₹${it.price * it.qty}</span></li>`)
      .join("");
    const subtotal = d.total;
    const gst = Math.round(subtotal * 0.05);
    const tip = d.tip || 0;
    const grand = subtotal + 29 + gst + tip;
    $("rcpSubtotal").textContent = `₹${subtotal}`;
    $("rcpGst").textContent = `₹${gst}`;
    $("rcpTip").textContent = `₹${tip}`;
    $("rcpGrand").textContent = `₹${grand}`;
    openModal(receiptModal);
  });
  $("rcpCloseBtn").addEventListener("click", () => closeModal(receiptModal));

  /* ============ SCRATCH CARD ============ */
  const scratchModal = $("scratchModal");
  const scratchCanvas = $("scratchCanvas");
  const scratchCloseBtn = $("scratchCloseBtn");

  function setupScratch() {
    const stage = scratchCanvas.parentElement;
    const rect = stage.getBoundingClientRect();
    const w = rect.width || 300;
    const h = rect.height || 180;
    scratchCanvas.width = w * window.devicePixelRatio;
    scratchCanvas.height = h * window.devicePixelRatio;
    scratchCanvas.style.width = `${w}px`;
    scratchCanvas.style.height = `${h}px`;
    const g = scratchCanvas.getContext("2d");
    g.scale(window.devicePixelRatio, window.devicePixelRatio);
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#d4a535");
    grad.addColorStop(0.5, "#f7d971");
    grad.addColorStop(1, "#b68416");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.font = "bold 18px system-ui";
    g.textAlign = "center";
    g.fillText("SCRATCH HERE", w / 2, h / 2 + 6);

    let isDown = false;
    let revealed = 0;
    let revealHit = false;
    const pos = (e) => {
      const r = scratchCanvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      return { x, y };
    };
    const scratch = (e) => {
      if (!isDown) return;
      const { x, y } = pos(e);
      g.globalCompositeOperation = "destination-out";
      g.beginPath();
      g.arc(x, y, 26, 0, Math.PI * 2);
      g.fill();
      if (!revealHit) {
        revealed += 1;
        if (revealed > 14) {
          revealHit = true;
          try { navigator.vibrate && navigator.vibrate(25); } catch {}
          setTimeout(() => {
            g.clearRect(0, 0, w, h);
            stage.classList.add("revealed");
          }, 450);
        }
      }
    };
    const start = (e) => { e.preventDefault(); isDown = true; scratch(e); };
    const end = () => { isDown = false; };
    scratchCanvas.addEventListener("mousedown", start);
    scratchCanvas.addEventListener("mousemove", scratch);
    scratchCanvas.addEventListener("mouseup", end);
    scratchCanvas.addEventListener("mouseleave", end);
    scratchCanvas.addEventListener("touchstart", start, { passive: false });
    scratchCanvas.addEventListener("touchmove", scratch, { passive: false });
    scratchCanvas.addEventListener("touchend", end);
  }

  function pickCoupon(cuisine) {
    const set = [
      { code: "FLAT40", title: "FLAT 40% OFF", emoji: "🎉" },
      { code: "EXTRA20", title: "Extra ₹120 OFF", emoji: "💸" },
      { code: "YUMPRO", title: "Free Zomato Pro", emoji: "👑" },
      { code: "SWEET15", title: "15% off desserts", emoji: "🍰" },
      { code: "PIZZAHUB", title: "Buy1Get1 on Pizza", emoji: "🍕" }
    ];
    return set[Math.floor(Math.random() * set.length)];
  }
  function openScratch(data) {
    if (publicMode) return;
    const coupon = pickCoupon(data.restaurant.cuisine || "");
    $("scratchCode").textContent = coupon.code;
    document.querySelector("#scratchReward .sr-title").textContent = coupon.title;
    document.querySelector("#scratchReward .sr-emoji").textContent = coupon.emoji;
    document.querySelector("#scratchModal .scratch-stage").classList.remove("revealed");
    openModal(scratchModal);
    // Wait for modal slide-up before measuring canvas
    setTimeout(setupScratch, 320);
  }
  scratchCloseBtn.addEventListener("click", () => closeModal(scratchModal));

  /* ============ STORY RECAP ============ */
  const storyWrap = $("storyWrap");
  const storySlide = $("storySlide");
  const storyBars = $("storyBars");
  const storyClose = $("storyClose");
  const storyPrev = $("storyPrev");
  const storyNext = $("storyNext");
  let storyIndex = 0;
  let storySlides = [];
  let storyTimer = null;

  function buildStorySlides(data) {
    const ordered = new Date(data.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const deliveredAt = (() => {
      const e = (data.events || []).find((x) => x.type === "delivered");
      return e ? new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "now";
    })();
    const totalKm = data.totalKm ? data.totalKm.toFixed(1) : "-";
    const minutes = data.etaMinutes != null ? "" : "";
    const slides = [
      {
        bg: `linear-gradient(135deg, #e23744, #7c2d12)`,
        title: "Your order story",
        body: `${data.restaurant.name}`,
        image: data.restaurant.image,
        duration: 3200
      },
      {
        bg: `linear-gradient(135deg, #f97316, #b91c1c)`,
        title: "Ordered at",
        body: ordered,
        big: data.items.map((i) => `${i.qty} × ${i.name}`).join(" · "),
        duration: 3500
      },
      {
        bg: `linear-gradient(135deg, #0ea5e9, #1e3a8a)`,
        title: "Your rider",
        body: data.rider?.name || "Delivery partner",
        image: data.rider?.photo,
        meta: data.rider?.vehicle || "",
        duration: 3400
      },
      {
        bg: `linear-gradient(135deg, #16a34a, #065f46)`,
        title: "Covered for you",
        body: `${totalKm} km`,
        meta: "Through real roads, just for your meal",
        duration: 3000
      },
      {
        bg: `linear-gradient(135deg, #facc15, #b45309)`,
        title: "Delivered at",
        body: deliveredAt,
        big: "Enjoy every bite 🍽",
        duration: 3500
      }
    ];
    return slides;
  }
  function renderStoryBars() {
    storyBars.innerHTML = storySlides
      .map((_, i) => `<div class="sb ${i < storyIndex ? "done" : i === storyIndex ? "active" : ""}"><div class="sb-fill"></div></div>`)
      .join("");
  }
  function renderSlide() {
    const s = storySlides[storyIndex];
    if (!s) return closeStory();
    storySlide.style.background = s.bg;
    storySlide.innerHTML = `
      ${s.image ? `<img class="ss-img" src="${s.image}"/>` : ""}
      <div class="ss-title">${s.title}</div>
      <div class="ss-body">${s.body || ""}</div>
      ${s.big ? `<div class="ss-big">${s.big}</div>` : ""}
      ${s.meta ? `<div class="ss-meta">${s.meta}</div>` : ""}
    `;
    renderStoryBars();
    const activeBar = storyBars.querySelector(".sb.active .sb-fill");
    if (activeBar) {
      activeBar.style.transition = "none";
      activeBar.style.width = "0%";
      requestAnimationFrame(() => {
        activeBar.style.transition = `width ${s.duration}ms linear`;
        activeBar.style.width = "100%";
      });
    }
    clearTimeout(storyTimer);
    storyTimer = setTimeout(nextSlide, s.duration);
  }
  function nextSlide() {
    storyIndex++;
    if (storyIndex >= storySlides.length) {
      closeStory();
      return;
    }
    renderSlide();
  }
  function prevSlide() {
    storyIndex = Math.max(0, storyIndex - 1);
    renderSlide();
  }
  function playStory(data) {
    if (publicMode) return;
    storySlides = buildStorySlides(data);
    storyIndex = 0;
    storyWrap.hidden = false;
    storyWrap.setAttribute("aria-hidden", "false");
    document.body.classList.add("story-on");
    renderSlide();
  }
  function closeStory() {
    storyWrap.hidden = true;
    storyWrap.setAttribute("aria-hidden", "true");
    document.body.classList.remove("story-on");
    clearTimeout(storyTimer);
  }
  storyClose.addEventListener("click", closeStory);
  storyPrev.addEventListener("click", prevSlide);
  storyNext.addEventListener("click", nextSlide);

  /* ============ EXPORT ============ */
  window.TrackExtras = {
    startCall,
    openChat,
    openRichRate,
    openScratch,
    playStory
  };

  // After first render of rider, ask for notifications (once per session)
  let askedNotify = false;
  socket.on("tracking-update", (data) => {
    if (publicMode || askedNotify) return;
    if (data.rider && "Notification" in window && Notification.permission === "default") {
      askedNotify = true;
      setTimeout(() => {
        try { Notification.requestPermission(); } catch {}
      }, 2200);
    }
  });
})();
