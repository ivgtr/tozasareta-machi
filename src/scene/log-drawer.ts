import Phaser from 'phaser'
import type { Effect } from '../game/types'
import { COLORS, TEXT_SIZE } from './tokens'
import { formatDelta } from './labels'
import { PixelButton } from './ui/button'
import { PixelPanel } from './ui/panel'
import { pixelText } from './ui/pixel-text'

const COLLAPSED_LINES = 3
const EXPANDED_MAX_LINES = 12

export class LogDrawer extends Phaser.GameObjects.Container {
  private readonly panel: PixelPanel
  private readonly dynamic: Phaser.GameObjects.Container
  private readonly toggleButton: PixelButton
  private expanded = false
  private maxWidth = 480

  constructor(scene: Phaser.Scene) {
    super(scene)
    this.panel = new PixelPanel(scene, 100, 40)
    this.dynamic = scene.add.container()
    this.toggleButton = new PixelButton(scene, {
      label: '記録',
      width: 64,
      height: 32,
      fontSize: TEXT_SIZE.labelWide,
      onAction: () => {
        this.expanded = !this.expanded
        this.toggleButton.setLabel(this.expanded ? '閉じる' : '記録')
        this.redraw(this.lastReport)
      },
    })
    this.add([this.panel, this.dynamic, this.toggleButton])
    scene.add.existing(this)
  }

  private lastReport: Effect[] = []

  setAnchor(x: number, y: number, maxWidth: number): void {
    this.maxWidth = maxWidth
    this.setPosition(x, y)
  }

  update(report: Effect[]): void {
    this.lastReport = report
    this.redraw(report)
  }

  private redraw(report: Effect[]): void {
    const d = this.dynamic
    d.removeAll(true)
    const lines = report.slice(-this.expanded ? EXPANDED_MAX_LINES : COLLAPSED_LINES)
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
      for (const e of lines) {
        const line = pixelText(
          this.scene,
          `${e.reason}${e.delta !== 0 ? `（${formatDelta(e.target, e.delta)}）` : ''}`,
          { fontSize: TEXT_SIZE.labelWide, color: COLORS.ink, wordWrapWidth: width - 40 },
        )
        line.setPosition(14, y)
        d.add(line)
        y += line.height + 4
      }
    }
    const height = y + 12
    this.panel.setPanelSize(width, height)
    this.toggleButton.setPosition(width - 44, height + 22)
  }
}
