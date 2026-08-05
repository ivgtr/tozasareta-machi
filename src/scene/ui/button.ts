import Phaser from 'phaser'
import { BUTTON, COLORS, TEXT_SIZE, colorCss } from '../tokens'
import { pixelText } from './pixel-text'

export interface PixelButtonOptions {
  label: string
  width: number
  height: number
  primary?: boolean
  fontSize?: number
  onAction: () => void
}

export class PixelButton extends Phaser.GameObjects.Container {
  private readonly buttonWidth: number
  private readonly buttonHeight: number
  private readonly primary: boolean
  private readonly onAction: () => void
  private readonly bg: Phaser.GameObjects.Graphics
  private readonly label: Phaser.GameObjects.Text
  private hovered = false
  private pressed = false
  private enabled = true

  constructor(scene: Phaser.Scene, options: PixelButtonOptions) {
    super(scene)
    this.buttonWidth = options.width
    this.buttonHeight = options.height
    this.primary = options.primary ?? false
    this.onAction = options.onAction
    this.bg = scene.add.graphics()
    this.label = pixelText(scene, options.label, {
      fontSize: options.fontSize ?? TEXT_SIZE.bodyWide,
      trackingEm: BUTTON.trackingEm,
    })
    this.label.setOrigin(0.5)
    this.add([this.bg, this.label])
    this.setInteractive(
      new Phaser.Geom.Rectangle(
        -options.width / 2,
        -options.height / 2,
        options.width,
        options.height,
      ),
      Phaser.Geom.Rectangle.Contains,
    )
    this.on('pointerover', () => {
      if (!this.enabled) return
      this.hovered = true
      this.redraw()
    })
    this.on('pointerout', () => {
      this.hovered = false
      this.pressed = false
      this.redraw()
    })
    this.on('pointerdown', () => {
      if (!this.enabled) return
      this.pressed = true
      this.redraw()
    })
    this.on('pointerup', () => {
      const wasPressed = this.pressed
      this.pressed = false
      this.redraw()
      if (wasPressed && this.enabled) this.onAction()
    })
    this.redraw()
    scene.add.existing(this)
  }

  setEnabled(value: boolean): void {
    this.enabled = value
    if (!value) {
      this.hovered = false
      this.pressed = false
    }
    this.setAlpha(value ? 1 : BUTTON.disabledAlpha)
    this.redraw()
  }

  setLabel(text: string): void {
    this.label.setText(text)
  }

  private redraw(): void {
    const g = this.bg
    const w = this.buttonWidth
    const h = this.buttonHeight
    const b = BUTTON.border
    const active = this.enabled && this.hovered
    const shift = this.enabled && this.pressed ? BUTTON.pressShift : 0
    const shadow = this.enabled && this.pressed ? BUTTON.shadowPressed : BUTTON.shadow
    const body = this.primary
      ? active
        ? COLORS.gold
        : COLORS.amber
      : active
        ? COLORS.frameHi
        : COLORS.night600
    const textColor = this.primary || active ? COLORS.night900 : COLORS.ink
    const x = -w / 2 + shift
    const y = -h / 2 + shift
    g.clear()
    if (this.enabled) {
      g.fillStyle(BUTTON.shadowColor, BUTTON.shadowAlpha)
      g.fillRect(x + shadow, y + shadow, w, h)
    }
    g.fillStyle(COLORS.frameHi)
    g.fillRect(x, y, w, h)
    g.fillStyle(body)
    g.fillRect(x + b, y + b, w - b * 2, h - b * 2)
    this.label.setColor(colorCss(textColor))
    this.label.setPosition(shift, shift)
  }
}
