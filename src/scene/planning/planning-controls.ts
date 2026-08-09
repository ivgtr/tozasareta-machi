import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import type { DeviceClass } from '../layout'
import type { PlanState } from '../plan'
import type { Rect } from '../regions'
import { COLORS, SPACING, TEXT_SIZE } from '../tokens'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { derivePlanningForecast, derivePlanningStatus, type PlanningForecast } from './model'

const BUTTON_HEIGHT = 44
const WIDE_BUTTON_GAP = 6
const NARROW_BUTTON_GAP = 8

export interface PlanningControlsCallbacks {
  onAuto: () => void
  onCommit: () => void
  onUnassignSelected: () => void
  onToggleRation: () => void
  onToggleProcure: () => void
}

export class PlanningControls extends Phaser.GameObjects.Container {
  private readonly frame: Phaser.GameObjects.Graphics
  private readonly dynamic: Phaser.GameObjects.Container
  private readonly rationButton: PixelButton
  private readonly procureButton: PixelButton
  private readonly autoButton: PixelButton
  private readonly removeButton: PixelButton
  private readonly commitButton: PixelButton
  private rect: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private deviceClass: DeviceClass = 'wide'

  constructor(scene: Phaser.Scene, callbacks: PlanningControlsCallbacks) {
    super(scene)
    this.frame = scene.add.graphics()
    this.dynamic = scene.add.container()
    this.rationButton = new PixelButton(scene, {
      label: '配給 通常',
      width: 72,
      height: BUTTON_HEIGHT,
      variant: 'toggle',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onToggleRation,
    })
    this.procureButton = new PixelButton(scene, {
      label: '調達 OFF',
      width: 72,
      height: BUTTON_HEIGHT,
      variant: 'toggle',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onToggleProcure,
    })
    this.autoButton = new PixelButton(scene, {
      label: '自動配置',
      width: 72,
      height: BUTTON_HEIGHT,
      variant: 'quiet',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onAuto,
    })
    this.removeButton = new PixelButton(scene, {
      label: '配置解除',
      width: 72,
      height: BUTTON_HEIGHT,
      variant: 'danger',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onUnassignSelected,
    })
    this.commitButton = new PixelButton(scene, {
      label: '今日を終える ▶',
      width: 112,
      height: BUTTON_HEIGHT,
      variant: 'primary',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onCommit,
    })
    this.add([
      this.frame,
      this.dynamic,
      this.rationButton,
      this.procureButton,
      this.autoButton,
      this.removeButton,
      this.commitButton,
    ])
    scene.add.existing(this)
  }

  setBounds(rect: Rect, deviceClass: DeviceClass): void {
    this.rect = rect
    this.deviceClass = deviceClass
    this.setPosition(rect.x, rect.y)
    this.redrawFrame()
    if (deviceClass === 'wide') this.layoutWide()
    else this.layoutNarrow()
  }

  update(state: GameState, plan: PlanState, busy: boolean, selectedAssigned: boolean): void {
    const status = derivePlanningStatus(state, plan)
    const forecast = derivePlanningForecast(state, plan)
    this.rationButton.setEnabled(!busy)
    this.procureButton.setEnabled(!busy)
    this.autoButton.setEnabled(!busy)
    this.removeButton.setEnabled(!busy)
    this.autoButton.setVisible(!selectedAssigned)
    this.removeButton.setVisible(selectedAssigned)
    this.commitButton.setEnabled(!busy)

    this.rationButton.setSelected(plan.ration)
    this.rationButton.setVariant('toggle')
    this.rationButton.setLabel(plan.ration ? '配給 節約' : '配給 通常')

    this.procureButton.setSelected(plan.procure && status.procureAffordable)
    this.procureButton.setVariant(status.procureAffordable ? 'toggle' : 'danger')
    this.procureButton.setLabel(
      status.procureAffordable ? (plan.procure ? '調達 ON' : '調達 OFF') : '調達 不足',
    )

    const d = this.dynamic
    d.removeAll(true)
    const remainingColor = status.remaining === 0 ? COLORS.green : COLORS.amber
    if (this.deviceClass === 'wide') {
      const summary = `${status.remaining === 0 ? '配置完了' : `待機 ${status.remaining}人`}  /  予−${status.plannedBudget}${status.plannedStockpile > 0 ? `  備−${status.plannedStockpile}` : ''}`
      d.add(
        pixelText(this.scene, summary, {
          fontSize: TEXT_SIZE.labelWide,
          color: remainingColor,
        }).setPosition(SPACING.md, 7),
      )
      const [primaryForecast, secondaryForecast] = formatForecastRows(forecast)
      const forecastText = secondaryForecast
        ? `本日の見込  ${primaryForecast}\n             ${secondaryForecast}`
        : `本日の見込  ${primaryForecast}`
      d.add(
        pixelText(this.scene, forecastText, {
          fontSize: TEXT_SIZE.labelNarrow,
          color: COLORS.inkDim,
        }).setPosition(SPACING.md, 26),
      )
      return
    }

    const forecastText = pixelText(this.scene, `本日の見込  ${formatForecastCompact(forecast)}`, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
    })
    forecastText.setPosition(SPACING.md, 5)
    d.add(forecastText)
  }

  triggerAutoFromKeyboard(): boolean {
    return this.autoButton.triggerFromKeyboard()
  }

  triggerCommitFromKeyboard(): boolean {
    return this.commitButton.triggerFromKeyboard()
  }

  private layoutWide(): void {
    this.layoutButtonRow({ horizontalPadding: 8, gap: WIDE_BUTTON_GAP, primaryWidth: 112, y: 104 })
  }

  private layoutNarrow(): void {
    this.layoutButtonRow({ horizontalPadding: 8, gap: NARROW_BUTTON_GAP, primaryWidth: 136, y: 44 })
  }

  private layoutButtonRow({
    horizontalPadding,
    gap,
    primaryWidth,
    y,
  }: {
    horizontalPadding: number
    gap: number
    primaryWidth: number
    y: number
  }): void {
    const available = this.rect.width - horizontalPadding * 2 - gap * 3
    const resolvedPrimaryWidth = Math.min(primaryWidth, Math.max(104, available * 0.34))
    const secondaryWidth = Math.max(44, (available - resolvedPrimaryWidth) / 3)
    let cursorX = horizontalPadding

    const place = (button: PixelButton, width: number) => {
      button.setSize(width, BUTTON_HEIGHT)
      button.setPosition(cursorX + width / 2, y)
      cursorX += width + gap
    }

    place(this.rationButton, secondaryWidth)
    place(this.procureButton, secondaryWidth)

    this.autoButton.setSize(secondaryWidth, BUTTON_HEIGHT)
    this.removeButton.setSize(secondaryWidth, BUTTON_HEIGHT)
    this.autoButton.setPosition(cursorX + secondaryWidth / 2, y)
    this.removeButton.setPosition(cursorX + secondaryWidth / 2, y)
    cursorX += secondaryWidth + gap

    place(this.commitButton, resolvedPrimaryWidth)
  }

  private redrawFrame(): void {
    const g = this.frame
    g.clear()
    g.fillStyle(COLORS.night900, 0.97)
    g.fillRect(0, 0, this.rect.width, this.rect.height)
    g.lineStyle(2, COLORS.frameLo)
    g.strokeRect(1, 1, this.rect.width - 2, this.rect.height - 2)
    g.fillStyle(COLORS.amber)
    g.fillRect(2, 2, Math.min(116, this.rect.width - 4), 3)
  }
}

function formatForecastRows(forecast: PlanningForecast): [string, string | null] {
  const resourceParts = [
    ['食', forecast.resources.food],
    ['電', forecast.resources.power],
    ['医', forecast.resources.medical],
    ['士', forecast.resources.morale],
  ] as const
  const otherParts = [
    ['予', forecast.budget],
    ['備', forecast.stockpile],
    ['道', forecast.progress.restore_road ?? 0],
  ] as const
  const primary = formatForecastParts(resourceParts)
  const secondary = formatForecastParts(otherParts)
  if (!primary && !secondary) return ['変化なし', null]
  if (!primary) return [secondary, null]
  return [primary, secondary || null]
}

function formatForecastCompact(forecast: PlanningForecast): string {
  const [primary, secondary] = formatForecastRows(forecast)
  return secondary ? `${primary}  ${secondary}` : primary
}

function formatForecastParts(parts: readonly (readonly [string, number])[]): string {
  return parts
    .filter(([, value]) => value !== 0)
    .map(([label, value]) => `${label}${value > 0 ? '+' : ''}${value}`)
    .join('  ')
}
