import type { GameState } from '../../game/types'

interface CompactStatusProps {
  state: GameState
}

export function CompactStatus({ state }: CompactStatusProps) {
  const items = [
    ['食料', state.resources.food],
    ['電力', state.resources.power],
    ['医療', state.resources.medical],
    ['士気', state.resources.morale],
    ['予算', state.budget],
    ['備蓄', state.stockpile],
  ] as const

  return (
    <section className="compact-status" aria-label="資源状況">
      <dl className="compact-status__list">
        {items.map(([label, value]) => (
          <div key={label} className="compact-status__item">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
