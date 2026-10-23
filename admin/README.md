# Aynix Admin

The control center for Aynix: approve stores and drivers, watch orders and deliveries live, step in when something goes wrong, and see the numbers.

Built with React, Vite and TypeScript. It talks only to the Aynix backend API.

## Pages

| Page | What you do there |
|---|---|
| **Dashboard** | Orders and sales today, commission earned, what needs attention, orders and sales per day for the last 30 days, top stores |
| **Live map** | Every online driver on a map (green = free, blue = on a job), moving in real time, plus a live feed of orders and deliveries |
| **Orders** | Search and filter orders. Open one to see everything, confirm or cancel items, cancel the whole order, assign a driver |
| **Deliveries** | Jobs waiting for a driver, in progress, failed. Find a driver now, or pick one by hand |
| **Stores** | Approve, reject, suspend or reactivate stores |
| **Drivers** | Approve, reject, suspend or reactivate drivers. See who is online |
| **Users** | Find anyone by name or phone. Ban or unban |
| **Categories** | Add, rename, reorder, hide or show product categories |

## Run it

The backend must be running first (see the main README). Then:

```bash
cd admin
npm install
npm run dev
```

Open http://localhost:5173 and log in with the admin account created by `npm run seed`.

In development, Vite forwards `/api` and the live socket to the backend at `http://localhost:3000`. If your backend runs somewhere else, start with `API_URL=http://host:port npm run dev`.

## Build for production

```bash
npm run build
```

This makes a static site in `admin/dist`. Serve it from the same domain as the API (for example with NGINX: `/` → `admin/dist`, `/api` and `/socket.io` → the backend), so no CORS setup is needed.

## How it is organized

```
src/
  api/          → client (tokens, auto refresh) and the data shapes
  auth/         → login state
  realtime/     → one Socket.io connection shared by every page
  components/   → layout, chart, badges, dialogs, order panel, assign driver
  pages/        → one file per page
  lib/          → formatting and small hooks
```

- Only one token refresh runs at a time. The backend treats a reused refresh token as theft and logs the user out everywhere, so parallel refreshes would kick the admin out.
- Filters live in the URL (`/orders?status=PENDING`), so links from the dashboard and the back button work.
- Status badges always show a word next to the color.
- Light and dark mode follow the system, or can be picked in the sidebar.
