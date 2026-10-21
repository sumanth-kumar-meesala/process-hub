import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { SandboxRouter } from '@/components/SandboxRouter'
import { inSandbox } from '@/lib/sandbox'
import '@fontsource/figtree/latin-400.css'
import '@fontsource/figtree/latin-500.css'
import '@fontsource/figtree/latin-600.css'
import '@fontsource/figtree/latin-700.css'
import '@fontsource/figtree/latin-800.css'
import './index.css'
import Discover from '@/pages/Discover'
import { BpmnSync } from '@/components/BpmnStatus'

// Heavy screens (3D, canvas) load on demand
const ProcessPage = lazy(() => import('@/pages/ProcessPage'))
const Builder = lazy(() => import('@/pages/Builder'))
const Admin = lazy(() => import('@/pages/Admin'))
const GuidePage = lazy(() => import('@/pages/GuidePage'))

// SharePoint's HTML-page viewer doesn't allow history.pushState, which HashRouter uses
const Router = inSandbox ? SandboxRouter : HashRouter

const Loading = () => <div className="p-10 text-on-surface-variant">Loading…</div>

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BpmnSync />
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/process/:id" element={<ProcessPage key="3d" />} />
          <Route path="/process/:id/sidebar" element={<ProcessPage key="sidebar" view="sidebar" />} />
          <Route path="/process/:id/timeline" element={<GuidePage />} />
          {/* older links to the guided pages open the Timeline */}
          <Route path="/process/:id/guide" element={<GuidePage />} />
          <Route path="/process/:id/guide/:view" element={<GuidePage />} />
          <Route path="/builder" element={<Builder />} />
          <Route path="/builder/:id" element={<Builder />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Discover />} />
        </Routes>
      </Suspense>
    </Router>
  </StrictMode>,
)
