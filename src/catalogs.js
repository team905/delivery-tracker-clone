/**
 * Catalog data for non-food services.
 *
 * - Grocery stores (Blinkit-style) with categorized product lists
 * - Shop (Flipkart-style) single mega-warehouse with multi-category products
 * - Transport vehicles for cab/parcel with base fare, per-km & per-min rates
 */

/* ===================== Grocery stores ===================== */
const groceryStores = [
  {
    id: "g1",
    serviceType: "grocery",
    name: "Fresh Basket · Andheri",
    tagline: "Fruits, veggies & daily essentials",
    lat: 19.1198,
    lng: 72.8467,
    deliveryMinutes: 9,
    rating: 4.7,
    image:
      "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=800&q=60"
  },
  {
    id: "g2",
    serviceType: "grocery",
    name: "Fresh Basket · Powai",
    tagline: "10-minute grocery store",
    lat: 19.1197,
    lng: 72.9056,
    deliveryMinutes: 11,
    rating: 4.6,
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=60"
  }
];

const groceryCategories = [
  { id: "fv", name: "Fruits & Veggies", emoji: "🥦" },
  { id: "da", name: "Dairy & Bread", emoji: "🥛" },
  { id: "sn", name: "Snacks & Drinks", emoji: "🥤" },
  { id: "st", name: "Staples", emoji: "🌾" },
  { id: "ho", name: "Home & Clean", emoji: "🧼" },
  { id: "pc", name: "Personal Care", emoji: "🧴" }
];

const groceryProducts = [
  // Fruits & Veggies
  { id: "gp1", cat: "fv", name: "Banana (Dozen)", price: 60, mrp: 80, unit: "12 pcs", image: "https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=400&q=60" },
  { id: "gp2", cat: "fv", name: "Apple Shimla", price: 180, mrp: 220, unit: "1 kg", image: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?auto=format&fit=crop&w=400&q=60" },
  { id: "gp3", cat: "fv", name: "Tomato (Local)", price: 40, mrp: 60, unit: "500 g", image: "https://images.unsplash.com/photo-1546470427-0a0d1b3a6c42?auto=format&fit=crop&w=400&q=60" },
  { id: "gp4", cat: "fv", name: "Onion", price: 32, mrp: 45, unit: "1 kg", image: "https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?auto=format&fit=crop&w=400&q=60" },
  { id: "gp5", cat: "fv", name: "Potato", price: 38, mrp: 50, unit: "1 kg", image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=60" },
  { id: "gp6", cat: "fv", name: "Capsicum", price: 55, mrp: 70, unit: "500 g", image: "https://images.unsplash.com/photo-1522184216316-3c25379f9760?auto=format&fit=crop&w=400&q=60" },

  // Dairy & Bread
  { id: "gp7", cat: "da", name: "Amul Gold Milk", price: 34, mrp: 36, unit: "500 ml", image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=60" },
  { id: "gp8", cat: "da", name: "Amul Butter", price: 60, mrp: 62, unit: "100 g", image: "https://images.unsplash.com/photo-1603198937180-8c06a2e4e4a3?auto=format&fit=crop&w=400&q=60" },
  { id: "gp9", cat: "da", name: "Brown Bread", price: 45, mrp: 50, unit: "400 g", image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=60" },
  { id: "gp10", cat: "da", name: "Paneer Fresh", price: 95, mrp: 110, unit: "200 g", image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=400&q=60" },
  { id: "gp11", cat: "da", name: "Curd Cup", price: 35, mrp: 40, unit: "400 g", image: "https://images.unsplash.com/photo-1571212515416-fca325dc6c6f?auto=format&fit=crop&w=400&q=60" },
  { id: "gp12", cat: "da", name: "Eggs (Tray)", price: 95, mrp: 110, unit: "12 pcs", image: "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=400&q=60" },

  // Snacks & Drinks
  { id: "gp13", cat: "sn", name: "Lays Classic", price: 20, mrp: 20, unit: "52 g", image: "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=400&q=60" },
  { id: "gp14", cat: "sn", name: "Coca Cola", price: 40, mrp: 45, unit: "750 ml", image: "https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=400&q=60" },
  { id: "gp15", cat: "sn", name: "Dairy Milk Silk", price: 80, mrp: 95, unit: "60 g", image: "https://images.unsplash.com/photo-1623660053975-cf75a8be0908?auto=format&fit=crop&w=400&q=60" },
  { id: "gp16", cat: "sn", name: "Maggi Noodles", price: 52, mrp: 60, unit: "280 g", image: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=400&q=60" },
  { id: "gp17", cat: "sn", name: "Tropicana Juice", price: 90, mrp: 110, unit: "1 L", image: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=400&q=60" },
  { id: "gp18", cat: "sn", name: "Oreo Biscuits", price: 30, mrp: 35, unit: "120 g", image: "https://images.unsplash.com/photo-1613946069412-38f7f1ff0b65?auto=format&fit=crop&w=400&q=60" },

  // Staples
  { id: "gp19", cat: "st", name: "Basmati Rice", price: 180, mrp: 220, unit: "1 kg", image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=60" },
  { id: "gp20", cat: "st", name: "Toor Dal", price: 130, mrp: 150, unit: "1 kg", image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=60" },
  { id: "gp21", cat: "st", name: "Sugar", price: 52, mrp: 60, unit: "1 kg", image: "https://images.unsplash.com/photo-1589927986089-35812388d1f4?auto=format&fit=crop&w=400&q=60" },
  { id: "gp22", cat: "st", name: "Fortune Oil", price: 170, mrp: 190, unit: "1 L", image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=60" },

  // Home & Clean
  { id: "gp23", cat: "ho", name: "Surf Excel", price: 180, mrp: 220, unit: "1 kg", image: "https://images.unsplash.com/photo-1620286502223-daebaa0b87eb?auto=format&fit=crop&w=400&q=60" },
  { id: "gp24", cat: "ho", name: "Vim Bar", price: 20, mrp: 25, unit: "200 g", image: "https://images.unsplash.com/photo-1583947581924-860bda3c5d80?auto=format&fit=crop&w=400&q=60" },
  { id: "gp25", cat: "ho", name: "Harpic", price: 95, mrp: 115, unit: "500 ml", image: "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=400&q=60" },

  // Personal Care
  { id: "gp26", cat: "pc", name: "Dove Soap", price: 55, mrp: 65, unit: "100 g", image: "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=400&q=60" },
  { id: "gp27", cat: "pc", name: "Colgate Paste", price: 95, mrp: 110, unit: "150 g", image: "https://images.unsplash.com/photo-1612538498488-1c88fb78efa5?auto=format&fit=crop&w=400&q=60" },
  { id: "gp28", cat: "pc", name: "Head & Shoulders", price: 199, mrp: 240, unit: "340 ml", image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=60" }
];

/* ===================== Shop (Flipkart-style) ===================== */
const shopWarehouse = {
  id: "sw1",
  serviceType: "shop",
  name: "ShopKart Warehouse",
  tagline: "Electronics, fashion, home & more",
  lat: 19.1055,
  lng: 72.8697,
  deliveryMinutes: 45,
  rating: 4.4,
  image:
    "https://images.unsplash.com/photo-1586880244406-556ebe35f282?auto=format&fit=crop&w=800&q=60"
};

const shopCategories = [
  { id: "mobiles", name: "Mobiles", emoji: "📱" },
  { id: "fashion", name: "Fashion", emoji: "👕" },
  { id: "electronics", name: "Electronics", emoji: "💻" },
  { id: "home", name: "Home", emoji: "🛋️" },
  { id: "beauty", name: "Beauty", emoji: "💄" },
  { id: "toys", name: "Toys", emoji: "🧸" }
];

const shopProducts = [
  { id: "sp1", cat: "mobiles", name: "Samsung Galaxy M14 5G", price: 12499, mrp: 16999, rating: 4.3, reviews: 48320, unit: "128 GB · Midnight Blue", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=60" },
  { id: "sp2", cat: "mobiles", name: "Realme Narzo 60x 5G", price: 11499, mrp: 14999, rating: 4.2, reviews: 21890, unit: "128 GB · Nebula Purple", image: "https://images.unsplash.com/photo-1605236453806-6ff36851218e?auto=format&fit=crop&w=600&q=60" },
  { id: "sp3", cat: "mobiles", name: "boAt Rockerz 450 Headphones", price: 1499, mrp: 3990, rating: 4.1, reviews: 135420, unit: "Wireless · 15 hr", image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=600&q=60" },
  { id: "sp4", cat: "mobiles", name: "Anker USB-C Charger 20W", price: 799, mrp: 1299, rating: 4.5, reviews: 9820, unit: "Fast charge", image: "https://images.unsplash.com/photo-1609081219090-a6d81d3085bf?auto=format&fit=crop&w=600&q=60" },

  { id: "sp5", cat: "fashion", name: "Roadster Men's T-Shirt", price: 499, mrp: 999, rating: 4.2, reviews: 20213, unit: "Cotton · Navy", image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=60" },
  { id: "sp6", cat: "fashion", name: "Nike Revolution 6 Shoes", price: 2899, mrp: 4295, rating: 4.4, reviews: 12400, unit: "UK 9 · Black", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=60" },
  { id: "sp7", cat: "fashion", name: "Women's Kurta Set", price: 899, mrp: 2499, rating: 4.1, reviews: 8820, unit: "L · Maroon", image: "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=600&q=60" },
  { id: "sp8", cat: "fashion", name: "Fossil Men's Watch", price: 3499, mrp: 7995, rating: 4.6, reviews: 2340, unit: "Leather · Brown", image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=60" },

  { id: "sp9", cat: "electronics", name: "HP Pavilion 15 Laptop", price: 54999, mrp: 72999, rating: 4.3, reviews: 5620, unit: "i5 · 16GB · 512GB SSD", image: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=600&q=60" },
  { id: "sp10", cat: "electronics", name: "Logitech MX Master 3S", price: 7499, mrp: 10995, rating: 4.7, reviews: 3220, unit: "Wireless · Graphite", image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=60" },
  { id: "sp11", cat: "electronics", name: "Mi 43 Smart TV", price: 24999, mrp: 39999, rating: 4.4, reviews: 11200, unit: "4K · Android", image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=600&q=60" },

  { id: "sp12", cat: "home", name: "Philips Air Fryer", price: 8999, mrp: 12995, rating: 4.5, reviews: 16800, unit: "4.1 L", image: "https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=600&q=60" },
  { id: "sp13", cat: "home", name: "Prestige Pressure Cooker", price: 1499, mrp: 2495, rating: 4.4, reviews: 29210, unit: "5 L · Stainless", image: "https://images.unsplash.com/photo-1603105040535-bdb8f6a5b16b?auto=format&fit=crop&w=600&q=60" },
  { id: "sp14", cat: "home", name: "Cotton Bedsheet King", price: 1299, mrp: 2999, rating: 4.2, reviews: 8210, unit: "108x108 · Floral", image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=60" },

  { id: "sp15", cat: "beauty", name: "Lakme Eyeconic Kajal", price: 210, mrp: 260, rating: 4.5, reviews: 45200, unit: "Deep Black", image: "https://images.unsplash.com/photo-1522335789203-aaa22e1e4db4?auto=format&fit=crop&w=600&q=60" },
  { id: "sp16", cat: "beauty", name: "The Ordinary Niacinamide", price: 650, mrp: 850, rating: 4.6, reviews: 12100, unit: "30 ml", image: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=600&q=60" },

  { id: "sp17", cat: "toys", name: "LEGO Classic Bricks", price: 1899, mrp: 2999, rating: 4.7, reviews: 3400, unit: "500 pieces", image: "https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?auto=format&fit=crop&w=600&q=60" },
  { id: "sp18", cat: "toys", name: "Remote Control Car", price: 999, mrp: 1999, rating: 4.2, reviews: 5620, unit: "Rechargeable", image: "https://images.unsplash.com/photo-1558060370-d644485927b2?auto=format&fit=crop&w=600&q=60" }
];

/* ===================== Vehicles (cab / parcel) ===================== */
const cabVehicles = [
  { id: "bike", name: "Bike", emoji: "🛵", seats: 1, baseFare: 25, perKm: 7, perMin: 1, etaMinutes: 3, desc: "Quick rides, beat traffic" },
  { id: "auto", name: "Auto", emoji: "🛺", seats: 3, baseFare: 35, perKm: 10, perMin: 1.2, etaMinutes: 4, desc: "Convenient city rides" },
  { id: "mini", name: "Mini", emoji: "🚗", seats: 4, baseFare: 60, perKm: 13, perMin: 1.5, etaMinutes: 5, desc: "Affordable AC cabs" },
  { id: "sedan", name: "Sedan", emoji: "🚙", seats: 4, baseFare: 80, perKm: 15, perMin: 1.8, etaMinutes: 6, desc: "Comfort with leg room" },
  { id: "suv", name: "SUV", emoji: "🚐", seats: 6, baseFare: 120, perKm: 18, perMin: 2, etaMinutes: 7, desc: "Group rides, extra boot" }
];

const parcelVehicles = [
  { id: "bike", name: "2 Wheeler", emoji: "🏍️", payload: "Up to 20 kg · 40×40 cm", baseFare: 35, perKm: 8, etaMinutes: 15, desc: "Small envelopes, documents, small bags" },
  { id: "auto", name: "3 Wheeler", emoji: "🛺", payload: "Up to 500 kg · 5 ft", baseFare: 90, perKm: 14, etaMinutes: 25, desc: "Appliances, furniture boxes" },
  { id: "tempo", name: "Tata Ace", emoji: "🚚", payload: "Up to 750 kg · 7 ft", baseFare: 180, perKm: 22, etaMinutes: 35, desc: "Home shifting, bulk deliveries" },
  { id: "truck", name: "Bolero / Pickup", emoji: "🛻", payload: "Up to 1200 kg · 8 ft", baseFare: 280, perKm: 30, etaMinutes: 45, desc: "Full truck load goods" }
];

const parcelPackageTypes = [
  { id: "documents", name: "Documents", emoji: "📄" },
  { id: "food", name: "Food", emoji: "🍱" },
  { id: "clothing", name: "Clothing", emoji: "👕" },
  { id: "electronics", name: "Electronics", emoji: "💻" },
  { id: "gifts", name: "Gifts", emoji: "🎁" },
  { id: "fragile", name: "Fragile", emoji: "🥂" },
  { id: "other", name: "Other", emoji: "📦" }
];

/** Haversine for fare estimation. */
function distanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(s)));
}

function estimateFare(vehicle, from, to, extraMinutes = 0) {
  const km = distanceKm(from, to);
  const min = km * 2.4 + extraMinutes;
  const total =
    (vehicle.baseFare || 0) +
    km * (vehicle.perKm || 0) +
    min * (vehicle.perMin || 0);
  return { km: Math.round(km * 10) / 10, min: Math.round(min), total: Math.round(total) };
}

module.exports = {
  groceryStores,
  groceryCategories,
  groceryProducts,
  shopWarehouse,
  shopCategories,
  shopProducts,
  cabVehicles,
  parcelVehicles,
  parcelPackageTypes,
  distanceKm,
  estimateFare
};
