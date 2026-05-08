import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, Sphere } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { getMoonIllumination } from '../data/memories'
import StarField from './StarField'
import { useExperience } from '../context/ExperienceContext'

function MoonBody({ illumination, eclipse, onMoonClick }) {
  const moonRef = useRef(null)

  useFrame((_, dt) => {
    if (!moonRef.current) return
    moonRef.current.rotation.y += dt * 0.018 * (eclipse ? 0.65 : 1)
  })

  const emissive = eclipse ? illumination * 0.22 + 0.05 : illumination * 0.28 + 0.06

  return (
    <group position={[0, 0.35, -10.8]}>
      <Sphere
        ref={moonRef}
        args={[2.15, 64, 64]}
        onPointerDown={(e) => {
          e.stopPropagation()
          onMoonClick()
        }}
      >
        <meshStandardMaterial
          color="#e8e4dc"
          emissive="#cfd2cc"
          emissiveIntensity={emissive}
          roughness={0.78}
          metalness={0.08}
        />
      </Sphere>
      {eclipse && (
        <mesh position={[0.55, 0.12, -0.2]} scale={[1.06, 1.06, 1.06]}>
          <sphereGeometry args={[2.15, 48, 48]} />
          <meshBasicMaterial color="#050816" transparent opacity={0.58} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

function ParallaxGroup({ children }) {
  const g = useRef(null)
  useFrame(({ mouse }) => {
    if (!g.current) return
    const rx = THREE.MathUtils.lerp(g.current.rotation.x, mouse.y * 0.07, 0.04)
    const ry = THREE.MathUtils.lerp(g.current.rotation.y, mouse.x * 0.06, 0.04)
    g.current.rotation.x = rx
    g.current.rotation.y = ry
  })
  return <group ref={g}>{children}</group>
}

function CameraRig({ focusPosition, atHome }) {
  const { camera } = useThree()

  useEffect(() => {
    if (atHome) {
      gsap.to(camera.position, {
        x: 0,
        y: 0,
        z: 14,
        duration: 1.55,
        ease: 'power3.inOut',
        overwrite: true,
      })
    }
  }, [atHome, camera])

  useEffect(() => {
    if (!atHome && focusPosition) {
      const [fx, fy, fz] = focusPosition
      const target = new THREE.Vector3(fx * 0.48, fy * 0.48, fz * 0.52 + 6.5)
      gsap.to(camera.position, {
        x: target.x * 1.08,
        y: target.y * 1.04,
        z: THREE.MathUtils.clamp(target.z * 0.85 + 3.2, 6.5, 11.8),
        duration: 1.45,
        ease: 'power3.inOut',
        overwrite: true,
      })
    }
  }, [atHome, focusPosition, camera])

  return null
}

function SceneInterior({ memories, starCount }) {
  const { finaleMode, onMoonClick, activeMemory, cameraHome, openMemory } =
    useExperience()

  const [illum, setIllum] = useState(() => getMoonIllumination())
  useEffect(() => {
    const id = window.setInterval(() => setIllum(getMoonIllumination()), 60_000)
    return () => clearInterval(id)
  }, [])
  const focus = activeMemory && !cameraHome ? activeMemory.position : null
  const atHome = cameraHome || !activeMemory

  return (
    <>
      <color attach="background" args={['#050816']} />
      <fog attach="fog" args={[finaleMode ? '#030510' : '#050816', 12, finaleMode ? 48 : 58]} />

      <CameraRig focusPosition={focus} atHome={atHome} />

      <ambientLight intensity={finaleMode ? 0.06 : 0.09} />
      <directionalLight
        position={[8, 6, 4]}
        intensity={finaleMode ? 0.22 : 0.38}
        color="#f8f4ec"
      />
      <directionalLight
        position={[-6, -2, -2]}
        intensity={finaleMode ? 0.12 : 0.18}
        color="#9eb6d9"
      />

      <Stars
        radius={90}
        depth={48}
        count={starCount}
        factor={finaleMode ? 2.1 : 2.9}
        saturation={0}
        fade
        speed={finaleMode ? 0.12 : 0.22}
      />

      <ParallaxGroup>
        <MoonBody
          illumination={illum}
          eclipse={finaleMode}
          onMoonClick={onMoonClick}
        />
        <StarField memories={memories} onStarSelect={openMemory} />
      </ParallaxGroup>
    </>
  )
}

export default function MoonScene({ memories }) {
  const [starCount, setStarCount] = useState(4800)
  const [dprMax, setDprMax] = useState(2)

  useEffect(() => {
    function pick() {
      const w = window.innerWidth
      if (w < 640) setStarCount(1200)
      else if (w < 960) setStarCount(2600)
      else setStarCount(4800)

      const ratio = window.devicePixelRatio || 1
      if (w < 480) setDprMax(Math.min(1.35, ratio))
      else if (w < 768) setDprMax(Math.min(1.65, ratio))
      else setDprMax(Math.min(2, ratio))
    }
    pick()
    window.addEventListener('resize', pick)
    return () => window.removeEventListener('resize', pick)
  }, [])

  const exposure = 1.05

  return (
    <div className="absolute inset-0 min-h-[100dvh] min-h-[100svh] touch-none md:touch-auto">
      <Canvas
        style={{ touchAction: 'none', width: '100%', height: '100%' }}
        shadows={false}
        dpr={[1, Math.max(1, dprMax)]}
        gl={{
          toneMappingExposure: exposure,
          antialias: true,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [0, 0, 14], fov: 44, near: 0.1, far: 120 }}
      >
        <Suspense fallback={null}>
          <SceneInterior memories={memories} starCount={starCount} />
        </Suspense>
      </Canvas>
    </div>
  )
}
