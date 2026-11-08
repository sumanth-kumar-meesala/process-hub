import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

/** Puts the icon into the page itself, so the SharePoint copy is one file. */
const inlineFavicon = (): Plugin => ({
  name: 'inline-favicon',
  transformIndexHtml: (html) => html.replace('./favicon.svg',
    `data:image/svg+xml;base64,${readFileSync(fileURLToPath(new URL('./public/favicon.svg', import.meta.url))).toString('base64')}`),
})

// base './' + HashRouter lets the site run from any GitHub Pages path.
// `vite build --mode sharepoint` (npm run build:sharepoint) makes ONE self-contained HTML file
// (all JavaScript, styles and the icon inside it) to upload to a SharePoint library.
export default defineConfig(({ mode }) => {
  const sharepoint = mode === 'sharepoint'
  // `vite build --mode spfx` (npm run build:spfx): the app as ONE plain .js file for the SPFx web part (see src/spfx.tsx)
  if (mode === 'spfx') return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define: { 'process.env.NODE_ENV': '"production"' },
    publicDir: false,
    build: {
      outDir: 'spfx/app', emptyOutDir: true, assetsInlineLimit: Infinity, cssCodeSplit: false, chunkSizeWarningLimit: 4000,
      lib: { entry: 'src/spfx.tsx', formats: ['es'], fileName: () => 'process-hub.js' },
      rolldownOptions: { output: { codeSplitting: false } },
    },
  }
  return {
    base: './',
    plugins: [react(), tailwindcss(), ...(sharepoint ? [viteSingleFile(), inlineFavicon()] : [])],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    publicDir: sharepoint ? false : 'public',
    build: { chunkSizeWarningLimit: 2000, ...(sharepoint ? { outDir: 'dist-sharepoint', chunkSizeWarningLimit: 4000 } : {}) },
  }
})
