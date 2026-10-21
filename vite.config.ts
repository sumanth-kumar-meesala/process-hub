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
  return {
    base: './',
    plugins: [react(), tailwindcss(), ...(sharepoint ? [viteSingleFile(), inlineFavicon()] : [])],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    publicDir: sharepoint ? false : 'public',
    build: { chunkSizeWarningLimit: 2000, ...(sharepoint ? { outDir: 'dist-sharepoint', chunkSizeWarningLimit: 4000 } : {}) },
  }
})
