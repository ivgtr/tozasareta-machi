import Phaser from 'phaser'
import type { GameState, TaskId } from '../game/types'
import { BALANCE } from '../game/data/balance'
import { PHYSICAL_TASKS } from '../game/actions'
import { COLORS, SPACING, TEXT_SIZE, colorCss } from './tokens'
import { spentOf, type PlanState } from './plan'
import { PixelButton } from './ui/button'
import { pixelText } from './ui/pixel-text'
import { drawArtSlot } from './ui/art-slot'
import type { Rect } from './regions'
import type { DeviceClass } from './layout'

export const TASK_LABEL: Record<TaskId, string> = {
  repair_power: '発電所の修理',
  restore_road: '道路復旧',
  reinforce_medical: '医療班増員',
  soup_kitchen: '炊き出し',
  ration: '節約配給',
}

export interface StripCallbacks {
  onAuto: () => void
  onReset: () => void
  onCommit: () => void
  onToggleRation: () => void
  onToggleProcure: () => void
}

export class PlanStrip extends Phaser.GameObjects.Container {
  private readonly dynamic: Phaser.GameObjects.Container
  private readonly rationButton: PixelButton
  private readonly procureButton: PixelButton
  private readonly autoButton: PixelButton
  private readonly resetButton: PixelButton
  private readonly commitButton: PixelButton
  private rect: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private deviceClass: DeviceClass = 'wide'

  constructor(scene: Phaser.Scene, callbacks: StripCallbacks) {
    super(scene)
    this.dynamic = scene.add.container()
    this.add(this.dynamic)
    this.rationButton = new PixelButton(scene, {
      label: '配給',
      width: 64,
      height: 36,
      fontSize: TEXT_SIZE.labelWide,
      onAction: () => callbacks.onToggleRation(),
    })
    this.procureButton = new PixelButton(scene, {
      label: '調達',
      width: 64,
      height: 36,
      fontSize: TEXT_SIZE.labelWide,
      onAction: () => callbacks.onToggleProcure(),
    })
    this.autoButton = new PixelButton(scene, {
      label: 'おまかせ',
      width: 88,
      height: 36,
      fontSize: TEXT_SIZE.labelWide,
      onAction: () => callbacks.onAuto(),
    })
    this.resetButton = new PixelButton(scene, {
      label: '解除',
      width: 64,
      height: 36,
      fontSize: TEXT_SIZE.labelWide,
      onAction: () => callbacks.onReset(),
    })
    this.commitButton = new PixelButton(scene, {
      label: '本日の対応を確定',
      width: 168,
      height: 40,
      fontSize: TEXT_SIZE.labelWide,
      primary: true,
      onAction: () => callbacks.onCommit(),
    })
    this.add([
      this.rationButton,
      this.procureButton,
      this.autoButton,
      this.resetButton,
      this.commitButton,
    ])
    scene.add.existing(this)
  }

  setBounds(rect: Rect, deviceClass: DeviceClass): void {
    this.rect = rect
    this.deviceClass = deviceClass
    this.setPosition(rect.x, rect.y)
    const cy = rect.height / 2
    let x = rect.width - SPACING.sm
    const place = (btn: PixelButton) => {
      const w = btn.buttonWidth
      x -= w
      btn.setPosition(x + w / 2, cy)
      x -= SPACING.sm
    }
    if (deviceClass === 'wide') {
      this.commitButton.setSize(168, 40)
      this.commitButton.setLabel('本日の対応を確定')
      this.autoButton.setSize(88, 36)
      this.autoButton.setLabel('おまかせ')
      this.resetButton.setSize(64, 36)
      this.resetButton.setLabel('解除')
      this.procureButton.setSize(80, 36)
      this.rationButton.setSize(80, 36)
      this.resetButton.setVisible(true)
      this.procureButton.setVisible(true)
      this.rationButton.setVisible(true)
      place(this.commitButton)
      place(this.autoButton)
      place(this.resetButton)
      place(this.procureButton)
      place(this.rationButton)
    } else {
      this.commitButton.setSize(80, 40)
      this.commitButton.setLabel('確定')
      this.autoButton.setSize(56, 36)
      this.autoButton.setLabel('自動')
      this.resetButton.setSize(48, 36)
      this.resetButton.setLabel('解除')
      this.procureButton.setSize(64, 36)
      this.procureButton.setLabel('調達')
      this.rationButton.setSize(64, 36)
      this.rationButton.setLabel('配給')
      this.resetButton.setVisible(true)
      this.procureButton.setVisible(true)
      this.rationButton.setVisible(true)
      place(this.commitButton)
      place(this.autoButton)
      place(this.resetButton)
      place(this.procureButton)
      place(this.rationButton)
    }
  }

  update(state: GameState, plan: PlanState, remaining: number, busy: boolean): void {
    this.updateButtons(busy, plan, state)
    const d = this.dynamic
    d.removeAll(true)
    const wide = this.deviceClass === 'wide'
    const cursor = this.renderTasks(d, wide, plan)
    this.renderRemaining(d, cursor, wide, remaining, plan)
  }

  private updateButtons(busy: boolean, plan: PlanState, state: GameState): void {
    for (const b of [
      this.rationButton,
      this.procureButton,
      this.autoButton,
      this.resetButton,
      this.commitButton,
    ]) {
      b.setEnabled(!busy)
    }
    const narrow = this.deviceClass === 'narrow'
    this.rationButton.setLabel(
      narrow ? (plan.ration ? '配給:節約' : '配給') : plan.ration ? '配給:節約' : '配給:通常',
    )
    const spent = spentOf(plan.placements)
    const procureOk = state.budget - spent.budget >= BALANCE.procure.budget
    this.procureButton.setLabel(
      narrow
        ? plan.procure
          ? '調達:ON'
          : `調達${procureOk ? '' : '!'}`
        : plan.procure
          ? '調達:ON'
          : `調達:OFF${procureOk ? '' : '（不足）'}`,
    )
  }

  private renderTasks(d: Phaser.GameObjects.Container, wide: boolean, plan: PlanState): number {
    const cy = this.rect.height / 2
    let cursor = SPACING.sm
    for (const t of PHYSICAL_TASKS) {
      const count = (plan.placements[t] ?? []).length
      if (!wide && count === 0) continue
      const slot = drawArtSlot(this.scene, d, 'icon', t, cursor + 9, cy, {
        width: 18,
        height: 18,
        glyphSize: 14,
        fallbackGlyph: '・',
      })
      if (count === 0) {
        if (slot instanceof Phaser.GameObjects.Image) slot.setAlpha(0.35)
        else slot.setColor(colorCss(COLORS.frameLo))
      }
      cursor += 20
      const num = pixelText(this.scene, `×${count}`, {
        fontSize: wide ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
        color: count === 0 ? COLORS.frameLo : COLORS.ink,
      })
      num.setPosition(cursor, cy)
      num.setOrigin(0, 0.5)
      d.add(num)
      cursor += num.width + SPACING.md
    }
    return cursor
  }

  private renderRemaining(
    d: Phaser.GameObjects.Container,
    cursor: number,
    wide: boolean,
    remaining: number,
    plan: PlanState,
  ): void {
    const cy = this.rect.height / 2
    const cost = spentOf(plan.placements)
    const remainText = wide
      ? `${remaining > 0 ? `${remaining}人 待機` : '配置完了'} 予算−${cost.budget}`
      : remaining > 0
        ? `${remaining}人 待機`
        : '配置完了'
    const remain = pixelText(this.scene, remainText, {
      fontSize: wide ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
      color: remaining === 0 ? COLORS.green : COLORS.amber,
    })
    remain.setPosition(cursor, cy)
    remain.setOrigin(0, 0.5)
    d.add(remain)
  }
}
