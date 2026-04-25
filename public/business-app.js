(async function () {
  const user = await Auth.requireRole("business_owner");
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
  document.getElementById("logoutBtn").onclick = async () => { await Auth.logout(); window.location.href = "/login.html"; };

  function fmtINR(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN"); }
  function fmtDate(s) { return s ? new Date(s).toLocaleString("en-IN") : "—"; }
  function badge(text, kind) { return `<span class="rp-status rp-status-${kind || "pending"}">${text}</span>`; }

  let myBusinesses = [];
  let activeBizId = localStorage.getItem("activeBizId") || "";

  async function refreshBusinesses() {
    const data = await Auth.api("/api/business/businesses");
    myBusinesses = data.businesses;
    if (!activeBizId || !myBusinesses.find((b) => b.id === activeBizId)) {
      activeBizId = myBusinesses[0]?.id || "";
      if (activeBizId) localStorage.setItem("activeBizId", activeBizId);
    }
    const active = myBusinesses.find((b) => b.id === activeBizId);
    document.getElementById("bizName").textContent = active ? active.name : "Set up your first business";
  }

  const routes = { dash, stores, menu, orders, earnings, promos, reviews, profile };
  async function navigate() {
    const hash = (location.hash || "#dash").slice(1);
    document.querySelectorAll("#navTabs a").forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + hash));
    page.innerHTML = `<div class="rp-empty">Loading…</div>`;
    await refreshBusinesses();
    try { await (routes[hash] || dash)(); } catch (e) { page.innerHTML = `<div class="rp-card"><div class="rp-empty">${e.message}</div></div>`; }
  }
  window.addEventListener("hashchange", navigate);
  navigate();

  if (user.status !== "active") {
    page.innerHTML = `<div class="rp-card"><div class="rp-empty">Your account is <strong>${user.status}</strong>. The platform admin will review and approve your account shortly.</div></div>`;
    return;
  }

  /* ===== Dashboard ===== */
  async function dash() {
    if (!myBusinesses.length) {
      page.innerHTML = `<div class="rp-page-title"><h1>Welcome, ${user.name}</h1><div class="rp-sub">Let's set up your first business</div></div>
        <div class="rp-card">
          <div class="rp-empty" style="padding-top:18px">You haven't added a business yet.</div>
          <div style="text-align:center"><a class="rp-btn rp-btn-primary" href="#stores">+ Add my first business</a></div>
        </div>`;
      return;
    }
    let earnings = { grossRevenue: 0, netRevenue: 0, pendingBalance: 0, orderCount: 0 };
    try { earnings = await Auth.api("/api/business/earnings"); } catch {}
    const orders = await Auth.api("/api/business/orders");
    const recent = orders.orders.slice(0, 6);

    page.innerHTML = `
      <div class="rp-page-title"><h1>Dashboard</h1>
        <select class="rp-select" id="bizPicker" style="max-width:250px">
          ${myBusinesses.map((b) => `<option value="${b.id}" ${b.id === activeBizId ? "selected" : ""}>${b.name}</option>`).join("")}
        </select>
      </div>
      <div class="rp-stat-grid">
        ${stat("Total orders", earnings.orderCount)}
        ${stat("Gross revenue", fmtINR(earnings.grossRevenue))}
        ${stat("Net revenue", fmtINR(earnings.netRevenue))}
        ${stat("Pending payout", fmtINR(earnings.pendingBalance))}
      </div>
      <div class="rp-card">
        <div class="rp-card-title"><h2>Recent orders</h2><a href="#orders" class="rp-pill">All orders</a></div>
        ${recent.length ? recent.map(orderRow).join("") : `<div class="rp-empty">No orders yet.</div>`}
      </div>
    `;
    document.getElementById("bizPicker").onchange = (e) => {
      activeBizId = e.target.value;
      localStorage.setItem("activeBizId", activeBizId);
      navigate();
    };
  }
  function stat(label, value) {
    return `<div class="rp-stat"><div class="rp-stat-label">${label}</div><div class="rp-stat-value">${value}</div></div>`;
  }
  function orderRow(o) {
    return `<div class="rp-list-item">
      <div style="font-size:24px;text-align:center">${o.serviceType === "food" ? "🍽️" : o.serviceType === "grocery" ? "🛒" : "📦"}</div>
      <div>
        <div><strong>${o.id}</strong> · ${o.customerName || "—"}</div>
        <div class="rp-list-meta">${o.items?.map((i) => i.qty + "× " + i.name).join(", ") || ""} · ${fmtDate(o.createdAt)}</div>
      </div>
      <div style="text-align:right">
        <div><strong>${fmtINR(o.total)}</strong></div>
        ${badge(o.status, o.status)}
      </div>
    </div>`;
  }

  /* ===== Stores (businesses) ===== */
  async function stores() {
    page.innerHTML = `<div class="rp-page-title"><h1>My businesses</h1><button class="rp-btn rp-btn-primary" id="newBizBtn">+ Add business</button></div>
      <div id="bizGrid"></div>`;
    document.getElementById("newBizBtn").onclick = () => openBizModal();
    document.getElementById("bizGrid").innerHTML = !myBusinesses.length ? `<div class="rp-card"><div class="rp-empty">No businesses yet.</div></div>` :
      myBusinesses.map((b) => `
        <div class="rp-card" style="margin-bottom:12px">
          <div style="display:grid;grid-template-columns:120px 1fr auto;gap:14px;align-items:center">
            <img class="rp-list-thumb" style="width:120px;height:90px" src="${b.image}" />
            <div>
              <div style="display:flex;gap:8px;align-items:center"><strong>${b.name}</strong> ${badge(b.status, b.status)} ${b.isOpen ? badge("Open", "active") : badge("Closed", "warn")}</div>
              <div class="rp-list-meta">${b.serviceType} · ${b.address || "No address"}</div>
              <div class="rp-list-meta">Commission ${b.commissionPct}% · Rating ${b.rating || "—"}</div>
            </div>
            <div class="rp-list-actions">
              <button class="rp-btn" data-edit="${b.id}">Edit</button>
              <button class="rp-btn ${b.isOpen ? "rp-btn-warn" : "rp-btn-success"}" data-toggle="${b.id}">${b.isOpen ? "Close" : "Open"}</button>
            </div>
          </div>
        </div>`).join("");
    page.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openBizModal(myBusinesses.find((x) => x.id === b.dataset.edit)));
    page.querySelectorAll("[data-toggle]").forEach((b) => b.onclick = async () => {
      const biz = myBusinesses.find((x) => x.id === b.dataset.toggle);
      await Auth.api(`/api/business/businesses/${biz.id}`, { method: "PATCH", body: JSON.stringify({ isOpen: !biz.isOpen }) });
      showToast(biz.isOpen ? "Closed" : "Now open"); stores();
    });
  }
  function openBizModal(existing) {
    openModal(existing ? "Edit business" : "Add a business", `
      <div class="rp-form-row">
        <div class="rp-field"><label>Name</label><input class="rp-input" id="b_name" value="${existing?.name || ""}"/></div>
        <div class="rp-field"><label>Service type</label>
          <select class="rp-select" id="b_svc">
            ${["food","grocery","cab","parcel","shop"].map((s) => `<option value="${s}" ${existing?.serviceType === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Phone</label><input class="rp-input" id="b_phone" value="${existing?.phone || ""}"/></div>
        <div class="rp-field"><label>Image URL</label><input class="rp-input" id="b_img" value="${existing?.image || ""}"/></div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Address</label><input class="rp-input" id="b_addr" value="${existing?.address || ""}"/></div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Latitude</label><input class="rp-input" id="b_lat" type="number" step="0.0001" value="${existing?.lat ?? 19.076}"/></div>
        <div class="rp-field"><label>Longitude</label><input class="rp-input" id="b_lng" type="number" step="0.0001" value="${existing?.lng ?? 72.8777}"/></div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Tags / cuisines (comma)</label><input class="rp-input" id="b_cuisines" value="${(existing?.cuisines || []).join(",")}"/></div>
        <div class="rp-field"><label>Description</label><input class="rp-input" id="b_desc" value="${existing?.description || ""}"/></div>
      </div>
    `, async () => {
      const body = {
        name: b_name.value, serviceType: b_svc.value, phone: b_phone.value, image: b_img.value,
        address: b_addr.value, lat: Number(b_lat.value), lng: Number(b_lng.value),
        cuisines: b_cuisines.value.split(",").map((x) => x.trim()).filter(Boolean),
        description: b_desc.value
      };
      if (existing) await Auth.api(`/api/business/businesses/${existing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await Auth.api("/api/business/businesses", { method: "POST", body: JSON.stringify(body) });
      showToast(existing ? "Updated" : "Created — pending admin approval");
      stores();
    });
  }

  /* ===== Menu / catalog ===== */
  async function menu() {
    if (!activeBizId) { page.innerHTML = `<div class="rp-card"><div class="rp-empty">Add a business first.</div></div>`; return; }
    page.innerHTML = `<div class="rp-page-title"><h1>Menu / catalog</h1>
      <div class="rp-actions">
        <select class="rp-select" id="bizPicker" style="max-width:240px">
          ${myBusinesses.map((b) => `<option value="${b.id}" ${b.id === activeBizId ? "selected" : ""}>${b.name}</option>`).join("")}
        </select>
        <button class="rp-btn rp-btn-primary" id="newProdBtn">+ Add item</button>
      </div></div>
      <div id="prodList">Loading…</div>`;
    document.getElementById("bizPicker").onchange = (e) => { activeBizId = e.target.value; localStorage.setItem("activeBizId", activeBizId); menu(); };
    document.getElementById("newProdBtn").onclick = () => openProdModal();
    const data = await Auth.api(`/api/business/businesses/${activeBizId}/products`);
    document.getElementById("prodList").innerHTML = !data.products.length ? `<div class="rp-card"><div class="rp-empty">No items yet.</div></div>` :
      data.products.map((p) => `
        <div class="rp-list-item">
          <img class="rp-list-thumb" src="${p.image}" />
          <div>
            <div><strong>${p.name}</strong> ${p.vegetarian ? "🟢" : "🔴"} ${!p.available ? `<span class="rp-status rp-status-warn">Hidden</span>` : ""}</div>
            <div class="rp-list-meta">${p.category} · ${fmtINR(p.price)} · Stock ${p.stock}</div>
            <div class="rp-list-meta">${p.description || ""}</div>
          </div>
          <div class="rp-list-actions">
            <button class="rp-btn" data-pedit='${JSON.stringify(p)}'>Edit</button>
            <button class="rp-btn ${p.available ? "rp-btn-warn" : "rp-btn-success"}" data-pavail="${p.id}" data-cur="${p.available}">${p.available ? "Hide" : "Show"}</button>
            <button class="rp-btn rp-btn-danger" data-pdel="${p.id}">Delete</button>
          </div>
        </div>`).join("");
    page.querySelectorAll("[data-pedit]").forEach((b) => b.onclick = () => openProdModal(JSON.parse(b.dataset.pedit)));
    page.querySelectorAll("[data-pavail]").forEach((b) => b.onclick = async () => {
      await Auth.api("/api/business/products/" + b.dataset.pavail, { method: "PATCH", body: JSON.stringify({ available: b.dataset.cur === "false" }) });
      showToast("Updated"); menu();
    });
    page.querySelectorAll("[data-pdel]").forEach((b) => b.onclick = async () => {
      if (!confirm("Delete this item?")) return;
      await Auth.api("/api/business/products/" + b.dataset.pdel, { method: "DELETE" });
      showToast("Deleted"); menu();
    });
  }
  function openProdModal(existing) {
    openModal(existing ? "Edit item" : "Add item", `
      <div class="rp-form-row">
        <div class="rp-field"><label>Name</label><input class="rp-input" id="x_name" value="${existing?.name || ""}"/></div>
        <div class="rp-field"><label>Price ₹</label><input class="rp-input" id="x_price" type="number" value="${existing?.price ?? 0}"/></div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Category</label><input class="rp-input" id="x_cat" value="${existing?.category || "Mains"}"/></div>
        <div class="rp-field"><label>Stock</label><input class="rp-input" id="x_stock" type="number" value="${existing?.stock ?? 99}"/></div>
        <div class="rp-field"><label>Vegetarian</label>
          <select class="rp-select" id="x_veg"><option value="false" ${!existing?.vegetarian?"selected":""}>No</option><option value="true" ${existing?.vegetarian?"selected":""}>Yes</option></select>
        </div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Image URL</label><input class="rp-input" id="x_img" value="${existing?.image || ""}"/></div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Description</label><textarea class="rp-textarea" id="x_desc">${existing?.description || ""}</textarea></div>
      </div>
    `, async () => {
      const body = {
        name: x_name.value, price: Number(x_price.value), category: x_cat.value,
        stock: Number(x_stock.value), vegetarian: x_veg.value === "true",
        image: x_img.value, description: x_desc.value
      };
      if (existing) await Auth.api("/api/business/products/" + existing.id, { method: "PATCH", body: JSON.stringify(body) });
      else await Auth.api(`/api/business/businesses/${activeBizId}/products`, { method: "POST", body: JSON.stringify(body) });
      showToast(existing ? "Updated" : "Added"); menu();
    });
  }

  /* ===== Orders ===== */
  async function orders() {
    page.innerHTML = `<div class="rp-page-title"><h1>Incoming orders</h1></div><div id="ord">Loading…</div>`;
    const data = await Auth.api("/api/business/orders");
    document.getElementById("ord").innerHTML = !data.orders.length ? `<div class="rp-card"><div class="rp-empty">No orders yet.</div></div>` : data.orders.map(orderRow).join("");
  }

  /* ===== Earnings ===== */
  async function earnings() {
    const e = await Auth.api("/api/business/earnings");
    page.innerHTML = `<div class="rp-page-title"><h1>Earnings</h1></div>
      <div class="rp-stat-grid">
        ${stat("Gross revenue", fmtINR(e.grossRevenue))}
        ${stat("Net (after commission)", fmtINR(e.netRevenue))}
        ${stat("Paid out", fmtINR(e.paidOut))}
        ${stat("Pending balance", fmtINR(e.pendingBalance))}
      </div>
      <div class="rp-card">
        <div class="rp-card-title"><h2>Request payout</h2></div>
        <div class="rp-form-row">
          <div class="rp-field"><label>Business</label>
            <select class="rp-select" id="po_biz">${myBusinesses.map((b) => `<option value="${b.id}">${b.name}</option>`).join("")}</select>
          </div>
          <div class="rp-field"><label>Amount ₹</label><input class="rp-input" id="po_amt" type="number" value="${Math.max(0, e.pendingBalance)}"/></div>
        </div>
        <div style="margin-top:12px"><button class="rp-btn rp-btn-primary" id="poBtn">Request payout</button></div>
      </div>
      <div class="rp-card">
        <div class="rp-card-title"><h2>Payout history</h2></div>
        ${!e.payouts.length ? `<div class="rp-empty">No payouts yet.</div>` :
          `<div class="rp-table-wrap"><table class="rp-table"><thead><tr><th>When</th><th>Amount</th><th>Status</th></tr></thead><tbody>${e.payouts.map((p) => `
            <tr><td>${fmtDate(p.requestedAt)}</td><td>${fmtINR(p.amount)}</td><td>${badge(p.status, p.status)}</td></tr>`).join("")}</tbody></table></div>`}
      </div>`;
    document.getElementById("poBtn").onclick = async () => {
      try {
        await Auth.api("/api/business/payouts/request", { method: "POST", body: JSON.stringify({ businessId: po_biz.value, amount: Number(po_amt.value) }) });
        showToast("Payout requested"); earnings();
      } catch (e) { showToast(e.message); }
    };
  }

  /* ===== Promos ===== */
  async function promos() {
    page.innerHTML = `<div class="rp-page-title"><h1>Offers & coupons</h1>
      <button class="rp-btn rp-btn-primary" id="newPro">+ New offer</button></div>
      <div id="prList">Loading…</div>`;
    document.getElementById("newPro").onclick = () => openModal("New offer", `
      <div class="rp-form-row">
        <div class="rp-field"><label>Business</label><select class="rp-select" id="o_biz">${myBusinesses.map((b) => `<option value="${b.id}">${b.name}</option>`).join("")}</select></div>
        <div class="rp-field"><label>Code</label><input class="rp-input" id="o_code" value="HOT10"/></div>
      </div>
      <div class="rp-form-row" style="margin-top:10px">
        <div class="rp-field"><label>Type</label><select class="rp-select" id="o_type"><option value="pct">Percent</option><option value="flat">Flat</option></select></div>
        <div class="rp-field"><label>Value</label><input class="rp-input" id="o_val" type="number" value="10"/></div>
        <div class="rp-field"><label>Min order ₹</label><input class="rp-input" id="o_min" type="number" value="200"/></div>
      </div>
    `, async () => {
      await Auth.api("/api/business/promotions", { method: "POST", body: JSON.stringify({
        businessId: o_biz.value, code: o_code.value, discountType: o_type.value, value: Number(o_val.value), minOrder: Number(o_min.value)
      })});
      showToast("Offer created"); promos();
    });
    const data = await Auth.api("/api/business/promotions");
    document.getElementById("prList").innerHTML = !data.promotions.length ? `<div class="rp-card"><div class="rp-empty">No offers yet.</div></div>` :
      `<div class="rp-card"><div class="rp-table-wrap"><table class="rp-table"><thead><tr><th>Code</th><th>Discount</th><th>Used</th><th>Min order</th></tr></thead><tbody>${data.promotions.map((p) => `
        <tr><td><strong>${p.code}</strong></td><td>${p.discountType === "pct" ? p.value + "%" : fmtINR(p.value)}</td><td>${p.usedCount}/${p.usageLimit || "∞"}</td><td>${fmtINR(p.minOrder)}</td></tr>`).join("")}</tbody></table></div></div>`;
  }

  /* ===== Reviews ===== */
  async function reviews() {
    page.innerHTML = `<div class="rp-page-title"><h1>Reviews</h1></div><div id="rvList">Loading…</div>`;
    const data = await Auth.api("/api/business/reviews");
    document.getElementById("rvList").innerHTML = !data.reviews.length ? `<div class="rp-card"><div class="rp-empty">No reviews yet.</div></div>` :
      data.reviews.map((r) => `
        <div class="rp-card" style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong>${"★".repeat(Math.round(r.ratings.overall || r.ratings.food || 4))}</strong> · Order ${r.orderId}</div>
            <div class="rp-list-meta">${fmtDate(r.createdAt)}</div>
          </div>
          <div style="margin-top:6px">${r.comment || "—"}</div>
          ${r.ownerResponse ? `<div style="background:#f1f3f9;padding:8px 10px;border-radius:8px;font-size:13px;margin-top:8px"><strong>Your reply:</strong> ${r.ownerResponse.body}</div>` : `
            <div style="margin-top:8px;display:flex;gap:8px"><input class="rp-input" placeholder="Reply..." data-rvmsg="${r.id}"/><button class="rp-btn rp-btn-primary" data-rvreply="${r.id}">Send</button></div>`}
        </div>`).join("");
    page.querySelectorAll("[data-rvreply]").forEach((b) => b.onclick = async () => {
      const id = b.dataset.rvreply;
      const msg = page.querySelector(`[data-rvmsg="${id}"]`).value;
      await Auth.api(`/api/business/reviews/${id}/respond`, { method: "POST", body: JSON.stringify({ message: msg }) });
      showToast("Reply sent"); reviews();
    });
  }

  /* ===== Profile ===== */
  async function profile() {
    page.innerHTML = `<div class="rp-page-title"><h1>Profile</h1></div>
    <div class="rp-card"><div class="rp-form-row">
      <div class="rp-field"><label>Name</label><input class="rp-input" id="pf_name" value="${user.name || ""}"/></div>
      <div class="rp-field"><label>Phone</label><input class="rp-input" id="pf_phone" value="${user.phone || ""}"/></div>
    </div>
    <div class="rp-form-row" style="margin-top:10px">
      <div class="rp-field"><label>New password</label><input class="rp-input" id="pf_pw" type="password" placeholder="Leave blank to keep current"/></div>
    </div>
    <div style="margin-top:14px"><button class="rp-btn rp-btn-primary" id="pfSave">Save</button></div></div>`;
    document.getElementById("pfSave").onclick = async () => {
      const body = { name: pf_name.value, phone: pf_phone.value };
      if (pf_pw.value) body.password = pf_pw.value;
      await Auth.api("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) });
      showToast("Profile saved");
    };
  }

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
      try { await onSave(); modal.classList.remove("is-open"); } catch (e) { showToast(e.message); }
    };
    modal.classList.add("is-open");
  }
})();
