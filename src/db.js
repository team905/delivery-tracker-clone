/**
 * Tiny JSON-file-backed store. Synchronous reads (data is small),
 * debounced writes. Survives restart for users, businesses, products,
 * orders log, reviews, payouts, audit, etc.
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const DEFAULT_DB = {
  users: [],
  sessions: [],
  businesses: [],
  products: [],
  serviceCategories: [],
  ordersLog: [],
  reviews: [],
  promotions: [],
  payouts: [],
  notifications: [],
  auditLogs: [],
  supportTickets: [],
  walletTxns: [],
  partnerStatus: {},
  settings: {
    platformCommissionPct: 18,
    deliveryFeeBase: 25,
    taxPct: 5,
    refer: { rewardAmount: 100, signupBonus: 50 }
  }
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    for (const k of Object.keys(DEFAULT_DB)) {
      if (parsed[k] === undefined) parsed[k] = DEFAULT_DB[k];
    }
    return parsed;
  } catch (e) {
    console.error("DB read failed, restoring default:", e);
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

let _db = load();
let _writeTimer = null;

function persist() {
  if (_writeTimer) clearTimeout(_writeTimer);
  _writeTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2));
    } catch (e) {
      console.error("DB write failed:", e);
    }
  }, 200);
}

function persistNow() {
  if (_writeTimer) {
    clearTimeout(_writeTimer);
    _writeTimer = null;
  }
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2));
  } catch (e) {
    console.error("DB write failed:", e);
  }
}

function db() { return _db; }

function reload() { _db = load(); }

function genId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = { db, persist, persistNow, reload, genId };
