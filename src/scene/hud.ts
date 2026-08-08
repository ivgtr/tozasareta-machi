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
  resource?: 'food' | 'power' | 'medical' | 'morale'
}

export function deriveAlerts(state: GameState): HudAlert[] {
  const alerts: HudAlert[] = []
  const r = state.resources
  const present = state.units.filter((u) => !isOnExpedition(u))
  if (r.food < lowFoodThreshold(present.length)) {
    alerts.push({
      icon: 'alert_warning',
      text: '食料の残りが少ない',
      tone: 'warning',
      resource: 'food',
    })
  }
  if (r.medical < BALANCE.medical.neglectAt) {
    alerts.push({
      icon: 'alert_danger',
      text: '医療体制が逼迫',
      tone: 'danger',
      resource: 'medical',
    })
  }
  if (r.power < BALANCE.power.lowAt) {
    alerts.push({
      icon: 'alert_warning',
      text: '電力不足',
      tone: 'warning',
      resource: 'power',
    })
  }
  if (r.morale < BALANCE.morale.riotAt) {
    alerts.push({
      icon: 'alert_danger',
      text: '暴動の危険',
      tone: 'danger',
      resource: 'morale',
    })
  }
  return alerts
}

export interface HudCallbacks {
  onUndo: () => void
  onLog: () => void
  onMenu: () => void
}

export class HudBar extends Phaser.GameObjects.Container {
  private readonly frame: Phaser.GameObjects.Graphics
  private readonly dynamic: Phaser.GameObjects.Container
  private readonly undoButton: PixelButton
  private readonly logButton: PixelButton
  private readonly menuButton: PixelButton
  private rect: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private deviceClass: DeviceClass = 'wide'

  constructor(scene: Phaser.Scene, callbacks: HudCallbacks) {
    super(scene)
    this.frame = scene.add.graphics()
    this.dynamic = scene.add.container()
    this.undoButton = new PixelButton(scene, {
      label: '一手戻る',
      width: 82,
      height: 34,
      variant: 'quiet',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onUndo,
    })
    this.logButton = new PixelButton(scene, {
      label: '記録',
      width: 64,
      height: 34,
      variant: 'quiet',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onLog,
    })
    this.menuButton = new PixelButton(scene, {
      label: 'メニュー',
      width: 76,
      height: 34,
      variant: 'quiet',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onMenu,
    })
    this.add([this.frame, this.dynamic, this.undoButton, this.logButton, this.menuButton])
    scene.add.existing(this)
  }

  setBounds(rect: Rect, deviceClass: DeviceClass): void {
    this.rect = rect
    this.deviceClass = deviceClass
    this.setPosition(rect.x, rect.y)
    this.redrawFrame()
    if (deviceClass === 'wide') {
      this.menuButton.setSize(76, 44)
      this.menuButton.setLabel('メニュー')
      this.logButton.setSize(64, 44)
      this.undoButton.setSize(82, 44)
      this.undoButton.setVisible(true)
      let x = rect.width - SPACING.sm
      for (const button of [this.menuButton, this.logButton, this.undoButton]) {
        x -= button.buttonWidth
        button.setPosition(x + button.buttonWidth / 2, rect.height / 2)
        x -= SPACING.xs
      }
    } else {
      this.undoButton.setVisible(false)
      this.logButton.setSize(52, 44)
      this.logButton.setLabel('記録')
      this.menuButton.setSize(68, 44)
      this.menuButton.setLabel('メニュー')
      let x = rect.width - SPACING.sm
      for (const button of [this.menuButton, this.logButton]) {
        x -= button.buttonWidth
        button.setPosition(x + button.buttonWidth / 2, rect.height / 2)
        x -= SPACING.xs
      }
    }
  }

  update(state: GameState, canUndo: boolean): void {
    this.undoButton.setEnabled(canUndo)
    const d = this.dynamic
    d.removeAll(true)
    const alerts = deriveAlerts(state)
    if (this.deviceClass === 'wide') this.renderWide(d, state, alerts)
    else this.renderNarrow(d, state, alerts)
  }

  private redrawFrame(): void {
    const g = this.frame
    g.clear()
    g.fillStyle(COLORS.night900, 0.98)
    g.fillRect(0, 0, this.rect.width, this.rect.height)
    g.lineStyle(1, COLORS.frameLo, 0.8)
    g.lineBetween(0, this.rect.height - 1, this.rect.width, this.rect.height - 1)
    if (this.deviceClass === 'narrow') {
      g.lineStyle(1, COLORS.frameLo, 0.35)
      g.lineBetween(SPACING.sm, this.rect.height / 2, this.rect.width - 140, this.rect.height / 2)
    }
  }

  private renderWide(
    host: Phaser.GameObjects.Container,
    state: GameState,
    alerts: HudAlert[],
  ): void {
    let cursor = this.renderWideDay(host, state.day)
    cursor = this.renderResources(host, cursor, state, alerts, true)
    const stocks = pixelText(this.scene, `予算 ${state.budget}  備蓄 ${state.stockpile}`, {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.inkDim,
    })
    stocks.setPosition(cursor + SPACING.sm, this.rect.height / 2)
    stocks.setOrigin(0, 0.5)
    host.add(stocks)
    cursor += stocks.width + SPACING.md

    const alert = alerts.find((candidate) => candidate.tone === 'danger') ?? alerts[0]
    if (alert) {
      cursor += this.addIcon(host, cursor, alert.icon, 18)
      const text = pixelText(this.scene, alert.text, {
        fontSize: TEXT_SIZE.labelWide,
        color: alert.tone === 'danger' ? COLORS.red : COLORS.amber,
      })
      text.setPosition(cursor + 2, this.rect.height / 2)
      text.setOrigin(0, 0.5)
      host.add(text)
      cursor += text.width + SPACING.md
      if (alerts.length > 1) {
        const more = pixelText(this.scene, `+${alerts.length - 1}`, {
          fontSize: TEXT_SIZE.labelNarrow,
          color: COLORS.inkDim,
        })
        more.setPosition(cursor, this.rect.height / 2)
        more.setOrigin(0, 0.5)
        host.add(more)
        cursor += more.width + SPACING.sm
      }
    }

    const actionLimit = this.undoButton.x - this.undoButton.buttonWidth / 2 - SPACING.md
    if (cursor < actionLimit - 80) this.renderModifier(host, cursor, state, actionLimit - cursor)
  }

  private renderNarrow(
    host: Phaser.GameObjects.Container,
    state: GameState,
    alerts: HudAlert[],
  ): void {
    const clamped = Math.min(state.day, BALANCE.days)
    const rescueIn = Math.max(1, BALANCE.days - clamped + 1)
    const day = pixelText(this.scene, `DAY ${clamped}`, {
      fontFamily: FONT_DISPLAY,
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.gold,
    })
    day.setPosition(SPACING.sm, 6)
    host.add(day)

    const rescue = pixelText(this.scene, `救援 ${rescueIn}日`, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: rescueIn <= 5 ? COLORS.red : COLORS.inkDim,
    })
    rescue.setPosition(72, 7)
    host.add(rescue)

    const stocks = pixelText(this.scene, `予算 ${state.budget}  備蓄 ${state.stockpile}`, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
    })
    stocks.setPosition(148, 7)
    host.add(stocks)

    const cursor = this.renderResources(host, SPACING.sm, state, alerts, false, 39)
    const actionLimit = this.logButton.x - this.logButton.buttonWidth / 2 - SPACING.sm
    if (cursor < actionLimit - 54) {
      this.renderModifier(host, cursor, state, actionLimit - cursor, 39)
    }
  }

  private renderWideDay(host: Phaser.GameObjects.Container, day: number): number {
    const clamped = Math.min(day, BALANCE.days)
    const rescueIn = Math.max(1, BALANCE.days - clamped + 1)
    const dayLabel = pixelText(this.scene, 'DAY', {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
    })
    dayLabel.setPosition(SPACING.sm, 8)
    host.add(dayLabel)
    const dayNum = pixelText(this.scene, String(clamped), {
      fontFamily: FONT_DISPLAY,
      fontSize: 24,
      color: COLORS.gold,
    })
    dayNum.setPosition(SPACING.sm, 24)
    host.add(dayNum)
    const rescue = pixelText(this.scene, `救援まで ${rescueIn}日`, {
      fontSize: TEXT_SIZE.labelWide,
      color: rescueIn <= 5 ? COLORS.red : COLORS.inkDim,
    })
    rescue.setPosition(60, this.rect.height / 2)
    rescue.setOrigin(0, 0.5)
    host.add(rescue)
    return 158
  }

  private renderResources(
    host: Phaser.GameObjects.Container,
    start: number,
    state: GameState,
    alerts: HudAlert[],
    wide: boolean,
    y: number = this.rect.height / 2,
  ): number {
    const alertByResource = new Map<NonNullable<HudAlert['resource']>, HudAlert>()
    for (const alert of alerts) {
      if (alert.resource) alertByResource.set(alert.resource, alert)
    }
    const items: Array<['food' | 'power' | 'medical' | 'morale', number]> = [
      ['food', state.resources.food],
      ['power', state.resources.power],
      ['medical', state.resources.medical],
      ['morale', state.resources.morale],
    ]
    let cursor = start
    for (const [id, value] of items) {
      const alert = alertByResource.get(id)
      cursor += this.addResource(host, cursor, id, value, wide, alert?.tone, y)
    }
    return cursor
  }

  private addResource(
    host: Phaser.GameObjects.Container,
    x: number,
    id: string,
    value: number,
    wide: boolean,
    tone?: HudAlert['tone'],
    y: number = this.rect.height / 2,
  ): number {
    const iconSize = wide ? 20 : 16
    let cursor = x
    cursor += this.addIcon(host, cursor, id, iconSize, y)
    const color = tone === 'danger' ? COLORS.red : tone === 'warning' ? COLORS.amber : COLORS.inkDim
    const num = pixelText(this.scene, String(Math.round(value)), {
      fontSize: tone && wide ? 18 : wide ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
      color,
    })
    num.setPosition(cursor + 2, y)
    num.setOrigin(0, 0.5)
    host.add(num)
    return iconSize + num.width + (wide ? SPACING.md : SPACING.sm)
  }

  private addIcon(
    host: Phaser.GameObjects.Container,
    x: number,
    id: string,
    size: number,
    y: number = this.rect.height / 2,
  ): number {
    drawArtSlot(this.scene, host, 'icon', id, x + size / 2, y, {
      width: size,
      height: size,
      glyphSize: Math.max(12, size - 4),
      fallbackGlyph: '・',
    })
    return size + 2
  }

  private renderModifier(
    host: Phaser.GameObjects.Container,
    x: number,
    state: GameState,
    available: number,
    y: number = this.rect.height / 2,
  ): void {
    const modifier = state.modifiers[0]
    if (!modifier) return
    const spec = artSpec('event', modifier.id)
    const label = `${spec?.glyph ?? '状'} ${spec?.label ?? modifier.id} ${modifier.daysLeft}日`
    const badge = pixelText(this.scene, label, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: spec ? colorNum(spec.color) : COLORS.inkDim,
      wordWrapWidth: available,
    })
    badge.setPosition(x, y)
    badge.setOrigin(0, 0.5)
    host.add(badge)
  }
}
