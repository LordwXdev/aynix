# Aynix mobile app

One app for everyone on Aynix. What you see depends on who you are:

| You are | You get |
|---|---|
| **Customer** | Shop, search, cart, checkout (cash on delivery), follow your order live, call your driver |
| **Seller** | Today's orders to confirm, earnings, all orders, your products, store settings |
| **Driver** (Aynix Move) | Go online, get jobs automatically, pickup and drop-off with call buttons, live GPS, history |

Everyone starts as a customer. From **Account** you can open a store or apply to drive. Once Aynix approves you, the app switches to the seller or driver side by itself.

Built with Expo (SDK 57), Expo Router and TypeScript. It talks to the Aynix backend.

## Run it on your phone

You need the backend running first (see the main README). Then:

1. Install **Expo Go** on your phone (App Store or Google Play).
2. Put your phone and computer on the **same Wi-Fi**.
3. On your computer:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
4. Scan the QR code with your phone's camera (iPhone) or with Expo Go (Android).

The app finds the backend by itself: it uses the same computer that runs `npx expo start`, on port 3000.

**If the app says "Can't reach Aynix":**
- Check the backend is running (`npm run dev` in the main folder).
- Check your computer's firewall allows port 3000.
- Or tell the app exactly where the backend is:
  ```bash
  EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npx expo start
  ```
  (use your computer's own IP address)

## Run it in a web browser

```bash
npx expo start --web
```

Handy for quick checks. Location works in the browser too, if you allow it.

## How to try every side

1. Sign up in the app. You are a customer.
2. Account → **Sell on Aynix** → fill in your store. You land on the seller side.
3. In the admin panel (`npm run admin` in the main folder), approve the store under **Stores**.
4. Add a product from the **Products** tab.
5. On another phone (or a browser window), sign up, then Account → **Drive with Aynix Move**. Approve the driver in the admin panel and tap **Go online**.
6. On a third account, buy the product. Confirm it as the seller. The driver gets the job right away.

## How it is organized

```
src/
  app/                 → every file is a screen (Expo Router)
    (auth)/            → welcome, login, sign up
    (shop)/            → customer tabs: shop, cart, orders, account
    (seller)/          → seller tabs: today, orders, products, account
    (driver)/          → driver tabs: jobs, history, account
    product/[id]       → product page
    store/[slug]       → store page
    order/[id]         → order tracking
    checkout, notifications, product-form, store-settings,
    become-seller, become-driver
  components/          → buttons, cards, fields, product card, job card…
  lib/                 → API client, login, cart, live updates, GPS, helpers
  theme/               → colors, spacing, text sizes (change the look here)
```

- The root `_layout.tsx` uses **protected routes**: logged-out people only see the welcome screens, and each role only sees its own screens.
- Tokens are kept in the phone's secure keychain (`expo-secure-store`).
- Only one token refresh runs at a time. The backend treats a reused refresh token as stolen and logs the user out everywhere.
- The cart is saved on the phone, so it survives closing the app.
- Drivers send their GPS every ~10 seconds while online. Customers see "seen just now" update live.
- Live updates (new orders, driver assigned, delivered…) come through Socket.io. Pull down on any list to refresh by hand.

## Check the code

```bash
npm run typecheck
npm run lint
```

## Not done yet

- Photo upload from the phone (sellers can paste a photo link for now)
- Push notifications when the app is closed (SMS covers the important ones)
- A map on the tracking screen
- Kreyòl and French translations
- Driver GPS while the app is in the background
