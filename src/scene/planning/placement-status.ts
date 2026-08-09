import Phaser from 'phaser'
import type { Unit } from '../../game/types'
import type { DeviceClass } from '../layout'
import type { Rect } from '../regions'
import { COLORS, TEXT_SIZE } from '../tokens'
import { PixelButton } from '../ui/button'
import { drawArtSlot } from '../ui/art-slot'
import { pixelText } from '../ui/pixel-text'

export interface PlacementStatusCallbacks {
  onClose: () => void
  onInspect: () => void
}

export class PlacementStatus extends Phaser.GameObjects.Container {
  private readonly frame: Phaser.GameObjects.Graphics
  private readonly content: Phaser.GameObjects.Container
  private readonly closeButton: PixelButton
  private readonly inspectButton: PixelButton
  private panelWidth = 0
  private panelHeight = 0
  private openFlag = false

  constructor(scene: Phaser.Scene, callbacks: PlacementStatusCallbacks) {
    super(scene)
    this.frame = scene.add.graphics()
    this.content = scene.add.container()
    this.closeButton = new PixelButton(scene, {
      label: '閉じる',
      width: 72,
      height: 44,
      variant: 'quiet',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onClose,
    })
    this.inspectButton = new PixelButton(scene, {
      label: '詳細',
      width: 64,
      height: 44,
      variant: 'quiet',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onInspect,
    })
    this.add([this.frame, this.content, this.inspectButton, this.closeButton])
    this.setDepth(700)
    this.setVisible(false)
    scene.add.existing(this)
  }

  setBounds(town: Rect, deviceClass: DeviceClass): void {
    this.panelWidth = deviceClass === 'wide' ? 390 : Math.min(360, town.width - 24)
    this.panelHeight = deviceClass === 'wide' ? 94 : 90
    this.setPosition(town.x + town.width - this.panelWidth - 16, town.y + 16)
    this.inspectButton.setPosition(this.panelWidth - 112, this.panelHeight / 2)
    this.closeButton.setPosition(this.panelWidth - 40, this.panelHeight / 2)
    this.redrawFrame()
  }

  show(unit: Unit, assignmentLabel: string): void {
    this.openFlag = true
    this.setVisible(true)
    this.render(unit, assignmentLabel)
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
    g.fillStyle(0x000000, 0.4)
    g.fillRect(4, 4, this.panelWidth, this.panelHeight)
    g.fillStyle(COLORS.night900, 0.94)
    g.fillRect(0, 0, this.panelWidth, this.panelHeight)
    g.lineStyle(2, COLORS.gold)
    g.strokeRect(1, 1, this.panelWidth - 2, this.panelHeight - 2)
  }

  private render(unit: Unit, assignmentLabel: string): void {
    const d = this.content
    d.removeAll(true)

    drawArtSlot(this.scene, d, 'portrait', unit.portrait, 36, this.panelHeight / 2, {
      width: 48,
      height: 58,
      glyphSize: 26,
      fallbackGlyph: '人',
    })

    const name = pixelText(this.scene, unit.name, {
      fontSize: TEXT_SIZE.bodyWide,
      color: COLORS.gold,
      wordWrapWidth: this.panelWidth - 202,
    })
    name.setPosition(68, 12)
    d.add(name)

    const status = pixelText(this.scene, `配置先を選択  /  ${assignmentLabel}`, {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.ink,
      wordWrapWidth: this.panelWidth - 202,
    })
    status.setPosition(68, 36)
    d.add(status)

    const guide = pixelText(this.scene, '施設をクリック / ドラッグでも配置', {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
      wordWrapWidth: this.panelWidth - 202,
    })
    guide.setPosition(68, 64)
    d.add(guide)
  }
}
