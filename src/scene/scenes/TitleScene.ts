import Phaser from 'phaser'
import { KEYS, SCENE_EVENTS } from '../keys'
import { BALANCE } from '../../game/data/balance'
import { deviceClassOf } from '../layout'
import { getSettings, randomSeed, updateSettings } from '../../store'
import { sharedStore } from '../store-bridge'
import { COLORS, TEXT_SIZE } from '../tokens'
import { CONFIRM_NEW_GAME } from '../labels'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'

const BRIEFING = `─ 緊急派遣要請 ─

昨夜の豪雨により、唯一の幹線道路が寸断された。
橋は崩落し、町は外部から孤立している。

電力は衰え、物資は細りつつある。
救援隊の到着は、推定 ${BALANCE.days} 日後。

貴殿を【臨時対策責任者】に任命する。

限られた作業員と物資を配分し、
道が開かれるその日まで、この町を生かし続けよ。`

const TYPE_SPEED_MS = 16

let sessionStarted = false

export class TitleScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text
  private briefingText!: Phaser.GameObjects.Text
  private motionButton!: PixelButton
  private resumeButton!: PixelButton
  private newButton!: PixelButton
  private skipButton: PixelButton | null = null
  private typed = 0
  private typeEvent: Phaser.Time.TimerEvent | null = null

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
    this.briefingText = pixelText(this, '', {
      fontSize: TEXT_SIZE.bodyWide,
      color: COLORS.ink,
      wordWrapWidth: 420,
    })
    this.briefingText.setOrigin(0.5, 0)
    this.motionButton = new PixelButton(this, {
      label: '',
      width: 200,
      height: 36,
      fontSize: TEXT_SIZE.labelWide,
      onAction: () => {
        updateSettings({ animations: !getSettings().animations })
        this.motionButton.setLabel(this.motionLabel())
      },
    })
    this.motionButton.setLabel(this.motionLabel())
    const store = sharedStore()
    const state = store.get().state
    const hasProgress = state.report.length > 0 || state.day > 1
    const canResume =
      (hasProgress || sessionStarted) && (state.phase === 'planning' || state.phase === 'choice')
    this.resumeButton = new PixelButton(this, {
      label: '▶ 続きから',
      width: 200,
      height: 48,
      primary: true,
      onAction: () => {
        sessionStarted = true
        this.scene.start(KEYS.play)
      },
    })
    this.resumeButton.setVisible(canResume)
    this.newButton = new PixelButton(this, {
      label: canResume ? '最初から' : '▶ 指揮所へ',
      width: 200,
      height: 48,
      primary: !canResume,
      onAction: () => {
        if (hasProgress && !window.confirm(CONFIRM_NEW_GAME)) {
          return
        }
        store.dispatch({ type: 'newGame', seed: randomSeed() })
        sessionStarted = true
        this.scene.start(KEYS.play)
      },
    })
    this.startBriefing()
    this.layout()
    this.game.events.on(SCENE_EVENTS.deviceClass, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SCENE_EVENTS.deviceClass, this.layout, this)
      if (this.typeEvent) this.typeEvent.remove()
    })
  }

  private motionLabel(): string {
    return `文字送り・演出: ${getSettings().animations ? 'ON' : 'OFF'}`
  }

  private startBriefing(): void {
    if (getSettings().animations) {
      this.typed = 0
      this.typeEvent = this.time.addEvent({
        delay: TYPE_SPEED_MS,
        repeat: BRIEFING.length - 1,
        callback: () => {
          this.typed += 1
          this.briefingText.setText(BRIEFING.slice(0, this.typed))
          if (this.typed >= BRIEFING.length) this.removeSkip()
        },
      })
      this.skipButton = new PixelButton(this, {
        label: 'スキップ ▶▶',
        width: 130,
        height: 36,
        fontSize: TEXT_SIZE.labelWide,
        onAction: () => {
          this.completeBriefing()
        },
      })
      this.layout()
    } else {
      this.briefingText.setText(BRIEFING)
    }
  }

  private completeBriefing(): void {
    if (this.typeEvent) {
      this.typeEvent.remove()
      this.typeEvent = null
    }
    this.briefingText.setText(BRIEFING)
    this.removeSkip()
  }

  private removeSkip(): void {
    if (this.skipButton) {
      this.skipButton.destroy()
      this.skipButton = null
    }
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize
    const narrow = deviceClassOf(window.innerWidth) === 'narrow'
    const titleY = narrow ? height * 0.08 : height * 0.1
    this.titleText.setPosition(width / 2, titleY)
    this.briefingText.setPosition(width / 2, titleY + 56)
    const actionsY = height * 0.82
    if (this.resumeButton.visible) {
      this.resumeButton.setPosition(width / 2 - 110, actionsY)
      this.newButton.setPosition(width / 2 + 110, actionsY)
    } else {
      this.newButton.setPosition(width / 2, actionsY)
    }
    this.motionButton.setPosition(width / 2, actionsY + 64)
    if (this.skipButton) {
      this.skipButton.setPosition(width / 2 + 180, height * 0.72)
    }
  }
}
