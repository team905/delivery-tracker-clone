(async function () {
  const user = await Auth.requireRole("customer");
  if (!user) return;
  document.getElementById("userName").textContent = user.name || user.email;
  document.getElementById("userAvatar").src = user.avatar || "";

  const page = document.getElementById("page");
  const toast = document.getElementById("toast");
  function showToast(msg) { toast.textContent = msg; toast.classList.add("is-on"); setTimeout(() => toast.classList.remove("is-on"), 2200); }
  document.getElementById("logoutBtn").onclick = async () => { await Auth.logout(); window.location.href = "/login.html"; };

  function fmtINR(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN"); }
  function fmtDate(s) { return s ? new Date(s).toLocaleString("en-IN") : "—"; }
  function badge(t, k) { return `<span class="rp-status rp-status-${k}">${t}</span>`; }

  const routes = { profile, orders, addresses, wallet, notifications, support };
  async function navigate() {
    const hash = (window.location.hash || "#profile").slice(1);
    document.querySelectorAll("#navTabs a").forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + hash));
    page.innerHTML = `<div class="rp-empty">Loading…</div>`;
    try { await (routes[hash] || profile)(); } catch (e) { page.innerHTML = `<div class="rp-card"><div class="rp-empty">${e.message}</div></div>`; }
  }
  window.addEventListener("hashchange", navigate);
  navigate();

  async function profile() {
    page.innerHTML = `<div class="rp-page-title"><h1>Profile</h1><div class="rp-sub">Update your details</div></div>
      <div class="rp-card">
        <div class="rp-form-row">
          <div class="rp-field"><label>Name</label><input class="rp-input" id="pf_name" value="${user.name || ""}"/></div>
          <div class="rp-field"><label>Phone</label><input class="rp-input" id="pf_phone" value="${user.phone || ""}"/></div>
        </div>
        <div class="rp-form-row" style="margin-top:10px">
          <div class="rp-field"><label>Email</label><input class="rp-input" disabled value="${user.email}"/></div>
          <div class="rp-field"><label>New password</label><input class="rp-input" id="pf_pw" type="password" placeholder="Leave blank to keep current"/></div>
        </div>
        <div style="margin-top:14px"><button class="rp-btn rp-btn-primary" id="pfSave">Save</button></div>
      </div>`;
    document.getElementById("pfSave").onclick = async () => {
      const body = { name: pf_name.value, phone: pf_phone.value };
      if (pf_pw.value) body.password = pf_pw.value;
      await Auth.api("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) });
      showToast("Saved");
    };
  }

  async function orders() {
    const data = await Auth.api("/api/customer/orders");
    page.innerHTML = `<div class="rp-page-title"><h1>My orders</h1></div>
      ${!data.orders.length ? `<div class="rp-card"><div class="rp-empty">No orders yet. <a href="/">Start ordering →</a></div></div>` :
        data.orders.map((o) => `
          <div class="rp-card" style="margin-bottom:10px">
            <div style="display:grid;grid-template-columns:50px 1fr auto;gap:12px;align-items:center">
              <div style="font-size:24px;text-align:center">${o.serviceType === "food" ? "🍽️" : o.serviceType === "grocery" ? "🛒" : o.serviceType === "cab" ? "🚕" : o.serviceType === "parcel" ? "📦" : "🛍️"}</div>
              <div>
                <div><strong>${o.id}</strong> · ${o.businessName || o.serviceBrand || "Order"} ${badge(o.status, o.status)}</div>
                <div class="rp-list-meta">${o.items?.map((i) => i.qty + "× " + i.name).join(", ") || ""}</div>
                <div class="rp-list-meta">${fmtDate(o.createdAt)}</div>
              </div>
              <div style="text-align:right"><div><strong>${fmtINR(o.total)}</strong></div>
                <a class="rp-pill" href="/track.html?id=${o.id}">Track / re-order</a>
              </div>
            </div>
          </div>`).join("")}`;
  }

  async function addresses() {
    const data = await Auth.api("/api/customer/profile");
    page.innerHTML = `<div class="rp-page-title"><h1>Saved addresses</h1>
      <button class="rp-btn rp-btn-primary" id="newAddr">+ Add address</button></div>
      ${!data.addresses.length ? `<div class="rp-card"><div class="rp-empty">None yet.</div></div>` :
        data.addresses.map((a) => `
          <div class="rp-list-item">
            <div style="font-size:24px;text-align:center">📍</div>
            <div><div><strong>${a.label}</strong></div><div class="rp-list-meta">${a.line1}${a.line2 ? ", " + a.line2 : ""}</div></div>
            <div><button class="rp-btn rp-btn-danger" data-adel="${a.id}">Remove</button></div>
          </div>`).join("")}`;
    document.getElementById("newAddr").onclick = () => openModal("Add address", `
      <div class="rp-form-row">
        <div class="rp-field"><label>Label</label><input class="rp-input" id="a_label" value="Home"/></div>
        <div class="rp-field"><label>Line 1</label><input class="rp-input" id="a_line1"/></div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Line 2</label><input class="rp-input" id="a_line2"/></div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Latitude</label><input class="rp-input" id="a_lat" type="number" step="0.0001" value="19.076"/></div>
        <div class="rp-field"><label>Longitude</label><input class="rp-input" id="a_lng" type="number" step="0.0001" value="72.8777"/></div>
      </div>
      <div style="margin-top:10px"><button class="rp-btn" id="useGps">Use my location</button></div>
    `, async () => {
      await Auth.api("/api/customer/addresses", { method: "POST", body: JSON.stringify({
        label: a_label.value, line1: a_line1.value, line2: a_line2.value,
        lat: Number(a_lat.value), lng: Number(a_lng.value)
      })});
      showToast("Saved"); addresses();
    }, () => {
      document.getElementById("useGps").onclick = () => navigator.geolocation.getCurrentPosition((p) => {
        document.getElementById("a_lat").value = p.coords.latitude.toFixed(5);
        document.getElementById("a_lng").value = p.coords.longitude.toFixed(5);
      });
    });
    page.querySelectorAll("[data-adel]").forEach((b) => b.onclick = async () => {
      await Auth.api("/api/customer/addresses/" + b.dataset.adel, { method: "DELETE" });
      showToast("Removed"); addresses();
    });
  }

  async function wallet() {
    const data = await Auth.api("/api/customer/profile");
    page.innerHTML = `<div class="rp-page-title"><h1>Wallet</h1></div>
      <div class="rp-stat-grid">
        <div class="rp-stat"><div class="rp-stat-label">Wallet balance</div><div class="rp-stat-value">${fmtINR(data.wallet)}</div></div>
      </div>
      <div class="rp-card"><div class="rp-card-title"><h2>Transactions</h2></div>
        ${!data.walletTxns.length ? `<div class="rp-empty">No transactions yet.</div>` :
          `<div class="rp-table-wrap"><table class="rp-table"><thead><tr><th>When</th><th>Type</th><th>Amount</th></tr></thead><tbody>${data.walletTxns.map((t) => `
            <tr><td>${fmtDate(t.at)}</td><td>${t.type}</td><td>${fmtINR(t.amount)}</td></tr>`).join("")}</tbody></table></div>`}
      </div>`;
  }

  async function notifications() {
    const data = await Auth.api("/api/customer/notifications");
    page.innerHTML = `<div class="rp-page-title"><h1>Notifications</h1></div>
      ${!data.notifications.length ? `<div class="rp-card"><div class="rp-empty">All caught up.</div></div>` :
        data.notifications.map((n) => `
          <div class="rp-list-item" style="background:${n.read ? "#fff" : "#fff8e1"}">
            <div style="font-size:22px;text-align:center">🔔</div>
            <div><div><strong>${n.title}</strong></div><div class="rp-list-meta">${n.body}</div><div class="rp-list-meta">${fmtDate(n.createdAt)}</div></div>
            <div>${!n.read ? `<button class="rp-btn" data-nread="${n.id}">Mark read</button>` : ""}</div>
          </div>`).join("")}`;
    page.querySelectorAll("[data-nread]").forEach((b) => b.onclick = async () => { await Auth.api(`/api/customer/notifications/${b.dataset.nread}/read`, { method: "POST" }); notifications(); });
  }

  async function support() {
    const data = await Auth.api("/api/customer/support");
    page.innerHTML = `<div class="rp-page-title"><h1>Support</h1>
      <button class="rp-btn rp-btn-primary" id="newTk">+ New ticket</button></div>
      ${!data.tickets.length ? `<div class="rp-card"><div class="rp-empty">No tickets.</div></div>` :
        data.tickets.map((t) => `
          <div class="rp-card" style="margin-bottom:10px">
            <div class="rp-card-title"><h2>${t.subject}</h2>${badge(t.status, t.status)}</div>
            <div style="font-size:13px;color:var(--rp-text-soft)">Order: ${t.orderId || "—"} · Opened ${fmtDate(t.createdAt)}</div>
            <div style="margin-top:10px;display:grid;gap:6px">${t.messages.map((m) => `<div style="background:${m.from==='admin'?'#dde7ff':'#fafbfd'};padding:8px 10px;border-radius:8px;font-size:13px"><strong>${m.from}:</strong> ${m.body}</div>`).join("")}</div>
          </div>`).join("")}`;
    document.getElementById("newTk").onclick = () => openModal("New support ticket", `
      <div class="rp-form-row">
        <div class="rp-field"><label>Subject</label><input class="rp-input" id="t_sub" placeholder="What's the issue?"/></div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Order ID (optional)</label><input class="rp-input" id="t_oid"/></div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Message</label><textarea class="rp-textarea" id="t_msg"></textarea></div>
      </div>
    `, async () => {
      await Auth.api("/api/customer/support", { method: "POST", body: JSON.stringify({ subject: t_sub.value, message: t_msg.value, orderId: t_oid.value || null }) });
      showToast("Sent"); support();
    });
  }

  function openModal(title, html, onSave, onMount) {
    let modal = document.getElementById("rpModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "rpModal";
      modal.className = "rp-modal-back";
      modal.innerHTML = `<div class="rp-modal"><div class="rp-modal-title" id="rpModalTitle"></div><div id="rpModalBody"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
          <button class="rp-btn" id="rpModalCancel">Cancel</button>
          <button class="rp-btn rp-btn-primary" id="rpModalSave">Save</button>
        </div></div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("is-open"); });
      document.getElementById("rpModalCancel").onclick = () => modal.classList.remove("is-open");
    }
    document.getElementById("rpModalTitle").textContent = title;
    document.getElementById("rpModalBody").innerHTML = html;
    document.getElementById("rpModalSave").onclick = async () => {
      try { await onSave(); modal.classList.remove("is-open"); } catch (e) { showToast(e.message); }
    };
    modal.classList.add("is-open");
    if (onMount) onMount();
  }
})();
