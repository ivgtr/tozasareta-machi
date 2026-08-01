import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Unit } from '../../game/types'
import { TRAITS } from '../../game/traits'
import { PixelArt } from '../art/PixelArt'

const APT_COLOR: Record<'labor' | 'tech' | 'medical' | 'charm', string> = {
  labor: 'var(--amber)',
  tech: 'var(--cyan)',
  medical: 'var(--green)',
  charm: 'var(--gold)',
}

interface UnitCardProps {
  unit: Unit
  selected?: boolean
  onClick?: () => void
  onDetails: () => void
  onPointerDown?: (e: ReactPointerEvent) => void
}

export function UnitCard({
  unit,
  selected = false,
  onClick,
  onDetails,
  onPointerDown,
}: UnitCardProps) {
  return (
    <div
      className={[
        'unit-card',
        selected ? 'unit-card--selected' : '',
        unit.condition === 'injured' ? 'unit-card--injured' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      onPointerDown={onPointerDown}
      tabIndex={0}
      role="button"
      aria-label={unit.name}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        } else if (e.key === 'i' || e.key === 'I') {
          e.preventDefault()
          onDetails()
        }
      }}
    >
      <div className="unit-card__portrait">
        <PixelArt kind="portrait" id={unit.portrait} glyph={unit.name.slice(0, 1)} />
      </div>
      <div className="unit-card__body">
        <div className="unit-card__name">
          {unit.name}
          {unit.condition === 'injured' ? <span className="unit-card__badge">負傷</span> : null}
        </div>
        <div className="unit-card__apt">
          <span style={{ color: APT_COLOR.labor }}>労{unit.apt.labor}</span>
          <span style={{ color: APT_COLOR.tech }}>技{unit.apt.tech}</span>
          <span style={{ color: APT_COLOR.medical }}>医{unit.apt.medical}</span>
          <span style={{ color: APT_COLOR.charm }}>魅{unit.apt.charm}</span>
        </div>
        {unit.traits.length > 0 ? (
          <div className="unit-card__traits">
            {unit.traits.map((t) => (
              <span
                key={t}
                className={
                  TRAITS[t].positive ? 'unit-card__trait' : 'unit-card__trait unit-card__trait--neg'
                }
              >
                {TRAITS[t].name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="unit-card__info"
        aria-label={`${unit.name}の詳細`}
        onClick={(e) => {
          e.stopPropagation()
          onDetails()
        }}
      >
        ℹ
      </button>
    </div>
  )
}
