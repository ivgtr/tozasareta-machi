import Phaser from 'phaser'
import { KEYS, SCENE_EVENTS } from '../keys'
import { deviceClassOf } from '../layout'
import { COLORS, TEXT_SIZE } from '../tokens'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'

export class TitleScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text
  private noteText!: Phaser.GameObjects.Text
  private startButton!: PixelButton

  constructor() {
    super(KEYS.title)
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.night900)
    this.titleText = pixelText(this, '孤立した町の30日間', {
      fontSize: TEXT_SIZE.title,
      color: COLORS.gold,
      trackingEm: 0.12,
    })
    this.titleText.setOrigin(0.5)
    this.noteText = pixelText(this, '', { color: COLORS.inkDim })
    this.noteText.setOrigin(0.5)
    this.startButton = new PixelButton(this, {
      label: 'はじめる',
      width: 240,
      height: 52,
      primary: true,
      onAction: () => this.scene.start(KEYS.play),
    })
    this.layout()
    this.game.events.on(SCENE_EVENTS.deviceClass, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SCENE_EVENTS.deviceClass, this.layout, this)
    })
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize
    const deviceClass = deviceClassOf(window.innerWidth)
    this.noteText.setText(`Phaser 骨格（P1）/ ${deviceClass} ${width}×${height}`)
    this.titleText.setPosition(width / 2, height * 0.32)
    this.noteText.setPosition(width / 2, height * 0.44)
    this.startButton.setPosition(width / 2, height * 0.58)
  }
}
