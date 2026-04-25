window.Auth = (function () {
  function tokenKey() { return "platform_session_token"; }
  function getToken() { return localStorage.getItem(tokenKey()) || ""; }
  function setToken(t) { if (t) localStorage.setItem(tokenKey(), t); else localStorage.removeItem(tokenKey()); }

  async function api(path, options = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    const t = getToken();
    if (t) headers.Authorization = "Bearer " + t;
    const res = await fetch(path, { ...options, headers, credentials: "include" });
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
    return data;
  }

  async function me() {
    try { return (await api("/api/auth/me")).user; } catch { return null; }
  }

  async function login(email, password) {
    const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    setToken(data.token);
    return data.user;
  }

  async function signup(payload) {
    const data = await api("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) });
    setToken(data.token);
    return data.user;
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); } catch {}
    setToken("");
  }

  function homeFor(role) {
    switch (role) {
      case "super_admin": return "/admin.html";
      case "business_owner": return "/business.html";
      case "delivery_partner": return "/partner.html";
      default: return "/";
    }
  }

  async function requireRole(role, opts = {}) {
    const user = await me();
    if (!user) {
      window.location.href = "/login.html?next=" + encodeURIComponent(window.location.pathname);
      return null;
    }
    if (role && user.role !== role) {
      if (!opts.silent) alert(`This page is for ${role.replace("_", " ")} accounts.`);
      window.location.href = homeFor(user.role);
      return null;
    }
    if (user.status !== "active" && user.role !== "customer" && user.role !== "super_admin") {
      if (!opts.silent) alert(`Your account is ${user.status}. Wait for admin approval.`);
    }
    return user;
  }

  return { api, me, login, signup, logout, homeFor, requireRole, getToken, setToken };
})();
