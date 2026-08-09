import Phaser from 'phaser'
import { BALANCE } from '../../game/data/balance'
import { getSettings, randomSeed, updateSettings } from '../../store'
import { audioDirectorFor, type AudioDirector } from '../audio/audio-director'
import { textureKey } from '../art/assets'
import { fadeInScene, transitionToScene } from '../global/scene-transition'
import { KEYS, SCENE_EVENTS } from '../keys'
import { CONFIRM_NEW_GAME } from '../labels'
import {
  deviceClassOf,
  logicalSafeInsetsForCanvas,
  type DeviceClass,
  type SafeInsets,
} from '../layout'
import { sharedStore } from '../store-bridge'
import { COLORS, TEXT_SIZE, fitSize } from '../tokens'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import type { StorySceneData } from './StoryScene'

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
  private soundButton!: PixelButton
  private audio!: AudioDirector
  private canResume = false
  private transitioning = false

  constructor() {
    super(KEYS.title)
  }

  create(): void {
    this.transitioning = false
    this.audio = audioDirectorFor(this.game)
    this.audio.setMood('silent')
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
      onAction: () => this.enterScene(KEYS.play),
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
        const launch: StorySceneData = { milestone: 'prologue', nextScene: KEYS.play }
        this.enterScene(KEYS.story, launch)
      },
    })

    this.motionButton = new PixelButton(this, {
      label: this.motionLabel(),
      width: 220,
      height: 44,
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

    this.soundButton = new PixelButton(this, {
      label: this.soundLabel(),
      width: 220,
      height: 44,
      variant: 'toggle',
      selected: getSettings().sound,
      fontSize: TEXT_SIZE.labelWide,
      onAction: () => {
        const sound = !getSettings().sound
        if (!sound) this.audio.play('cancel')
        updateSettings({ sound })
        this.audio.syncSettings()
        if (sound) this.audio.play('confirm')
        this.soundButton.setLabel(this.soundLabel())
        this.soundButton.setSelected(sound)
      },
    })

    this.input.keyboard?.on('keydown-ENTER', (event: KeyboardEvent) => {
      if (event.repeat) return
      event.preventDefault()
      void this.audio.unlock()
      const handled = this.canResume
        ? this.resumeButton.triggerFromKeyboard()
        : this.newButton.triggerFromKeyboard()
      if (!handled) this.audio.play('invalid')
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

  private soundLabel(): string {
    return `サウンド ${getSettings().sound ? 'ON' : 'OFF'}`
  }

  private enterScene(key: string, data?: object): void {
    if (this.transitioning) return
    this.transitioning = true
    sessionStarted = true
    void this.audio.unlock()
    this.audio.play('confirm')
    transitionToScene(this, key, data)
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize
    const deviceClass = deviceClassOf(window.innerWidth)
    const safeInsets = logicalSafeInsetsForCanvas(this.game.canvas, width, height)
    this.layoutBackground(width, height, deviceClass, safeInsets)
    if (deviceClass === 'wide') this.layoutWide(width, height, safeInsets)
    else this.layoutNarrow(width, height, safeInsets)
  }

  private layoutBackground(
    width: number,
    height: number,
    deviceClass: DeviceClass,
    safeInsets: SafeInsets,
  ): void {
    const source = this.background.texture.getSourceImage() as { width: number; height: number }
    const scale = Math.max(width / source.width, height / source.height)
    this.background.setPosition(width / 2, height / 2)
    this.background.setScale(scale)

    this.shade.clear()
    this.shade.fillStyle(COLORS.night900, deviceClass === 'wide' ? 0.56 : 0.68)
    this.shade.fillRect(0, 0, width, height)
    this.shade.fillStyle(COLORS.night900, 0.88)
    this.shade.fillRect(0, 0, width, safeInsets.top + (deviceClass === 'wide' ? 42 : 28))
    this.shade.fillRect(0, height - safeInsets.bottom - 34, width, safeInsets.bottom + 34)

    const frameX = safeInsets.left + 14
    const frameY = safeInsets.top + 14
    const frameW = width - safeInsets.left - safeInsets.right - 28
    const frameH = height - safeInsets.top - safeInsets.bottom - 28
    this.frame.clear()
    this.frame.lineStyle(2, COLORS.frameLo, 0.75)
    this.frame.strokeRect(frameX, frameY, frameW, frameH)
    this.frame.lineStyle(1, COLORS.cyan, 0.45)
    this.frame.lineBetween(
      safeInsets.left + 24,
      safeInsets.top + 42,
      width - safeInsets.right - 24,
      safeInsets.top + 42,
    )
  }

  private layoutWide(width: number, height: number, safeInsets: SafeInsets): void {
    const left = Math.max(72, safeInsets.left + 24)
    const topShift = Math.max(0, safeInsets.top - 14)
    this.resumeButton.setSize(220, 50)
    this.newButton.setSize(220, 50)
    this.motionButton.setSize(220, 44)
    this.soundButton.setSize(220, 44)
    this.kicker.setPosition(left, 68 + topShift)
    this.kicker.setFontSize(TEXT_SIZE.labelWide)
    this.titleText.setPosition(left, 106 + topShift)
    this.titleText.setFontSize(38)
    this.titleText.setWordWrapWidth(650)
    this.subtitleText.setPosition(left, 164 + topShift)
    this.subtitleText.setFontSize(TEXT_SIZE.bodyWide)
    this.subtitleText.setWordWrapWidth(560)

    const cardX = left
    const cardY = 252 + topShift
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
    const portraitX = width - 238 - safeInsets.right
    const portraitBottom = height - safeInsets.bottom - 112
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

    const actionsY = height - safeInsets.bottom - 150
    if (this.canResume) {
      this.resumeButton.setPosition(left + 110, actionsY)
      this.newButton.setPosition(left + 346, actionsY)
    } else {
      this.newButton.setPosition(left + 110, actionsY)
    }
    this.motionButton.setPosition(left + 110, actionsY + 62)
    this.soundButton.setPosition(left + 346, actionsY + 62)
  }

  private layoutNarrow(width: number, height: number, safeInsets: SafeInsets): void {
    const left = Math.max(24, safeInsets.left + 18)
    const topShift = Math.max(0, safeInsets.top - 14)
    this.kicker.setPosition(left, 46 + topShift)
    this.kicker.setFontSize(TEXT_SIZE.labelNarrow)
    this.titleText.setPosition(left, 78 + topShift)
    this.titleText.setFontSize(27)
    this.titleText.setWordWrapWidth(width - left - safeInsets.right - 24)
    this.subtitleText.setPosition(left, 126 + topShift)
    this.subtitleText.setFontSize(TEXT_SIZE.bodyNarrow)
    this.subtitleText.setWordWrapWidth(width - left - safeInsets.right - 24)

    const portraitW = 150
    const portraitH = 200
    const portraitX = width - 92 - safeInsets.right
    const portraitBottom = 344 + topShift
    const source = this.mayor.texture.getSourceImage() as { width: number; height: number }
    const fit = fitSize(source.width, source.height, portraitW, portraitH)
    this.mayor.setDisplaySize(fit.width, fit.height)
    this.mayor.setPosition(portraitX, portraitBottom)
    this.mayorLabel.setPosition(portraitX, portraitBottom + 8)
    this.mayorLabel.setFontSize(TEXT_SIZE.labelNarrow)

    const cardX = safeInsets.left + 18
    const cardY = 386 + topShift
    const cardW = width - safeInsets.left - safeInsets.right - 36
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

    const actionsY = height - safeInsets.bottom - (this.canResume ? 250 : 192)
    const buttonW = width - safeInsets.left - safeInsets.right - 48
    if (this.canResume) {
      this.resumeButton.setSize(buttonW, 48)
      this.resumeButton.setPosition(width / 2 + (safeInsets.left - safeInsets.right) / 2, actionsY)
      this.newButton.setSize(buttonW, 48)
      this.newButton.setPosition(
        width / 2 + (safeInsets.left - safeInsets.right) / 2,
        actionsY + 56,
      )
      this.motionButton.setPosition(
        width / 2 + (safeInsets.left - safeInsets.right) / 2,
        actionsY + 116,
      )
      this.soundButton.setPosition(
        width / 2 + (safeInsets.left - safeInsets.right) / 2,
        actionsY + 176,
      )
    } else {
      this.newButton.setSize(buttonW, 48)
      this.newButton.setPosition(width / 2 + (safeInsets.left - safeInsets.right) / 2, actionsY)
      this.motionButton.setPosition(
        width / 2 + (safeInsets.left - safeInsets.right) / 2,
        actionsY + 60,
      )
      this.soundButton.setPosition(
        width / 2 + (safeInsets.left - safeInsets.right) / 2,
        actionsY + 116,
      )
    }
    this.motionButton.setSize(buttonW, 44)
    this.soundButton.setSize(buttonW, 44)
  }
}
