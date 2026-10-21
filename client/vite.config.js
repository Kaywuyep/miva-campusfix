import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development, forward API, uploads and websocket traffic to Express
    proxy: {
      "/api": "http://localhost:5002",
      "/uploads": "http://localhost:5002",
      "/socket.io": { target: "http://localhost:5002", ws: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/__tests__/setupTests.js",
  },
});
