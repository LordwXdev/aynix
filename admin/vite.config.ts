import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// in development the admin talks to the backend through this proxy,
// so there are no CORS problems and the URLs are the same as in production
const backend = process.env.API_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": backend,
      "/health": backend,
      "/socket.io": { target: backend, ws: true },
    },
  },
});
