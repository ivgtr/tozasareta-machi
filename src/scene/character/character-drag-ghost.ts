import Phaser from 'phaser'
import type { Unit } from '../../game/types'
import { COLORS, TEXT_SIZE } from '../tokens'
import { drawArtSlot } from '../ui/art-slot'
import { pixelText } from '../ui/pixel-text'

export class CharacterDragGhost extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene) {
    super(scene)
    this.setDepth(1000)
    this.setVisible(false)
    scene.add.existing(this)
  }

  setUnit(unit: Unit): void {
    this.removeAll(true)
    const width = 76
    const height = 94
    const frame = this.scene.add.graphics()
    frame.fillStyle(0x000000, 0.45)
    frame.fillRect(-width / 2 + 4, -height / 2 + 4, width, height)
    frame.fillStyle(COLORS.night900, 0.96)
    frame.fillRect(-width / 2, -height / 2, width, height)
    frame.lineStyle(3, unit.condition === 'injured' ? COLORS.red : COLORS.gold)
    frame.strokeRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2)
    this.add(frame)

    drawArtSlot(this.scene, this, 'portrait', unit.portrait, 0, -8, {
      width: 54,
      height: 70,
      glyphSize: 32,
      fallbackGlyph: '人',
    })

    const name = pixelText(this.scene, unit.name, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.ink,
      wordWrapWidth: width - 8,
      align: 'center',
    })
    name.setOrigin(0.5, 1)
    name.setPosition(0, height / 2 - 5)
    this.add(name)
  }
}
