import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const adminSheetTarget = env.ADMIN_SHEET_TARGET || "https://beyondtheoffer.vercel.app";

  return {
    plugins: [react()],
    server: {
      port: 3000,
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      },
      proxy: {
        "/api/admin-sheet": {
          target: adminSheetTarget,
          changeOrigin: true,
          secure: true,
        },
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
        },
      },
    },
  };
});
