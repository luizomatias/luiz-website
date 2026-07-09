import { defineConfig } from 'vite'

// GitHub Pages serves this project at https://<user>.github.io/luiz-website/,
// so production assets need the repo name as their base path. Local dev stays
// at the root. The CI workflow can override the base via VITE_BASE.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.VITE_BASE ?? '/luiz-website/' : '/',
}))
