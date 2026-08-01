import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type { Aptitude, Unit } from '../../game/types'
import { TRAITS } from '../../game/traits'
import { APTITUDE_LABEL } from '../../game/data/units'
import { PixelArt } from '../art/PixelArt'

const APT_SHORT: Record<Aptitude, string> = { labor: '労', tech: '技', medical: '医', charm: '魅' }
const APT_COLOR: Record<Aptitude, string> = {
  labor: 'var(--amber)',
  tech: 'var(--cyan)',
  medical: 'var(--green)',
  charm: 'var(--gold)',
}

function topAptitude(unit: Unit): Aptitude {
  const order: Aptitude[] = ['labor', 'tech', 'medical', 'charm']
  return order.reduce((best, a) => (unit.apt[a] > unit.apt[best] ? a : best), order[0] as Aptitude)
}

interface UnitCardProps {
  unit: Unit
  selected?: boolean
  compact?: boolean
  onClick?: () => void
  onDetails: () => void
  onPointerDown?: (e: ReactPointerEvent) => void
}

export function UnitCard({
  unit,
  selected = false,
  compact = false,
  onClick,
  onDetails,
  onPointerDown,
}: UnitCardProps) {
  const top = topAptitude(unit)
  const classes = [
    'unit-card',
    compact ? 'unit-card--compact' : '',
    selected ? 'unit-card--selected' : '',
    unit.condition === 'injured' ? 'unit-card--injured' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const badge = (
    <span
      className="unit-card__apt-badge"
      style={{ background: APT_COLOR[top] }}
      aria-label={`得意: ${APTITUDE_LABEL[top]} ${unit.apt[top]}`}
    >
      {APT_SHORT[top]}
    </span>
  )

  const portrait = (
    <div className="unit-card__portrait">
      <PixelArt kind="portrait" id={unit.portrait} glyph="人" />
      {badge}
    </div>
  )

  const infoBtn = (
    <button
      type="button"
      className="unit-card__info"
      aria-label={`${unit.name}の詳細`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onDetails()
      }}
    >
      ℹ
    </button>
  )

  const rootProps = {
    className: classes,
    onClick: (e: ReactMouseEvent) => {
      e.stopPropagation()
      onClick?.()
    },
    onPointerDown,
    tabIndex: 0,
    role: 'button' as const,
    'aria-label': unit.alias ? `${unit.name}（${unit.alias}）` : unit.name,
    onKeyDown: (e: ReactKeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick?.()
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        onDetails()
      }
    },
  }

  if (compact) {
    return (
      <div {...rootProps}>
        {portrait}
        <div className="unit-card__id">
          <span className="unit-card__compact-name">{unit.name}</span>
          <span className="unit-card__alias">{unit.alias ?? '—'}</span>
        </div>
        {unit.condition === 'injured' ? <span className="unit-card__badge">負傷</span> : null}
        {infoBtn}
      </div>
    )
  }

  return (
    <div {...rootProps}>
      {portrait}
      <div className="unit-card__body">
        <div className="unit-card__name">
          {unit.name}
          {unit.condition === 'injured' ? <span className="unit-card__badge">負傷</span> : null}
        </div>
        {unit.alias ? <div className="unit-card__alias">{unit.alias}</div> : null}
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
      {infoBtn}
    </div>
  )
}
