const socket = io();

const riderSelect = document.getElementById("riderSelect");
const connStatus = document.getElementById("riderConnStatus");
const ordersGrid = document.getElementById("ordersGrid");
const activeGrid = document.getElementById("activeGrid");
const toast = document.getElementById("toast");

const STATUS_LABELS = {
  placed: "New",
  accepted: "Heading to restaurant",
  picked_up: "On the way",
  delivered: "Delivered"
};

const QUICK_MSGS = [
  "On my way!",
  "Reached the restaurant",
  "Picked up the food",
  "Arriving in 2 minutes",
  "I'm at your gate",
  "Please share OTP"
];

const RIDER_BROADCASTS = [
  "Heavy traffic · adding 3–5 min",
  "Heavy rain — may take longer",
  "I'm at the gate, please come down"
];

let currentRiderId = null;
let knownOrders = new Map();
let chatPolling = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  toast.classList.add("visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => (toast.hidden = true), 300);
  }, 2500);
}

async function loadRiders() {
  const res = await fetch("/api/riders");
  const data = await res.json();
  riderSelect.innerHTML = data.riders
    .map((r) => `<option value="${r.id}">${r.name} · ${r.vehicle}</option>`)
    .join("");
  currentRiderId = data.riders[0].id;
  socket.emit("join-rider", { riderId: currentRiderId });
}

function setStatus(text, live) {
  connStatus.textContent = text;
  connStatus.classList.remove("z-rider-pill--live", "z-rider-pill--off", "z-rider-pill--wait");
  if (live) connStatus.classList.add("z-rider-pill--live");
  else if (String(text).toLowerCase().includes("reconnect")) connStatus.classList.add("z-rider-pill--wait");
  else connStatus.classList.add("z-rider-pill--off");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderOrders(orders) {
  orders.forEach((o) => knownOrders.set(o.id, o));
  const available = orders.filter((o) => o.status === "placed");
  const active = orders.filter(
    (o) => (o.status === "accepted" || o.status === "picked_up") && o.rider?.id === currentRiderId
  );

  ordersGrid.innerHTML = available.length
    ? available.map(renderOrderCard).join("")
    : '<div class="z-rider-empty">No new orders right now. We’ll notify you.</div>';

  activeGrid.innerHTML = active.length
    ? active.map(renderActiveCard).join("")
    : '<div class="z-rider-empty">No active trip on this account.</div>';

  ordersGrid.querySelectorAll("button[data-accept]").forEach((btn) =>
    btn.addEventListener("click", () => acceptOrder(btn.dataset.accept))
  );
  activeGrid.querySelectorAll("button[data-quick]").forEach((btn) =>
    btn.addEventListener("click", () => sendQuick(btn.dataset.order, btn.dataset.quick))
  );
  activeGrid.querySelectorAll("button[data-broadcast]").forEach((btn) =>
    btn.addEventListener("click", () => sendBroadcast(btn.dataset.order, btn.dataset.broadcast))
  );
  activeGrid.querySelectorAll("form[data-chat-form]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      const orderId = form.dataset.chatForm;
      if (input.value.trim()) {
        sendChat(orderId, input.value.trim());
        input.value = "";
      }
    });
  });
}

function serviceChip(order) {
  const emoji = order.serviceEmoji || "🍔";
  const brand = order.serviceBrand || "Food";
  const color = order.serviceColor || "#e23744";
  return `<span class="rider-service-chip" style="background:${color}15;color:${color};border:1px solid ${color}40">${emoji} ${brand}</span>`;
}

function routeText(order) {
  const from = order.pickup?.address || order.restaurant?.name || "Pickup";
  const to = order.drop?.address || order.customer?.address || "Drop";
  return `${from} → ${to}`;
}

function vehicleLine(order) {
  if (!order.vehicleDetails) return "";
  const v = order.vehicleDetails;
  if (order.serviceType === "cab") {
    return `<div class="items-text">🚕 ${v.name} · ${order.fare?.km || "—"} km · ~${order.fare?.min || "—"} min</div>`;
  }
  if (order.serviceType === "parcel") {
    return `<div class="items-text">${v.emoji} ${v.name} · ${order.packageInfo?.typeLabel || "Parcel"}${order.packageInfo?.note ? " · " + escapeHtml(order.packageInfo.note) : ""}</div>`;
  }
  return "";
}

function renderOrderCard(order) {
  const itemList = order.items.map((it) => `${it.qty} × ${it.name}`).join(", ");
  const isTransport = order.serviceType === "cab" || order.serviceType === "parcel";
  return `
    <div class="order-card z-rider-tile">
      <div class="order-card-head">
        <strong>${order.id}</strong>
        ${serviceChip(order)}
        <span class="badge status-${order.status}">${STATUS_LABELS[order.status]}</span>
      </div>
      <div class="route-text">${routeText(order)}</div>
      ${isTransport ? vehicleLine(order) : `<div class="items-text">${itemList}</div>`}
      <div class="route-text"><strong>₹${order.total}</strong> · ${order.customer.name} · ${order.customer.phone}</div>
      <div class="order-card-actions">
        <button class="btn btn-primary" data-accept="${order.id}">Accept ${order.serviceType === "cab" ? "ride" : order.serviceType === "parcel" ? "parcel" : "order"}</button>
      </div>
    </div>
  `;
}

function renderActiveCard(order) {
  const itemList = order.items.map((it) => `${it.qty} × ${it.name}`).join(", ");
  const isTransport = order.serviceType === "cab" || order.serviceType === "parcel";
  const noteHtml = order.customerNote
    ? `<div class="rider-note-pin"><span>📌</span><strong>Customer note</strong><p>${escapeHtml(order.customerNote.text)}</p></div>`
    : "";
  const chatList = (order.chat || [])
    .slice(-8)
    .map((m) => `<div class="rider-chat-msg ${m.from}"><span>${escapeHtml(m.text)}</span><em>${new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</em></div>`)
    .join("");
  return `
    <div class="order-card order-card-active z-rider-tile z-rider-tile--active" data-order="${order.id}">
      <div class="order-card-head">
        <strong>${order.id}</strong>
        ${serviceChip(order)}
        <span class="badge status-${order.status}">${STATUS_LABELS[order.status]}</span>
        <span class="rider-otp-badge">OTP ${order.otp}</span>
      </div>
      <div class="route-text">${routeText(order)}</div>
      ${isTransport ? vehicleLine(order) : `<div class="items-text">${itemList}</div>`}
      ${noteHtml}
      <div class="rider-broadcast-row">
        <span class="tiny muted">Broadcast to customer:</span>
        ${RIDER_BROADCASTS.map((m) => `<button class="chip" data-order="${order.id}" data-broadcast="${escapeHtml(m)}">${m}</button>`).join("")}
      </div>
      <div class="rider-chat">
        <strong class="tiny muted">Chat with customer</strong>
        <div class="rider-chat-body">${chatList || '<div class="tiny muted">No messages yet</div>'}</div>
        <div class="rider-chat-quicks">
          ${QUICK_MSGS.map((q) => `<button class="chip" data-order="${order.id}" data-quick="${escapeHtml(q)}">${q}</button>`).join("")}
        </div>
        <form data-chat-form="${order.id}" class="rider-chat-form">
          <input autocomplete="off" maxlength="400" placeholder="Type a message..."/>
          <button class="btn btn-primary" type="submit">Send</button>
        </form>
      </div>
      <div class="order-card-actions">
        <a class="btn btn-ghost" href="/track.html?orderId=${order.id}" target="_blank">View tracking</a>
      </div>
    </div>
  `;
}

async function acceptOrder(orderId) {
  try {
    const res = await fetch(`/api/rider/${orderId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riderId: currentRiderId })
    });
    if (!res.ok) throw new Error();
    showToast(`Order ${orderId} accepted`);
  } catch {
    showToast("Could not accept order");
  }
}

async function sendChat(orderId, text) {
  try {
    await fetch(`/api/orders/${orderId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, from: "rider" })
    });
    showToast("Message sent");
  } catch {
    showToast("Could not send message");
  }
}

async function sendQuick(orderId, text) {
  await sendChat(orderId, text);
}

async function sendBroadcast(orderId, text) {
  try {
    await fetch(`/api/orders/${orderId}/rider-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    showToast("Broadcast sent to customer");
  } catch {
    showToast("Could not broadcast");
  }
}

riderSelect.addEventListener("change", () => {
  currentRiderId = riderSelect.value;
  socket.emit("join-rider", { riderId: currentRiderId });
});

socket.on("connect", () => {
  setStatus("Online", true);
  socket.emit("join-riders");
  if (currentRiderId) socket.emit("join-rider", { riderId: currentRiderId });
});
socket.on("disconnect", () => setStatus("Reconnecting...", false));
socket.on("rider-orders", renderOrders);
socket.on("new-order", () => showToast("🛵 New order!"));
socket.on("chat-message", (msg) => {
  if (msg.orderId) showToast(`Customer: ${msg.text}`);
  refresh();
});
socket.on("rider-order-update", (order) => {
  knownOrders.set(order.id, order);
  // Trigger a full refresh so active card updates with latest chat/note
  refresh();
});

async function refresh() {
  try {
    const res = await fetch("/api/rider/orders");
    const data = await res.json();
    renderOrders(data.orders);
  } catch {}
}

loadRiders().then(refresh);
// Periodic refresh so rider sees customer note updates even if socket missed
setInterval(refresh, 6000);
