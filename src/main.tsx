import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Discover from '@/pages/Discover'

// Heavy screens (3D, canvas) load on demand
const ProcessPage = lazy(() => import('@/pages/ProcessPage'))
const Builder = lazy(() => import('@/pages/Builder'))
const Admin = lazy(() => import('@/pages/Admin'))
const GuidePage = lazy(() => import('@/pages/GuidePage'))

const Loading = () => <div className="p-10 text-on-surface-variant">Loading…</div>

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/process/:id" element={<ProcessPage />} />
          <Route path="/process/:id/sidebar" element={<ProcessPage view="sidebar" />} />
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
    </HashRouter>
  </StrictMode>,
)
