import type { GameState } from '../../game/types'
import { BALANCE } from '../../game/data/balance'
import { PixelArt } from '../art/PixelArt'
import { PixelButton } from './PixelButton'

interface TopBarProps {
  state: GameState
  canUndo: boolean
  onUndo: () => void
  onRestart: () => void
}

interface Alert {
  icon: string
  text: string
  tone: 'warning' | 'danger'
}

function deriveAlerts(state: GameState): Alert[] {
  const alerts: Alert[] = []
  const r = state.resources
  const consume = state.units.length * BALANCE.unit.foodPerUnit
  if (r.food < consume * BALANCE.morale.lowFoodDays)
    alerts.push({ icon: 'alert_warning', text: '食料の残りが少ない', tone: 'warning' })
  if (r.medical < BALANCE.medical.neglectAt)
    alerts.push({ icon: 'alert_danger', text: '医療体制が逼迫', tone: 'danger' })
  if (r.power < 30) alerts.push({ icon: 'alert_warning', text: '電力不足', tone: 'warning' })
  if (r.morale < BALANCE.morale.riotAt)
    alerts.push({ icon: 'alert_danger', text: '暴動の危険', tone: 'danger' })
  return alerts
}

export function TopBar({ state, canUndo, onUndo, onRestart }: TopBarProps) {
  const alerts = deriveAlerts(state)
  return (
    <header className="play__top">
      <div className="play__day">
        <span key={Math.min(state.day, BALANCE.days)} className="play__day-num">
          {Math.min(state.day, BALANCE.days)}
        </span>
        <span className="play__day-total">/ {BALANCE.days}</span>
      </div>
      <div className="play__alerts">
        {alerts.length === 0 ? (
          <span className="play__alert play__alert--ok">
            <PixelArt kind="icon" id="status_ok" size="sm" />
            <span>平穏を保っている</span>
          </span>
        ) : (
          alerts.map((a, i) => (
            <span key={i} className={`play__alert play__alert--${a.tone}`}>
              <PixelArt kind="icon" id={a.icon} size="sm" />
              <span>{a.text}</span>
            </span>
          ))
        )}
      </div>
      <div className="play__top-actions">
        <PixelButton disabled={!canUndo} onClick={onUndo}>
          一手戻る
        </PixelButton>
        <PixelButton onClick={onRestart}>最初から</PixelButton>
      </div>
    </header>
  )
}
