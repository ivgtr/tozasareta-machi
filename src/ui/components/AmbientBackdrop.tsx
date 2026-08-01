import { useMemo } from 'react'
import '../styles/backdrop.css'

interface AmbientBackdropProps {
  morale: number
  danger?: boolean
  rain?: boolean
}

interface RainDrop {
  left: number
  delay: number
  duration: number
}

export function AmbientBackdrop({ morale, danger = false, rain = false }: AmbientBackdropProps) {
  const drops = useMemo<RainDrop[]>(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: (i * 137) % 100,
        delay: (i % 10) * 0.3,
        duration: 0.7 + (i % 5) * 0.12,
      })),
    [],
  )
  const gloom = Math.max(0, (60 - morale) / 60) * 0.5

  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__sky" />
      <div className="backdrop__clouds" />
      {rain ? (
        <div className="backdrop__rain">
          {drops.map((d, i) => (
            <span
              key={i}
              style={{
                left: `${d.left}%`,
                animationDelay: `${d.delay}s`,
                animationDuration: `${d.duration}s`,
              }}
            />
          ))}
        </div>
      ) : null}
      <div className="backdrop__gloom" style={{ opacity: gloom }} />
      {danger ? <div className="backdrop__danger" /> : null}
      <div className="backdrop__scan" />
      <div className="backdrop__vignette" />
    </div>
  )
}
