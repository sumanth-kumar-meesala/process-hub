import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Discover from '@/pages/Discover'

// Heavy screens (3D, canvas) load on demand
const ProcessPage = lazy(() => import('@/pages/ProcessPage'))
const Builder = lazy(() => import('@/pages/Builder'))
const Admin = lazy(() => import('@/pages/Admin'))

const Loading = () => <div className="p-10 text-on-surface-variant">Loading…</div>

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/process/:id" element={<ProcessPage />} />
          <Route path="/builder" element={<Builder />} />
          <Route path="/builder/:id" element={<Builder />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Discover />} />
        </Routes>
      </Suspense>
    </HashRouter>
  </StrictMode>,
)
