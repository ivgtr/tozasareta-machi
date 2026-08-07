import Phaser from 'phaser'
import type { GameState } from '../game/types'
import { resolvePlacement, taskCost } from '../game/actions'
import { isTaskDisabled } from '../game/modifiers'
import type { DeviceClass } from './layout'
import type { Rect } from './regions'
import { COLORS, PANEL_CONTENT_INSET, TEXT_SIZE } from './tokens'
import { FACILITIES, type FacilityViewId } from './town/facilities'
import type { FacilityId } from './town/layout'
import { formatDelta } from './labels'
import type { PlanState } from './plan'
import { PixelButton } from './ui/button'
import { PixelPanel } from './ui/panel'
import { pixelText } from './ui/pixel-text'

const VIEW_LABEL: Record<FacilityViewId, string> = {
  normal: '通常',
  low: '出力低下',
  working: '作業中',
  collapsed: '崩落',
  restored: '復旧済み',
  damaged: '損傷',
}

export interface FacilityDetailContext {
  state: GameState
  plan: PlanState
  view: Record<FacilityId, FacilityViewId>
}

export interface FacilityDetailCallbacks {
  onClose: () => void
}

export class FacilityDetailPanel extends Phaser.GameObjects.Container {
  private readonly panel: PixelPanel
  private readonly dynamic: Phaser.GameObjects.Container
  private readonly closeButton: PixelButton
  private panelWidth = 0
  private panelHeight = 0
  private openFlag = false

  constructor(scene: Phaser.Scene, callbacks: FacilityDetailCallbacks) {
    super(scene)
    this.panel = new PixelPanel(scene, 100, 100)
    this.dynamic = scene.add.container()
    this.closeButton = new PixelButton(scene, {
      label: '閉じる',
      width: 84,
      height: 34,
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onClose,
    })
    this.add([this.panel, this.dynamic, this.closeButton])
    this.setDepth(680)
    this.setVisible(false)
    scene.add.existing(this)
  }

  setBounds(town: Rect, deviceClass: DeviceClass): void {
    if (deviceClass === 'wide') {
      this.panelWidth = Math.min(430, town.width - 32)
      this.panelHeight = 190
      this.setPosition(town.x + town.width - this.panelWidth - 16, town.y + 16)
    } else {
      this.panelWidth = Math.max(300, town.width - 24)
      this.panelHeight = 210
      this.setPosition(town.x + (town.width - this.panelWidth) / 2, town.y + 12)
    }
    this.panel.setPanelSize(this.panelWidth, this.panelHeight)
    this.closeButton.setPosition(this.panelWidth - 54, 26)
  }

  show(ctx: FacilityDetailContext, facility: FacilityId): void {
    this.openFlag = true
    this.setVisible(true)
    this.render(ctx, facility)
  }

  hide(): void {
    this.openFlag = false
    this.setVisible(false)
  }

  get isOpen(): boolean {
    return this.openFlag
  }

  private render(ctx: FacilityDetailContext, facility: FacilityId): void {
    const d = this.dynamic
    d.removeAll(true)
    const inset = PANEL_CONTENT_INSET
    const wrapW = this.panelWidth - inset * 2
    const meta = FACILITIES[facility]
    const viewId = ctx.view[facility]

    const title = pixelText(this.scene, `${meta.glyph} ${meta.label} — ${VIEW_LABEL[viewId]}`, {
      fontSize: TEXT_SIZE.heading,
      color: meta.color,
      wordWrapWidth: wrapW - 92,
    })
    title.setPosition(inset, inset)
    d.add(title)

    let y = inset + 42
    if (meta.tasks.length === 0) {
      const note =
        facility === 'warehouse'
          ? `配給・調達は下部の計画操作から変更 / 備蓄 ${ctx.state.stockpile}`
          : '指揮の拠点。人員の配置はできない。'
      const text = pixelText(this.scene, note, {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.inkDim,
        wordWrapWidth: wrapW,
      })
      text.setPosition(inset, y)
      d.add(text)
      return
    }

    for (const task of meta.tasks) {
      const cost = taskCost(task)
      const disabled = isTaskDisabled(ctx.state.modifiers, task)
      const unitIds = ctx.plan.placements[task] ?? []
      const effects = unitIds.length > 0 ? resolvePlacement(ctx.state, { task, unitIds }) : []
      const summary = [
        `${unitIds.length}人配置`,
        cost.budget > 0 ? `予算${cost.budget}` : '',
        disabled ? '配置不可' : '',
        effects.map((effect) => formatDelta(effect.target, effect.delta)).join('・'),
      ]
        .filter(Boolean)
        .join(' / ')
      const line = pixelText(this.scene, summary, {
        fontSize: TEXT_SIZE.bodyWide,
        color: disabled ? COLORS.red : COLORS.ink,
        wordWrapWidth: wrapW,
      })
      line.setPosition(inset, y)
      d.add(line)
      y += Math.max(28, line.height + 8)
    }

    const guide = pixelText(this.scene, '人物を選択してこの施設をタップすると配置', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.inkDim,
      wordWrapWidth: wrapW,
    })
    guide.setPosition(inset, this.panelHeight - 38)
    d.add(guide)
  }
}
