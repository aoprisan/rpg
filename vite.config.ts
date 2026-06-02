import { defineConfig } from "vite";

// Base path is the repository name so the production build works on
// GitHub Pages at https://<user>.github.io/rpg/. Local dev/preview ignore it.
export default defineConfig({
  base: "/rpg/",
  build: {
    target: "es2020",
    sourcemap: false,
  },
});
