import Phaser from 'phaser'
import { NO_INSETS, logicalSafeInsetsForCanvas, type DeviceClass, type SafeInsets } from '../layout'
import { COLORS } from '../tokens'

export interface PresentationRect {
  x: number
  y: number
  width: number
  height: number
}

export abstract class PresentationSurface extends Phaser.GameObjects.Container {
  protected readonly backdrop: Phaser.GameObjects.Graphics
  protected readonly frame: Phaser.GameObjects.Graphics
  protected readonly content: Phaser.GameObjects.Container
  protected deviceClass: DeviceClass = 'wide'
  protected viewportWidth = 1280
  protected viewportHeight = 720
  protected panel: PresentationRect = { x: 64, y: 48, width: 1152, height: 624 }
  protected safeInsets: SafeInsets = NO_INSETS
  private openFlag = false
  private accent: number = COLORS.cyan

  constructor(scene: Phaser.Scene) {
    super(scene)
    this.backdrop = scene.add.graphics()
    this.frame = scene.add.graphics()
    this.content = scene.add.container()
    this.add([this.backdrop, this.frame, this.content])
    this.setDepth(1200)
    this.setVisible(false)
    scene.add.existing(this)

    this.backdrop.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData,
      ) => event.stopPropagation(),
    )
  }

  setViewport(width: number, height: number, deviceClass: DeviceClass): void {
    this.viewportWidth = width
    this.viewportHeight = height
    this.deviceClass = deviceClass
    this.safeInsets = logicalSafeInsetsForCanvas(this.scene.game.canvas, width, height)
    this.updatePanel()
    this.backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains,
    )
    if (this.openFlag) this.redrawSurface(this.accent)
  }

  hide(): void {
    this.openFlag = false
    this.setVisible(false)
  }

  get isOpen(): boolean {
    return this.openFlag
  }

  protected begin(accent: number): void {
    this.openFlag = true
    this.accent = accent
    this.safeInsets = logicalSafeInsetsForCanvas(
      this.scene.game.canvas,
      this.viewportWidth,
      this.viewportHeight,
    )
    this.updatePanel()
    this.content.removeAll(true)
    this.redrawSurface(accent)
    this.setVisible(true)
  }

  protected redrawSurface(accent: number): void {
    const p = this.panel
    this.backdrop.clear()
    this.backdrop.fillStyle(COLORS.night900, 0.88)
    this.backdrop.fillRect(0, 0, this.viewportWidth, this.viewportHeight)

    this.frame.clear()
    this.frame.fillStyle(0x000000, 0.5)
    this.frame.fillRect(p.x + 8, p.y + 8, p.width, p.height)
    this.frame.fillStyle(COLORS.night900, 0.98)
    this.frame.fillRect(p.x, p.y, p.width, p.height)
    this.frame.lineStyle(3, COLORS.frameHi)
    this.frame.strokeRect(p.x + 1, p.y + 1, p.width - 2, p.height - 2)
    this.frame.lineStyle(2, COLORS.frameLo)
    this.frame.strokeRect(p.x + 7, p.y + 7, p.width - 14, p.height - 14)
    this.frame.fillStyle(accent)
    this.frame.fillRect(p.x + 8, p.y + 8, p.width - 16, 6)
  }

  protected drawArtFrame(
    x: number,
    y: number,
    width: number,
    height: number,
    accent: number,
  ): void {
    const g = this.scene.add.graphics()
    g.fillStyle(COLORS.night800)
    g.fillRect(x, y, width, height)
    g.lineStyle(2, accent)
    g.strokeRect(x + 1, y + 1, width - 2, height - 2)
    g.lineStyle(1, COLORS.frameLo)
    g.strokeRect(x + 6, y + 6, width - 12, height - 12)
    this.content.add(g)
  }

  private updatePanel(): void {
    const marginX = this.deviceClass === 'wide' ? 56 : 12
    const marginY = this.deviceClass === 'wide' ? 42 : 14
    const innerX = this.safeInsets.left
    const innerY = this.safeInsets.top
    const innerW = Math.max(1, this.viewportWidth - this.safeInsets.left - this.safeInsets.right)
    const innerH = Math.max(1, this.viewportHeight - this.safeInsets.top - this.safeInsets.bottom)
    this.panel = {
      x: innerX + marginX,
      y: innerY + marginY,
      width: Math.max(1, innerW - marginX * 2),
      height: Math.max(1, innerH - marginY * 2),
    }
  }
}
