import Phaser from 'phaser'
import { BALANCE } from '../../game/data/balance'
import { getSettings, randomSeed, updateSettings } from '../../store'
import { textureKey } from '../art/assets'
import { fadeInScene, transitionToScene } from '../global/scene-transition'
import { KEYS, SCENE_EVENTS } from '../keys'
import { CONFIRM_NEW_GAME } from '../labels'
import { deviceClassOf, type DeviceClass } from '../layout'
import { sharedStore } from '../store-bridge'
import { COLORS, TEXT_SIZE, fitSize } from '../tokens'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'

const INTRO = `昨夜の豪雨で、唯一の幹線道路が寸断された。\n電力と物資は限られている。救援到着まで ${BALANCE.days} 日。\n人員を配置し、この町を生かし続けよ。`

let sessionStarted = false

export class TitleScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Image
  private shade!: Phaser.GameObjects.Graphics
  private frame!: Phaser.GameObjects.Graphics
  private mayor!: Phaser.GameObjects.Image
  private kicker!: Phaser.GameObjects.Text
  private titleText!: Phaser.GameObjects.Text
  private subtitleText!: Phaser.GameObjects.Text
  private briefingTitle!: Phaser.GameObjects.Text
  private briefingText!: Phaser.GameObjects.Text
  private mayorLabel!: Phaser.GameObjects.Text
  private resumeButton!: PixelButton
  private newButton!: PixelButton
  private motionButton!: PixelButton
  private canResume = false
  private transitioning = false

  constructor() {
    super(KEYS.title)
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.night900)
    this.background = this.add.image(0, 0, textureKey('scene', 'night')).setOrigin(0.5)
    this.shade = this.add.graphics()
    this.frame = this.add.graphics()

    this.kicker = pixelText(this, 'EMERGENCY OPERATIONS / 臨時災害対策本部', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.cyan,
      trackingEm: 0.08,
    })
    this.titleText = pixelText(this, '孤立した町の30日間', {
      fontSize: TEXT_SIZE.title,
      color: COLORS.gold,
      wordWrapWidth: 620,
    })
    this.subtitleText = pixelText(this, '人を動かし、町をつなぎ、救援の日まで生き延びる。', {
      fontSize: TEXT_SIZE.bodyWide,
      color: COLORS.inkDim,
      wordWrapWidth: 560,
    })
    this.briefingTitle = pixelText(this, '緊急派遣要請', {
      fontSize: TEXT_SIZE.heading,
      color: COLORS.amber,
    })
    this.briefingText = pixelText(this, INTRO, {
      fontSize: TEXT_SIZE.bodyWide,
      color: COLORS.ink,
      wordWrapWidth: 500,
    })

    this.mayor = this.add.image(0, 0, textureKey('portrait', 'mayor')).setOrigin(0.5, 1)
    this.mayorLabel = pixelText(this, '真壁史子  /  町長', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.gold,
    })
    this.mayorLabel.setOrigin(0.5, 0)

    const store = sharedStore()
    const state = store.get().state
    const hasProgress = state.report.length > 0 || state.day > 1
    this.canResume =
      (hasProgress || sessionStarted) && (state.phase === 'planning' || state.phase === 'choice')

    this.resumeButton = new PixelButton(this, {
      label: '▶ 続きから',
      width: 220,
      height: 50,
      variant: 'primary',
      onAction: () => this.enterPlay(),
    })
    this.resumeButton.setVisible(this.canResume)

    this.newButton = new PixelButton(this, {
      label: this.canResume ? '最初から' : '▶ 指揮所へ',
      width: 220,
      height: 50,
      variant: this.canResume ? 'default' : 'primary',
      onAction: () => {
        if (hasProgress && !window.confirm(CONFIRM_NEW_GAME)) return
        store.dispatch({ type: 'newGame', seed: randomSeed() })
        this.enterPlay()
      },
    })

    this.motionButton = new PixelButton(this, {
      label: this.motionLabel(),
      width: 220,
      height: 36,
      variant: 'toggle',
      selected: getSettings().animations,
      fontSize: TEXT_SIZE.labelWide,
      onAction: () => {
        const animations = !getSettings().animations
        updateSettings({ animations })
        this.motionButton.setLabel(this.motionLabel())
        this.motionButton.setSelected(animations)
      },
    })

    this.layout()
    fadeInScene(this)
    this.game.events.on(SCENE_EVENTS.deviceClass, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SCENE_EVENTS.deviceClass, this.layout, this)
    })
  }

  private motionLabel(): string {
    return `文字送り・演出 ${getSettings().animations ? 'ON' : 'OFF'}`
  }

  private enterPlay(): void {
    if (this.transitioning) return
    this.transitioning = true
    sessionStarted = true
    transitionToScene(this, KEYS.play)
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize
    const deviceClass = deviceClassOf(window.innerWidth)
    this.layoutBackground(width, height, deviceClass)
    if (deviceClass === 'wide') this.layoutWide(width, height)
    else this.layoutNarrow(width, height)
  }

  private layoutBackground(width: number, height: number, deviceClass: DeviceClass): void {
    const source = this.background.texture.getSourceImage() as { width: number; height: number }
    const scale = Math.max(width / source.width, height / source.height)
    this.background.setPosition(width / 2, height / 2)
    this.background.setScale(scale)

    this.shade.clear()
    this.shade.fillStyle(COLORS.night900, deviceClass === 'wide' ? 0.56 : 0.68)
    this.shade.fillRect(0, 0, width, height)
    this.shade.fillStyle(COLORS.night900, 0.88)
    this.shade.fillRect(0, 0, width, deviceClass === 'wide' ? 42 : 28)
    this.shade.fillRect(0, height - 34, width, 34)

    this.frame.clear()
    this.frame.lineStyle(2, COLORS.frameLo, 0.75)
    this.frame.strokeRect(14, 14, width - 28, height - 28)
    this.frame.lineStyle(1, COLORS.cyan, 0.45)
    this.frame.lineBetween(24, 42, width - 24, 42)
  }

  private layoutWide(width: number, height: number): void {
    const left = 72
    this.resumeButton.setSize(220, 50)
    this.newButton.setSize(220, 50)
    this.motionButton.setSize(220, 36)
    this.kicker.setPosition(left, 68)
    this.kicker.setFontSize(TEXT_SIZE.labelWide)
    this.titleText.setPosition(left, 106)
    this.titleText.setFontSize(38)
    this.titleText.setWordWrapWidth(650)
    this.subtitleText.setPosition(left, 164)
    this.subtitleText.setFontSize(TEXT_SIZE.bodyWide)
    this.subtitleText.setWordWrapWidth(560)

    const cardX = left
    const cardY = 252
    const cardW = 560
    const cardH = 190
    this.frame.fillStyle(COLORS.night900, 0.82)
    this.frame.fillRect(cardX, cardY, cardW, cardH)
    this.frame.lineStyle(2, COLORS.amber, 0.9)
    this.frame.strokeRect(cardX + 1, cardY + 1, cardW - 2, cardH - 2)
    this.frame.fillStyle(COLORS.amber, 0.9)
    this.frame.fillRect(cardX + 14, cardY + 14, 72, 4)
    this.briefingTitle.setPosition(cardX + 24, cardY + 32)
    this.briefingText.setPosition(cardX + 24, cardY + 72)
    this.briefingText.setFontSize(TEXT_SIZE.bodyWide)
    this.briefingText.setWordWrapWidth(cardW - 48)

    const portraitW = 290
    const portraitH = 390
    const portraitX = width - 238
    const portraitBottom = height - 112
    const source = this.mayor.texture.getSourceImage() as { width: number; height: number }
    const fit = fitSize(source.width, source.height, portraitW, portraitH)
    this.mayor.setDisplaySize(fit.width, fit.height)
    this.mayor.setPosition(portraitX, portraitBottom)
    this.mayorLabel.setPosition(portraitX, portraitBottom + 12)
    this.mayorLabel.setFontSize(TEXT_SIZE.labelWide)

    const portraitFrameX = portraitX - portraitW / 2 - 18
    const portraitFrameY = portraitBottom - portraitH - 18
    this.frame.lineStyle(2, COLORS.gold, 0.75)
    this.frame.strokeRect(portraitFrameX, portraitFrameY, portraitW + 36, portraitH + 58)
    this.frame.fillStyle(COLORS.night900, 0.62)
    this.frame.fillRect(portraitFrameX, portraitBottom + 4, portraitW + 36, 38)

    const actionsY = height - 150
    if (this.canResume) {
      this.resumeButton.setPosition(left + 110, actionsY)
      this.newButton.setPosition(left + 346, actionsY)
    } else {
      this.newButton.setPosition(left + 110, actionsY)
    }
    this.motionButton.setPosition(left + 110, actionsY + 62)
  }

  private layoutNarrow(width: number, height: number): void {
    const left = 24
    this.kicker.setPosition(left, 46)
    this.kicker.setFontSize(TEXT_SIZE.labelNarrow)
    this.titleText.setPosition(left, 78)
    this.titleText.setFontSize(27)
    this.titleText.setWordWrapWidth(width - 48)
    this.subtitleText.setPosition(left, 126)
    this.subtitleText.setFontSize(TEXT_SIZE.bodyNarrow)
    this.subtitleText.setWordWrapWidth(width - 48)

    const portraitW = 150
    const portraitH = 200
    const portraitX = width - 92
    const portraitBottom = 344
    const source = this.mayor.texture.getSourceImage() as { width: number; height: number }
    const fit = fitSize(source.width, source.height, portraitW, portraitH)
    this.mayor.setDisplaySize(fit.width, fit.height)
    this.mayor.setPosition(portraitX, portraitBottom)
    this.mayorLabel.setPosition(portraitX, portraitBottom + 8)
    this.mayorLabel.setFontSize(TEXT_SIZE.labelNarrow)

    const cardX = 18
    const cardY = 386
    const cardW = width - 36
    const cardH = 194
    this.frame.fillStyle(COLORS.night900, 0.88)
    this.frame.fillRect(cardX, cardY, cardW, cardH)
    this.frame.lineStyle(2, COLORS.amber, 0.9)
    this.frame.strokeRect(cardX + 1, cardY + 1, cardW - 2, cardH - 2)
    this.frame.fillStyle(COLORS.amber, 0.9)
    this.frame.fillRect(cardX + 12, cardY + 12, 64, 4)
    this.briefingTitle.setPosition(cardX + 18, cardY + 28)
    this.briefingTitle.setFontSize(18)
    this.briefingText.setPosition(cardX + 18, cardY + 66)
    this.briefingText.setFontSize(TEXT_SIZE.bodyNarrow)
    this.briefingText.setWordWrapWidth(cardW - 36)

    const actionsY = height - (this.canResume ? 194 : 136)
    if (this.canResume) {
      this.resumeButton.setSize(width - 48, 48)
      this.resumeButton.setPosition(width / 2, actionsY)
      this.newButton.setSize(width - 48, 48)
      this.newButton.setPosition(width / 2, actionsY + 56)
      this.motionButton.setPosition(width / 2, actionsY + 116)
    } else {
      this.newButton.setSize(width - 48, 48)
      this.newButton.setPosition(width / 2, actionsY)
      this.motionButton.setPosition(width / 2, actionsY + 60)
    }
    this.motionButton.setSize(width - 48, 36)
  }
}
