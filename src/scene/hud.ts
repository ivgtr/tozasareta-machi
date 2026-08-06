import Phaser from 'phaser'
import type { GameState } from '../game/types'
import { BALANCE } from '../game/data/balance'
import { isOnExpedition } from '../game/actions'
import { lowFoodThreshold } from '../game/settlement'
import { artSpec } from './art/manifest'
import { COLORS, FONT_DISPLAY, SPACING, TEXT_SIZE, colorNum } from './tokens'
import { PixelButton } from './ui/button'
import { pixelText } from './ui/pixel-text'
import { drawArtSlot } from './ui/art-slot'
import type { Rect } from './regions'
import type { DeviceClass } from './layout'

export interface HudAlert {
  icon: string
  text: string
  tone: 'warning' | 'danger'
}

export function deriveAlerts(state: GameState): HudAlert[] {
  const alerts: HudAlert[] = []
  const r = state.resources
  const present = state.units.filter((u) => !isOnExpedition(u))
  if (r.food < lowFoodThreshold(present.length))
    alerts.push({ icon: 'alert_warning', text: '食料の残りが少ない', tone: 'warning' })
  if (r.medical < BALANCE.medical.neglectAt)
    alerts.push({ icon: 'alert_danger', text: '医療体制が逼迫', tone: 'danger' })
  if (r.power < BALANCE.power.lowAt)
    alerts.push({ icon: 'alert_warning', text: '電力不足', tone: 'warning' })
  if (r.morale < BALANCE.morale.riotAt)
    alerts.push({ icon: 'alert_danger', text: '暴動の危険', tone: 'danger' })
  return alerts
}

export interface HudCallbacks {
  onUndo: () => void
  onMenu: () => void
}

export class HudBar extends Phaser.GameObjects.Container {
  private readonly dynamic: Phaser.GameObjects.Container
  private readonly undoButton: PixelButton
  private readonly menuButton: PixelButton
  private readonly callbacks: HudCallbacks
  private rect: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private deviceClass: DeviceClass = 'wide'

  constructor(scene: Phaser.Scene, callbacks: HudCallbacks) {
    super(scene)
    this.callbacks = callbacks
    this.dynamic = scene.add.container()
    this.add(this.dynamic)
    this.undoButton = new PixelButton(scene, {
      label: '一手戻る',
      width: 96,
      height: 36,
      fontSize: TEXT_SIZE.labelWide,
      onAction: () => this.callbacks.onUndo(),
    })
    this.menuButton = new PixelButton(scene, {
      label: 'メニュー',
      width: 96,
      height: 36,
      fontSize: TEXT_SIZE.labelWide,
      onAction: () => this.callbacks.onMenu(),
    })
    this.add([this.undoButton, this.menuButton])
    scene.add.existing(this)
  }

  setBounds(rect: Rect, deviceClass: DeviceClass): void {
    this.rect = rect
    this.deviceClass = deviceClass
    this.setPosition(rect.x, rect.y)
    if (deviceClass === 'wide') {
      this.menuButton.setSize(96, 36)
      this.menuButton.setLabel('メニュー')
      this.menuButton.setPosition(rect.width - 96 - SPACING.sm, rect.height / 2)
      this.menuButton.setVisible(true)
      this.undoButton.setSize(96, 36)
      this.undoButton.setPosition(rect.width - 96 * 2 - SPACING.sm * 2, rect.height / 2)
      this.undoButton.setVisible(true)
    } else {
      this.menuButton.setSize(64, 36)
      this.menuButton.setLabel('メニュ')
      this.menuButton.setPosition(rect.width - 64 - SPACING.xs, rect.height / 2)
      this.menuButton.setVisible(true)
      this.undoButton.setVisible(false)
    }
  }

  update(state: GameState, canUndo: boolean): void {
    this.undoButton.setEnabled(canUndo)
    const wide = this.deviceClass === 'wide'
    const d = this.dynamic
    d.removeAll(true)
    const day = Math.min(state.day, BALANCE.days)
    const rescueIn = Math.max(1, BALANCE.days - day + 1)
    const dayNum = pixelText(this.scene, String(day), {
      fontFamily: FONT_DISPLAY,
      fontSize: wide ? TEXT_SIZE.dayCounterWide : TEXT_SIZE.dayCounterNarrow,
      color: COLORS.gold,
    })
    dayNum.setPosition(SPACING.sm, this.rect.height / 2)
    dayNum.setOrigin(0, 0.5)
    d.add(dayNum)
    let cursor = SPACING.sm + dayNum.width + SPACING.sm
    if (wide) {
      const side = pixelText(this.scene, `/ ${BALANCE.days}  救援まで あと${rescueIn}日`, {
        fontSize: TEXT_SIZE.labelWide,
        color: rescueIn <= 5 ? COLORS.red : COLORS.inkDim,
      })
      side.setPosition(cursor, this.rect.height / 2)
      side.setOrigin(0, 0.5)
      d.add(side)
      cursor += side.width + SPACING.lg
    }
    const items: Array<[string, number]> = [
      ['food', state.resources.food],
      ['power', state.resources.power],
      ['medical', state.resources.medical],
      ['morale', state.resources.morale],
    ]
    for (const [id, value] of items) {
      cursor += this.addResource(d, cursor, id, value, wide)
    }
    if (wide) {
      const stocks = pixelText(this.scene, `予算${state.budget} 備蓄${state.stockpile}`, {
        fontSize: TEXT_SIZE.labelWide,
        color: COLORS.inkDim,
      })
      stocks.setPosition(cursor + SPACING.sm, this.rect.height / 2)
      stocks.setOrigin(0, 0.5)
      d.add(stocks)
      cursor += stocks.width + SPACING.lg
    } else {
      const budget = pixelText(this.scene, `予${state.budget}`, {
        fontSize: TEXT_SIZE.labelNarrow,
        color: COLORS.inkDim,
      })
      budget.setPosition(cursor, this.rect.height / 2)
      budget.setOrigin(0, 0.5)
      d.add(budget)
      cursor += budget.width + SPACING.sm
      const stock = pixelText(this.scene, `備${state.stockpile}`, {
        fontSize: TEXT_SIZE.labelNarrow,
        color: COLORS.inkDim,
      })
      stock.setPosition(cursor, this.rect.height / 2)
      stock.setOrigin(0, 0.5)
      d.add(stock)
      cursor += stock.width + SPACING.sm
    }

    const alerts = deriveAlerts(state)
    for (const a of alerts) {
      const color = a.tone === 'danger' ? COLORS.red : COLORS.amber
      cursor += this.addIcon(d, cursor, a.icon)
      const text = pixelText(this.scene, wide ? a.text : '', {
        fontSize: TEXT_SIZE.labelNarrow,
        color,
      })
      text.setPosition(cursor + 2, this.rect.height / 2)
      text.setOrigin(0, 0.5)
      d.add(text)
      cursor += text.width + SPACING.md
    }
    if (alerts.length === 0 && wide) {
      cursor += this.addIcon(d, cursor, 'status_ok')
      const ok = pixelText(this.scene, '平穏を保っている', {
        fontSize: TEXT_SIZE.labelNarrow,
        color: COLORS.green,
      })
      ok.setPosition(cursor + 2, this.rect.height / 2)
      ok.setOrigin(0, 0.5)
      d.add(ok)
      cursor += ok.width + SPACING.md
    }
    if (wide) {
      for (const m of state.modifiers) {
        const spec = artSpec('event', m.id)
        const badge = pixelText(
          this.scene,
          `${spec?.glyph ?? '状'}${spec?.label ?? m.id} あと${m.daysLeft}日`,
          {
            fontSize: TEXT_SIZE.labelNarrow,
            color: spec ? colorNum(spec.color) : COLORS.inkDim,
          },
        )
        badge.setPosition(cursor, this.rect.height / 2)
        badge.setOrigin(0, 0.5)
        d.add(badge)
        cursor += badge.width + SPACING.md
      }
    }
  }

  private addResource(
    host: Phaser.GameObjects.Container,
    x: number,
    id: string,
    value: number,
    wide: boolean,
  ): number {
    let cursor = x
    cursor += this.addIcon(host, cursor, id)
    const num = pixelText(this.scene, String(Math.round(value)), {
      fontSize: wide ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
      color: COLORS.ink,
    })
    num.setPosition(cursor + 2, this.rect.height / 2)
    num.setOrigin(0, 0.5)
    host.add(num)
    return num.width + SPACING.md + 20
  }

  private addIcon(host: Phaser.GameObjects.Container, x: number, id: string): number {
    const size = 18
    drawArtSlot(this.scene, host, 'icon', id, x + size / 2, this.rect.height / 2, {
      width: size,
      height: size,
      glyphSize: 14,
      fallbackGlyph: '・',
    })
    return size + 2
  }
}
