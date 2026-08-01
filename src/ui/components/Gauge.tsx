import type { CSSProperties } from 'react'

interface GaugeProps {
  label: string
  value: number
  max?: number
  color?: string
  segments?: number
  stateWord?: string
}

export function Gauge({ label, value, max = 100, color, segments = 10, stateWord }: GaugeProps) {
  const ratio = Math.max(0, Math.min(1, value / max))
  const lit = Math.round(ratio * segments)
  const low = ratio < 0.25
  return (
    <div
      className={['gauge', low ? 'gauge--low' : ''].filter(Boolean).join(' ')}
      style={{ '--gauge-color': color } as CSSProperties}
    >
      <div className="gauge__head">
        <span className="gauge__label">{label}</span>
        <span className="gauge__num">{Math.round(value)}</span>
      </div>
      <div
        className="gauge__cells"
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemax={max}
        aria-label={label}
      >
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className={['gauge__cell', i < lit ? 'gauge__cell--on' : ''].join(' ')} />
        ))}
      </div>
      {stateWord ? <div className="gauge__word">{stateWord}</div> : null}
    </div>
  )
}
