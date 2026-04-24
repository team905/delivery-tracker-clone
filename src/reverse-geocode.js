const https = require("https");

const cache = new Map();
let lastRequestAt = 0;
let inFlight = new Set();

function gridKey(lat, lng) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function fetchJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "delivery-tracker-clone/1.0" } },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`status ${res.statusCode}`));
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
  });
}

async function throttled() {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function fetchName(lat, lng) {
  await throttled();
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
  const data = await fetchJson(url, 3500);
  const a = data.address || {};
  const name =
    a.suburb || a.neighbourhood || a.road || a.quarter || a.hamlet || a.village ||
    (data.display_name ? data.display_name.split(",")[0] : null);
  return name || "On the route";
}

function getCachedName(lat, lng) {
  return cache.get(gridKey(lat, lng)) || null;
}

function ensureName(lat, lng) {
  const key = gridKey(lat, lng);
  if (cache.has(key) || inFlight.has(key)) return;
  inFlight.add(key);
  fetchName(lat, lng)
    .then((name) => cache.set(key, name))
    .catch(() => cache.set(key, null))
    .finally(() => inFlight.delete(key));
}

module.exports = { getCachedName, ensureName };
