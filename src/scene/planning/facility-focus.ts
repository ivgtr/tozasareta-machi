import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import { placementValue, resolvePlacement, taskCost } from '../../game/actions'
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

const PROGRESS_VISUAL_TARGET = 40

export interface FacilityFocusContext {
  state: GameState
  plan: PlanState
  view: FacilityViewMap
}

export interface FacilityFocusCallbacks {
  onClose: () => void
  onSelectUnit: (unitId: string) => void
  onUnassignUnit: (unitId: string) => void
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
      this.panelHeight = Math.min(350, Math.max(328, town.height * 0.65))
      this.setPosition(town.x + town.width - this.panelWidth - 16, town.y + 16)
    } else {
      this.panelWidth = Math.max(320, town.width - 24)
      this.panelHeight = 328
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
    const progress = unitIds.length > 0 ? placementValue(ctx.state, { task, unitIds }) : 0
    const outputs = effects
      .filter((effect) => effect.target !== 'budget' && effect.target !== 'stockpile')
      .map((effect) => formatDelta(effect.target, effect.delta))

    const action = pixelText(this.scene, TASK_LABEL[task], {
      fontSize: TEXT_SIZE.bodyWide,
      color: disabled ? COLORS.red : COLORS.ink,
      wordWrapWidth: wrapW,
    })
    action.setPosition(inset, inset + 56)
    d.add(action)

    const forecastTitle = pixelText(
      this.scene,
      unitIds.length === 0 ? '実行見込  未配置' : `実行見込  ${TASK_LABEL[task]} +${progress}`,
      {
        fontSize: TEXT_SIZE.labelWide,
        color: unitIds.length > 0 ? COLORS.green : COLORS.inkDim,
        wordWrapWidth: wrapW,
      },
    )
    forecastTitle.setPosition(inset, inset + 84)
    d.add(forecastTitle)

    const progressBar = this.scene.add.graphics()
    const progressWidth = wrapW
    progressBar.fillStyle(COLORS.night800)
    progressBar.fillRect(inset, inset + 106, progressWidth, 12)
    progressBar.fillStyle(disabled ? COLORS.red : COLORS.green)
    progressBar.fillRect(
      inset + 2,
      inset + 108,
      Math.round((progressWidth - 4) * Math.min(1, progress / PROGRESS_VISUAL_TARGET)),
      8,
    )
    progressBar.lineStyle(1, COLORS.frameLo)
    progressBar.strokeRect(inset, inset + 106, progressWidth, 12)
    d.add(progressBar)

    const detailParts = [
      ...outputs,
      cost.budget > 0 ? `予算 −${cost.budget}` : '',
      cost.stockpile > 0 ? `備蓄 −${cost.stockpile}` : '',
      disabled ? '現在は実行不可' : '',
    ].filter(Boolean)
    const details = pixelText(this.scene, detailParts.join('  /  ') || '追加コストなし', {
      fontSize: TEXT_SIZE.labelWide,
      color: disabled ? COLORS.red : COLORS.inkDim,
      wordWrapWidth: wrapW,
    })
    details.setPosition(inset, inset + 126)
    d.add(details)

    const head = pixelText(this.scene, `担当 ${unitIds.length}人`, {
      fontSize: TEXT_SIZE.labelWide,
      color: unitIds.length > 0 ? COLORS.amber : COLORS.inkDim,
    })
    head.setPosition(inset, inset + 154)
    d.add(head)

    this.renderAssignmentSlots(d, ctx.state, unitIds, inset, inset + 176, wrapW)
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

  private renderAssignmentSlots(
    host: Phaser.GameObjects.Container,
    state: GameState,
    unitIds: string[],
    x: number,
    y: number,
    wrapWidth: number,
  ): void {
    const visible = unitIds.slice(0, 4)
    const slotCount = Math.min(5, visible.length + 1)
    const gap = 8
    const slotW = Math.min(70, Math.floor((wrapWidth - gap * (slotCount - 1)) / slotCount))
    const slotsWidth = slotCount * slotW + (slotCount - 1) * gap
    const startX = x + (wrapWidth - slotsWidth) / 2
    visible.forEach((unitId, index) => {
      const unit = state.units.find((candidate) => candidate.id === unitId)
      if (!unit) return
      const slotX = startX + index * (slotW + gap)
      const slot = this.scene.add.graphics()
      slot.fillStyle(COLORS.night800, 0.9)
      slot.fillRect(slotX, y, slotW, 108)
      slot.lineStyle(2, unit.unique ? COLORS.amber : COLORS.frameLo)
      slot.strokeRect(slotX, y, slotW, 108)
      host.add(slot)
      drawArtSlot(this.scene, host, 'portrait', unit.portrait, slotX + slotW / 2, y + 25, {
        width: Math.min(42, slotW - 8),
        height: 48,
        glyphSize: 24,
        fallbackGlyph: '人',
      })
      const name = pixelText(this.scene, unit.name, {
        fontSize: TEXT_SIZE.labelNarrow,
        color: unit.condition === 'injured' ? COLORS.red : COLORS.ink,
        wordWrapWidth: slotW,
        align: 'center',
      })
      name.setOrigin(0.5, 0)
      name.setPosition(slotX + slotW / 2, y + 50)
      host.add(name)
      const zone = this.scene.add.zone(slotX + slotW / 2, y + 31, slotW, 62)
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
      const remove = new PixelButton(this.scene, {
        label: '外す',
        width: Math.max(44, slotW - 8),
        height: 44,
        variant: 'quiet',
        fontSize: TEXT_SIZE.labelNarrow,
        onAction: () => this.callbacks.onUnassignUnit(unitId),
      })
      remove.setPosition(slotX + slotW / 2, y + 84)
      host.add(remove)
    })
    const emptyX = startX + visible.length * (slotW + gap)
    const emptySlot = this.scene.add.graphics()
    emptySlot.fillStyle(COLORS.night800, 0.55)
    emptySlot.fillRect(emptyX, y, slotW, 108)
    emptySlot.lineStyle(1, COLORS.frameLo, 0.8)
    emptySlot.strokeRect(emptyX, y, slotW, 108)
    host.add(emptySlot)
    const plus = pixelText(this.scene, '＋', {
      fontSize: 24,
      color: COLORS.inkDim,
    })
    plus.setOrigin(0.5)
    plus.setPosition(emptyX + slotW / 2, y + 32)
    host.add(plus)
    const hint = pixelText(this.scene, 'Deckから\n配置', {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
      align: 'center',
      wordWrapWidth: slotW - 4,
    })
    hint.setOrigin(0.5, 0)
    hint.setPosition(emptyX + slotW / 2, y + 52)
    host.add(hint)
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
