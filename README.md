# Delivery Super-app (food, grocery, cab, parcel, shop, multi-role)

End-to-end multi-service delivery + tracking platform with four user roles:

- **Customers** — order food, groceries, cabs, parcels, shopping; live tracking
- **Business owners** — restaurant/store/shop dashboard with menu, orders, earnings, payouts
- **Delivery partners** — go online, accept orders, OTP delivery, earnings, payouts
- **Super admin** — approve businesses & partners, manage categories, settings, payouts, audit log, support tickets

Data persistence is JSON-file-backed in `data/db.json` (auto-created on boot).

## Run

```bash
cd delivery-tracker-clone
npm install
npm start
```

### URLs

| Audience | URL |
| -------- | --- |
| Super-app landing (customers) | `http://localhost:4010/` |
| Login / signup (any role) | `http://localhost:4010/login.html` |
| Super-admin console | `http://localhost:4010/admin.html` |
| Business owner studio | `http://localhost:4010/business.html` |
| Delivery partner hub | `http://localhost:4010/partner.html` |
| Customer account | `http://localhost:4010/account.html` |
| Legacy rider console (no login) | `http://localhost:4010/rider.html` |

If 4010 is busy, the server auto-falls back to 4011, 4012, ...

### Default super admin

A super admin is auto-seeded on first boot:

```
email:    admin@platform.local
password: admin@123
```

Override at boot via `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` env vars.

### Role flow

1. Owner signs up → admin approves → owner adds a business → admin approves business → owner adds catalog items.
2. Customer signs up → orders from any active business → tracking page opens.
3. Partner signs up → admin approves → partner goes online → accepts the order with OTP → completes delivery.
4. Earnings, commissions and payouts are computed automatically; partners and owners can request payouts; admin processes them.
5. Customer can rate the order and open support tickets; admin can reply.

### Data model (JSON store)

`data/db.json` contains: users, sessions, businesses, products, serviceCategories, ordersLog, reviews, promotions, payouts, notifications, auditLogs, supportTickets, walletTxns, partnerStatus, settings.

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

## CI/CD (GitHub -> Render auto deploy)

This repo includes `.github/workflows/render-auto-deploy.yml`.

To enable zero-touch deployment on every push to `main`:

1. In Render, open your web service.
2. Go to `Settings` -> `Deploy Hook` and create/copy a deploy hook URL.
3. In GitHub, open this repo -> `Settings` -> `Secrets and variables` -> `Actions`.
4. Add a new repository secret:
   - Name: `RENDER_DEPLOY_HOOK_URL`
   - Value: `<your render deploy hook url>`
5. Push to `main`.

Each push to `main` now triggers Render deploy automatically. You can also run it manually from GitHub Actions (`workflow_dispatch`).
