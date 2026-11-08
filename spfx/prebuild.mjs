// Wraps ../dist-sharepoint/process-hub.html (npm run build:sharepoint in the parent folder) as a TS string module.
import { readFileSync, writeFileSync } from 'node:fs'
const html = readFileSync('../dist-sharepoint/process-hub.html', 'utf8')
writeFileSync('src/webparts/processHub/appHtml.ts', `export default ${JSON.stringify(html)};\n`)
console.log(`appHtml.ts written (${(html.length / 1048576).toFixed(1)} MB)`)
