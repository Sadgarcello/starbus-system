import { useCallback, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useExperience } from '../context/ExperienceContext'

function clampHover(clientX, clientY) {
  if (typeof window === 'undefined') return { x: clientX, y: clientY }
  const pad = 12
  const w = window.innerWidth
  const h = window.innerHeight
  return {
    x: Math.min(Math.max(clientX, pad), w - pad),
    y: Math.min(Math.max(clientY, pad), h - pad),
  }
}

const colorByType = {
  gold: new THREE.Color('#c9a962'),
  blue: new THREE.Color('#6b9bc4'),
  white: new THREE.Color('#dfe6f7'),
  apology: new THREE.Color('#9a4d4d'),
}

/** Invisible picking mesh — forwards raycasts so opacity=0 meshes still resolve. */
function installAlwaysPickableRaycast(mesh) {
  mesh.raycast = (raycaster, intersects) => {
    THREE.Mesh.prototype.raycast.call(mesh, raycaster, intersects)
  }
}

export default function Star({
  memory,
  visible,
  onSelect,
  layoutScale = 1,
  tapScale = 1,
  pickerMult = 6,
}) {
  const groupRef = useRef(null)
  const visualRef = useRef(null)

  const base = useMemo(() => {
    const [x, y, z] = memory.position
    return new THREE.Vector3(x * layoutScale, y * layoutScale, z)
  }, [memory.position, layoutScale])

  const seed = useMemo(
    () => memory.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0),
    [memory.id],
  )
  const { setHoverLabel } = useExperience()

  const bindPickerRef = useCallback((node) => {
    if (node) installAlwaysPickableRaycast(node)
  }, [])

  useFrame(({ clock }) => {
    const g = groupRef.current
    const viz = visualRef.current
    if (!g || !viz) return
    const t = clock.elapsedTime
    g.position.set(
      base.x + Math.sin(t * 0.11 + seed * 0.02) * 0.18,
      base.y + Math.cos(t * 0.09 + seed * 0.015) * 0.14,
      base.z + Math.sin(t * 0.07 + seed * 0.01) * 0.12,
    )
    const pulse = 0.65 + Math.sin(t * 1.3 + seed * 0.01) * 0.12
    viz.scale.setScalar(pulse * (memory.type === 'apology' ? 1.15 : 1))
  })

  const col = colorByType[memory.type] ?? colorByType.white
  const sphereR = (memory.type === 'apology' ? 0.14 : 0.106) * tapScale

  const pointerBindings = useMemo(
    () => ({
      onPointerDown: (e) => {
        e.stopPropagation()
        setHoverLabel(null)
        onSelect(memory.id)
      },
      onPointerOver: (e) => {
        e.stopPropagation()
        if (e.pointerType !== 'touch') document.body.style.cursor = 'pointer'
        const pos = clampHover(e.clientX, e.clientY)
        setHoverLabel({ text: memory.label, ...pos })
      },
      onPointerMove: (e) => {
        const pos = clampHover(e.clientX, e.clientY)
        setHoverLabel({ text: memory.label, ...pos })
      },
      onPointerOut: (e) => {
        e.stopPropagation()
        document.body.style.cursor = ''
        setHoverLabel(null)
      },
    }),
    [memory.id, memory.label, onSelect, setHoverLabel],
  )

  if (!visible) return null

  const hitRadius = sphereR * pickerMult

  return (
    <group ref={groupRef}>
      <mesh ref={bindPickerRef} {...pointerBindings}>
        <sphereGeometry args={[hitRadius, 12, 12]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={visualRef}>
        <sphereGeometry args={[sphereR, 12, 12]} />
        <meshStandardMaterial
          color={col}
          emissive={col}
          emissiveIntensity={1.05}
          roughness={0.35}
          metalness={0.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
