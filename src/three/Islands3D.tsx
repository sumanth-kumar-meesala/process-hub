import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Float, Html, Line, OrbitControls, QuadraticBezierLine } from '@react-three/drei'
import * as THREE from 'three'
import type { Process, Role } from '@/lib/types'
import { tint } from '@/lib/types'
import { loopsOf, roleKind, sceneFor, stageRoles } from '@/lib/derive'

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
function LoopArc({ a, b, text, short, compact, focus }: { a: V3; b: V3; text: string; short: string; compact: boolean; focus: boolean }) {
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
      {!compact && (
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
function Scenery({ kind, color }: { kind: string; color: string }) {
  switch (kind) {
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

/* ---------- bridges with moving dots ---------- */
function Bridge({ a, b }: { a: V3; b: V3 }) {
  const dots = useRef<THREE.Group>(null)
  const dir = new THREE.Vector3(b[0] - a[0], 0, b[2] - a[2])
  const len = dir.length()
  const angle = Math.atan2(dir.x, dir.z)
  const mid: V3 = [(a[0] + b[0]) / 2, -0.14, (a[2] + b[2]) / 2]
  useFrame(({ clock }) => {
    dots.current?.children.forEach((c, i) => {
      const t = ((clock.elapsedTime * 0.35 + i / 4) % 1)
      c.position.set(0, 0.06, -len / 2 + t * len)
    })
  })
  return (
    <group position={mid} rotation={[0, angle, 0]}>
      <mesh><boxGeometry args={[0.55, 0.06, len]} /><M c="#FFFFFF" /></mesh>
      <group ref={dots}>{[0, 1, 2, 3].map((i) => <mesh key={i}><sphereGeometry args={[0.07, 10, 8]} /><meshBasicMaterial color="#1D4ED8" /></mesh>)}</group>
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

/** Fits the island chain to the canvas width (screen space), then applies the +/- zoom level.
 *  On narrow screens it zooms in on the current stage and follows it instead. */
function FitCamera({ span, level, focus, narrow }: { span: number; level: number; focus: V3; narrow: boolean }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    const fit = narrow ? size.width / 13 : Math.min(size.width / (span * 1.04), size.height / 11.5)
    const t = narrow ? new THREE.Vector3(focus[0], -0.2, focus[2]) : new THREE.Vector3(0, -0.2, 0)
    cam.zoom = fit * Math.pow(1.2, level)
    cam.position.set(t.x + 18, t.y + 16, t.z + 18)
    cam.lookAt(t)
    const c = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null
    if (c?.target) { c.target.copy(t); c.update?.() }
    cam.updateProjectionMatrix()
  }, [camera, controls, size.width, size.height, span, level, narrow, focus[0], focus[2]])
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
}

export default function Islands3D({ process, active, onSelect, hover = null, onHover, roleFilter = null, compact = false, avatarLabel = 'I am here', zoomLevel = 0 }: IslandsProps) {
  const n = process.stages.length
  const items = n + 2
  const gap = 5.4
  // The camera looks from (1,1,1): screen-right is (1,0,-1) and screen-down is (1,0,1).
  // Islands run left→right across the screen and zig-zag up/down a little.
  const R = Math.SQRT1_2
  const posOf = (i: number): V3 => {
    const u = (i - (items - 1) / 2) * gap
    const w = i % 2 ? 1.5 : -1.5
    return [(u + w) * R, 0, (-u + w) * R]
  }
  const stageRoleList = useMemo<Role[][]>(() => process.stages.map((s) => stageRoles(process, s)), [process])
  const loops = useMemo(() => loopsOf(process), [process])
  const narrow = useNarrow()
  const dimOf = (k: number) => !!roleFilter && !stageRoleList[k].some((r) => r.id === roleFilter)
  const avatarTarget: V3 = n ? (() => { const p = posOf(active + 1); return [p[0] + 1.05, 0.45, p[2] + 1.1] })() : posOf(0)

  return (
    <Canvas flat orthographic camera={{ position: [18, 16, 18], zoom: 40, near: -100, far: 200 }} dpr={[1, 2]}
      style={{ touchAction: 'pan-y' }}
      aria-label={`3D view of ${process.title}`}>
      <hemisphereLight args={['#FFFFFF', '#C7D2FE', 1.1]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[8, 14, 6]} intensity={1.0} />
      <directionalLight position={[4, 6, 14]} intensity={0.55} />
              <group>
          {Array.from({ length: items - 1 }).map((_, i) => <Bridge key={i} a={posOf(i)} b={posOf(i + 1)} />)}

          {/* start: one flag per trigger */}
          <Island pos={posOf(0)} color="#64748B" top="#E2E8F0" side="#64748B">
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
            return (
              <Island key={s.id} pos={posOf(k + 1)} color={s.color} top={tint(s.color, 0.16)} side={s.color}
                active={isActive && !compact} hovered={hover === k} dim={dimOf(k)}
                onClick={onSelect ? () => onSelect(k) : undefined}
                onOver={onHover ? () => onHover(k) : undefined} onOut={onHover ? () => onHover(null) : undefined}>
                <Scenery kind={sceneFor(s)} color={s.color} />
                {[...roles].sort((x, y) => Number(roleKind(y) === 'agent') - Number(roleKind(x) === 'agent')).slice(0, 3).map((r, i) => {
                  const pp: V3 = roleKind(r) === 'agent' ? [-0.75, 0, 1.0] : [0.2 + i * 0.6, 0, 1.15 - i * 0.15]
                  return roleKind(r) === 'agent'
                    ? <group key={r.id}><Robot p={pp} color={r.color} />{!compact && <ToolsOrbit p={[pp[0], pp[1] + 0.4, pp[2]]} tools={r.tools ?? []} color={r.color} labels={isActive} />}</group>
                    : <Person key={r.id} p={pp} color={r.color} />
                })}
                {process.steps.some((x) => x.stageId === s.id && x.kind === 'decision') && <CheckSign repeat={loops.some((l) => l.from === k && l.to === k)} />}
                {!compact && s.systems[0] && (!narrow || isActive) && (
                  <Float speed={2} floatIntensity={0.6} rotationIntensity={0}>
                    <Html position={[1.1, 2.6, -1]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none', opacity: dimOf(k) ? 0.25 : 1 }}>
                      <div className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-white shadow">
                        <span className="h-2.5 w-3.5 rounded-sm border-2" style={{ borderColor: tint(s.color, 0.6) }} />{s.systems.join(' · ')}
                      </div>
                    </Html>
                  </Float>
                )}
                {!compact && (
                  <Html position={[1.9, -0.4, 1.9]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none', opacity: dimOf(k) ? 0.3 : 1 }}>
                    <div className="flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] bg-white py-1 pl-1 pr-3.5 text-[13px] font-extrabold" style={{ borderColor: s.color }}>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-white" style={{ background: s.color }}>{k + 1}</span>{s.short}
                    </div>
                  </Html>
                )}
              </Island>
            )
          })}

          {/* finish: trophy + one tick per outcome */}
          <Island pos={posOf(items - 1)} color="#0F766E" top="#D5F3EF" side="#0F766E">
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
            {!compact && <Html position={[1.9, -0.4, 1.9]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}><div className="whitespace-nowrap rounded-full border-[1.5px] border-teal-700 bg-white px-3.5 py-1.5 text-[13px] font-extrabold">It's done when</div></Html>}
          </Island>

          {!compact && (
            <Html position={[posOf(0)[0] + 1.9, -0.4, posOf(0)[2] + 1.9]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <div className="whitespace-nowrap rounded-full border border-slate-400 bg-white px-3.5 py-1.5 text-[13px] font-extrabold">It starts when</div>
            </Html>
          )}
          {loops.filter((l) => l.from !== l.to).map((l) => (
            <LoopArc key={`${l.from}-${l.to}`} a={posOf(l.from + 1)} b={posOf(l.to + 1)} compact={compact}
              focus={!narrow && (active === l.from || active === l.to)} short={l.from === l.to ? 'Repeats' : `${l.label || 'Back'} → stage ${l.to + 1}`}
              text={l.from === l.to ? `${l.label || 'Not yet'}? Repeat “${l.toStep}”` : `${l.label || 'Back'} → back to “${l.toStep}”`} />
          ))}
          {!compact && n > 0 && <Avatar target={avatarTarget} label={avatarLabel} />}
        </group>
      <ContactShadows position={[0, -2.3, 0]} scale={items * gap * 1.4} far={4} blur={2.6} opacity={0.22} color="#1E3A8A" />
      {!compact && <OrbitControls makeDefault enablePan={false} enableZoom={false} minPolarAngle={0.55} maxPolarAngle={1.15} />}
      <FitCamera span={(items - 1) * gap + 5.2} level={zoomLevel} narrow={narrow && !compact} focus={posOf(n ? active + 1 : 0)} />
    </Canvas>
  )
}
