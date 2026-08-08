import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import type { DeviceClass } from '../layout'
import type { PlanState } from '../plan'
import type { Rect } from '../regions'
import { COLORS, SPACING, TEXT_SIZE } from '../tokens'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { derivePlanningForecast, derivePlanningStatus, type PlanningForecast } from './model'

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
      width: 104,
      height: 34,
      variant: 'toggle',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onToggleRation,
    })
    this.procureButton = new PixelButton(scene, {
      label: '調達 OFF',
      width: 104,
      height: 34,
      variant: 'toggle',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onToggleProcure,
    })
    this.autoButton = new PixelButton(scene, {
      label: '自動配置',
      width: 108,
      height: 38,
      variant: 'quiet',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onAuto,
    })
    this.removeButton = new PixelButton(scene, {
      label: '配置解除',
      width: 108,
      height: 38,
      variant: 'danger',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onUnassignSelected,
    })
    this.commitButton = new PixelButton(scene, {
      label: '今日を終える ▶',
      width: 174,
      height: 44,
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
    const summary = `${status.remaining === 0 ? '配置完了' : `待機 ${status.remaining}人`}  /  予算 −${status.plannedBudget}${status.plannedStockpile > 0 ? `  備蓄 −${status.plannedStockpile}` : ''}`
    const text = pixelText(this.scene, summary, {
      fontSize: TEXT_SIZE.labelWide,
      color: remainingColor,
      wordWrapWidth: this.rect.width - SPACING.md * 2,
    })
    text.setPosition(SPACING.md, 7)
    d.add(text)

    const forecastText = pixelText(
      this.scene,
      `本日の見込  ${formatForecast(forecast, this.deviceClass)}`,
      {
        fontSize: TEXT_SIZE.labelNarrow,
        color: COLORS.inkDim,
        wordWrapWidth: this.rect.width - SPACING.md * 2,
      },
    )
    forecastText.setPosition(SPACING.md, this.deviceClass === 'wide' ? 22 : 7)
    d.add(forecastText)
    text.setVisible(this.deviceClass === 'wide')
  }

  triggerAutoFromKeyboard(): boolean {
    return this.autoButton.triggerFromKeyboard()
  }

  triggerCommitFromKeyboard(): boolean {
    return this.commitButton.triggerFromKeyboard()
  }

  private layoutWide(): void {
    const w = this.rect.width
    this.rationButton.setSize(104, 34)
    this.procureButton.setSize(104, 34)
    this.autoButton.setSize(108, 38)
    this.removeButton.setSize(108, 38)
    this.commitButton.setSize(Math.max(160, w - 148), 44)
    this.rationButton.setPosition(62, 64)
    this.procureButton.setPosition(174, 64)
    this.autoButton.setPosition(62, 104)
    this.removeButton.setPosition(62, 104)
    this.commitButton.setPosition(148 + (w - 148) / 2, 104)
  }

  private layoutNarrow(): void {
    const y = this.rect.height - 20
    this.rationButton.setSize(88, 34)
    this.procureButton.setSize(84, 34)
    this.autoButton.setSize(82, 34)
    this.removeButton.setSize(82, 34)
    this.commitButton.setSize(136, 38)
    const widths = [88, 84, 82, 136]
    const gaps = 8 * 3
    const total = widths.reduce((sum, width) => sum + width, 0) + gaps
    let x = Math.max(SPACING.sm, (this.rect.width - total) / 2)
    const place = (button: PixelButton, width: number) => {
      button.setPosition(x + width / 2, y)
      x += width + 8
    }
    place(this.rationButton, widths[0]!)
    place(this.procureButton, widths[1]!)
    const contextWidth = widths[2]!
    this.autoButton.setPosition(x + contextWidth / 2, y)
    this.removeButton.setPosition(x + contextWidth / 2, y)
    x += contextWidth + 8
    place(this.commitButton, widths[3]!)
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

function formatForecast(forecast: PlanningForecast, deviceClass: DeviceClass): string {
  const labels =
    deviceClass === 'wide'
      ? {
          food: '食料',
          power: '電力',
          medical: '医療',
          morale: '士気',
          budget: '予算',
          stockpile: '備蓄',
        }
      : { food: '食', power: '電', medical: '医', morale: '士', budget: '予', stockpile: '備' }
  const values = [
    [labels.food, forecast.resources.food],
    [labels.power, forecast.resources.power],
    [labels.medical, forecast.resources.medical],
    [labels.morale, forecast.resources.morale],
    [labels.budget, forecast.budget],
    [labels.stockpile, forecast.stockpile],
  ] as const
  const parts = values
    .filter(([, value]) => value !== 0)
    .map(([label, value]) => `${label}${value > 0 ? '+' : ''}${value}`)
  const road = forecast.progress.restore_road
  if (road) parts.push(`${deviceClass === 'wide' ? '道路復旧' : '道'}+${road}`)
  return parts.join(deviceClass === 'wide' ? '  /  ' : ' ') || '変化なし'
}
