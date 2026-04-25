(async function () {
  const user = await Auth.requireRole("delivery_partner");
  if (!user) return;
  document.getElementById("userName").textContent = user.name || user.email;
  document.getElementById("userAvatar").src = user.avatar || "";

  const page = document.getElementById("page");
  const onlinePill = document.getElementById("onlinePill");
  const toast = document.getElementById("toast");
  function showToast(msg) { toast.textContent = msg; toast.classList.add("is-on"); setTimeout(() => toast.classList.remove("is-on"), 2200); }
  document.getElementById("logoutBtn").onclick = async () => { await Auth.logout(); window.location.href = "/login.html"; };

  function fmtINR(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN"); }
  function fmtDate(s) { return s ? new Date(s).toLocaleString("en-IN") : "—"; }
  function badge(t, k) { return `<span class="rp-status rp-status-${k}">${t}</span>`; }

  let isOnline = false;
  let myLocation = null;
  const socket = io({ transports: ["websocket", "polling"] });
  socket.emit("join-riders");
  socket.emit("join-rider", { riderId: user.id });
  socket.on("rider-orders", (orders) => {
    const h = window.location.hash;
    if (h === "#available" || h === "" || h === "#dash") refreshAvailable(orders);
  });
  socket.on("new-order", () => showToast("📦 New order available"));
  socket.on("rider-order-update", () => { if (window.location.hash === "#trips") trips(); });

  async function loadStatus() {
    const data = await Auth.api("/api/partner/profile");
    isOnline = !!data.status?.isOnline;
    myLocation = data.status?.location || null;
    onlinePill.innerHTML = `<span class="rp-online-toggle ${isOnline ? "" : "is-off"}"><span class="rp-online-dot"></span>${isOnline ? "Online" : "Offline"}</span>`;
  }

  async function setOnline(next) {
    let coords = null;
    if (next && navigator.geolocation) {
      coords = await new Promise((r) => navigator.geolocation.getCurrentPosition((p) => r({ lat: p.coords.latitude, lng: p.coords.longitude }), () => r(null)));
    }
    const body = { isOnline: next };
    if (coords) { body.lat = coords.lat; body.lng = coords.lng; }
    await Auth.api("/api/partner/online", { method: "POST", body: JSON.stringify(body) });
    await loadStatus();
  }

  const routes = { dash, available, trips, earnings, profile };
  async function navigate() {
    const hash = (window.location.hash || "#dash").slice(1);
    document.querySelectorAll("#navTabs a").forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + hash));
    page.innerHTML = `<div class="rp-empty">Loading…</div>`;
    await loadStatus();
    try { await (routes[hash] || dash)(); } catch (e) { page.innerHTML = `<div class="rp-card"><div class="rp-empty">${e.message}</div></div>`; }
  }
  window.addEventListener("hashchange", navigate);
  navigate();

  if (user.status !== "active") {
    page.innerHTML = `<div class="rp-card"><div class="rp-empty">Your account is <strong>${user.status}</strong>. Wait for admin approval.</div></div>`;
    return;
  }

  function stat(label, value) { return `<div class="rp-stat"><div class="rp-stat-label">${label}</div><div class="rp-stat-value">${value}</div></div>`; }

  async function dash() {
    const e = await Auth.api("/api/partner/earnings");
    page.innerHTML = `
      <div class="rp-page-title"><h1>Today, ${user.name?.split(" ")[0] || "Partner"}</h1>
        <div class="rp-actions">
          <button class="rp-btn ${isOnline ? "rp-btn-warn" : "rp-btn-success"}" id="onlineBtn">${isOnline ? "Go offline" : "Go online"}</button>
        </div>
      </div>
      <div class="rp-stat-grid">
        ${stat("Today's earning", fmtINR(e.todayEarning))}
        ${stat("Today's trips", e.todayTrips)}
        ${stat("Pending balance", fmtINR(e.pendingBalance))}
        ${stat("Total trips", e.totalTrips)}
      </div>
      <div class="rp-card">
        <div class="rp-card-title"><h2>Available now</h2><a href="#available" class="rp-pill">All</a></div>
        <div id="availList">Loading…</div>
      </div>`;
    document.getElementById("onlineBtn").onclick = async () => { await setOnline(!isOnline); dash(); };
  }

  async function available() {
    page.innerHTML = `<div class="rp-page-title"><h1>Available orders</h1>
      <button class="rp-btn ${isOnline ? "rp-btn-warn" : "rp-btn-success"}" id="onlineBtn">${isOnline ? "Go offline" : "Go online"}</button></div>
      <div id="availList">Loading…</div>`;
    document.getElementById("onlineBtn").onclick = async () => { await setOnline(!isOnline); available(); };
    if (!isOnline) { document.getElementById("availList").innerHTML = `<div class="rp-card"><div class="rp-empty">You are offline. Go online to see new orders.</div></div>`; return; }
  }

  function refreshAvailable(orders) {
    const el = document.getElementById("availList");
    if (!el) return;
    if (!orders.length) { el.innerHTML = `<div class="rp-empty">No orders right now. Stay online — we'll ping you.</div>`; return; }
    el.innerHTML = orders.map((o) => {
      const src = o.pickup?.address || o.restaurant?.name;
      const dst = o.drop?.address || o.customer?.address;
      return `<div class="rp-list-item">
        <div style="font-size:30px;text-align:center">${o.serviceEmoji || "📦"}</div>
        <div>
          <div><strong>${o.id}</strong> ${badge(o.serviceBrand || o.serviceType, "pending")}</div>
          <div class="rp-list-meta">${src} → ${dst}</div>
          <div class="rp-list-meta">Pay-out ~${fmtINR(o.fare?.total || o.total || 0)} · ${o.items?.[0]?.name || ""}</div>
        </div>
        <div><button class="rp-btn rp-btn-primary" data-accept="${o.id}">Accept</button></div>
      </div>`;
    }).join("");
    el.querySelectorAll("[data-accept]").forEach((b) => b.onclick = async () => {
      try {
        await Auth.api(`/api/rider/${b.dataset.accept}/accept`, { method: "POST", body: JSON.stringify({}) });
        showToast("Accepted!"); window.location.hash = "#trips";
      } catch (e) { showToast(e.message); }
    });
  }

  async function trips() {
    const data = await Auth.api("/api/partner/trips");
    page.innerHTML = `<div class="rp-page-title"><h1>Trip history</h1></div>
      ${!data.trips.length ? `<div class="rp-card"><div class="rp-empty">No trips yet.</div></div>` : data.trips.map((t) => `
        <div class="rp-card" style="margin-bottom:10px">
          <div style="display:grid;grid-template-columns:50px 1fr auto;gap:10px;align-items:center">
            <div style="font-size:24px;text-align:center">${t.serviceType === "cab" ? "🚕" : t.serviceType === "parcel" ? "📦" : "🛍️"}</div>
            <div>
              <div><strong>${t.id}</strong> ${badge(t.status, t.status)}</div>
              <div class="rp-list-meta">${(t.pickup?.address || t.businessName || "—")} → ${(t.drop?.address || t.customerAddress || "—")}</div>
              <div class="rp-list-meta">${fmtDate(t.createdAt)}</div>
            </div>
            <div style="text-align:right"><div><strong>${fmtINR(t.partnerEarning)}</strong></div><a class="rp-pill" href="/track.html?id=${t.id}" target="_blank">Track</a></div>
          </div>
        </div>`).join("")}`;
  }

  async function earnings() {
    const e = await Auth.api("/api/partner/earnings");
    page.innerHTML = `<div class="rp-page-title"><h1>Earnings</h1></div>
      <div class="rp-stat-grid">
        ${stat("Today", fmtINR(e.todayEarning))}
        ${stat("Total earned", fmtINR(e.totalEarnings))}
        ${stat("Paid out", fmtINR(e.paidOut))}
        ${stat("Pending", fmtINR(e.pendingBalance))}
      </div>
      <div class="rp-card">
        <div class="rp-card-title"><h2>Request payout</h2></div>
        <div class="rp-form-row">
          <div class="rp-field"><label>Amount ₹</label><input class="rp-input" id="po_amt" type="number" value="${Math.max(0, e.pendingBalance)}"/></div>
        </div>
        <div style="margin-top:12px"><button class="rp-btn rp-btn-primary" id="poBtn">Request payout</button></div>
      </div>
      <div class="rp-card">
        <div class="rp-card-title"><h2>Payout history</h2></div>
        ${!e.payouts.length ? `<div class="rp-empty">No payouts yet.</div>` : `<div class="rp-table-wrap"><table class="rp-table"><thead><tr><th>When</th><th>Amount</th><th>Status</th></tr></thead><tbody>${e.payouts.map((p) => `
          <tr><td>${fmtDate(p.requestedAt)}</td><td>${fmtINR(p.amount)}</td><td>${badge(p.status, p.status)}</td></tr>`).join("")}</tbody></table></div>`}
      </div>`;
    document.getElementById("poBtn").onclick = async () => {
      try { await Auth.api("/api/partner/payouts/request", { method: "POST", body: JSON.stringify({ amount: Number(po_amt.value) }) }); showToast("Requested"); earnings(); }
      catch (e) { showToast(e.message); }
    };
  }

  async function profile() {
    page.innerHTML = `<div class="rp-page-title"><h1>My profile</h1></div>
      <div class="rp-card">
        <div class="rp-form-row">
          <div class="rp-field"><label>Name</label><input class="rp-input" id="pf_name" value="${user.name || ""}"/></div>
          <div class="rp-field"><label>Phone</label><input class="rp-input" id="pf_phone" value="${user.phone || ""}"/></div>
        </div>
        <div class="rp-form-row" style="margin-top:10px">
          <div class="rp-field"><label>Vehicle</label><input class="rp-input" id="pf_vehicle" value="${user.profile?.vehicle || ""}"/></div>
          <div class="rp-field"><label>License #</label><input class="rp-input" id="pf_lic" value="${user.profile?.license || ""}"/></div>
        </div>
        <div class="rp-form-row" style="margin-top:10px">
          <div class="rp-field"><label>New password</label><input class="rp-input" id="pf_pw" type="password" placeholder="Leave blank to keep current"/></div>
        </div>
        <div style="margin-top:14px"><button class="rp-btn rp-btn-primary" id="pfSave">Save</button></div>
      </div>`;
    document.getElementById("pfSave").onclick = async () => {
      const body = { name: pf_name.value, phone: pf_phone.value, profile: { vehicle: pf_vehicle.value, license: pf_lic.value } };
      if (pf_pw.value) body.password = pf_pw.value;
      await Auth.api("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) });
      showToast("Saved");
    };
  }
})();
