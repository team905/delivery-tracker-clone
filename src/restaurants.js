const restaurants = [
  {
    id: "r1",
    name: "Spice Junction",
    cuisine: "North Indian · Biryani",
    lat: 19.0845,
    lng: 72.8893,
    rating: 4.6,
    deliveryMinutes: 28,
    image:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=60",
    menu: [
      { id: "m1", name: "Chicken Biryani", price: 320 },
      { id: "m2", name: "Butter Chicken", price: 360 },
      { id: "m3", name: "Garlic Naan", price: 60 },
      { id: "m4", name: "Paneer Tikka", price: 280 }
    ]
  },
  {
    id: "r2",
    name: "Tokyo Bowl",
    cuisine: "Japanese · Ramen · Sushi",
    lat: 19.0888,
    lng: 72.8821,
    rating: 4.4,
    deliveryMinutes: 32,
    image:
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=60",
    menu: [
      { id: "m1", name: "Tonkotsu Ramen", price: 480 },
      { id: "m2", name: "Chicken Katsu", price: 420 },
      { id: "m3", name: "Salmon Sushi Roll", price: 540 },
      { id: "m4", name: "Edamame", price: 180 }
    ]
  },
  {
    id: "r3",
    name: "Naples Pizzeria",
    cuisine: "Italian · Pizza",
    lat: 19.081,
    lng: 72.8956,
    rating: 4.7,
    deliveryMinutes: 25,
    image:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=60",
    menu: [
      { id: "m1", name: "Margherita Pizza", price: 320 },
      { id: "m2", name: "Pepperoni Pizza", price: 440 },
      { id: "m3", name: "Garlic Bread", price: 180 },
      { id: "m4", name: "Tiramisu", price: 260 }
    ]
  },
  {
    id: "r4",
    name: "Green Bowl Co.",
    cuisine: "Healthy · Salads",
    lat: 19.0772,
    lng: 72.8845,
    rating: 4.5,
    deliveryMinutes: 22,
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=60",
    menu: [
      { id: "m1", name: "Quinoa Power Bowl", price: 340 },
      { id: "m2", name: "Grilled Chicken Salad", price: 380 },
      { id: "m3", name: "Avocado Toast", price: 260 },
      { id: "m4", name: "Fresh Juice", price: 160 }
    ]
  }
];

module.exports = { restaurants };
