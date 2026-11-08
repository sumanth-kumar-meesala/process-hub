/**
 * Entry for the SharePoint (SPFx) web part: the app as a plain script file, no inline script, no eval,
 * so it runs under SharePoint's content security policy.
 * It draws into a shadow root: Tailwind's reset and classes can't touch the SharePoint page, and the page can't touch them.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SandboxRouter } from '@/components/SandboxRouter'
import { App } from '@/App'
import appCss from './index.css?inline'
import flowCss from '@xyflow/react/dist/style.css?inline'
import f400 from '@fontsource/figtree/latin-400.css?inline'
import f500 from '@fontsource/figtree/latin-500.css?inline'
import f600 from '@fontsource/figtree/latin-600.css?inline'
import f700 from '@fontsource/figtree/latin-700.css?inline'
import f800 from '@fontsource/figtree/latin-800.css?inline'

const style = (css: string) => Object.assign(document.createElement('style'), { textContent: css })

export function mount(host: HTMLElement): () => void {
  // @font-face and @property (Tailwind's --tw-* defaults: borders, rings, shadows) are ignored inside a shadow root,
  // so they go into the page head (once); the names are all --tw-… so they can't clash with the page
  if (!document.getElementById('process-hub-fonts')) {
    const props = appCss.match(/@property\s+--[\w-]+\s*\{[^}]*\}/g) ?? []
    document.head.append(Object.assign(style(f400 + f500 + f600 + f700 + f800 + props.join('\n')), { id: 'process-hub-fonts' }))
  }
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  // the reset's `html, body, #root` and the page colours move onto the wrapper
  const shell = Object.assign(document.createElement('div'), { id: 'root' })
  shell.setAttribute('style', 'min-height:max(88vh,720px);position:relative;background:var(--color-surface);color:var(--color-on-surface);font-family:var(--font-sans);-webkit-font-smoothing:antialiased')
  root.replaceChildren(style(appCss + flowCss), shell)
  const r = createRoot(shell)
  r.render(<StrictMode><App Router={SandboxRouter} /></StrictMode>)
  return () => r.unmount()
}
