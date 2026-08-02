import type { GameState } from '../../game/types'
import { BALANCE } from '../../game/data/balance'
import { isOnExpedition } from '../../game/actions'
import { moraleLabel } from '../../game/state'
import { Gauge } from './Gauge'
import { PALETTE } from '../art/manifest'

interface StatusWallProps {
  state: GameState
}

function capacityWord(value: number): string {
  if (value >= 70) return '安定している'
  if (value >= 40) return '低下中'
  if (value >= 20) return '逼迫している'
  return '機能停止寸前'
}

export function StatusWall({ state }: StatusWallProps) {
  const r = state.resources
  const present = state.units.filter((u) => !isOnExpedition(u))
  const away = state.units.length - present.length
  const consume = present.length * BALANCE.unit.foodPerUnit
  const foodDays = consume > 0 ? Math.floor(r.food / consume) : 99
  const income =
    BALANCE.budget.income + (r.power >= BALANCE.budget.bonusAt ? BALANCE.budget.bonus : 0)

  return (
    <div className="statuswall">
      <Gauge
        label="食料"
        icon="food"
        value={r.food}
        max={200}
        color={PALETTE.amber}
        stateWord={`残り約 ${foodDays} 日（1日 −${consume}）`}
      />
      <Gauge
        label="電力"
        icon="power"
        value={r.power}
        color={PALETTE.cyan}
        stateWord={capacityWord(r.power)}
      />
      <Gauge
        label="医療"
        icon="medical"
        value={r.medical}
        color={PALETTE.green}
        stateWord={capacityWord(r.medical)}
      />
      <Gauge
        label="士気"
        icon="morale"
        value={r.morale}
        color={PALETTE.gold}
        stateWord={moraleLabel(r.morale)}
      />

      <dl className="statuswall__stocks">
        <div>
          <dt>予算</dt>
          <dd>{state.budget}</dd>
        </div>
        <div>
          <dt>備蓄</dt>
          <dd>{state.stockpile}</dd>
        </div>
        <div>
          <dt>人員</dt>
          <dd>
            {present.length}
            {away > 0 ? `（他${away}探索中）` : ''}
          </dd>
        </div>
      </dl>
      <p className="statuswall__forecast">
        日々の清算: 食料 −{consume} / 予算 +{income}
        {r.power < BALANCE.budget.bonusAt ? '（電力回復で増収）' : ''}
      </p>
    </div>
  )
}
