/**
 * BPMN files stored inside process-hub.html itself.
 *
 * "Prepare the page" (Admin → Processes) puts the chosen .bpmn files into the page, gzip-compressed and base64-encoded,
 * in <script type="application/json" id="process-hub-files">. Each time the page opens, it unpacks them and turns them
 * into processes in the browser — on your computer, on SharePoint, anywhere. On SharePoint a file can also be linked to
 * its copy in a SharePoint folder; then the page uses the latest version from there (see src/store/bpmn.ts).
 */

export interface PageFile {
  /** file name, e.g. "FS07 - Create & Manage Service Agreement (All).bpmn" */
  name: string
  /** the file, gzip-compressed, base64 */
  gz?: string
  /** the file as plain text (only where the browser can't compress) */
  text?: string
  /** when it was put into the page */
  savedAt: string
  /** its copy in SharePoint, read live by the page there (…/_api/v2.0/drives/{driveId}/items/{itemId}) */
  spItemUrl?: string
}

export const FILES_ID = 'process-hub-files'

const toB64 = (bytes: Uint8Array) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Packs a file's text for the page (gzip when the browser can, else plain text). */
export async function packFile(name: string, text: string, spItemUrl?: string): Promise<PageFile> {
  const savedAt = new Date().toISOString()
  if (typeof CompressionStream === 'undefined') return { name, text, savedAt, spItemUrl }
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return { name, gz: toB64(new Uint8Array(await new Response(stream).arrayBuffer())), savedAt, spItemUrl }
}

/** The file's text again. */
export async function unpackFile(f: PageFile): Promise<string> {
  if (typeof f.text === 'string') return f.text
  if (!f.gz) return ''
  const bytes = Uint8Array.from(atob(f.gz), (c) => c.charCodeAt(0))
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

/** The files stored in this page. */
export function pageFiles(): PageFile[] {
  const el = document.getElementById(FILES_ID)
  if (!el?.textContent?.trim()) return []
  try { const v = JSON.parse(el.textContent); return Array.isArray(v) ? v : [] } catch { return [] }
}
