import Phaser from 'phaser'
import { BALANCE } from '../../game/data/balance'
import type { GameState } from '../../game/types'
import { getSettings, updateSettings } from '../../store'
import type { DeviceClass } from '../layout'
import { COLORS, TEXT_SIZE } from '../tokens'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'

export interface MenuPresentationCallbacks {
  onClose: () => void
  onBackToTitle: () => void
  onRestart: () => void
}

export class MenuPresentation extends Phaser.GameObjects.Container {
  private readonly backdrop: Phaser.GameObjects.Rectangle
  private readonly frame: Phaser.GameObjects.Graphics
  private readonly kicker: Phaser.GameObjects.Text
  private readonly title: Phaser.GameObjects.Text
  private readonly dayText: Phaser.GameObjects.Text
  private readonly statusText: Phaser.GameObjects.Text
  private readonly note: Phaser.GameObjects.Text
  private readonly closeButton: PixelButton
  private readonly motionButton: PixelButton
  private readonly titleButton: PixelButton
  private readonly restartButton: PixelButton
  private viewportWidth = 1280
  private viewportHeight = 720
  private deviceClass: DeviceClass = 'wide'
  private currentState: GameState | null = null
  private openFlag = false

  constructor(scene: Phaser.Scene, callbacks: MenuPresentationCallbacks) {
    super(scene)
    this.backdrop = scene.add.rectangle(0, 0, 10, 10, COLORS.night900, 0.76).setOrigin(0)
    this.backdrop.setInteractive()
    this.backdrop.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        callbacks.onClose()
      },
    )
    this.frame = scene.add.graphics()
    this.kicker = pixelText(scene, 'COMMAND / EMERGENCY HQ', {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.cyan,
      trackingEm: 0.08,
    })
    this.title = pixelText(scene, '指揮所メニュー', {
      fontSize: 22,
      color: COLORS.gold,
    })
    this.dayText = pixelText(scene, '', {
      fontSize: TEXT_SIZE.heading,
      color: COLORS.amber,
    })
    this.statusText = pixelText(scene, '', {
      fontSize: TEXT_SIZE.bodyWide,
      color: COLORS.ink,
    })
    this.note = pixelText(scene, 'タイトルへ戻ると、本日の未確定な配置は破棄されます。', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.inkDim,
    })

    this.closeButton = new PixelButton(scene, {
      label: 'ゲームに戻る',
      width: 260,
      height: 46,
      variant: 'primary',
      onAction: callbacks.onClose,
    })
    this.motionButton = new PixelButton(scene, {
      label: this.motionLabel(),
      width: 260,
      height: 40,
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
    this.titleButton = new PixelButton(scene, {
      label: 'タイトルに戻る',
      width: 260,
      height: 42,
      variant: 'quiet',
      onAction: callbacks.onBackToTitle,
    })
    this.restartButton = new PixelButton(scene, {
      label: '最初から',
      width: 260,
      height: 42,
      variant: 'danger',
      onAction: callbacks.onRestart,
    })

    this.add([
      this.backdrop,
      this.frame,
      this.kicker,
      this.title,
      this.dayText,
      this.statusText,
      this.note,
      this.closeButton,
      this.motionButton,
      this.titleButton,
      this.restartButton,
    ])
    this.setDepth(1800)
    this.setVisible(false)
    scene.add.existing(this)
  }

  setViewport(width: number, height: number, deviceClass: DeviceClass): void {
    this.viewportWidth = width
    this.viewportHeight = height
    this.deviceClass = deviceClass
    if (this.openFlag) this.layout()
  }

  show(state: GameState): void {
    this.currentState = state
    this.openFlag = true
    this.updateStatus(state)
    this.motionButton.setLabel(this.motionLabel())
    this.motionButton.setSelected(getSettings().animations)
    this.layout()
    this.setVisible(true)
  }

  hide(): void {
    this.openFlag = false
    this.setVisible(false)
  }

  get isOpen(): boolean {
    return this.openFlag
  }

  private motionLabel(): string {
    return `文字送り・演出 ${getSettings().animations ? 'ON' : 'OFF'}`
  }

  private updateStatus(state: GameState): void {
    const day = Math.min(state.day, BALANCE.days)
    const rescueIn = Math.max(1, BALANCE.days - day + 1)
    this.dayText.setText(`DAY ${day} / ${BALANCE.days}    救援まで ${rescueIn}日`)
    this.statusText.setText(
      `食料 ${Math.round(state.resources.food)}    電力 ${Math.round(state.resources.power)}\n` +
        `医療 ${Math.round(state.resources.medical)}    士気 ${Math.round(state.resources.morale)}\n` +
        `予算 ${state.budget}    備蓄 ${state.stockpile}    人員 ${state.units.length}`,
    )
  }

  private layout(): void {
    const width = this.viewportWidth
    const height = this.viewportHeight
    const narrow = this.deviceClass === 'narrow'
    const panelW = narrow ? width - 24 : 430
    const panelH = narrow ? height - 28 : height - 48
    const panelX = narrow ? 12 : width - panelW - 24
    const panelY = narrow ? 14 : 24
    const pad = narrow ? 22 : 30
    const contentW = panelW - pad * 2

    this.backdrop.setSize(width, height)
    this.backdrop.setPosition(0, 0)
    if (this.backdrop.input) {
      this.backdrop.input.hitArea = new Phaser.Geom.Rectangle(0, 0, width, height)
    }

    this.frame.clear()
    this.frame.fillStyle(0x000000, 0.5)
    this.frame.fillRect(panelX + 8, panelY + 8, panelW, panelH)
    this.frame.fillStyle(COLORS.night900, 0.98)
    this.frame.fillRect(panelX, panelY, panelW, panelH)
    this.frame.lineStyle(3, COLORS.frameHi)
    this.frame.strokeRect(panelX + 1, panelY + 1, panelW - 2, panelH - 2)
    this.frame.lineStyle(1, COLORS.cyan, 0.8)
    this.frame.strokeRect(panelX + 8, panelY + 8, panelW - 16, panelH - 16)
    this.frame.fillStyle(COLORS.cyan, 0.9)
    this.frame.fillRect(panelX + 12, panelY + 12, panelW - 24, 5)
    this.frame.lineStyle(1, COLORS.frameLo, 0.8)
    this.frame.lineBetween(panelX + pad, panelY + 186, panelX + panelW - pad, panelY + 186)

    this.kicker.setPosition(panelX + pad, panelY + 34)
    this.title.setPosition(panelX + pad, panelY + 60)
    this.title.setFontSize(narrow ? 20 : 22)
    this.dayText.setPosition(panelX + pad, panelY + 112)
    this.dayText.setFontSize(narrow ? 17 : TEXT_SIZE.heading)
    this.dayText.setWordWrapWidth(contentW)
    this.statusText.setPosition(panelX + pad, panelY + 204)
    this.statusText.setFontSize(narrow ? TEXT_SIZE.bodyNarrow : TEXT_SIZE.bodyWide)
    this.statusText.setWordWrapWidth(contentW)
    this.note.setPosition(panelX + pad, panelY + 306)
    this.note.setFontSize(narrow ? TEXT_SIZE.labelNarrow : TEXT_SIZE.labelWide)
    this.note.setWordWrapWidth(contentW)

    const buttonW = contentW
    const bottom = panelY + panelH - 36
    this.restartButton.setSize(buttonW, 42)
    this.restartButton.setPosition(panelX + panelW / 2, bottom - 21)
    this.titleButton.setSize(buttonW, 42)
    this.titleButton.setPosition(panelX + panelW / 2, bottom - 73)
    this.motionButton.setSize(buttonW, 40)
    this.motionButton.setPosition(panelX + panelW / 2, bottom - 125)
    this.closeButton.setSize(buttonW, 46)
    this.closeButton.setPosition(panelX + panelW / 2, bottom - 181)

    if (this.currentState) this.updateStatus(this.currentState)
  }
}
