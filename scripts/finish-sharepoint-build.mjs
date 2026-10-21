// After `vite build --mode sharepoint`: name the page process-hub.html and check it is safe as ONE inline page.
// Inside an inline <script>, the text "</script" ends the script early (the browser shows code as text instead
// of running the app), so the build fails if the app's script is cut short anywhere.
import { readFileSync, renameSync, writeFileSync } from 'node:fs'

const dir = 'dist-sharepoint'
renameSync(`${dir}/index.html`, `${dir}/process-hub.html`)
const html = readFileSync(`${dir}/process-hub.html`, 'utf8')

const start = html.search(/<script type="module"[^>]*>/)
if (start < 0) throw new Error('No inline app script found in process-hub.html')
const body = html.indexOf('>', start) + 1
const end = html.slice(body).search(/<\/script/i) + body
const rest = html.slice(end)
// what follows the app script must be the end of the page, not more of the app's code
if (!/^<\/script>\s*(<link[^>]*>|<style[^>]*>[\s\S]*?<\/style>|\s)*<\/head>/i.test(rest)) {
  const near = html.slice(Math.max(body, end - 120), end + 40).replace(/\s+/g, ' ')
  throw new Error(`The app's inline script ends early at character ${end} — some code contains "</script". Near: …${near}…`)
}
if (/<!--/.test(html.slice(body, end))) throw new Error('The app script contains "<!--", which can break inline scripts.')
const mb = (html.length / 1024 / 1024).toFixed(1)
writeFileSync(`${dir}/process-hub.html`, html)
console.log(`✓ ${dir}/process-hub.html (${mb} MB) — one self-contained page, script intact`)
