# Live Delivery Tracker (Zomato-like)

End-to-end food delivery flow with live parcel tracking:

- Browse restaurants, build a cart, pick delivery location on a map
- Place an order → rider console gets it live
- Rider accepts → customer tracking page shows smooth live movement
- Status stages: Placed → Rider assigned → Picked up → Delivered
- ETA, rider details, animated marker, auto-zoomed map — Zomato style

## Run

```bash
cd delivery-tracker-clone
npm install
npm start
```

- Customer site:    http://localhost:4010/
- Rider console:    http://localhost:4010/rider.html

If 4010 is busy, the server auto-falls back to 4011, 4012, ...

## Flow

1. Open the customer site and select a restaurant.
2. Add items to the cart.
3. Set delivery address by clicking on the map or "Use my location".
4. Place order — you're redirected to the tracking page.
5. Open the rider console in another tab — the order shows up live.
6. Click "Accept order" — the tracking page starts showing the rider moving.
7. Rider moves smoothly: restaurant → customer. ETA updates, status progresses.

## APIs

- `GET  /api/restaurants`
- `POST /api/orders`
- `GET  /api/orders/:id`
- `GET  /api/rider/orders`
- `POST /api/rider/:orderId/accept`
- `GET  /api/riders`
- `GET  /api/health`

## Socket events

- `join-order` / `tracking-update` (customer)
- `join-riders` / `rider-orders` / `new-order` (rider console)
