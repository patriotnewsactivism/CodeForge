import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  cacheDir: "/tmp/vite-cache",
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          "monaco": ["@monaco-editor/react"],
          "ui": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-popover", "@radix-ui/react-select", "@radix-ui/react-switch", "@radix-ui/react-tabs", "@radix-ui/react-tooltip"],
          "convex": ["convex/react", "convex/browser"],
          "charts": ["recharts"],
          "motion": ["framer-motion"],
        },
      },
    },
  },
});
