(async function () {
  const user = await Auth.requireRole("super_admin");
  if (!user) return;
  document.getElementById("userName").textContent = user.name || user.email;
  document.getElementById("userAvatar").src = user.avatar || "";

  const page = document.getElementById("page");
  const toast = document.getElementById("toast");
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("is-on");
    setTimeout(() => toast.classList.remove("is-on"), 2200);
  }
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await Auth.logout(); window.location.href = "/login.html";
  });

  function fmtINR(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN"); }
  function fmtDate(s) { return s ? new Date(s).toLocaleString("en-IN") : "—"; }

  function badge(text, kind) { return `<span class="rp-status rp-status-${kind || "pending"}">${text}</span>`; }

  const routes = {
    overview, owners, partners, customers, businesses, categories,
    orders, payouts, promos, disputes, settings, audit
  };

  async function navigate() {
    const hash = (location.hash || "#overview").slice(1);
    const handler = routes[hash] || overview;
    document.querySelectorAll("#navTabs a").forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("href") === "#" + hash);
    });
    page.innerHTML = `<div class="rp-empty">Loading…</div>`;
    try { await handler(); } catch (e) { page.innerHTML = `<div class="rp-card"><div class="rp-empty">${e.message}</div></div>`; }
  }
  window.addEventListener("hashchange", navigate);
  navigate();

  /* ===== Overview ===== */
  async function overview() {
    const data = await Auth.api("/api/admin/overview");
    const s = data.stats;
    page.innerHTML = `
      <div class="rp-page-title"><h1>Platform overview</h1><div class="rp-sub">Real-time performance across all services</div></div>
      <div class="rp-stat-grid">
        ${stat("Users", s.users)}
        ${stat("Customers", s.customers)}
        ${stat("Business owners", s.businessOwners)}
        ${stat("Delivery partners", s.deliveryPartners)}
        ${stat("Active businesses", s.activeBusinesses + " / " + s.businesses)}
        ${stat("Pending approvals", s.pendingApprovals)}
        ${stat("Total orders", s.totalOrders)}
        ${stat("Gross revenue", fmtINR(s.grossRevenue))}
        ${stat("Platform commission", fmtINR(s.platformCommission))}
        ${stat("Pending payouts", fmtINR(s.pendingPayouts))}
      </div>
      <div class="rp-card">
        <div class="rp-card-title"><h2>Recent orders</h2><a href="#orders" class="rp-pill">View all</a></div>
        <div id="recentOrders" class="rp-empty">Loading…</div>
      </div>
    `;
    const recent = await Auth.api("/api/admin/orders?limit=10");
    document.getElementById("recentOrders").outerHTML = orderTable(recent.orders);
  }
  function stat(label, value) {
    return `<div class="rp-stat"><div class="rp-stat-label">${label}</div><div class="rp-stat-value">${value}</div></div>`;
  }

  /* ===== Users (owners/partners/customers) ===== */
  async function userPage(role, title) {
    page.innerHTML = `
      <div class="rp-page-title">
        <div><h1>${title}</h1><div class="rp-sub">Manage and approve ${title.toLowerCase()}</div></div>
        <div class="rp-actions">
          <input class="rp-input" id="searchUsers" placeholder="Search…" style="max-width:220px" />
          <button class="rp-btn rp-btn-primary" id="newUserBtn">+ New ${title.slice(0,-1)}</button>
        </div>
      </div>
      <div class="rp-card"><div id="usersList">Loading…</div></div>
    `;
    document.getElementById("newUserBtn").onclick = () => openUserModal(role, title);
    document.getElementById("searchUsers").oninput = debounce(load, 250);

    async function load() {
      const q = document.getElementById("searchUsers").value;
      const data = await Auth.api(`/api/admin/users?role=${role}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      document.getElementById("usersList").innerHTML = usersTable(data.users, role);
      bindUserActions(role);
    }
    load();
  }
  function owners() { return userPage("business_owner", "Business owners"); }
  function partners() { return userPage("delivery_partner", "Delivery partners"); }
  function customers() { return userPage("customer", "Customers"); }

  function usersTable(users, role) {
    if (!users.length) return `<div class="rp-empty">No users yet.</div>`;
    return `<div class="rp-table-wrap"><table class="rp-table">
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Joined</th><th></th></tr></thead>
      <tbody>${users.map((u) => `
        <tr>
          <td><strong>${u.name || "—"}</strong></td>
          <td>${u.email}</td>
          <td>${u.phone || "—"}</td>
          <td>${badge(u.status, u.status)}</td>
          <td>${fmtDate(u.createdAt)}</td>
          <td>
            ${u.status === "pending" ? `<button class="rp-btn rp-btn-success" data-act="approve" data-id="${u.id}">Approve</button>
              <button class="rp-btn rp-btn-danger" data-act="reject" data-id="${u.id}">Reject</button>` :
              u.status === "active" ? `<button class="rp-btn rp-btn-warn" data-act="suspend" data-id="${u.id}">Suspend</button>` :
              `<button class="rp-btn rp-btn-success" data-act="activate" data-id="${u.id}">Reactivate</button>`}
            ${u.role !== "super_admin" ? `<button class="rp-btn rp-btn-ghost" data-act="delete" data-id="${u.id}">Delete</button>` : ""}
          </td>
        </tr>`).join("")}</tbody></table></div>`;
  }
  function bindUserActions(role) {
    page.querySelectorAll("[data-act]").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id; const act = btn.dataset.act;
        try {
          if (act === "delete") {
            if (!confirm("Permanently delete this user?")) return;
            await Auth.api("/api/admin/users/" + id, { method: "DELETE" });
          } else {
            const map = { approve: "active", reject: "rejected", suspend: "suspended", activate: "active" };
            await Auth.api("/api/admin/users/" + id, { method: "PATCH", body: JSON.stringify({ status: map[act] }) });
          }
          showToast("Done");
          userPage(role, role.replace("_", " ") + "s");
        } catch (e) { showToast(e.message); }
      };
    });
  }
  function openUserModal(role, title) {
    openModal(`Create ${title.slice(0,-1).toLowerCase()}`, `
      <div class="rp-form-row">
        <div class="rp-field"><label>Name</label><input class="rp-input" id="m_name" /></div>
        <div class="rp-field"><label>Email</label><input class="rp-input" id="m_email" type="email" /></div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Phone</label><input class="rp-input" id="m_phone" /></div>
        <div class="rp-field"><label>Temporary password</label><input class="rp-input" id="m_pw" type="text" value="${role}@123" /></div>
      </div>
    `, async () => {
      const body = {
        name: m_name.value.trim(), email: m_email.value.trim(),
        phone: m_phone.value.trim(), password: m_pw.value, role
      };
      await Auth.api("/api/admin/users", { method: "POST", body: JSON.stringify(body) });
      showToast("User created");
      userPage(role, title);
    });
  }

  /* ===== Businesses ===== */
  async function businesses() {
    page.innerHTML = `<div class="rp-page-title"><h1>Businesses</h1><div class="rp-sub">Approve and manage all businesses</div></div>
      <div class="rp-card"><div id="bizList">Loading…</div></div>`;
    const data = await Auth.api("/api/admin/businesses");
    if (!data.businesses.length) { document.getElementById("bizList").innerHTML = `<div class="rp-empty">No businesses yet.</div>`; return; }
    document.getElementById("bizList").innerHTML = `<div class="rp-table-wrap"><table class="rp-table">
      <thead><tr><th>Name</th><th>Service</th><th>Owner</th><th>Status</th><th>Commission</th><th>Rating</th><th></th></tr></thead>
      <tbody>${data.businesses.map((b) => `
        <tr>
          <td><strong>${b.name}</strong><div class="rp-list-meta">${b.address || ""}</div></td>
          <td>${b.serviceType}</td>
          <td>${b.ownerName || "—"}<div class="rp-list-meta">${b.ownerEmail || ""}</div></td>
          <td>${badge(b.status, b.status)}</td>
          <td>${b.commissionPct}%</td>
          <td>${b.rating || "—"}</td>
          <td>
            ${b.status !== "active" ? `<button class="rp-btn rp-btn-success" data-bact="active" data-id="${b.id}">Approve</button>` :
              `<button class="rp-btn rp-btn-warn" data-bact="suspended" data-id="${b.id}">Suspend</button>`}
            <button class="rp-btn" data-comm="${b.id}" data-cur="${b.commissionPct}">Set commission</button>
          </td>
        </tr>`).join("")}</tbody></table></div>`;
    page.querySelectorAll("[data-bact]").forEach((btn) => {
      btn.onclick = async () => {
        await Auth.api("/api/admin/businesses/" + btn.dataset.id, { method: "PATCH", body: JSON.stringify({ status: btn.dataset.bact }) });
        showToast("Business updated"); businesses();
      };
    });
    page.querySelectorAll("[data-comm]").forEach((btn) => {
      btn.onclick = async () => {
        const v = prompt("Commission %?", btn.dataset.cur);
        if (!v) return;
        await Auth.api("/api/admin/businesses/" + btn.dataset.comm, { method: "PATCH", body: JSON.stringify({ commissionPct: Number(v) }) });
        showToast("Commission updated"); businesses();
      };
    });
  }

  /* ===== Categories ===== */
  async function categories() {
    page.innerHTML = `
      <div class="rp-page-title">
        <div><h1>Service categories</h1><div class="rp-sub">Categories that business owners can pick when listing</div></div>
        <button class="rp-btn rp-btn-primary" id="newCatBtn">+ New category</button>
      </div>
      <div class="rp-card"><div id="catList">Loading…</div></div>`;
    document.getElementById("newCatBtn").onclick = () => openModal("New category", `
      <div class="rp-form-row">
        <div class="rp-field"><label>Name</label><input class="rp-input" id="c_name" placeholder="Pizza"/></div>
        <div class="rp-field"><label>Parent service</label>
          <select class="rp-select" id="c_parent">
            <option value="food">Food</option><option value="grocery">Grocery</option>
            <option value="cab">Cab</option><option value="parcel">Parcel</option><option value="shop">Shop</option>
          </select>
        </div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Icon (emoji)</label><input class="rp-input" id="c_icon" value="🍕"/></div>
      </div>
    `, async () => {
      await Auth.api("/api/admin/categories", { method: "POST", body: JSON.stringify({ name: c_name.value, parentService: c_parent.value, icon: c_icon.value }) });
      showToast("Category created"); categories();
    });
    const data = await Auth.api("/api/admin/categories");
    document.getElementById("catList").innerHTML = !data.categories.length ? `<div class="rp-empty">None yet.</div>` :
      `<div class="rp-table-wrap"><table class="rp-table"><thead><tr><th>Icon</th><th>Name</th><th>Service</th><th></th></tr></thead><tbody>${data.categories.map((c) => `
        <tr><td style="font-size:22px">${c.icon}</td><td>${c.name}</td><td>${c.parentService}</td>
          <td><button class="rp-btn rp-btn-danger" data-del="${c.id}">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
    page.querySelectorAll("[data-del]").forEach((btn) => btn.onclick = async () => {
      await Auth.api("/api/admin/categories/" + btn.dataset.del, { method: "DELETE" });
      showToast("Deleted"); categories();
    });
  }

  /* ===== Orders ===== */
  async function orders() {
    page.innerHTML = `<div class="rp-page-title"><h1>Orders</h1><div class="rp-sub">All orders across the platform</div></div>
      <div class="rp-card"><div id="ordList">Loading…</div></div>`;
    const data = await Auth.api("/api/admin/orders?limit=200");
    document.getElementById("ordList").innerHTML = orderTable(data.orders);
  }

  function orderTable(orders) {
    if (!orders.length) return `<div class="rp-empty">No orders yet.</div>`;
    return `<div class="rp-table-wrap"><table class="rp-table">
      <thead><tr><th>ID</th><th>Service</th><th>Business</th><th>Customer</th><th>Partner</th><th>Total</th><th>Commission</th><th>Status</th><th>When</th></tr></thead>
      <tbody>${orders.map((o) => `
        <tr><td><strong>${o.id}</strong></td><td>${o.serviceType}</td><td>${o.businessName || "—"}</td>
          <td>${o.customerName || "—"}</td><td>${o.partnerName || "—"}</td>
          <td>${fmtINR(o.total)}</td><td>${fmtINR(o.platformCommission)}</td>
          <td>${badge(o.status, o.status)}</td><td>${fmtDate(o.createdAt)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  /* ===== Payouts ===== */
  async function payouts() {
    page.innerHTML = `<div class="rp-page-title"><h1>Payouts</h1><div class="rp-sub">Process pending payouts</div></div>
      <div class="rp-card"><div id="poList">Loading…</div></div>`;
    const data = await Auth.api("/api/admin/payouts");
    if (!data.payouts.length) { document.getElementById("poList").innerHTML = `<div class="rp-empty">No payouts requested.</div>`; return; }
    document.getElementById("poList").innerHTML = `<div class="rp-table-wrap"><table class="rp-table">
      <thead><tr><th>ID</th><th>Type</th><th>Amount</th><th>Requested</th><th>Status</th><th></th></tr></thead>
      <tbody>${data.payouts.map((p) => `
        <tr><td>${p.id}</td><td>${p.businessId ? "Business" : "Partner"}</td><td>${fmtINR(p.amount)}</td>
          <td>${fmtDate(p.requestedAt)}</td><td>${badge(p.status, p.status)}</td>
          <td>${p.status === "pending" ? `<button class="rp-btn rp-btn-primary" data-pay="${p.id}">Process</button>` : "—"}</td></tr>`).join("")}</tbody></table></div>`;
    page.querySelectorAll("[data-pay]").forEach((b) => b.onclick = async () => {
      await Auth.api(`/api/admin/payouts/${b.dataset.pay}/process`, { method: "POST" });
      showToast("Payout processed"); payouts();
    });
  }

  /* ===== Promotions ===== */
  async function promos() {
    page.innerHTML = `<div class="rp-page-title">
      <div><h1>Promotions</h1><div class="rp-sub">Platform-wide coupons</div></div>
      <button class="rp-btn rp-btn-primary" id="newPromo">+ New promo</button>
    </div>
    <div class="rp-card"><div id="prList">Loading…</div></div>`;
    document.getElementById("newPromo").onclick = () => openModal("New promotion", `
      <div class="rp-form-row">
        <div class="rp-field"><label>Code</label><input class="rp-input" id="p_code" placeholder="WELCOME50"/></div>
        <div class="rp-field"><label>Type</label><select class="rp-select" id="p_type"><option value="pct">Percentage</option><option value="flat">Flat</option></select></div>
        <div class="rp-field"><label>Value</label><input class="rp-input" id="p_val" type="number"/></div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Min order ₹</label><input class="rp-input" id="p_min" type="number" value="0"/></div>
        <div class="rp-field"><label>Usage limit</label><input class="rp-input" id="p_limit" type="number"/></div>
        <div class="rp-field"><label>Valid until</label><input class="rp-input" id="p_to" type="date"/></div>
      </div>
    `, async () => {
      await Auth.api("/api/admin/promotions", { method: "POST", body: JSON.stringify({
        code: p_code.value, discountType: p_type.value, value: Number(p_val.value),
        minOrder: Number(p_min.value), usageLimit: Number(p_limit.value) || null,
        validTo: p_to.value ? new Date(p_to.value).toISOString() : null
      })});
      showToast("Promotion created"); promos();
    });
    const data = await Auth.api("/api/admin/promotions");
    document.getElementById("prList").innerHTML = !data.promotions.length ? `<div class="rp-empty">No promos yet.</div>` :
      `<div class="rp-table-wrap"><table class="rp-table"><thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Used</th><th>Until</th><th></th></tr></thead>
      <tbody>${data.promotions.map((p) => `<tr><td><strong>${p.code}</strong></td><td>${p.discountType}</td><td>${p.discountType==='pct'?p.value+'%':fmtINR(p.value)}</td>
        <td>${p.usedCount}/${p.usageLimit||'∞'}</td><td>${p.validTo?fmtDate(p.validTo):'—'}</td>
        <td><button class="rp-btn rp-btn-danger" data-prdel="${p.id}">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
    page.querySelectorAll("[data-prdel]").forEach((b) => b.onclick = async () => {
      await Auth.api("/api/admin/promotions/" + b.dataset.prdel, { method: "DELETE" });
      showToast("Deleted"); promos();
    });
  }

  /* ===== Disputes ===== */
  async function disputes() {
    page.innerHTML = `<div class="rp-page-title"><h1>Support tickets</h1><div class="rp-sub">Customer issues</div></div><div class="rp-card"><div id="tkList">Loading…</div></div>`;
    const data = await Auth.api("/api/admin/disputes");
    if (!data.tickets.length) { document.getElementById("tkList").innerHTML = `<div class="rp-empty">No tickets.</div>`; return; }
    document.getElementById("tkList").innerHTML = data.tickets.map((t) => `
      <div class="rp-card" style="margin-bottom:10px">
        <div class="rp-card-title"><h2>${t.subject}</h2>${badge(t.status, t.status)}</div>
        <div style="font-size:13px; color:var(--rp-text-soft)">Order: ${t.orderId || "—"} · Opened ${fmtDate(t.createdAt)}</div>
        <div style="margin-top:10px; display:grid; gap:6px">
          ${t.messages.map((m) => `<div style="background:${m.from==='admin'?'#dde7ff':'#fafbfd'};padding:8px 10px;border-radius:8px;font-size:13px"><strong>${m.from}:</strong> ${m.body}</div>`).join("")}
        </div>
        <div style="margin-top:10px; display:flex; gap:8px">
          <input class="rp-input" placeholder="Reply..." data-tkmsg="${t.id}" />
          <button class="rp-btn rp-btn-primary" data-tkreply="${t.id}">Send</button>
          ${t.status !== 'closed' ? `<button class="rp-btn rp-btn-warn" data-tkclose="${t.id}">Close ticket</button>` : ""}
        </div>
      </div>`).join("");
    page.querySelectorAll("[data-tkreply]").forEach((b) => b.onclick = async () => {
      const id = b.dataset.tkreply;
      const msg = page.querySelector(`[data-tkmsg="${id}"]`).value;
      if (!msg) return;
      await Auth.api(`/api/admin/disputes/${id}/respond`, { method: "POST", body: JSON.stringify({ message: msg }) });
      showToast("Reply sent"); disputes();
    });
    page.querySelectorAll("[data-tkclose]").forEach((b) => b.onclick = async () => {
      await Auth.api(`/api/admin/disputes/${b.dataset.tkclose}/respond`, { method: "POST", body: JSON.stringify({ status: "closed" }) });
      showToast("Closed"); disputes();
    });
  }

  /* ===== Settings ===== */
  async function settings() {
    const data = await Auth.api("/api/admin/overview");
    const s = data.settings;
    page.innerHTML = `<div class="rp-page-title"><h1>Platform settings</h1><div class="rp-sub">Commissions, fees, taxes</div></div>
    <div class="rp-card"><div class="rp-form-row">
      <div class="rp-field"><label>Commission %</label><input class="rp-input" id="s_comm" type="number" value="${s.platformCommissionPct}"/></div>
      <div class="rp-field"><label>Delivery fee base</label><input class="rp-input" id="s_fee" type="number" value="${s.deliveryFeeBase}"/></div>
      <div class="rp-field"><label>Tax %</label><input class="rp-input" id="s_tax" type="number" value="${s.taxPct}"/></div>
    </div>
    <div style="margin-top:14px"><button class="rp-btn rp-btn-primary" id="saveSet">Save</button></div></div>`;
    document.getElementById("saveSet").onclick = async () => {
      await Auth.api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({
        platformCommissionPct: Number(s_comm.value), deliveryFeeBase: Number(s_fee.value), taxPct: Number(s_tax.value)
      })});
      showToast("Settings saved");
    };
  }

  /* ===== Audit log ===== */
  async function audit() {
    page.innerHTML = `<div class="rp-page-title"><h1>Audit log</h1><div class="rp-sub">Last 200 actions</div></div><div class="rp-card"><div id="audList">Loading…</div></div>`;
    const data = await Auth.api("/api/admin/audit?limit=200");
    document.getElementById("audList").innerHTML = !data.logs.length ? `<div class="rp-empty">Empty.</div>` :
      `<div class="rp-table-wrap"><table class="rp-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead><tbody>${data.logs.map((l) => `
        <tr><td>${fmtDate(l.at)}</td><td>${l.actorName} <span class="rp-list-meta">(${l.actorRole})</span></td>
          <td>${l.action}</td><td>${l.entityType || ""} ${l.entityId || ""}</td></tr>`).join("")}</tbody></table></div>`;
  }

  /* ===== Modal helper ===== */
  function openModal(title, html, onSave) {
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
      try { await onSave(); modal.classList.remove("is-open"); }
      catch (e) { showToast(e.message); }
    };
    modal.classList.add("is-open");
  }
  function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), ms); }; }
})();
