import Phaser from 'phaser'
import { BUTTON, COLORS, TEXT_SIZE, colorCss } from '../tokens'
import { pixelText } from './pixel-text'

export type PixelButtonVariant = 'default' | 'primary' | 'quiet' | 'toggle' | 'danger'

export interface PixelButtonOptions {
  label: string
  width: number
  height: number
  variant?: PixelButtonVariant
  selected?: boolean
  fontSize?: number
  onAction: () => void
  wordWrapWidth?: number
}

export class PixelButton extends Phaser.GameObjects.Container {
  private innerWidth: number
  private innerHeight: number
  private variant: PixelButtonVariant
  private selected: boolean
  private readonly onAction: () => void
  private readonly bg: Phaser.GameObjects.Graphics
  private readonly label: Phaser.GameObjects.Text
  private hovered = false
  private pressed = false
  private focused = false
  private enabled = true

  constructor(scene: Phaser.Scene, options: PixelButtonOptions) {
    super(scene)
    this.innerWidth = Math.max(options.width, BUTTON.minTouchSize)
    this.variant = options.variant ?? 'default'
    this.selected = options.selected ?? false
    this.onAction = options.onAction
    this.bg = scene.add.graphics()
    this.label = pixelText(scene, options.label, {
      fontSize: options.fontSize ?? TEXT_SIZE.bodyWide,
      trackingEm: BUTTON.trackingEm,
      ...(options.wordWrapWidth !== undefined ? { wordWrapWidth: options.wordWrapWidth } : {}),
    })
    this.innerHeight = Math.max(
      options.height,
      Math.ceil(this.label.height) + BUTTON.labelVPad * 2,
      BUTTON.minTouchSize,
    )
    this.label.setOrigin(0.5)
    this.add([this.bg, this.label])
    this.setInteractive(
      new Phaser.Geom.Rectangle(
        -this.innerWidth / 2,
        -this.innerHeight / 2,
        this.innerWidth,
        this.innerHeight,
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
    this.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        if (!this.enabled) return
        event.stopPropagation()
        this.focused = false
        this.pressed = true
        this.redraw()
      },
    )
    this.on('pointerup', () => {
      const wasPressed = this.pressed
      this.pressed = false
      this.redraw()
      if (wasPressed && this.enabled) this.onAction()
    })
    this.redraw()
    scene.add.existing(this)
  }

  get buttonWidth(): number {
    return this.innerWidth
  }

  get buttonHeight(): number {
    return this.innerHeight
  }

  setSize(width: number, height: number): this {
    this.innerWidth = Math.max(width, BUTTON.minTouchSize)
    this.innerHeight = Math.max(height, BUTTON.minTouchSize)
    if (this.input) {
      this.input.hitArea = new Phaser.Geom.Rectangle(
        -this.innerWidth / 2,
        -this.innerHeight / 2,
        this.innerWidth,
        this.innerHeight,
      )
    }
    this.redraw()
    return this
  }

  setEnabled(value: boolean): void {
    this.enabled = value
    if (!value) {
      this.hovered = false
      this.pressed = false
      this.focused = false
    }
    this.setAlpha(value ? 1 : BUTTON.disabledAlpha)
    this.redraw()
  }

  setLabel(text: string): void {
    this.label.setText(text)
  }

  setVariant(variant: PixelButtonVariant): void {
    this.variant = variant
    this.redraw()
  }

  setSelected(selected: boolean): void {
    this.selected = selected
    this.redraw()
  }

  setFocused(focused: boolean): void {
    this.focused = focused && this.enabled
    this.redraw()
  }

  triggerFromKeyboard(): boolean {
    if (!this.enabled || !this.visible || !this.active) return false
    this.focused = true
    this.pressed = true
    this.redraw()
    this.scene.time.delayedCall(90, () => {
      if (!this.active) return
      this.pressed = false
      this.focused = false
      this.redraw()
    })
    this.onAction()
    return true
  }

  private redraw(): void {
    const g = this.bg
    const w = this.innerWidth
    const h = this.innerHeight
    const b = BUTTON.border
    const active = this.enabled && (this.hovered || this.focused)
    const shift = this.enabled && this.pressed ? BUTTON.pressShift : 0
    const shadow = this.enabled && this.pressed ? BUTTON.shadowPressed : BUTTON.shadow
    const palette = this.palette(active)
    const x = -w / 2 + shift
    const y = -h / 2 + shift
    g.clear()
    if (this.enabled) {
      g.fillStyle(BUTTON.shadowColor, BUTTON.shadowAlpha)
      g.fillRect(x + shadow, y + shadow, w, h)
    }
    g.fillStyle(palette.border)
    g.fillRect(x, y, w, h)
    g.fillStyle(palette.body)
    g.fillRect(x + b, y + b, w - b * 2, h - b * 2)
    if (this.focused) {
      g.lineStyle(2, COLORS.cyan)
      g.strokeRect(x - 2, y - 2, w + 4, h + 4)
    }
    this.label.setColor(colorCss(palette.text))
    this.label.setPosition(shift, shift)
  }

  private palette(active: boolean): { border: number; body: number; text: number } {
    if (this.variant === 'primary') {
      return {
        border: COLORS.gold,
        body: active ? COLORS.gold : COLORS.amber,
        text: COLORS.night900,
      }
    }
    if (this.variant === 'danger') {
      return {
        border: COLORS.red,
        body: active ? COLORS.red : COLORS.night700,
        text: active ? COLORS.night900 : COLORS.red,
      }
    }
    if (this.variant === 'toggle') {
      if (this.selected) {
        return {
          border: COLORS.cyan,
          body: active ? COLORS.gold : COLORS.cyan,
          text: COLORS.night900,
        }
      }
      return {
        border: active ? COLORS.cyan : COLORS.frameLo,
        body: active ? COLORS.night600 : COLORS.night800,
        text: active ? COLORS.cyan : COLORS.inkDim,
      }
    }
    if (this.variant === 'quiet') {
      return {
        border: active ? COLORS.frameHi : COLORS.frameLo,
        body: active ? COLORS.night700 : COLORS.night900,
        text: active ? COLORS.ink : COLORS.inkDim,
      }
    }
    return {
      border: COLORS.frameHi,
      body: active ? COLORS.frameHi : COLORS.night600,
      text: active ? COLORS.night900 : COLORS.ink,
    }
  }
}
