import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import { resolvePlacement, taskCost } from '../../game/actions'
import { isTaskDisabled } from '../../game/modifiers'
import type { DeviceClass } from '../layout'
import { formatDelta } from '../labels'
import type { PlanState } from '../plan'
import type { Rect } from '../regions'
import { TASK_LABEL } from '../task-presentation'
import { COLORS, PANEL_CONTENT_INSET, SPACING, TEXT_SIZE } from '../tokens'
import { FACILITIES, type FacilityViewId, type FacilityViewMap } from '../town/facilities'
import type { FacilityId } from '../town/layout'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'

const VIEW_LABEL: Record<FacilityViewId, string> = {
  normal: '通常',
  low: '出力低下',
  working: '作業中',
  collapsed: '崩落',
  restored: '復旧済み',
}

export interface FacilityFocusContext {
  state: GameState
  plan: PlanState
  view: FacilityViewMap
}

export interface FacilityFocusCallbacks {
  onClose: () => void
  onSelectUnit: (unitId: string) => void
}

export class FacilityFocus extends Phaser.GameObjects.Container {
  private readonly frame: Phaser.GameObjects.Graphics
  private readonly dynamic: Phaser.GameObjects.Container
  private readonly closeButton: PixelButton
  private readonly callbacks: FacilityFocusCallbacks
  private panelWidth = 0
  private panelHeight = 0
  private openFlag = false

  constructor(scene: Phaser.Scene, callbacks: FacilityFocusCallbacks) {
    super(scene)
    this.callbacks = callbacks
    this.frame = scene.add.graphics()
    this.dynamic = scene.add.container()
    this.closeButton = new PixelButton(scene, {
      label: '閉じる',
      width: 78,
      height: 32,
      variant: 'quiet',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onClose,
    })
    this.add([this.frame, this.dynamic, this.closeButton])
    this.setDepth(690)
    this.setVisible(false)
    scene.add.existing(this)
  }

  setBounds(town: Rect, deviceClass: DeviceClass): void {
    if (deviceClass === 'wide') {
      this.panelWidth = Math.min(420, Math.max(360, town.width * 0.34))
      this.panelHeight = Math.min(286, Math.max(244, town.height * 0.52))
      this.setPosition(town.x + town.width - this.panelWidth - 16, town.y + 16)
    } else {
      this.panelWidth = Math.max(320, town.width - 24)
      this.panelHeight = 264
      this.setPosition(town.x + (town.width - this.panelWidth) / 2, town.y + 12)
    }
    this.closeButton.setPosition(this.panelWidth - 50, 24)
    this.redrawFrame()
  }

  show(ctx: FacilityFocusContext, facility: FacilityId): void {
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

  private redrawFrame(): void {
    const g = this.frame
    g.clear()
    g.fillStyle(0x000000, 0.45)
    g.fillRect(6, 6, this.panelWidth, this.panelHeight)
    g.fillStyle(COLORS.night900, 0.97)
    g.fillRect(0, 0, this.panelWidth, this.panelHeight)
    g.lineStyle(2, COLORS.frameHi)
    g.strokeRect(1, 1, this.panelWidth - 2, this.panelHeight - 2)
    g.lineStyle(2, COLORS.frameLo)
    g.strokeRect(5, 5, this.panelWidth - 10, this.panelHeight - 10)
  }

  private render(ctx: FacilityFocusContext, facility: FacilityId): void {
    const d = this.dynamic
    d.removeAll(true)
    const inset = PANEL_CONTENT_INSET
    const wrapW = this.panelWidth - inset * 2
    const meta = FACILITIES[facility]
    const viewId = ctx.view[facility]

    const accent = this.scene.add.graphics()
    accent.fillStyle(meta.color)
    accent.fillRect(6, 6, 6, this.panelHeight - 12)
    d.add(accent)

    const title = pixelText(this.scene, meta.label, {
      fontSize: TEXT_SIZE.heading,
      color: meta.color,
      wordWrapWidth: wrapW - 88,
    })
    title.setPosition(inset, inset - 2)
    d.add(title)

    const stateBadge = pixelText(this.scene, VIEW_LABEL[viewId], {
      fontSize: TEXT_SIZE.labelWide,
      color:
        viewId === 'low' || viewId === 'collapsed'
          ? COLORS.red
          : viewId === 'working'
            ? COLORS.green
            : COLORS.inkDim,
    })
    stateBadge.setPosition(inset, inset + 28)
    d.add(stateBadge)

    if (meta.tasks.length === 0) {
      this.renderPassiveFacility(d, ctx, facility, inset, wrapW)
      return
    }

    const task = meta.tasks[0]!
    const unitIds = ctx.plan.placements[task] ?? []
    const cost = taskCost(task)
    const disabled = isTaskDisabled(ctx.state.modifiers, task)
    const effects = unitIds.length > 0 ? resolvePlacement(ctx.state, { task, unitIds }) : []
    const outputs = effects
      .filter((effect) => effect.target !== 'budget' && effect.target !== 'stockpile')
      .map((effect) => formatDelta(effect.target, effect.delta))

    const action = pixelText(this.scene, TASK_LABEL[task], {
      fontSize: TEXT_SIZE.bodyWide,
      color: disabled ? COLORS.red : COLORS.ink,
      wordWrapWidth: wrapW,
    })
    action.setPosition(inset, inset + 58)
    d.add(action)

    const costParts = [
      cost.budget > 0 ? `予算 −${cost.budget}` : '',
      cost.stockpile > 0 ? `備蓄 −${cost.stockpile}` : '',
      disabled ? '現在は実行不可' : '',
    ].filter(Boolean)
    const costText = pixelText(this.scene, costParts.join('  /  ') || '追加コストなし', {
      fontSize: TEXT_SIZE.labelWide,
      color: disabled ? COLORS.red : COLORS.inkDim,
      wordWrapWidth: wrapW,
    })
    costText.setPosition(inset, inset + 84)
    d.add(costText)

    const outputText = pixelText(
      this.scene,
      unitIds.length === 0
        ? '人物を配置すると、この日の予測効果を表示'
        : outputs.length > 0
          ? `予測  ${outputs.join('  /  ')}`
          : '予測効果なし',
      {
        fontSize: TEXT_SIZE.bodyWide,
        color: unitIds.length > 0 ? COLORS.green : COLORS.inkDim,
        wordWrapWidth: wrapW,
      },
    )
    outputText.setPosition(inset, inset + 110)
    d.add(outputText)

    const head = pixelText(this.scene, `担当 ${unitIds.length}人`, {
      fontSize: TEXT_SIZE.labelWide,
      color: unitIds.length > 0 ? COLORS.amber : COLORS.inkDim,
    })
    head.setPosition(inset, inset + 146)
    d.add(head)

    this.renderAssignedUnits(d, ctx.state, unitIds, inset, inset + 166, wrapW)
  }

  private renderPassiveFacility(
    host: Phaser.GameObjects.Container,
    ctx: FacilityFocusContext,
    facility: FacilityId,
    x: number,
    wrapWidth: number,
  ): void {
    const note =
      facility === 'warehouse'
        ? `備蓄 ${ctx.state.stockpile}。配給と調達は右下の「本日の方針」から変更する。`
        : '対策本部。直接の人員配置は行わず、町全体の指揮を担う。'
    const text = pixelText(this.scene, note, {
      fontSize: TEXT_SIZE.bodyWide,
      color: COLORS.inkDim,
      wordWrapWidth: wrapWidth,
    })
    text.setPosition(x, PANEL_CONTENT_INSET + 68)
    host.add(text)
  }

  private renderAssignedUnits(
    host: Phaser.GameObjects.Container,
    state: GameState,
    unitIds: string[],
    x: number,
    y: number,
    wrapWidth: number,
  ): void {
    if (unitIds.length === 0) {
      const empty = pixelText(this.scene, '未配置', {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.inkDim,
      })
      empty.setPosition(x, y + 16)
      host.add(empty)
      return
    }
    const visible = unitIds.slice(0, 5)
    const gap = 8
    const slotW = Math.min(
      62,
      Math.floor((wrapWidth - gap * (visible.length - 1)) / visible.length),
    )
    visible.forEach((unitId, index) => {
      const unit = state.units.find((candidate) => candidate.id === unitId)
      if (!unit) return
      const slotX = x + index * (slotW + gap)
      drawArtSlot(this.scene, host, 'portrait', unit.portrait, slotX + slotW / 2, y + 28, {
        width: Math.min(46, slotW),
        height: 58,
        glyphSize: 28,
        fallbackGlyph: '人',
      })
      const name = pixelText(this.scene, unit.name, {
        fontSize: TEXT_SIZE.labelNarrow,
        color: unit.condition === 'injured' ? COLORS.red : COLORS.ink,
        wordWrapWidth: slotW,
        align: 'center',
      })
      name.setOrigin(0.5, 0)
      name.setPosition(slotX + slotW / 2, y + 60)
      host.add(name)
      const zone = this.scene.add.zone(slotX + slotW / 2, y + 38, slotW, 82)
      zone.setInteractive()
      zone.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _lx: number,
          _ly: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation()
          this.callbacks.onSelectUnit(unitId)
        },
      )
      host.add(zone)
    })
    if (unitIds.length > visible.length) {
      const more = pixelText(this.scene, `+${unitIds.length - visible.length}`, {
        fontSize: TEXT_SIZE.labelWide,
        color: COLORS.inkDim,
      })
      more.setPosition(x + wrapWidth - SPACING.md, y + 28)
      more.setOrigin(1, 0.5)
      host.add(more)
    }
  }
}
