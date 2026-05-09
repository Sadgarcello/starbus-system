import { Suspense, useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, Sphere } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { getMoonIllumination } from '../data/memories'
import { getViewportCameraTune } from '../lib/viewportCameraTune'
import { layoutScaleForViewportWidth } from '../lib/viewportStars'
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
  const size = useThree((s) => s.size)
  const [coarsePointer, setCoarsePointer] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(pointer: coarse)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia('(pointer: coarse)')
    const sync = () => setCoarsePointer(mq.matches)
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])

  useFrame(({ mouse }) => {
    if (!g.current) return
    const asp = size.height > 4 ? size.width / size.height : 1
    const narrow = size.width < 640 || asp < 0.5
    const damp = coarsePointer ? 0.22 : narrow ? 0.45 : 1
    const ryMul = coarsePointer ? 0.026 : narrow ? 0.042 : 0.06
    const rxMul = coarsePointer ? 0.032 : narrow ? 0.048 : 0.07

    const rx = THREE.MathUtils.lerp(g.current.rotation.x, mouse.y * rxMul * damp, 0.04)
    const ry = THREE.MathUtils.lerp(g.current.rotation.y, mouse.x * ryMul * damp, 0.04)
    g.current.rotation.x = rx
    g.current.rotation.y = ry
  })
  return <group ref={g}>{children}</group>
}

function CameraRig({ focusPosition, atHome, tune }) {
  const { camera } = useThree()

  useLayoutEffect(() => {
    // Three.js PerspectiveCamera mutates projection in place via fov + updateProjectionMatrix.
    /* eslint-disable react-hooks/immutability -- R3F default camera follows Three semantics */
    camera.fov = tune.homeFov
    camera.updateProjectionMatrix()
    /* eslint-enable react-hooks/immutability */
  }, [camera, tune.homeFov])

  useEffect(() => {
    if (atHome) {
      gsap.to(camera.position, {
        x: 0,
        y: 0,
        z: tune.homeZ,
        duration: 1.55,
        ease: 'power3.inOut',
        overwrite: true,
      })
    }
  }, [atHome, camera, tune.homeZ])

  useEffect(() => {
    if (!atHome && focusPosition) {
      const [fx, fy, fz] = focusPosition
      const target = new THREE.Vector3(fx * 0.48, fy * 0.48, fz * 0.52 + 6.5)
      gsap.to(camera.position, {
        x: target.x * 1.08,
        y: target.y * 1.04,
        z: THREE.MathUtils.clamp(
          target.z * 0.85 + 3.2,
          tune.focusZMin,
          tune.focusZMax,
        ),
        duration: 1.45,
        ease: 'power3.inOut',
        overwrite: true,
      })
    }
  }, [atHome, focusPosition, camera, tune.focusZMin, tune.focusZMax])

  return null
}

function SceneInterior({ memories, starCount }) {
  const { finaleMode, onMoonClick, activeMemory, cameraHome, openMemory } =
    useExperience()

  const size = useThree((s) => s.size)

  const tune = useMemo(
    () => getViewportCameraTune(size.width, size.height),
    [size.width, size.height],
  )

  const layoutScale = useMemo(
    () => layoutScaleForViewportWidth(size.width),
    [size.width],
  )

  const [illum, setIllum] = useState(() => getMoonIllumination())
  useEffect(() => {
    const id = window.setInterval(() => setIllum(getMoonIllumination()), 60_000)
    return () => clearInterval(id)
  }, [])
  const focusRaw =
    activeMemory && !cameraHome ? activeMemory.position : null
  const focusScaled = focusRaw
    ? [
        focusRaw[0] * layoutScale,
        focusRaw[1] * layoutScale,
        focusRaw[2],
      ]
    : null
  const atHome = cameraHome || !activeMemory

  return (
    <>
      <color attach="background" args={['#050816']} />
      <fog attach="fog" args={[finaleMode ? '#030510' : '#050816', 12, finaleMode ? 48 : 58]} />

      <CameraRig focusPosition={focusScaled} atHome={atHome} tune={tune} />

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
        <StarField
          memories={memories}
          viewportWidth={size.width}
          onStarSelect={openMemory}
        />
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
