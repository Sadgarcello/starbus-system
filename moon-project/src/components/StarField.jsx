import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { constellationEdges } from '../data/memories'
import { useExperience } from '../context/ExperienceContext'
import Star from './Star'

export default function StarField({ memories, onStarSelect }) {
  const { openedIds, finalUnlocked } = useExperience()
  const vw = useThree((s) => s.size.width)
  const tapScale = vw < 640 ? 1.45 : vw < 900 ? 1.25 : 1

  const constellationPoints = useMemo(() => {
    const byId = new Map(memories.map((m) => [m.id, m.position]))
    const lines = []
    for (const [a, b] of constellationEdges) {
      if (openedIds.has(a) && openedIds.has(b)) {
        const pa = byId.get(a)
        const pb = byId.get(b)
        if (pa && pb) {
          lines.push([new THREE.Vector3(...pa), new THREE.Vector3(...pb)])
        }
      }
    }
    return lines
  }, [memories, openedIds])

  const constellationMode = constellationPoints.length >= 2

  return (
    <>
      {memories.map((m) => {
        let visible = true
        if (m.hiddenUntilUnlocked && m.id === 'final') visible = finalUnlocked
        return (
          <Star
            key={m.id}
            memory={m}
            visible={visible}
            tapScale={tapScale}
            onSelect={onStarSelect}
          />
        )
      })}
      {constellationMode &&
        constellationPoints.map((pair, idx) => (
          <Line
            key={`c-${idx}`}
            points={pair}
            color="#9a8860"
            lineWidth={0.6}
            transparent
            opacity={0.32}
            depthWrite={false}
          />
        ))}
    </>
  )
}
