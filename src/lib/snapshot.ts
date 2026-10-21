/**
 * This page's own HTML exactly as it was loaded, before the app drew anything into it.
 * "Prepare the page" saves a copy of it with the chosen BPMN files inside, so nobody has to pick process-hub.html.
 * Imported first in main.tsx, so it runs before anything changes the page.
 */
export const pageSource: string = `<!doctype html>\n${document.documentElement.outerHTML}`
