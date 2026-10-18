import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Float, Html, Line, OrbitControls, QuadraticBezierLine } from '@react-three/drei'
import * as THREE from 'three'
import type { Process, Role } from '@/lib/types'
import { tint } from '@/lib/types'
import { loopsOf, roleKind, sceneFor, stageRoles, sysLabel, sysUnsure } from '@/lib/derive'

/* ---------- small building blocks ---------- */
const M = ({ c, e = 0 }: { c: string; e?: number }) => <meshStandardMaterial color={c} roughness={0.78} metalness={0.02} emissive={c} emissiveIntensity={e} />
type V3 = [number, number, number]
const B = ({ p, s, c, r }: { p: V3; s: V3; c: string; r?: V3 }) => (
  <mesh position={p} rotation={r}><boxGeometry args={s} /><M c={c} /></mesh>
)

function Person({ p, color, seated = false, scale = 1 }: { p: V3; color: string; seated?: boolean; scale?: number }) {
  const h = seated ? 0.32 : 0.5
  return (
    <group position={p} scale={scale}>
      <mesh position={[0, h / 2 + 0.12, 0]}><capsuleGeometry args={[0.15, h - 0.2, 6, 12]} /><M c={color} /></mesh>
      <mesh position={[0, h + 0.3, 0]}><sphereGeometry args={[0.14, 16, 12]} /><M c="#F5D0A9" /></mesh>
      <mesh position={[0, h + 0.33, -0.015]}><sphereGeometry args={[0.15, 16, 12, 0, Math.PI * 2, 0, Math.PI / 3.2]} /><M c="#7A5536" /></mesh>
    </group>
  )
}

/** An AI agent: a friendly robot in the role's colour. */
function Robot({ p, color }: { p: V3; color: string }) {
  const S = 1.5
  const eyes = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (eyes.current) eyes.current.scale.y = Math.sin(clock.elapsedTime * 2.2) > 0.97 ? 0.15 : 1 })
  return (
    <group position={p} scale={S}>
      <B p={[0, 0.3, 0]} s={[0.36, 0.42, 0.3]} c="#F1F5F9" />
      <B p={[0, 0.32, 0.155]} s={[0.22, 0.16, 0.02]} c={color} />
      <B p={[0, 0.7, 0]} s={[0.4, 0.3, 0.32]} c="#E2E8F0" />
      <B p={[0, 0.7, 0.165]} s={[0.32, 0.18, 0.02]} c="#0F172A" />
      <group ref={eyes} position={[0, 0.71, 0.18]}>
        <mesh position={[-0.07, 0, 0]}><sphereGeometry args={[0.035, 10, 8]} /><meshBasicMaterial color="#5EEAD4" /></mesh>
        <mesh position={[0.07, 0, 0]}><sphereGeometry args={[0.035, 10, 8]} /><meshBasicMaterial color="#5EEAD4" /></mesh>
      </group>
      <mesh position={[0, 0.95, 0]}><cylinderGeometry args={[0.015, 0.015, 0.2, 6]} /><M c="#64748B" /></mesh>
      <mesh position={[0, 1.07, 0]}><sphereGeometry args={[0.05, 10, 8]} /><meshBasicMaterial color={color} /></mesh>
    </group>
  )
}

/** The tools an AI agent can use (MCP servers, APIs, apps) orbit around it, linked by light beams. */
function ToolsOrbit({ p, tools, color, labels }: { p: V3; tools: string[]; color: string; labels: boolean }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.35 })
  const list = tools.length ? tools.slice(0, 5) : ['Tools']
  const r = 0.95
  return (
    <group position={[p[0], p[1] + 0.75, p[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}><ringGeometry args={[r - 0.02, r + 0.02, 48]} /><meshBasicMaterial color={color} transparent opacity={0.45} /></mesh>
      <group ref={g}>
        {list.map((t, i) => {
          const a = (i / list.length) * Math.PI * 2
          const q: V3 = [Math.cos(a) * r, 0.15 + (i % 2) * 0.18, Math.sin(a) * r]
          return (
            <group key={t + i}>
              <Line points={[[0, 0, 0], q]} color={color} lineWidth={1.5} transparent opacity={0.7} dashed dashSize={0.06} gapSize={0.05} />
              <mesh position={q} rotation={[0.6, 0.6, 0]}><boxGeometry args={[0.2, 0.2, 0.2]} /><meshStandardMaterial color="#FFFFFF" emissive={color} emissiveIntensity={0.55} /></mesh>
              {labels && (
                <Html position={[q[0], q[1] + 0.28, q[2]]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
                  <div className="whitespace-nowrap rounded-md border bg-white px-1.5 py-0.5 text-[10px] font-bold" style={{ borderColor: color, color: '#0F172A' }}>{t}</div>
                </Html>
              )}
            </group>
          )
        })}
      </group>
    </group>
  )
}

/** A yellow "check" sign on islands where a yes/no decision happens.
 *  If the check can send work round again inside the same stage, an orange arrow ring circles the sign. */
function CheckSign({ repeat = false }: { repeat?: boolean }) {
  const ring = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (ring.current) ring.current.rotation.y -= dt * 1.2 })
  return (
    <group position={[1.3, 0, -1.25]}>
      <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.03, 0.03, 0.9, 6]} /><M c="#475569" /></mesh>
      <mesh position={[0, 1.0, 0]} rotation={[0, Math.PI / 4, Math.PI / 4]}><boxGeometry args={[0.34, 0.34, 0.06]} /><M c="#FBBF24" /></mesh>
      <mesh position={[0, 1.0, 0.03]} rotation={[0, Math.PI / 4, 0]}><boxGeometry args={[0.06, 0.16, 0.08]} /><M c="#78350F" /></mesh>
      {repeat && (
        <group ref={ring} position={[0, 0.55, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.48, 0.055, 8, 40, Math.PI * 1.6]} /><meshBasicMaterial color="#F97316" /></mesh>
          <mesh position={[0.48, 0, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.12, 0.26, 10]} /><meshBasicMaterial color="#F97316" /></mesh>
        </group>
      )}
    </group>
  )
}

/** A "go back" path: an arc between islands (or a loop over one island) for checks that send work back. */
function LoopArc({ a, b, text, short, compact, focus, label = true }: { a: V3; b: V3; text: string; short: string; compact: boolean; focus: boolean; label?: boolean }) {
  const ref = useRef<{ material: { dashOffset: number } } | null>(null)
  useFrame((_, dt) => { if (ref.current) ref.current.material.dashOffset += dt * 0.6 })
  const same = a[0] === b[0] && a[2] === b[2]
  const start: V3 = same ? [a[0] + 0.9, 1.2, a[2] - 0.9] : [a[0], 1.3, a[2]]
  const end: V3 = same ? [a[0] - 0.9, 1.2, a[2] + 0.9] : [b[0], 1.3, b[2]]
  const dist = Math.hypot(a[0] - b[0], a[2] - b[2])
  const mid: V3 = same ? [a[0], 4.2, a[2]] : [(a[0] + b[0]) / 2, 5.2 + dist * 0.18, (a[2] + b[2]) / 2]
  const top: V3 = [(start[0] + 2 * mid[0] + end[0]) / 4, (start[1] + 2 * mid[1] + end[1]) / 4, (start[2] + 2 * mid[2] + end[2]) / 4]
  return (
    <group>
      <QuadraticBezierLine ref={ref as never} start={start} end={end} mid={mid} color="#F97316" lineWidth={focus ? 5 : 3.5} dashed dashSize={0.3} gapSize={0.18} />
      <mesh position={end}><sphereGeometry args={[0.12, 12, 10]} /><meshBasicMaterial color="#F97316" /></mesh>
      {!compact && label && (
        <Html position={top} center zIndexRange={[11, 0]} style={{ pointerEvents: 'none' }}>
          <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#F97316] px-2.5 py-1 text-[11px] font-extrabold text-white shadow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
            {focus ? text : short}
          </div>
        </Html>
      )}
    </group>
  )
}

/** AI stages: a small data-centre plinth with a slowly turning, glowing crystal. */
function AiCore({ color }: { color: string }) {
  const g = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.8 })
  return (
    <group position={[-0.6, 0, -0.6]}>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.75, 0.85, 0.4, 6]} /><M c="#1E293B" /></mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} position={[Math.cos(i * Math.PI / 3) * 0.78, 0.2, Math.sin(i * Math.PI / 3) * 0.78]}><boxGeometry args={[0.06, 0.08, 0.06]} /><meshBasicMaterial color={i % 2 ? '#5EEAD4' : color} /></mesh>)}
      <mesh ref={g} position={[0, 1.05, 0]}><octahedronGeometry args={[0.42, 0]} /><meshStandardMaterial color={tint(color, 0.6)} emissive={color} emissiveIntensity={0.5} flatShading /></mesh>
      <mesh position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.45, 0.55, 32]} /><meshBasicMaterial color="#5EEAD4" transparent opacity={0.7} /></mesh>
    </group>
  )
}

/* ---------- island scenery, chosen from what the stage is about ---------- */
/* ---------- props that show what happens on an island ---------- */
const Cyl = ({ p, r, h, c, seg = 24, rot, e = 0 }: { p: V3; r: number | [number, number]; h: number; c: string; seg?: number; rot?: V3; e?: number }) => (
  <mesh position={p} rotation={rot}><cylinderGeometry args={[Array.isArray(r) ? r[0] : r, Array.isArray(r) ? r[1] : r, h, seg]} /><M c={c} e={e} /></mesh>
)
const Tick = ({ p, s = 1, c = '#16A34A', rot }: { p: V3; s?: number; c?: string; rot?: V3 }) => (
  <group position={p} scale={s} rotation={rot}>
    <B p={[-0.09, -0.03, 0]} s={[0.07, 0.2, 0.04]} c={c} r={[0, 0, 0.75]} />
    <B p={[0.08, 0.05, 0]} s={[0.07, 0.38, 0.04]} c={c} r={[0, 0, -0.6]} />
  </group>
)

/** A microphone on a stand with sound rings, and a recorder with a red light. */
function RecordingProp({ color }: { color: string }) {
  const rings = useRef<THREE.Group>(null)
  const dot = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    rings.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.6 + i / 3) % 1
      c.scale.setScalar(0.6 + t * 1.4); ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t)
    })
    if (dot.current) dot.current.emissiveIntensity = Math.sin(clock.elapsedTime * 4) > 0 ? 1.2 : 0.2
  })
  return (
    <group position={[-0.5, 0, -0.5]}>
      <Cyl p={[0, 0.03, 0]} r={0.4} h={0.06} c="#334155" />
      <Cyl p={[0, 0.7, 0]} r={0.04} h={1.3} c="#64748B" seg={10} />
      <Cyl p={[0, 1.42, 0]} r={0.2} h={0.36} c="#1E293B" />
      <mesh position={[0, 1.62, 0]}><sphereGeometry args={[0.21, 18, 14]} /><M c={tint(color, 0.35)} /></mesh>
      <group ref={rings} position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]}>
        {[0, 1, 2].map((i) => <mesh key={i}><torusGeometry args={[0.45, 0.025, 8, 36]} /><meshBasicMaterial color={color} transparent opacity={0.5} /></mesh>)}
      </group>
      <B p={[1.1, 0.2, 0.6]} s={[0.75, 0.4, 0.5]} c="#F8FAFC" />
      <mesh position={[0.92, 0.42, 0.6]}><sphereGeometry args={[0.08, 12, 10]} /><meshStandardMaterial ref={dot} color="#EF4444" emissive="#EF4444" emissiveIntensity={1} /></mesh>
      <B p={[1.2, 0.41, 0.6]} s={[0.35, 0.02, 0.3]} c={color} />
    </group>
  )
}

/** A file going up to a cloud. */
function UploadProp({ color }: { color: string }) {
  return (
    <group position={[-0.4, 0, -0.5]}>
      <B p={[0, 0.35, 0]} s={[0.55, 0.7, 0.06]} c="#FFFFFF" />
      {[0.5, 0.38, 0.26].map((y) => <B key={y} p={[0, y, 0.035]} s={[0.36, 0.04, 0.01]} c={tint(color, 0.5)} />)}
      <Float speed={2.2} floatIntensity={0.8} rotationIntensity={0}>
        <group position={[0, 0.98, 0]}>
          <Cyl p={[0, 0, 0]} r={0.06} h={0.4} c={color} seg={10} />
          <mesh position={[0, 0.3, 0]}><coneGeometry args={[0.17, 0.25, 16]} /><M c={color} /></mesh>
        </group>
      </Float>
      <group position={[0.1, 1.75, 0]} scale={0.85}>
        {[[-0.35, 0, 0, 0.32], [0.05, 0.12, 0, 0.42], [0.45, 0, 0, 0.3], [0.05, -0.08, 0.15, 0.3]].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]}><sphereGeometry args={[r, 18, 14]} /><M c="#F8FAFC" /></mesh>
        ))}
      </group>
    </group>
  )
}

/** A clipboard with a checklist and a magnifying glass. */
function ReviewProp({ color }: { color: string }) {
  return (
    <group position={[-0.5, 0, -0.6]}>
      <group rotation={[-0.18, 0, 0]} position={[0, 0.85, 0]}>
        <B p={[0, 0, 0]} s={[1.1, 1.5, 0.08]} c="#B45309" />
        <B p={[0, -0.05, 0.05]} s={[0.95, 1.25, 0.02]} c="#FFFFFF" />
        <B p={[0, 0.72, 0.06]} s={[0.4, 0.14, 0.06]} c="#94A3B8" />
        {[0.35, 0.05, -0.25].map((y, i) => (
          <group key={y}>
            <B p={[-0.3, y, 0.07]} s={[0.16, 0.16, 0.01]} c={i < 2 ? '#DCFCE7' : '#F1F5F9'} />
            {i < 2 && <Tick p={[-0.3, y, 0.08]} s={0.45} />}
            <B p={[0.12, y, 0.07]} s={[0.5, 0.05, 0.01]} c="#CBD5E1" />
          </group>
        ))}
      </group>
      <group position={[1.05, 0.75, 0.75]} rotation={[0.3, -0.6, 0.5]}>
        <mesh><torusGeometry args={[0.3, 0.06, 10, 28]} /><M c={color} /></mesh>
        <mesh><circleGeometry args={[0.28, 24]} /><meshStandardMaterial color="#BAE6FD" transparent opacity={0.55} side={THREE.DoubleSide} /></mesh>
        <Cyl p={[0, -0.5, 0]} r={0.05} h={0.45} c="#334155" seg={10} />
      </group>
    </group>
  )
}

/** A document with a big green "approved" tick and a stamp. */
function ApprovalProp({ color }: { color: string }) {
  return (
    <group position={[-0.5, 0, -0.6]}>
      <B p={[0, 0.8, 0]} s={[1.05, 1.45, 0.06]} c="#FFFFFF" />
      {[1.3, 1.15, 1.0, 0.85].map((y) => <B key={y} p={[0, y, 0.035]} s={[0.75, 0.05, 0.01]} c="#CBD5E1" />)}
      <mesh position={[0.1, 0.45, 0.05]}><circleGeometry args={[0.3, 28]} /><M c="#16A34A" /></mesh>
      <Tick p={[0.1, 0.45, 0.07]} s={0.9} c="#FFFFFF" />
      <group position={[1.1, 0, 0.7]}>
        <Cyl p={[0, 0.1, 0]} r={0.32} h={0.2} c={color} />
        <Cyl p={[0, 0.35, 0]} r={0.08} h={0.35} c="#7C2D12" seg={10} />
        <mesh position={[0, 0.6, 0]}><sphereGeometry args={[0.16, 14, 12]} /><M c="#7C2D12" /></mesh>
      </group>
    </group>
  )
}

/** Stacked database discs: information saved and kept. */
function DatabaseProp({ color }: { color: string }) {
  return (
    <group position={[-0.5, 0, -0.5]}>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[0, 0.25 + i * 0.48, 0]}>
          <Cyl p={[0, 0, 0]} r={0.62} h={0.4} c={i === 2 ? color : tint(color, 0.55 - i * 0.12)} seg={32} />
          <mesh position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.4, 0.46, 32]} /><meshBasicMaterial color="#FFFFFF" transparent opacity={0.6} /></mesh>
          <mesh position={[0.44, 0, 0.44]}><sphereGeometry args={[0.05, 10, 8]} /><meshBasicMaterial color="#4ADE80" /></mesh>
        </group>
      ))}
      <group position={[1.2, 0, 0.55]}>
        <B p={[0, 0.5, 0]} s={[0.08, 0.6, 0.3]} c="#E2E8F0" />
        <B p={[0.02, 0.85, 0]} s={[0.05, 0.08, 0.6]} c="#334155" />
        <B p={[0, 0.03, 0]} s={[0.4, 0.06, 0.4]} c="#94A3B8" />
      </group>
    </group>
  )
}

/** An envelope and a mailbox: someone is told or sent something. */
function MessageProp({ color }: { color: string }) {
  return (
    <group position={[-0.5, 0, -0.5]}>
      <Float speed={2} floatIntensity={0.5} rotationIntensity={0.15}>
        <group position={[0, 1.0, 0]} rotation={[0, Math.PI / 4, 0]}>
          <B p={[0, 0, 0]} s={[1.2, 0.8, 0.08]} c="#FFFFFF" />
          <B p={[-0.3, 0.12, 0.05]} s={[0.72, 0.06, 0.01]} c={color} r={[0, 0, -0.58]} />
          <B p={[0.3, 0.12, 0.05]} s={[0.72, 0.06, 0.01]} c={color} r={[0, 0, 0.58]} />
          <mesh position={[0.42, 0.28, 0.06]}><circleGeometry args={[0.1, 16]} /><meshBasicMaterial color="#EF4444" /></mesh>
        </group>
      </Float>
      <group position={[1.15, 0, 0.6]}>
        <Cyl p={[0, 0.35, 0]} r={0.05} h={0.7} c="#475569" seg={8} />
        <B p={[0, 0.85, 0]} s={[0.36, 0.32, 0.55]} c={color} />
        <Cyl p={[0, 1.01, 0]} r={0.18} h={0.55} c={color} rot={[Math.PI / 2, 0, 0]} />
        <B p={[0.21, 1.0, 0.1]} s={[0.03, 0.3, 0.08]} c="#EF4444" />
      </group>
    </group>
  )
}

/** A warning sign, cones and a flashing light: something went wrong or needs escalating. */
function AlertProp() {
  const light = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => { if (light.current) light.current.emissiveIntensity = Math.sin(clock.elapsedTime * 6) > 0 ? 1.4 : 0.15 })
  return (
    <group position={[-0.5, 0, -0.5]}>
      <Cyl p={[0, 0.5, 0]} r={0.04} h={1} c="#475569" seg={8} />
      <group position={[0, 1.25, 0.03]} rotation={[0, Math.PI / 4, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.62, 0.62, 0.06, 3]} /><M c="#FBBF24" /></mesh>
        <B p={[0, 0.04, 0.04]} s={[0.08, 0.32, 0.02]} c="#151A25" />
        <B p={[0, -0.22, 0.04]} s={[0.08, 0.08, 0.02]} c="#151A25" />
      </group>
      {[[0.95, 0.55], [1.35, -0.1]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <B p={[0, 0.03, 0]} s={[0.42, 0.06, 0.42]} c="#EA580C" />
          <mesh position={[0, 0.33, 0]}><coneGeometry args={[0.17, 0.6, 18]} /><M c="#F97316" /></mesh>
          <Cyl p={[0, 0.33, 0]} r={[0.09, 0.12]} h={0.1} c="#FFFFFF" />
        </group>
      ))}
      <group position={[-0.2, 0, 1.1]}>
        <Cyl p={[0, 0.08, 0]} r={0.22} h={0.16} c="#334155" />
        <mesh position={[0, 0.3, 0]}><sphereGeometry args={[0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial ref={light} color="#EF4444" emissive="#EF4444" emissiveIntensity={1} /></mesh>
      </group>
    </group>
  )
}

/** A padlock and a signed form: consent, privacy and security. */
function ConsentProp({ color }: { color: string }) {
  return (
    <group position={[-0.5, 0, -0.5]}>
      <B p={[0, 0.45, 0]} s={[0.95, 0.85, 0.45]} c="#F59E0B" />
      <mesh position={[0, 0.88, 0]}><torusGeometry args={[0.32, 0.08, 10, 24, Math.PI]} /><M c="#94A3B8" /></mesh>
      <Cyl p={[0, 0.88, 0]} r={0.08} h={0.01} c="#94A3B8" />
      <mesh position={[0, 0.5, 0.23]}><circleGeometry args={[0.1, 16]} /><M c="#78350F" /></mesh>
      <B p={[0, 0.36, 0.23]} s={[0.06, 0.2, 0.01]} c="#78350F" />
      <group position={[1.15, 0.03, 0.65]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <B p={[0, 0, 0]} s={[0.7, 0.9, 0.03]} c="#FFFFFF" />
        {[0.25, 0.1, -0.05].map((y) => <B key={y} p={[0, y, 0.02]} s={[0.5, 0.04, 0.01]} c="#CBD5E1" />)}
        <B p={[0, -0.28, 0.02]} s={[0.45, 0.03, 0.01]} c={color} r={[0, 0, 0.15]} />
      </group>
      <Cyl p={[1.45, 0.08, 0.45]} r={0.04} h={0.6} c={color} seg={8} rot={[0, 0, Math.PI / 2.4]} />
    </group>
  )
}

/** Archive boxes and a bin: closing, removing access, deleting what's no longer needed. */
function ArchiveProp({ color }: { color: string }) {
  return (
    <group position={[-0.5, 0, -0.5]}>
      {[[0, 0, 0], [0.75, 0, 0.05], [0.35, 0.55, 0]].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <B p={[0, 0.27, 0]} s={[0.7, 0.5, 0.55]} c="#D9A066" />
          <B p={[0, 0.54, 0]} s={[0.74, 0.08, 0.59]} c="#C98A4E" />
          <B p={[0, 0.3, 0.28]} s={[0.3, 0.14, 0.01]} c="#FFFFFF" />
        </group>
      ))}
      <group position={[0.4, 0, 1.15]}>
        <Cyl p={[0, 0.3, 0]} r={[0.3, 0.24]} h={0.6} c={color} />
        <Cyl p={[0, 0.62, 0]} r={0.33} h={0.06} c={tint(color, 0.5)} />
        <B p={[0, 0.7, 0]} s={[0.2, 0.06, 0.06]} c={tint(color, 0.5)} />
      </group>
    </group>
  )
}

/** Two people passing a package: handing work over. */
function HandoverProp({ color }: { color: string }) {
  return (
    <group position={[-0.4, 0, -0.5]}>
      <group rotation={[0, Math.PI / 2, 0]}><Person p={[0, 0, -0.55]} color="#2563EB" scale={1.15} /></group>
      <group rotation={[0, -Math.PI / 2, 0]}><Person p={[0, 0, -0.55]} color="#DB2777" scale={1.15} /></group>
      <Float speed={2.5} floatIntensity={0.4} rotationIntensity={0}>
        <group position={[0, 0.85, 0]}>
          <B p={[0, 0, 0]} s={[0.42, 0.32, 0.36]} c="#D9A066" />
          <B p={[0, 0, 0]} s={[0.44, 0.06, 0.38]} c={color} />
          <B p={[0, 0, 0]} s={[0.06, 0.34, 0.38]} c={color} />
        </group>
      </Float>
      <mesh position={[0, 1.45, 0]} rotation={[0, Math.PI / 4, Math.PI / 2]}><coneGeometry args={[0.12, 0.25, 3]} /><M c={color} /></mesh>
    </group>
  )
}

/** A phone with a speech bubble: someone is contacted. */
function PhoneProp({ color }: { color: string }) {
  return (
    <group position={[-0.4, 0, -0.5]} rotation={[0, Math.PI / 4, 0]}>
      <B p={[0, 0.8, 0]} s={[0.8, 1.5, 0.12]} c="#1E293B" />
      <mesh position={[0, 0.82, 0.065]}><planeGeometry args={[0.66, 1.2]} /><M c={tint(color, 0.45)} e={0.25} /></mesh>
      <Cyl p={[0, 1.15, 0.07]} r={0.12} h={0.02} c="#FFFFFF" rot={[Math.PI / 2, 0, 0]} />
      <B p={[0, 0.72, 0.07]} s={[0.4, 0.06, 0.01]} c="#FFFFFF" />
      <B p={[0, 0.58, 0.07]} s={[0.3, 0.06, 0.01]} c="#FFFFFF" />
      <Float speed={2.4} floatIntensity={0.6} rotationIntensity={0}>
        <group position={[0.75, 1.75, 0]}>
          <mesh scale={[1, 0.7, 0.4]}><sphereGeometry args={[0.38, 18, 14]} /><M c="#FFFFFF" /></mesh>
          <mesh position={[-0.22, -0.28, 0]} rotation={[0, 0, 0.6]}><coneGeometry args={[0.08, 0.2, 8]} /><M c="#FFFFFF" /></mesh>
          {[-0.14, 0, 0.14].map((x) => <mesh key={x} position={[x, 0, 0.16]}><sphereGeometry args={[0.045, 8, 6]} /><meshBasicMaterial color={color} /></mesh>)}
        </group>
      </Float>
    </group>
  )
}

/** A board with a bar chart: checking how it's going and reporting. */
function ReportProp({ color }: { color: string }) {
  return (
    <group position={[-0.4, 0, -0.7]}>
      <Cyl p={[-0.65, 0.5, 0]} r={0.04} h={1} c="#64748B" seg={8} />
      <Cyl p={[0.65, 0.5, 0]} r={0.04} h={1} c="#64748B" seg={8} />
      <B p={[0, 1.3, 0]} s={[1.7, 1.15, 0.08]} c="#FFFFFF" />
      {[0.35, 0.6, 0.45, 0.85].map((h, i) => <B key={i} p={[-0.52 + i * 0.35, 0.83 + h / 2, 0.05]} s={[0.22, h, 0.03]} c={i === 3 ? color : tint(color, 0.45)} />)}
      <B p={[0, 0.8, 0.05]} s={[1.4, 0.03, 0.02]} c="#94A3B8" />
      <Tick p={[0.65, 1.68, 0.06]} s={0.5} />
    </group>
  )
}

/** A round table with people around it: a meeting or a second opinion. */
function MeetingProp({ color }: { color: string }) {
  return (
    <group position={[-0.3, 0, -0.4]}>
      <Cyl p={[0, 0.25, 0]} r={0.08} h={0.5} c="#64748B" seg={10} />
      <Cyl p={[0, 0.52, 0]} r={0.62} h={0.07} c="#F8FAFC" seg={32} />
      <B p={[-0.15, 0.57, 0.1]} s={[0.35, 0.02, 0.25]} c="#FFFFFF" r={[0, 0.4, 0]} />
      <B p={[0.2, 0.57, -0.1]} s={[0.3, 0.02, 0.22]} c={tint(color, 0.5)} r={[0, -0.3, 0]} />
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.4
        return <Person key={i} p={[Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95]} color={['#2563EB', color, '#16A34A'][i]} seated />
      })}
    </group>
  )
}

/** A calm therapy room: two armchairs, a small table and a plant. */
function ClinicProp({ color }: { color: string }) {
  const chair = (p: V3, rot: number, c: string) => (
    <group position={p} rotation={[0, rot, 0]}>
      <B p={[0, 0.22, 0]} s={[0.6, 0.24, 0.55]} c={c} />
      <B p={[0, 0.5, -0.24]} s={[0.6, 0.55, 0.12]} c={c} />
      <B p={[-0.3, 0.38, 0]} s={[0.1, 0.22, 0.55]} c={tint(c, 0.6)} />
      <B p={[0.3, 0.38, 0]} s={[0.1, 0.22, 0.55]} c={tint(c, 0.6)} />
    </group>
  )
  return (
    <group position={[-0.4, 0, -0.4]}>
      <Cyl p={[0, 0.015, 0]} r={1.1} h={0.03} c={tint(color, 0.3)} seg={36} />
      {chair([-0.65, 0, -0.35], Math.PI / 4, color)}
      {chair([0.65, 0, 0.35], Math.PI + Math.PI / 4, '#94A3B8')}
      <Cyl p={[0.05, 0.22, -0.05]} r={0.22} h={0.04} c="#FFFFFF" />
      <Cyl p={[0.05, 0.11, -0.05]} r={0.04} h={0.2} c="#64748B" seg={8} />
      <group position={[-0.95, 0, 0.75]}>
        <Cyl p={[0, 0.15, 0]} r={[0.17, 0.13]} h={0.3} c="#C2410C" />
        <mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.3, 14, 12]} /><M c="#16A34A" /></mesh>
        <mesh position={[0.15, 0.72, 0.05]}><sphereGeometry args={[0.18, 12, 10]} /><M c="#22C55E" /></mesh>
      </group>
    </group>
  )
}

/** A finish flag and a ticked box: wrapping up. */
function FinishProp({ color }: { color: string }) {
  const flag = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 2) * 0.15 })
  return (
    <group position={[-0.5, 0, -0.5]}>
      <Cyl p={[0, 0.9, 0]} r={0.04} h={1.8} c="#475569" seg={8} />
      <group ref={flag} position={[0, 1.55, 0]}>
        {[0, 1, 2, 3].flatMap((c) => [0, 1].map((r) => <B key={`${c}${r}`} p={[0.12 + c * 0.17, -r * 0.17, 0]} s={[0.17, 0.17, 0.02]} c={(c + r) % 2 ? '#FFFFFF' : '#151A25'} />))}
      </group>
      <group position={[1.1, 0, 0.6]}>
        <B p={[0, 0.3, 0]} s={[0.6, 0.6, 0.6]} c={color} />
        <Tick p={[0, 0.32, 0.31]} s={1.1} c="#FFFFFF" />
      </group>
    </group>
  )
}

const NEW_PROPS = new Set(['recording', 'upload', 'review', 'approval', 'database', 'message', 'alert', 'consent', 'archive', 'handover', 'phone', 'report', 'meeting', 'clinic', 'finish'])
function Scenery({ kind, color }: { kind: string; color: string }) {
  // the newer props are drawn a bit bigger so they read clearly next to the people
  return NEW_PROPS.has(kind) ? <group scale={1.25} position={[-0.15, 0, -0.15]}><SceneryInner kind={kind} color={color} /></group> : <SceneryInner kind={kind} color={color} />
}
function SceneryInner({ kind, color }: { kind: string; color: string }) {
  switch (kind) {
    case 'recording': return <RecordingProp color={color} />
    case 'upload': return <UploadProp color={color} />
    case 'review': return <ReviewProp color={color} />
    case 'approval': return <ApprovalProp color={color} />
    case 'database': return <DatabaseProp color={color} />
    case 'message': return <MessageProp color={color} />
    case 'alert': return <AlertProp />
    case 'consent': return <ConsentProp color={color} />
    case 'archive': return <ArchiveProp color={color} />
    case 'handover': return <HandoverProp color={color} />
    case 'phone': return <PhoneProp color={color} />
    case 'report': return <ReportProp color={color} />
    case 'meeting': return <MeetingProp color={color} />
    case 'clinic': return <ClinicProp color={color} />
    case 'finish': return <FinishProp color={color} />
    case 'home':
      return (
        <group position={[-0.4, 0, -0.4]}>
          <B p={[0, 0.45, 0]} s={[1.4, 0.9, 1.2]} c="#FFE6CC" />
          <mesh position={[0, 1.22, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[1.12, 0.65, 4]} /><M c="#E07A2E" /></mesh>
          <B p={[0.25, 0.3, 0.61]} s={[0.3, 0.6, 0.02]} c="#9A4A00" />
          <B p={[-0.35, 0.55, 0.61]} s={[0.32, 0.26, 0.02]} c="#FFFFFF" />
          <B p={[0.71, 0.55, -0.1]} s={[0.02, 0.26, 0.32]} c="#FFF4E6" />
          <B p={[0.35, 1.3, -0.2]} s={[0.18, 0.4, 0.18]} c="#9A4A00" />
        </group>
      )
    case 'office':
      return (
        <group position={[-0.5, 0, -0.5]}>
          <B p={[0, 1.05, 0]} s={[1.1, 2.1, 1.1]} c={color} />
          {[0.45, 0.95, 1.45].map((y) => (
            <group key={y}>
              <B p={[0, y + 0.1, 0.56]} s={[0.9, 0.22, 0.02]} c={tint(color, 0.25)} />
              <B p={[0.56, y + 0.1, 0]} s={[0.02, 0.22, 0.9]} c={tint(color, 0.4)} />
            </group>
          ))}
          <B p={[0, 2.16, 0]} s={[0.9, 0.12, 0.9]} c={tint(color, 0.5)} />
          <B p={[1.25, 0.25, 0.6]} s={[0.9, 0.5, 0.5]} c="#F8FAFC" />
        </group>
      )
    case 'calendar':
      return (
        <group position={[-0.3, 0, -0.9]}>
          <B p={[0, 0.85, 0]} s={[1.8, 1.4, 0.12]} c="#FFFFFF" />
          <B p={[0, 1.42, 0.07]} s={[1.8, 0.26, 0.02]} c={color} />
          {[0, 1, 2].flatMap((r) => [0, 1, 2, 3].map((c) => (
            <B key={`${r}${c}`} p={[-0.6 + c * 0.4, 1.05 - r * 0.3, 0.07]} s={[0.3, 0.2, 0.02]} c={r === 1 && c === 2 ? color : tint(color, 0.22)} />
          )))}
          <B p={[0.9, 0.2, 1.1]} s={[0.8, 0.4, 0.5]} c="#E2E8F0" />
          <B p={[0.9, 0.55, 0.9]} s={[0.6, 0.38, 0.04]} c="#334155" r={[-0.25, 0, 0]} />
        </group>
      )
    case 'classroom':
      return (
        <group>
          <B p={[-0.2, 0.9, -1.2]} s={[2.0, 1.1, 0.08]} c="#FFFFFF" />
          <B p={[-0.2, 0.9, -1.15]} s={[1.0, 0.04, 0.01]} c={color} r={[0, 0, 0.3]} />
          {[[-0.8, -0.1], [0, -0.1], [-0.8, 0.7], [0, 0.7]].map(([x, z], i) => (
            <group key={i}>
              <B p={[x, 0.15, z]} s={[0.5, 0.3, 0.4]} c="#CBD5E1" />
              <Person p={[x, 0.2, z + 0.35]} color="#DB2777" seated scale={0.85} />
            </group>
          ))}
        </group>
      )
    case 'records':
      return (
        <group position={[-0.6, 0, -0.6]}>
          {[0, 0.75].map((x) => (
            <group key={x}>
              <B p={[x, 0.9, 0]} s={[0.6, 1.8, 0.8]} c="#1E293B" />
              {[0.3, 0.6, 0.9, 1.2, 1.5].map((y, i) => <mesh key={y} position={[x - 0.15, y, 0.41]}><boxGeometry args={[0.18, 0.05, 0.01]} /><M c={i % 2 ? '#4ADE80' : '#A78BFA'} e={0.6} /></mesh>)}
            </group>
          ))}
          <B p={[1.7, 0.2, 0.4]} s={[0.9, 0.4, 0.5]} c="#E2E8F0" />
          <B p={[1.7, 0.75, 0.3]} s={[0.8, 0.55, 0.06]} c={color} />
          <mesh position={[1.7, 0.75, 0.34]}><boxGeometry args={[0.7, 0.45, 0.01]} /><M c={tint(color, 0.35)} e={0.15} /></mesh>
        </group>
      )
    case 'payment':
      return (
        <group position={[-0.4, 0, -0.4]}>
          {[0, 1, 2, 3].map((i) => <mesh key={i} position={[0, 0.07 + i * 0.13, 0]}><cylinderGeometry args={[0.45, 0.45, 0.12, 28]} /><M c={i % 2 ? '#F59E0B' : '#FBBF24'} /></mesh>)}
          {[0, 1].map((i) => <mesh key={i} position={[0.9, 0.07 + i * 0.13, 0.4]}><cylinderGeometry args={[0.45, 0.45, 0.12, 28]} /><M c={i % 2 ? '#F59E0B' : '#FBBF24'} /></mesh>)}
          <B p={[-0.2, 0.55, 1.0]} s={[0.7, 0.9, 0.12]} c={color} r={[-0.2, 0.3, 0]} />
        </group>
      )
    case 'delivery':
      return (
        <group position={[-0.5, 0, -0.3]} rotation={[0, -0.4, 0]}>
          <B p={[0, 0.55, 0]} s={[1.6, 0.8, 0.8]} c="#FFFFFF" />
          <B p={[1.05, 0.45, 0]} s={[0.55, 0.6, 0.78]} c={color} />
          <B p={[1.2, 0.6, 0]} s={[0.3, 0.25, 0.8]} c="#BCD0F5" />
          {[[-0.5, 0.42], [-0.5, -0.42], [0.95, 0.42], [0.95, -0.42]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.17, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.17, 0.17, 0.1, 18]} /><M c="#151A25" /></mesh>
          ))}
          <B p={[-0.3, 0.2, 1.1]} s={[0.4, 0.4, 0.4]} c="#D9A066" />
          <B p={[0.2, 0.15, 1.2]} s={[0.3, 0.3, 0.3]} c="#C98A4E" />
        </group>
      )
    case 'ai':
      return <AiCore color={color} />
    default:
      return (
        <group position={[-0.5, 0, -0.5]}>
          <B p={[0, 0.6, 0]} s={[1.4, 1.2, 1.2]} c={color} />
          <B p={[0, 1.25, 0]} s={[1.5, 0.1, 1.3]} c={tint(color, 0.5)} />
          <B p={[0, 0.35, 0.61]} s={[0.4, 0.7, 0.02]} c="#FFFFFF" />
        </group>
      )
  }
}

/* ---------- inside an island: one platform per step ---------- */
export interface WalkView { done: Set<string>; current?: string; finished: boolean; nonce: number }

/** Where each step's platform sits on its island (island-local coords), left→right across the screen. */
export function stepSpots(count: number): V3[] {
  const R = Math.SQRT1_2
  if (count > 4) {
    // two rows that snake back, so 5-10 steps still fit on the island without touching
    const cols = Math.ceil(count / 2)
    return Array.from({ length: count }, (_, i) => {
      const row = Math.floor(i / cols)
      const c = row ? cols - 1 - (i - cols) : i
      const u = -1.25 + (cols === 1 ? 1.25 : (2.5 * c) / (cols - 1))
      const w = row ? 0.7 : -0.7
      return [(u + w) * R, 0, (-u + w) * R]
    })
  }
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const u = -1.3 + 2.6 * t
    const w = count > 2 ? (i % 2 ? 0.5 : -0.5) : 0
    return [(u + w) * R, 0, (-u + w) * R]
  })
}

function StepPlatforms({ process, stageId, color, selected, hoverStep, onStep, walk, showLabels }: {
  process: Process; stageId: string; color: string; selected?: string | null; hoverStep?: string | null
  onStep?: (id: string) => void; walk?: WalkView | null; showLabels: boolean
}) {
  const steps = process.steps.filter((x) => x.stageId === stageId && (x.kind === 'step' || x.kind === 'decision'))
  const spots = stepSpots(steps.length)
  const grp = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (grp.current) grp.current.scale.setScalar(THREE.MathUtils.damp(grp.current.scale.x, 1, 6, dt)) })
  const at = (id: string) => spots[steps.findIndex((x) => x.id === id)]
  const noLinks = process.edges.filter((e) => /^no$/i.test(e.label ?? '') && at(e.from) && at(e.to))
  return (
    <group ref={grp} scale={0.01}>
      {spots.slice(1).map((q, i) => <Line key={i} points={[[spots[i][0], 0.12, spots[i][2]], [q[0], 0.12, q[2]]]} color={color} lineWidth={3} />)}
      {noLinks.map((e) => {
        const a = at(e.from), b = at(e.to)
        return <QuadraticBezierLine key={e.id} start={[a[0], 0.2, a[2]]} end={[b[0], 0.2, b[2]]} mid={[(a[0] + b[0]) / 2 - 0.4, 1.4, (a[2] + b[2]) / 2 - 0.4]} color="#F97316" lineWidth={2.5} dashed dashSize={0.12} gapSize={0.08} />
      })}
      {steps.map((st, i) => {
        const q = spots[i]
        const role = process.roles.find((r) => r.id === st.roleId)
        const isDone = walk?.done.has(st.id)
        const isCur = walk?.current === st.id
        const isSel = selected === st.id || hoverStep === st.id
        const dec = st.kind === 'decision'
        const top = isDone ? '#BBF7D0' : dec ? '#FDE68A' : '#FFFFFF'
        const res = (st.resourceIds ?? []).length
        return (
          <group key={st.id} position={q}
            onClick={(e) => { e.stopPropagation(); onStep?.(st.id) }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { document.body.style.cursor = '' }}>
            <mesh position={[0, 0.08, 0]} rotation={[0, dec ? Math.PI / 4 : 0, 0]}><boxGeometry args={[0.66, 0.16, 0.66]} /><M c={isCur ? color : isDone ? '#16A34A' : tint(color, 0.55)} /></mesh>
            <mesh position={[0, 0.17, 0]} rotation={[0, dec ? Math.PI / 4 : 0, 0]}><boxGeometry args={[0.6, 0.03, 0.6]} /><M c={top} e={isCur ? 0.2 : 0} /></mesh>
            {(isSel || isCur) && <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.46, 0.53, 32]} /><meshBasicMaterial color={isCur ? '#F59E0B' : color} /></mesh>}
            {role && (roleKind(role) === 'agent'
              ? <group scale={0.62}><Robot p={[0, 0.3, -0.05]} color={role.color} /></group>
              : <Person p={[0, 0.19, -0.05]} color={role.color} scale={0.8} />)}
            {isDone && !isCur && <mesh position={[0.24, 0.62, 0.24]}><sphereGeometry args={[0.1, 12, 10]} /><meshBasicMaterial color="#16A34A" /></mesh>}
            {showLabels && steps.length > 3 && !isSel && !isCur && (
              <Html position={[0.35, 0.05, 0.35]} center zIndexRange={[13, 0]} style={{ pointerEvents: 'none' }}>
                <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-white px-1 text-[11px] font-extrabold text-white shadow" style={{ background: dec ? '#D97706' : isDone ? '#16A34A' : color }}>{dec ? '?' : i + 1}</span>
              </Html>
            )}
            {showLabels && (steps.length <= 3 || isSel || isCur) && (
              <Html position={[0.55, -0.1, 0.55]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
                <div className="flex w-[150px] items-start gap-1.5 rounded-xl border bg-white px-2 py-1 shadow-sm" style={{ borderColor: isSel || isCur ? color : '#D3D7E2' }}>
                  <span className="mt-px flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: dec ? '#D97706' : isDone ? '#16A34A' : color }}>{dec ? '?' : i + 1}</span>
                  <span className="flex flex-col text-[11px] font-bold leading-tight text-[#151A25]">{st.label}
                    <span className="text-[10px] font-semibold text-[#4A5163]">{role?.name}{res ? ` · ${res} doc${res > 1 ? 's' : ''}` : ''}</span></span>
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}

/* ---------- one floating island ---------- */
interface IslandProps {
  pos: V3; color: string; top: string; side: string
  active?: boolean; hovered?: boolean; dim?: boolean
  onClick?: () => void; onOver?: () => void; onOut?: () => void
  children?: React.ReactNode
}
function Island({ pos, color, top, side, active, hovered, dim, onClick, onOver, onOut, children }: IslandProps) {
  const ref = useRef<THREE.Group>(null)
  const lift = active ? 0.45 : hovered ? 0.22 : 0
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, pos[1] + lift, 8, dt)
  })
  useEffect(() => {
    ref.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m && 'opacity' in m) { m.transparent = true; m.opacity = dim ? 0.22 : 1; m.depthWrite = !dim }
    })
  }, [dim, children])
  return (
    <group ref={ref} position={pos}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      onPointerOver={(e) => { e.stopPropagation(); onOver?.(); if (onClick) document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { onOut?.(); document.body.style.cursor = '' }}>
      <mesh position={[0, -0.32, 0]}><boxGeometry args={[3.6, 0.64, 3.6]} /><M c={side} /></mesh>
      <mesh position={[0, 0.01, 0]}><boxGeometry args={[3.62, 0.04, 3.62]} /><M c={top} /></mesh>
      <mesh position={[0, -1.25, 0]}><cylinderGeometry args={[1.55, 0.35, 1.25, 6]} /><meshStandardMaterial color="#94A3B8" roughness={0.9} flatShading /></mesh>
      {active && <Pulse color={color} />}
      {children}
    </group>
  )
}

function Pulse({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = (clock.elapsedTime % 1.6) / 1.6
    ref.current.scale.setScalar(1 + t * 0.35)
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = 1 - t
  })
  return (
    <mesh ref={ref} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[2.45, 2.6, 4, 1, Math.PI / 4]} />
      <meshBasicMaterial color={color} transparent />
    </mesh>
  )
}

/* ---------- bridges with moving dots (and walk progress) ---------- */
export type BridgeState = 'plain' | 'done' | 'next' | 'todo'
/** A flat strip that follows a curve (the road surface). */
function ribbon(curve: THREE.Curve<THREE.Vector3>, width: number, y: number, seg = 36) {
  const pts = curve.getSpacedPoints(seg)
  const pos: number[] = [], idx: number[] = []
  pts.forEach((p, i) => {
    const t = curve.getTangentAt(Math.min(1, i / seg))
    const nx = -t.z, nz = t.x, l = Math.hypot(nx, nz) || 1
    const ox = (nx / l) * width / 2, oz = (nz / l) * width / 2
    pos.push(p.x + ox, y, p.z + oz, p.x - ox, y, p.z - oz)
    if (i < seg) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx); g.computeVertexNormals()
  return g
}

/** A curved road between two islands, with moving dots (and walk progress). */
function Bridge({ curve, state = 'plain', color = '#1D4ED8' }: { curve: THREE.Curve<THREE.Vector3>; state?: BridgeState; color?: string }) {
  const dots = useRef<THREE.Group>(null)
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  const deckG = useMemo(() => ribbon(curve, 0.55, -0.08), [curve])
  const edgeG = useMemo(() => ribbon(curve, 0.72, -0.15), [curve])
  const glowG = useMemo(() => ribbon(curve, 1.0, -0.12), [curve])
  const len = useMemo(() => curve.getLength(), [curve])
  useFrame(({ clock }) => {
    dots.current?.children.forEach((c, i) => {
      const t = ((clock.elapsedTime * (state === 'next' ? 0.7 : 0.35) * (5.4 / len) + i / 4) % 1)
      const q = curve.getPointAt(t); c.position.set(q.x, -0.02, q.z)
    })
    if (glow.current) glow.current.opacity = state === 'next' ? 0.35 + Math.sin(clock.elapsedTime * 4) * 0.25 : state === 'done' ? 0.55 : 0
  })
  const deck = state === 'done' ? color : state === 'todo' ? '#E2E8F0' : '#FFFFFF'
  return (
    <group>
      <mesh geometry={edgeG}><meshStandardMaterial color="#CBD5E1" side={THREE.DoubleSide} roughness={0.9} /></mesh>
      <mesh geometry={deckG}><meshStandardMaterial color={deck} side={THREE.DoubleSide} roughness={0.78} emissive={deck} emissiveIntensity={state === 'done' ? 0.25 : 0} /></mesh>
      {(state === 'done' || state === 'next') && <mesh geometry={glowG}><meshBasicMaterial ref={glow} color={color} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} /></mesh>}
      {state !== 'done' && state !== 'todo' && <group ref={dots}>{[0, 1, 2, 3].map((i) => <mesh key={i}><sphereGeometry args={[0.07, 10, 8]} /><meshBasicMaterial color={state === 'next' ? color : '#1D4ED8'} /></mesh>)}</group>}
    </group>
  )
}

/** How many islands per row: one row for short processes, then a winding road of 2-3 rows. */
const GAP = 5.4, ROW_GAP = 11
/** In the quiet overview, names sit just below an island's front corner so they don't cover it. */
const LABEL_Q: V3 = [2.25, -1.55, 2.25]
/** How far the camera has to see for a layout (screen units), used to fit it. */
export const layoutSpan = (cols: number, rows: number, s = 1, rs = s) => ({
  w: (cols - 1) * GAP * s + 5.2 + (rows > 1 ? 3.5 * s : 0),
  h: rows > 1 ? 9.5 + (rows - 1) * ROW_GAP * rs * 0.5 : 11.5,
})
/** Islands per row: whichever of 1, 2 or 3 rows shows the islands biggest in this space. Phones get 2 per row. */
export function roadLayout(items: number, narrow = false, w = 1200, h = 450, s = 1, rs = s) {
  if (narrow) return { cols: 2, rows: Math.ceil(items / 2) }
  let best = { cols: items, rows: 1 }, top = 0
  for (let r = 1; r <= 3; r++) {
    const cols = Math.ceil(items / r), rows = Math.ceil(items / cols)
    if (r > 1 && cols < 3) break
    const sp = layoutSpan(cols, rows, s, rs)
    const z = Math.min(w / (sp.w * 1.04), h / sp.h)
    if (z > top * 1.04) { top = z; best = { cols, rows } } // a clear win is needed to add a row
  }
  return best
}

/** A small green flag planted on an island the walker has finished. */
const DoneFlag = () => (
  <Float speed={3} floatIntensity={0.3} rotationIntensity={0}>
    <group position={[-1.35, 0, -1.2]}>
      <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.03, 0.03, 1.2, 6]} /><M c="#334155" /></mesh>
      <mesh position={[0.28, 1.05, 0]}><boxGeometry args={[0.55, 0.32, 0.03]} /><M c="#16A34A" /></mesh>
      <mesh position={[0.28, 1.05, 0.02]} rotation={[0, 0, -0.75]}><boxGeometry args={[0.08, 0.2, 0.02]} /><meshBasicMaterial color="#FFFFFF" /></mesh>
      <mesh position={[0.38, 1.08, 0.02]} rotation={[0, 0, 0.75]}><boxGeometry args={[0.07, 0.3, 0.02]} /><meshBasicMaterial color="#FFFFFF" /></mesh>
    </group>
  </Float>
)

/** Celebration burst: a short shower of coloured confetti whenever `nonce` changes. */
function Confetti({ at, nonce }: { at: V3; nonce: number }) {
  const g = useRef<THREE.Group>(null)
  const parts = useMemo(() => Array.from({ length: 46 }, () => ({
    v: new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4),
    r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
    c: ['#F59E0B', '#2563EB', '#16A34A', '#DB2777', '#7C3AED', '#F97316'][Math.floor(Math.random() * 6)],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [nonce])
  const t0 = useRef(-1)
  useEffect(() => { t0.current = -1 }, [nonce])
  useFrame(({ clock }) => {
    if (!g.current || nonce === 0) return
    if (t0.current < 0) t0.current = clock.elapsedTime
    const t = clock.elapsedTime - t0.current
    g.current.visible = t < 1.8
    g.current.children.forEach((m, i) => {
      const p = parts[i]
      m.position.set(p.v.x * t, p.v.y * t - 4.5 * t * t, p.v.z * t)
      m.rotation.set(p.r.x * t, p.r.y * t, p.r.z * t)
    })
  })
  if (!nonce) return null
  return (
    <group ref={g} position={[at[0], at[1] + 1, at[2]]}>
      {parts.map((p, i) => <mesh key={i}><planeGeometry args={[0.14, 0.09]} /><meshBasicMaterial color={p.c} side={THREE.DoubleSide} /></mesh>)}
    </group>
  )
}

/* ---------- the "I am here" avatar ---------- */
function Avatar({ target, label }: { target: V3; label: string }) {
  const g = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  useFrame(({ clock }, dt) => {
    if (!g.current || !body.current) return
    g.current.position.x = THREE.MathUtils.damp(g.current.position.x, target[0], 5, dt)
    g.current.position.z = THREE.MathUtils.damp(g.current.position.z, target[2], 5, dt)
    g.current.position.y = THREE.MathUtils.damp(g.current.position.y, target[1], 5, dt)
    const t = clock.elapsedTime * 4.2
    const j = Math.abs(Math.sin(t))
    body.current.position.y = j * 0.55
    const squash = j < 0.12 ? 1 - (0.12 - j) * 1.6 : 1
    body.current.scale.set(2 - squash, squash, 2 - squash)
  })
  return (
    <group ref={g} position={target}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><circleGeometry args={[0.32, 24]} /><meshBasicMaterial color="#0B1220" transparent opacity={0.22} /></mesh>
      <group ref={body}>
        <mesh position={[0, 0.42, 0]}><capsuleGeometry args={[0.2, 0.42, 6, 14]} /><M c="#F59E0B" /></mesh>
        <mesh position={[0, 0.95, 0]}><sphereGeometry args={[0.19, 18, 14]} /><M c="#F5D0A9" /></mesh>
        <mesh position={[0, 1.02, -0.02]}><sphereGeometry args={[0.195, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2.2]} /><M c="#3B2A20" /></mesh>
      </group>
      <Html position={[0, 1.95, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="whitespace-nowrap rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-extrabold text-white shadow-lg">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#F59E0B]" />{label}
        </div>
      </Html>
    </group>
  )
}

/** Fits the island chain to the canvas, or glides in on one island when `focus` is set.
 *  Narrow screens follow the current stage. +/- buttons outside change `level`. */
function CameraRig({ span, spanH = 11.5, level, center, focus, narrow, tilt = 0, resetKey = 0 }: { span: number; spanH?: number; level: number; center: V3; focus: V3 | null; narrow: boolean; tilt?: number; resetKey?: number }) {
  const { camera, size, controls } = useThree()
  const goal = useRef({ zoom: 40, t: new THREE.Vector3(), moving: true })
  // where the camera sits relative to what it looks at: the usual corner view, tilted up (more from above) or down
  const off = useRef(new THREE.Vector3(18, 16, 18))
  const offGoal = useMemo(() => {
    const r = Math.hypot(18, 16, 18), polar = THREE.MathUtils.clamp(Math.acos(16 / r) - tilt * 0.14, 0.35, 1.42)
    return new THREE.Vector3(r * Math.sin(polar) * Math.SQRT1_2, r * Math.cos(polar), r * Math.sin(polar) * Math.SQRT1_2)
  }, [tilt])
  useEffect(() => { goal.current.moving = true }, [offGoal])
  // "Reset view": ease back from wherever the mouse left the camera
  useEffect(() => {
    if (!resetKey) return
    const c = controls as unknown as { target?: THREE.Vector3 } | null
    off.current.copy(camera.position).sub(c?.target ?? new THREE.Vector3())
  }, [resetKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fitAll = Math.min(size.width / (span * 1.04), size.height / spanH)
    const zoomIn = Math.min(size.width / 8.5, size.height / 6.2)
    const z = focus ? zoomIn : narrow ? Math.min(size.width / 15.5, size.height / 9) : fitAll
    // when zoomed in on a wide screen, keep the island to the right of the details panel
    const shift = focus && !narrow && size.width > 760 ? 175 / z : 0
    const t = focus ? new THREE.Vector3(focus[0] - shift * Math.SQRT1_2, 0.4, focus[2] + shift * Math.SQRT1_2) : narrow ? new THREE.Vector3(center[0], -0.2, center[2]) : new THREE.Vector3(0, -0.2, 0)
    goal.current = { zoom: z * Math.pow(1.2, level), t, moving: true }
  }, [size.width, size.height, span, spanH, level, narrow, focus?.[0], focus?.[2], center[0], center[2], resetKey])
  useFrame((_, dt) => {
    const g = goal.current
    if (!g.moving) return
    const cam = camera as THREE.OrthographicCamera
    const c = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null
    const cur = c?.target ?? new THREE.Vector3()
    cur.x = THREE.MathUtils.damp(cur.x, g.t.x, 5, dt); cur.y = THREE.MathUtils.damp(cur.y, g.t.y, 5, dt); cur.z = THREE.MathUtils.damp(cur.z, g.t.z, 5, dt)
    cam.zoom = THREE.MathUtils.damp(cam.zoom, g.zoom, 5, dt)
    const o = off.current
    o.x = THREE.MathUtils.damp(o.x, offGoal.x, 5, dt); o.y = THREE.MathUtils.damp(o.y, offGoal.y, 5, dt); o.z = THREE.MathUtils.damp(o.z, offGoal.z, 5, dt)
    cam.position.set(cur.x + o.x, cur.y + o.y, cur.z + o.z)
    cam.lookAt(cur)
    c?.update?.()
    cam.updateProjectionMatrix()
    if (Math.abs(cam.zoom - g.zoom) < 0.05 && cur.distanceTo(g.t) < 0.01 && off.current.distanceTo(offGoal) < 0.01) g.moving = false
  })
  return null
}

const useNarrow = () => {
  const q = '(max-width: 700px)'
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => { const m = window.matchMedia(q); const f = () => setN(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return n
}

/* ---------- the whole scene ---------- */
export interface IslandsProps {
  process: Process
  active: number
  onSelect?: (i: number) => void
  hover?: number | null
  onHover?: (i: number | null) => void
  roleFilter?: string | null
  compact?: boolean
  avatarLabel?: string
  zoomLevel?: number
  /** zoomed-in stage (shows its step platforms) */
  focus?: number | null
  selectedStep?: string | null
  hoverStep?: string | null
  onStep?: (id: string) => void
  /** "Walk it with me" progress */
  walk?: WalkView | null
  /** clicked empty space (used to zoom back out) */
  onBackground?: () => void
  /** the simple overview: big stage names, no system tags or loop labels until you point at a stage, no avatar, no turning */
  quiet?: boolean
  /** tilt steps: up looks more from above, down more from the side */
  tilt?: number
  /** change it to ease the camera back to the starting view */
  resetKey?: number
}

export default function Islands3D({ process, active, onSelect, hover = null, onHover, roleFilter = null, compact = false, avatarLabel = 'I am here', zoomLevel = 0, focus = null, selectedStep = null, hoverStep = null, onStep, walk = null, onBackground, quiet = false, tilt = 0, resetKey = 0 }: IslandsProps) {
  const n = process.stages.length
  const items = n + 2
  // the quiet overview spreads the islands out so their names have room
  const space = quiet ? 1.45 : 1
  // rows sit further apart still, so each stage name has clear room below its island
  const rowSpace = quiet ? 2 : 1
  const gap = GAP * space
  const narrowEarly = useNarrow()
  const wrap = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 1200, h: 450 })
  useEffect(() => {
    const el = wrap.current; if (!el) return
    const ro = new ResizeObserver(([e]) => { const r = e.contentRect; if (r.width && r.height) setBox({ w: r.width, h: r.height }) })
    ro.observe(el); return () => ro.disconnect()
  }, [])
  // the quiet overview reads best as one road, left to right
  const { cols, rows } = quiet && !narrowEarly && items <= 8 && box.w >= 1100 ? { cols: items, rows: 1 } : roadLayout(items, narrowEarly && !compact, box.w, box.h, space, rowSpace)
  const rowGap = ROW_GAP * rowSpace
  const amp = rows > 1 ? 1.3 : 1.5
  // The camera looks from (1,1,1): screen-right is (1,0,-1) and screen-down is (1,0,1).
  // Islands run along a winding road: rows go left→right, then right→left, each island a little up or down.
  const R = Math.SQRT1_2
  const screenOf = (i: number): [number, number] => {
    const r = Math.floor(i / cols)
    let c = i % cols
    if (r % 2) c = cols - 1 - c
    return [(c - (cols - 1) / 2) * gap, (r - (rows - 1) / 2) * rowGap + (c % 2 ? amp : -amp)]
  }
  const toWorld = (x: number, y: number): V3 => [(x + y) * R, 0, (-x + y) * R]
  const posOf = (i: number): V3 => toWorld(...screenOf(i))
  // curved roads: gentle S-bends along a row, a U-turn at the end of a row
  const roads = useMemo(() => Array.from({ length: Math.max(0, items - 1) }).map((_, i) => {
    const [ax, ay] = screenOf(i), [bx, by] = screenOf(i + 1)
    const turn = Math.floor(i / cols) !== Math.floor((i + 1) / cols)
    const side = ax > 0 ? 1 : -1
    const c1 = turn ? [ax + side * 4.2 * space, ay + rowGap * 0.12] : [ax + (bx - ax) * 0.5, ay]
    const c2 = turn ? [bx + side * 4.2 * space, by - rowGap * 0.12] : [bx - (bx - ax) * 0.5, by]
    const v = (p: number[]) => new THREE.Vector3(...toWorld(p[0], p[1]))
    return new THREE.CubicBezierCurve3(v([ax, ay]), v(c1), v(c2), v([bx, by]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, cols, rows])
  const stageRoleList = useMemo<Role[][]>(() => process.stages.map((s) => stageRoles(process, s)), [process])
  const loops = useMemo(() => loopsOf(process), [process])
  const narrow = narrowEarly
  const dimOf = (k: number) => focus !== null ? focus !== k : (!!roleFilter && !stageRoleList[k].some((r) => r.id === roleFilter))
  // walking: which stage the walker is on, and which stages are finished
  const stepStage = (id?: string) => process.stages.findIndex((st) => st.id === process.steps.find((x) => x.id === id)?.stageId)
  const curStage = walk ? (walk.finished ? n : Math.max(0, stepStage(walk.current))) : -1
  const stageDone = (k: number) => !!walk && (walk.finished || k < curStage)
  const bridgeState = (i: number): BridgeState => !walk ? 'plain' : i < curStage + 1 || walk.finished ? 'done' : i === curStage + 1 ? 'next' : 'todo'
  const avatarTarget: V3 = (() => {
    if (!n) return posOf(0)
    if (walk?.finished) { const p = posOf(items - 1); return [p[0] + 0.9, 0.05, p[2] + 0.9] }
    const k = walk ? curStage : active
    const p = posOf(k + 1)
    const lift = k === active || k === focus ? 0.45 : 0
    if (walk?.current && focus === k) {
      const steps = process.steps.filter((x) => x.stageId === process.stages[k].id && (x.kind === 'step' || x.kind === 'decision'))
      const q = stepSpots(steps.length)[Math.max(0, steps.findIndex((x) => x.id === walk.current))]
      return [p[0] + q[0] + 0.25, lift + 0.2, p[2] + q[2] + 0.35]
    }
    return [p[0] + 1.05, lift, p[2] + 1.1]
  })()

  return (
    <div ref={wrap} className="h-full w-full">
    <Canvas onPointerMissed={() => onBackground?.()} flat orthographic camera={{ position: [18, 16, 18], zoom: 40, near: -100, far: 200 }} dpr={[1, 2]}
      style={{ touchAction: 'pan-y' }}
      aria-label={`3D view of ${process.title}`}>
      <hemisphereLight args={['#FFFFFF', '#C7D2FE', 1.1]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[8, 14, 6]} intensity={1.0} />
      <directionalLight position={[4, 6, 14]} intensity={0.55} />
              <group>
          {roads.map((curve, i) => <Bridge key={i} curve={curve} state={bridgeState(i)} color={process.stages[Math.min(i, n - 1)]?.color ?? '#0F766E'} />)}

          {/* start: one flag per trigger */}
          {/* drei's Html can drop the first label it mounts here (React 19 root unmount race), so mount an empty one first */}
          <Html position={posOf(0)} style={{ display: 'none' }}><span /></Html>
          <Island pos={posOf(0)} color="#64748B" top="#E2E8F0" side="#64748B" dim={focus !== null}>
            {process.triggers.slice(0, 7).map((_, i) => {
              const cols = ['#2563EB', '#16A34A', '#EA580C', '#7C3AED', '#DC2626', '#0EA5E9', '#DB2777']
              const x = -1.1 + (i % 3) * 1.1, z = -1 + Math.floor(i / 3) * 0.95
              return (
                <group key={i} position={[x, 0, z]}>
                  <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.03, 0.03, 1, 6]} /><M c="#334155" /></mesh>
                  <mesh position={[0.2, 0.85, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.16, 0.4, 3]} /><M c={cols[i]} /></mesh>
                </group>
              )
            })}
          </Island>

          {process.stages.map((s, k) => {
            const roles = stageRoleList[k]
            const isActive = k === active
            // zoomed in and the stage has steps → show step platforms instead of the scenery
            const hasSteps = process.steps.some((x) => x.stageId === s.id && (x.kind === 'step' || x.kind === 'decision'))
            const platforms = focus === k && hasSteps
            return (
              <Island key={s.id} pos={posOf(k + 1)} color={s.color} top={tint(s.color, 0.16)} side={s.color}
                active={(isActive || focus === k) && !compact} hovered={hover === k} dim={dimOf(k)}
                onClick={onSelect ? () => onSelect(k) : undefined}
                onOver={onHover ? () => onHover(k) : undefined} onOut={onHover ? () => onHover(null) : undefined}>
                {focus === k && !compact && !hasSteps && (
                  <Html position={[0, 3.1, 0]} center zIndexRange={[16, 0]} style={{ pointerEvents: 'none' }}>
                    <div className="flex w-[210px] flex-col items-center gap-0.5 rounded-2xl border-2 border-dashed bg-white px-3 py-2 text-center shadow" style={{ borderColor: s.color }}>
                      <span className="text-[13px] font-extrabold text-[#151A25]">Steps not added yet</span>
                      <span className="text-[11px] font-semibold text-[#4A5163]">{process.owner} is still completing this stage</span>
                    </div>
                  </Html>
                )}
                {platforms && !compact && (
                  <StepPlatforms process={process} stageId={s.id} color={s.color} selected={selectedStep} hoverStep={hoverStep} onStep={onStep} walk={walk} showLabels />
                )}
                {stageDone(k) && <DoneFlag />}
                {!platforms && <Scenery kind={sceneFor(s, process)} color={s.color} />}
                {!platforms && [...roles].sort((x, y) => Number(roleKind(y) === 'agent') - Number(roleKind(x) === 'agent')).slice(0, 3).map((r, i) => {
                  const pp: V3 = roleKind(r) === 'agent' ? [-0.75, 0, 1.0] : [0.2 + i * 0.6, 0, 1.15 - i * 0.15]
                  return roleKind(r) === 'agent'
                    ? <group key={r.id}><Robot p={pp} color={r.color} />{!compact && <ToolsOrbit p={[pp[0], pp[1] + 0.4, pp[2]]} tools={r.tools ?? []} color={r.color} labels={isActive} />}</group>
                    : <Person key={r.id} p={pp} color={r.color} />
                })}
                {!platforms && process.steps.some((x) => x.stageId === s.id && x.kind === 'decision') && <CheckSign repeat={loops.some((l) => l.from === k && l.to === k)} />}
                {!compact && s.systems[0] && (quiet ? hover === k || isActive : (!narrow || isActive)) && (focus === null || focus === k) && (() => {
                  const sys = s.systems.map(sysLabel).filter(Boolean)
                  const unsure = s.systems.some(sysUnsure)
                  return (
                  <Float speed={2} floatIntensity={0.6} rotationIntensity={0}>
                    <Html position={[1.7, 2.6, -1.3]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none', opacity: dimOf(k) ? 0.25 : 1 }}>
                      <div className="flex max-w-[230px] items-center gap-1.5 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-white shadow">
                        <span className="h-2.5 w-3.5 flex-none rounded-sm border-2" style={{ borderColor: tint(s.color, 0.6) }} />
                        <span className="truncate">{sys.slice(0, 2).join(' · ')}</span>
                        {sys.length > 2 && <span className="flex-none text-white/70">+{sys.length - 2}</span>}
                        {unsure && <span title="The owner still needs to confirm this system" className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[#F59E0B] text-[10px] text-ink">?</span>}
                      </div>
                    </Html>
                  </Float>
                  )
                })()}
                {!compact && (
                  <Html position={quiet ? LABEL_Q : [1.9, -0.4, 1.9]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none', opacity: dimOf(k) ? (focus !== null ? 0 : 0.3) : 1 }}>
                    <div className={quiet ? 'flex items-center gap-2 whitespace-nowrap rounded-full border-2 bg-white py-1 pl-1 pr-3.5 text-[14px] font-extrabold shadow-sm' : 'flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] bg-white py-1 pl-1 pr-3.5 text-[13px] font-extrabold'} style={{ borderColor: s.color }}>
                      <span className={quiet ? 'flex h-7 w-7 items-center justify-center rounded-full text-[13px] text-white' : 'flex h-6 w-6 items-center justify-center rounded-full text-xs text-white'} style={{ background: s.color }}>{k + 1}</span>{s.short}
                    </div>
                  </Html>
                )}
              </Island>
            )
          })}

          {/* finish: trophy + one tick per outcome */}
          <Island pos={posOf(items - 1)} color="#0F766E" top="#D5F3EF" side="#0F766E" dim={focus !== null} active={!!walk?.finished}>
            <Float speed={2.4} floatIntensity={0.5} rotationIntensity={0.2}>
              <group position={[0, 0.1, 0]}>
                <mesh position={[0, 0.08, 0]}><boxGeometry args={[0.7, 0.16, 0.7]} /><M c="#B45309" /></mesh>
                <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.1, 0.12, 0.5, 12]} /><M c="#F59E0B" /></mesh>
                <mesh position={[0, 0.95, 0]}><cylinderGeometry args={[0.5, 0.18, 0.7, 24]} /><M c="#FBBF24" /></mesh>
              </group>
            </Float>
            {Array.from({ length: Math.max(1, Math.min(3, process.outcomes.length)) }).map((_, i) => (
              <mesh key={i} position={[-1.1 + i * 1.1, 0.25, 1.2 - (i % 2) * 2.3]}><sphereGeometry args={[0.22, 16, 12]} /><M c="#16A34A" /></mesh>
            ))}
            {!compact && focus === null && <Html position={quiet ? LABEL_Q : [1.9, -0.4, 1.9]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}><div className="whitespace-nowrap rounded-full border-[1.5px] border-teal-700 bg-white px-3.5 py-1.5 text-[13px] font-extrabold">It's done when</div></Html>}
          </Island>

          {!compact && focus === null && (
            <Html position={quiet ? [posOf(0)[0] + LABEL_Q[0], LABEL_Q[1], posOf(0)[2] + LABEL_Q[2]] : [posOf(0)[0] + 1.9, -0.4, posOf(0)[2] + 1.9]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <div className="whitespace-nowrap rounded-full border border-slate-400 bg-white px-3.5 py-1.5 text-[13px] font-extrabold">It starts when</div>
            </Html>
          )}
          {focus === null && loops.filter((l) => l.from !== l.to).map((l) => (
            <LoopArc key={`${l.from}-${l.to}`} a={posOf(l.from + 1)} b={posOf(l.to + 1)} compact={compact}
              focus={!narrow && (quiet ? hover === l.from || hover === l.to : active === l.from || active === l.to)} label={!quiet || hover === l.from || hover === l.to} short={l.from === l.to ? 'Repeats' : `${l.label || 'Back'} → stage ${l.to + 1}`}
              text={l.from === l.to ? `${l.label || 'Not yet'}? Repeat “${l.toStep}”` : l.label ? `${l.label} → back to “${l.toStep}”` : `Back to “${l.toStep}”`} />
          ))}
          {!compact && !quiet && n > 0 && (walk || focus === null) && <Avatar target={avatarTarget} label={walk?.finished ? 'All done!' : avatarLabel} />}
          {!compact && walk && <Confetti at={avatarTarget} nonce={walk.nonce} />}
        </group>
      <ContactShadows position={[0, -2.3, 0]} scale={Math.max(cols * gap, rows * rowGap) * 1.6} far={4} blur={2.6} opacity={0.22} color="#1E3A8A" />
      {/* the quiet overview: drag to move the map (zoom and tilt come from the page's buttons); phones keep scrolling the page */}
      {!compact && <OrbitControls makeDefault enablePan={quiet && !narrow} screenSpacePanning panSpeed={0.6} mouseButtons={quiet ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN } : undefined}
        enableZoom={false} enableRotate={!quiet} minPolarAngle={quiet ? 0.35 : 0.55} maxPolarAngle={quiet ? 1.42 : 1.15} />}
      <CameraRig span={layoutSpan(cols, rows, space, rowSpace).w} spanH={layoutSpan(cols, rows, space, rowSpace).h} level={zoomLevel} tilt={tilt} resetKey={resetKey} narrow={narrow && !compact} center={quiet ? toWorld(0, 0) : toWorld(0, screenOf(n ? (walk ? Math.min(curStage, n - 1) : active) + 1 : 0)[1])} focus={focus !== null && !compact ? posOf(focus + 1) : null} />
    </Canvas>
    </div>
  )
}
