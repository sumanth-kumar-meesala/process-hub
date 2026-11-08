// first: keep a copy of this page's HTML as loaded (used by Admin → "Prepare the page")
import '@/lib/snapshot'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { SandboxRouter } from '@/components/SandboxRouter'
import { inSandbox } from '@/lib/sandbox'
import '@fontsource/figtree/latin-400.css'
import '@fontsource/figtree/latin-500.css'
import '@fontsource/figtree/latin-600.css'
import '@fontsource/figtree/latin-700.css'
import '@fontsource/figtree/latin-800.css'
import './index.css'
import { App } from '@/App'

// SharePoint's HTML-page viewer doesn't allow history.pushState, which HashRouter uses
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App Router={inSandbox ? SandboxRouter : HashRouter} />
  </StrictMode>,
)
