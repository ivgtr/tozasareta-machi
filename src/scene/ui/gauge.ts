import Phaser from 'phaser'
import { COLORS, GAUGE } from '../tokens'

export interface PixelGaugeOptions {
  width: number
  color?: number
  segments?: number
}

export class PixelGauge extends Phaser.GameObjects.Container {
  private readonly gaugeWidth: number
  private readonly color: number
  private readonly segments: number
  private readonly cells: Phaser.GameObjects.Graphics[]
  private litCount = 0

  constructor(scene: Phaser.Scene, options: PixelGaugeOptions) {
    super(scene)
    this.gaugeWidth = options.width
    this.color = options.color ?? COLORS.green
    this.segments = options.segments ?? GAUGE.segments
    this.cells = []
    for (let i = 0; i < this.segments; i++) {
      const cell = scene.add.graphics()
      this.cells.push(cell)
      this.add(cell)
    }
    this.redraw()
    scene.add.existing(this)
  }

  setValue(value: number, max = 100): void {
    const ratio = Math.max(0, Math.min(1, value / max))
    this.litCount = Math.round(ratio * this.segments)
    this.redraw()
  }

  private redraw(): void {
    const gap = GAUGE.cellGap
    const b = GAUGE.cellBorder
    const cellWidth = Math.floor((this.gaugeWidth - gap * (this.segments - 1)) / this.segments)
    this.cells.forEach((cell, i) => {
      const x = i * (cellWidth + gap)
      const lit = i < this.litCount
      cell.clear()
      cell.fillStyle(lit ? COLORS.frameHi : COLORS.frameLo)
      cell.fillRect(x, 0, cellWidth, GAUGE.cellHeight)
      cell.fillStyle(lit ? this.color : COLORS.night800)
      cell.fillRect(x + b, b, cellWidth - b * 2, GAUGE.cellHeight - b * 2)
    })
  }
}
