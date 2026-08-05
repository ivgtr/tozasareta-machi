import Phaser from 'phaser'
import { COLORS, PANEL } from '../tokens'

export class PixelPanel extends Phaser.GameObjects.Container {
  private innerWidth: number
  private innerHeight: number
  private readonly bg: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene, width: number, height: number) {
    super(scene)
    this.innerWidth = width
    this.innerHeight = height
    this.bg = scene.add.graphics()
    this.add(this.bg)
    this.redraw()
    scene.add.existing(this)
  }

  get panelWidth(): number {
    return this.innerWidth
  }

  get panelHeight(): number {
    return this.innerHeight
  }

  setPanelSize(width: number, height: number): void {
    this.innerWidth = width
    this.innerHeight = height
    this.redraw()
  }

  private redraw(): void {
    const g = this.bg
    const w = this.innerWidth
    const h = this.innerHeight
    const b = PANEL.border
    const inset = PANEL.inset
    g.clear()
    g.fillStyle(PANEL.shadowColor, PANEL.shadowAlpha)
    g.fillRect(PANEL.shadowX, PANEL.shadowY, w, h)
    g.fillStyle(COLORS.frameHi)
    g.fillRect(0, 0, w, h)
    g.fillStyle(COLORS.night800)
    g.fillRect(b, b, w - b * 2, h - b * 2)
    g.fillStyle(COLORS.night700)
    g.fillRect(b + inset, b + inset, w - (b + inset) * 2, h - (b + inset) * 2)
  }
}
