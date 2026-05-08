import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { constellationEdges } from '../data/memories'
import {
  layoutScaleForViewportWidth,
  tapScaleForViewportWidth,
  hitPickerRadiusMultiplier,
} from '../lib/viewportStars'
import { useExperience } from '../context/ExperienceContext'
import Star from './Star'

export default function StarField({ memories, viewportWidth, onStarSelect }) {
  const { openedIds, finalUnlocked } = useExperience()
  const layoutScale = layoutScaleForViewportWidth(viewportWidth)
  const tapScale = tapScaleForViewportWidth(viewportWidth)
  const pickerMult = hitPickerRadiusMultiplier(viewportWidth)

  const constellationPoints = useMemo(() => {
    const byId = new Map(
      memories.map((m) => {
        const [x, y, z] = m.position
        return [m.id, new THREE.Vector3(x * layoutScale, y * layoutScale, z)]
      }),
    )
    const lines = []
    for (const [a, b] of constellationEdges) {
      if (openedIds.has(a) && openedIds.has(b)) {
        const pa = byId.get(a)
        const pb = byId.get(b)
        if (pa && pb) {
          lines.push([pa, pb])
        }
      }
    }
    return lines
  }, [memories, openedIds, layoutScale])

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
            layoutScale={layoutScale}
            tapScale={tapScale}
            pickerMult={pickerMult}
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
