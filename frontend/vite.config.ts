import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    // Щоб не писати "../../components/..." — імпортуємо як "@/components/..."
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  server: {
    host: "0.0.0.0",   // контейнер має слухати ззовні, не лише 127.0.0.1
    port: 5173,
    strictPort: true,  // краще впасти, ніж мовчки зайняти інший порт
  },
});
