import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState } from '../../game/types'
import { BALANCE } from '../../game/data/balance'
import { isOnExpedition } from '../../game/actions'
import { PixelArt } from '../art/PixelArt'
import { PixelButton } from './PixelButton'
import { GameMenu } from './GameMenu'

interface TopBarProps {
  state: GameState
  canUndo: boolean
  onUndo: () => void
  onRestart: () => void
  onBackToTitle: () => void
}

interface Alert {
  icon: string
  text: string
  tone: 'warning' | 'danger'
}

function deriveAlerts(state: GameState): Alert[] {
  const alerts: Alert[] = []
  const r = state.resources
  const present = state.units.filter((u) => !isOnExpedition(u))
  const consume = present.length * BALANCE.unit.foodPerUnit
  if (r.food < consume * BALANCE.morale.lowFoodDays)
    alerts.push({ icon: 'alert_warning', text: '食料の残りが少ない', tone: 'warning' })
  if (r.medical < BALANCE.medical.neglectAt)
    alerts.push({ icon: 'alert_danger', text: '医療体制が逼迫', tone: 'danger' })
  if (r.power < 30) alerts.push({ icon: 'alert_warning', text: '電力不足', tone: 'warning' })
  if (r.morale < BALANCE.morale.riotAt)
    alerts.push({ icon: 'alert_danger', text: '暴動の危険', tone: 'danger' })
  return alerts
}

export function TopBar({ state, canUndo, onUndo, onRestart, onBackToTitle }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    if (wasOpenRef.current && !menuOpen) menuButtonRef.current?.focus()
    wasOpenRef.current = menuOpen
  }, [menuOpen])

  const alerts = deriveAlerts(state)
  const day = Math.min(state.day, BALANCE.days)
  const rescueIn = Math.max(1, BALANCE.days - day + 1)
  return (
    <>
      <header className="play__top">
        <div className="play__day">
          <span key={day} className="play__day-num">
            {day}
          </span>
          <div className="play__day-side">
            <span className="play__day-total">/ {BALANCE.days}</span>
            <span className={`play__rescue ${rescueIn <= 5 ? 'play__rescue--soon' : ''}`}>
              救援まで あと{rescueIn}日
            </span>
          </div>
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
          <PixelButton
            ref={menuButtonRef}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            メニュー
          </PixelButton>
        </div>
      </header>
      {menuOpen ? (
        <GameMenu onClose={closeMenu} onBackToTitle={onBackToTitle} onRestart={onRestart} />
      ) : null}
    </>
  )
}
