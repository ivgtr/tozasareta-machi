import Phaser from 'phaser'
import { KEYS, SCENE_EVENTS } from '../keys'
import { deviceClassOf } from '../layout'
import { COLORS, PANEL_CONTENT_INSET, SCREEN_MARGIN, SPACING, TEXT_SIZE } from '../tokens'
import { PixelButton } from '../ui/button'
import { PixelGauge } from '../ui/gauge'
import { PixelPanel } from '../ui/panel'
import { pixelText } from '../ui/pixel-text'

const PANEL_HEIGHT = 160
const PANEL_WIDTH_WIDE = 360
const GAUGE_TOP_GAP = SPACING.md

export class PlayScene extends Phaser.Scene {
  private panel!: PixelPanel
  private infoText!: Phaser.GameObjects.Text
  private gauge!: PixelGauge
  private exitButton!: PixelButton

  constructor() {
    super(KEYS.play)
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.night900)
    this.panel = new PixelPanel(this, PANEL_WIDTH_WIDE, PANEL_HEIGHT)
    this.infoText = pixelText(this, '', { color: COLORS.inkDim })
    this.gauge = new PixelGauge(this, { width: 220, color: COLORS.green })
    this.gauge.setValue(62)
    this.panel.add([this.infoText, this.gauge])
    this.exitButton = new PixelButton(this, {
      label: 'タイトルへ',
      width: 200,
      height: 48,
      onAction: () => this.scene.start(KEYS.title),
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
    const narrow = deviceClass === 'narrow'
    const panelWidth = narrow ? width - SCREEN_MARGIN * 2 : PANEL_WIDTH_WIDE
    this.panel.setPanelSize(panelWidth, PANEL_HEIGHT)
    this.panel.setPosition((width - panelWidth) / 2, height * 0.25)
    this.infoText.setPosition(PANEL_CONTENT_INSET, PANEL_CONTENT_INSET)
    this.infoText.setText(`P1 骨格 / ${deviceClass} ${width}×${height}`)
    this.gauge.setPosition(
      PANEL_CONTENT_INSET,
      PANEL_CONTENT_INSET + TEXT_SIZE.bodyWide + GAUGE_TOP_GAP,
    )
    this.exitButton.setPosition(width / 2, height * 0.62)
  }
}
