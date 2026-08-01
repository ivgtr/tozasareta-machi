import type { GameState, TaskId } from '../../game/types'
import { BALANCE } from '../../game/data/balance'
import { moraleLabel } from '../../game/state'
import { Gauge } from './Gauge'
import { Roster } from './Roster'
import { PALETTE } from '../art/manifest'

interface StatusWallProps {
  state: GameState
  chars: Partial<Record<TaskId, string>>
  selectedChar: string | null
  busy?: boolean
  onSelectChar: (id: string | null) => void
}

function capacityWord(value: number): string {
  if (value >= 70) return '安定している'
  if (value >= 40) return '低下中'
  if (value >= 20) return '逼迫している'
  return '機能停止寸前'
}

export function StatusWall({
  state,
  chars,
  selectedChar,
  busy = false,
  onSelectChar,
}: StatusWallProps) {
  const r = state.resources
  const foodDays = Math.floor(r.food / BALANCE.food.consume)
  const income =
    BALANCE.budget.income + (r.power >= BALANCE.budget.bonusAt ? BALANCE.budget.bonus : 0)

  return (
    <div className="statuswall">
      <Gauge
        label="食料"
        value={r.food}
        max={200}
        color={PALETTE.amber}
        stateWord={`残り約 ${foodDays} 日`}
      />
      <Gauge label="電力" value={r.power} color={PALETTE.cyan} stateWord={capacityWord(r.power)} />
      <Gauge
        label="医療"
        value={r.medical}
        color={PALETTE.green}
        stateWord={capacityWord(r.medical)}
      />
      <Gauge label="士気" value={r.morale} color={PALETTE.gold} stateWord={moraleLabel(r.morale)} />

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
          <dt>作業員</dt>
          <dd>{state.workers}</dd>
        </div>
      </dl>
      <p className="statuswall__forecast">
        日々の清算: 食料 −{BALANCE.food.consume} / 予算 +{income}
        {r.power < BALANCE.budget.bonusAt ? '（電力回復で増収）' : ''}
      </p>

      <h3 className="statuswall__sub">人員</h3>
      <Roster
        characters={state.characters}
        chars={chars}
        selected={selectedChar}
        busy={busy}
        onSelect={onSelectChar}
      />
    </div>
  )
}
