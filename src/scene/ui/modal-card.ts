import Phaser from 'phaser'
import { COLORS, PANEL_CONTENT_INSET, SPACING } from '../tokens'
import { PixelPanel } from './panel'

export const MODAL_DIM_ALPHA = 0.7

export class ModalCard extends Phaser.GameObjects.Container {
  protected readonly dim: Phaser.GameObjects.Rectangle
  protected readonly panel: PixelPanel
  protected readonly content: Phaser.GameObjects.Container
  protected cardW = 560
  protected cardH = 560
  protected contentInset = PANEL_CONTENT_INSET
  private cardX = 0
  private cardY = 0

  constructor(scene: Phaser.Scene, onOutsideClick?: () => void) {
    super(scene)
    this.dim = scene.add.rectangle(0, 0, 10, 10, COLORS.night900, MODAL_DIM_ALPHA)
    this.dim.setOrigin(0)
    this.dim.setInteractive()
    this.dim.on(
      'pointerdown',
      (
        pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        if (onOutsideClick && !this.panelContains(pointer)) onOutsideClick()
      },
    )
    this.panel = new PixelPanel(scene, 10, 10)
    this.content = scene.add.container(0, 0)
    this.add([this.panel, this.content])
    this.setVisible(false)
    scene.add.existing(this)
  }

  protected begin(width: number, height: number, minW = 360, maxW = 560, clear = true): number {
    if (clear) this.content.removeAll(true)
    const cardW = Math.min(maxW, Math.max(minW, width - SPACING.lg * 2))
    this.cardW = cardW
    this.dim.setSize(width, height)
    this.dim.setPosition(0, 0)
    if (this.dim.input) {
      this.dim.input.hitArea = new Phaser.Geom.Rectangle(0, 0, width, height)
    }
    this.setPosition(0, 0)
    this.cardX = (width - cardW) / 2
    this.content.setPosition(this.cardX, 0)
    return cardW - this.contentInset * 2
  }

  protected finish(height: number, bottom: number, bottomPad: number): void {
    const cardH = Math.min(height - SPACING.lg * 2, Math.ceil(bottom) + bottomPad)
    this.cardH = cardH
    this.cardY = (height - cardH) / 2
    this.panel.setPanelSize(this.cardW, cardH)
    this.panel.setPosition(this.cardX, this.cardY)
    this.content.setPosition(this.cardX, this.cardY)
  }

  protected showCard(): void {
    this.setVisible(true)
    this.dim.setVisible(true)
  }

  protected hideCard(): void {
    this.setVisible(false)
    this.dim.setVisible(false)
  }

  private panelContains(pointer: Phaser.Input.Pointer): boolean {
    const x = pointer.worldX - this.cardX
    const y = pointer.worldY - this.cardY
    return x >= 0 && x <= this.cardW && y >= 0 && y <= this.panel.panelHeight
  }
}
