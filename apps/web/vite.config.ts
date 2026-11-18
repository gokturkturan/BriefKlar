import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Same-origin requests in development: no CORS issues, SSE works out of the box
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
