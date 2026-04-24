/**
 * Service registry — single source of truth for all delivery/tracking services.
 *
 * - catalog services (food/grocery/shop) ship items from a vendor to a customer
 * - transport services (cab/parcel) move a rider/parcel from a pickup to a drop
 *
 * The tracking simulator treats the whole app uniformly: a courier/driver
 * travels from their current location to a "source" point (restaurant / store /
 * pickup address) and then to a "destination" point (customer / drop address).
 * Service-specific vocabulary and UI are driven by the `labels` dictionary.
 */

const SERVICES = {
  food: {
    id: "food",
    name: "Food Delivery",
    tagline: "Restaurants, cafes & desserts",
    emoji: "🍔",
    color: "#e23744",
    gradient: "linear-gradient(135deg,#ff5a5f 0%,#e23744 100%)",
    type: "catalog",
    hasKitchenPrep: true,
    allowsTip: true,
    etaMin: 25,
    etaMax: 40,
    brand: "Zomato",
    vehicleTypes: ["bike"],
    entryPath: "/food.html",
    labels: {
      partner: "Delivery partner",
      partnerShort: "Rider",
      partnerAction: "is on the way",
      source: "Restaurant",
      destination: "Your address",
      order: "order",
      orderPlaced: "Order placed",
      finding: "Looking for a delivery partner",
      accepted: "Rider is heading to the restaurant",
      at_source: "Rider reached the restaurant",
      picked_up: "Rider picked up your food",
      arrived: "Rider has arrived at your address",
      delivered: "Food delivered · Enjoy your meal",
      itemsWord: "items"
    }
  },
  grocery: {
    id: "grocery",
    name: "Daily Needs",
    tagline: "Groceries, fruits & essentials in 10 minutes",
    emoji: "🛒",
    color: "#0c831f",
    gradient: "linear-gradient(135deg,#32d74b 0%,#0c831f 100%)",
    type: "catalog",
    hasKitchenPrep: false,
    allowsTip: true,
    etaMin: 8,
    etaMax: 15,
    brand: "Blinkit",
    vehicleTypes: ["bike"],
    entryPath: "/grocery.html",
    labels: {
      partner: "Delivery partner",
      partnerShort: "Partner",
      partnerAction: "is sprinting to you",
      source: "Store",
      destination: "Your address",
      order: "order",
      orderPlaced: "Order placed",
      finding: "Packing your order at the store",
      accepted: "Partner picked up your order at the store",
      at_source: "Partner is at the store",
      picked_up: "Partner picked up your order",
      arrived: "Partner is at your door",
      delivered: "Groceries delivered",
      itemsWord: "items"
    }
  },
  cab: {
    id: "cab",
    name: "Cabs",
    tagline: "Bike, auto, sedan & SUV rides",
    emoji: "🚕",
    color: "#0a7cff",
    gradient: "linear-gradient(135deg,#3ea3ff 0%,#0a5cff 100%)",
    type: "transport",
    hasKitchenPrep: false,
    allowsTip: true,
    etaMin: 3,
    etaMax: 8,
    brand: "Ola",
    vehicleTypes: ["bike", "auto", "mini", "sedan", "suv"],
    entryPath: "/cab.html",
    labels: {
      partner: "Driver",
      partnerShort: "Driver",
      partnerAction: "is driving to you",
      source: "Pickup",
      destination: "Drop",
      order: "ride",
      orderPlaced: "Ride booked",
      finding: "Finding a driver near you",
      accepted: "Driver accepted your ride",
      at_source: "Driver arrived at pickup",
      picked_up: "Trip started",
      arrived: "Arrived at drop",
      delivered: "Trip completed",
      itemsWord: "stops"
    }
  },
  parcel: {
    id: "parcel",
    name: "Parcel",
    tagline: "Send anything across the city",
    emoji: "📦",
    color: "#ff6a00",
    gradient: "linear-gradient(135deg,#ffb46b 0%,#ff6a00 100%)",
    type: "transport",
    hasKitchenPrep: false,
    allowsTip: true,
    etaMin: 15,
    etaMax: 45,
    brand: "Porter",
    vehicleTypes: ["bike", "auto", "tempo", "truck"],
    entryPath: "/parcel.html",
    labels: {
      partner: "Delivery partner",
      partnerShort: "Partner",
      partnerAction: "is moving your parcel",
      source: "Pickup",
      destination: "Drop",
      order: "parcel",
      orderPlaced: "Parcel booked",
      finding: "Finding a nearby partner",
      accepted: "Partner is heading to pickup",
      at_source: "Partner arrived at pickup",
      picked_up: "Parcel picked up",
      arrived: "Partner reached drop address",
      delivered: "Parcel delivered",
      itemsWord: "parcels"
    }
  },
  shop: {
    id: "shop",
    name: "Shop",
    tagline: "Electronics, fashion & more",
    emoji: "🛍️",
    color: "#2874f0",
    gradient: "linear-gradient(135deg,#4d9bff 0%,#1a4fd0 100%)",
    type: "catalog",
    hasKitchenPrep: false,
    allowsTip: false,
    etaMin: 30,
    etaMax: 90,
    brand: "Flipkart",
    vehicleTypes: ["bike", "auto"],
    entryPath: "/shop.html",
    labels: {
      partner: "Delivery agent",
      partnerShort: "Agent",
      partnerAction: "is delivering your order",
      source: "Warehouse",
      destination: "Your address",
      order: "order",
      orderPlaced: "Order placed",
      finding: "Preparing your order",
      accepted: "Agent picked up your order",
      at_source: "Agent at warehouse",
      picked_up: "Out for delivery",
      arrived: "Agent reached your address",
      delivered: "Order delivered",
      itemsWord: "items"
    }
  }
};

const SERVICE_LIST = Object.values(SERVICES);

function getService(id) {
  return SERVICES[String(id || "").toLowerCase()] || null;
}

/** Safe public summary used by frontends. */
function publicServiceSummary(svc) {
  return {
    id: svc.id,
    name: svc.name,
    tagline: svc.tagline,
    emoji: svc.emoji,
    color: svc.color,
    gradient: svc.gradient,
    type: svc.type,
    brand: svc.brand,
    entryPath: svc.entryPath,
    etaMin: svc.etaMin,
    etaMax: svc.etaMax,
    vehicleTypes: svc.vehicleTypes,
    labels: svc.labels,
    hasKitchenPrep: svc.hasKitchenPrep,
    allowsTip: svc.allowsTip
  };
}

module.exports = {
  SERVICES,
  SERVICE_LIST,
  getService,
  publicServiceSummary
};
