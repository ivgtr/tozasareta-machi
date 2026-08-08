import Phaser from 'phaser'
import type { Effect } from '../game/types'
import { COLORS, TEXT_SIZE } from './tokens'
import { formatDelta } from './labels'
import { visibleLogEntries } from './log-drawer-model'
import { PixelPanel } from './ui/panel'
import { pixelText } from './ui/pixel-text'

export class LogDrawer extends Phaser.GameObjects.Container {
  private readonly panel: PixelPanel
  private readonly dynamic: Phaser.GameObjects.Container
  private expanded = false
  private maxWidth = 480
  private lastReport: Effect[] = []

  constructor(scene: Phaser.Scene) {
    super(scene)
    this.panel = new PixelPanel(scene, 100, 40)
    this.dynamic = scene.add.container()
    this.add([this.panel, this.dynamic])
    this.setDepth(720)
    this.setVisible(false)
    scene.add.existing(this)
  }

  setAnchor(x: number, y: number, maxWidth: number): void {
    this.maxWidth = maxWidth
    this.setPosition(x, y)
  }

  update(report: Effect[]): void {
    this.lastReport = report
    if (this.expanded) this.redraw(report)
  }

  toggle(): void {
    this.expanded = !this.expanded
    this.setVisible(this.expanded)
    if (this.expanded) this.redraw(this.lastReport)
  }

  hide(): void {
    this.expanded = false
    this.setVisible(false)
  }

  get isOpen(): boolean {
    return this.expanded
  }

  private redraw(report: Effect[]): void {
    const d = this.dynamic
    d.removeAll(true)
    const lines = visibleLogEntries(report, true)
    const width = Math.min(this.maxWidth, 440)
    let y = 12
    if (report.length === 0) {
      const empty = pixelText(this.scene, 'まだ記録はない', {
        fontSize: TEXT_SIZE.labelWide,
        color: COLORS.inkDim,
      })
      empty.setPosition(14, y)
      d.add(empty)
      y += 22
    } else {
      const day = report[report.length - 1]?.day ?? 1
      const head = pixelText(this.scene, `── 第${day}日 ──`, {
        fontSize: TEXT_SIZE.labelWide,
        color: COLORS.inkDim,
      })
      head.setPosition(14, y)
      d.add(head)
      y += 20
      for (const effect of lines) {
        const line = pixelText(
          this.scene,
          `${effect.reason}${effect.delta !== 0 ? `（${formatDelta(effect.target, effect.delta)}）` : ''}`,
          {
            fontSize: TEXT_SIZE.labelWide,
            color: COLORS.ink,
            wordWrapWidth: width - 40,
          },
        )
        line.setPosition(14, y)
        d.add(line)
        y += line.height + 4
      }
    }
    this.panel.setPanelSize(width, y + 12)
  }
}
