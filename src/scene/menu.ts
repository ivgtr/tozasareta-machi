import Phaser from 'phaser'
import { COLORS, TEXT_SIZE } from './tokens'
import { ModalCard } from './ui/modal-card'
import { PixelButton } from './ui/button'
import { pixelText } from './ui/pixel-text'

export interface MenuCallbacks {
  onClose: () => void
  onBackToTitle: () => void
  onRestart: () => void
}

const MENU_W = 360
const MENU_H = 280

export class MenuOverlay extends ModalCard {
  private openFlag = false

  constructor(scene: Phaser.Scene, callbacks: MenuCallbacks) {
    super(scene, callbacks.onClose)
    const title = pixelText(scene, 'ゲームメニュー', {
      fontSize: TEXT_SIZE.heading,
      color: COLORS.gold,
    })
    title.setPosition(24, 24)
    const note = pixelText(scene, 'タイトルへ戻ると、本日の未確定な配置は破棄されます。', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.inkDim,
      wordWrapWidth: 310,
    })
    note.setPosition(24, 60)
    const close = new PixelButton(scene, {
      label: 'ゲームに戻る',
      width: 200,
      height: 44,
      variant: 'primary',
      onAction: callbacks.onClose,
    })
    close.setPosition(180, 130)
    const toTitle = new PixelButton(scene, {
      label: 'タイトルに戻る',
      width: 200,
      height: 44,
      onAction: callbacks.onBackToTitle,
    })
    toTitle.setPosition(180, 182)
    const restart = new PixelButton(scene, {
      label: '最初から',
      width: 200,
      height: 44,
      onAction: callbacks.onRestart,
    })
    restart.setPosition(180, 234)
    this.content.add([title, note, close, toTitle, restart])
  }

  show(): void {
    this.openFlag = true
    const { width, height } = this.scene.scale.gameSize
    this.begin(width, height, MENU_W, MENU_W, false)
    this.finish(height, MENU_H - 32, 32)
    this.showCard()
  }

  hide(): void {
    this.openFlag = false
    this.hideCard()
  }

  get isOpen(): boolean {
    return this.openFlag
  }
}

export interface ConfirmCallbacks {
  onConfirm: () => void
  onCancel: () => void
}

const CONFIRM_W = 420
const CONFIRM_H = 220

export class ConfirmOverlay extends ModalCard {
  private readonly headText: Phaser.GameObjects.Text
  private readonly planText: Phaser.GameObjects.Text
  private openFlag = false

  constructor(scene: Phaser.Scene, callbacks: ConfirmCallbacks) {
    super(scene, callbacks.onCancel)
    this.headText = pixelText(scene, '', { fontSize: TEXT_SIZE.heading, color: COLORS.amber })
    this.headText.setPosition(24, 28)
    const note = pixelText(scene, '未配置の人員はこの日、何も生み出しません。', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.inkDim,
    })
    note.setPosition(24, 64)
    this.planText = pixelText(scene, '', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.ink,
      wordWrapWidth: 370,
    })
    this.planText.setPosition(24, 96)
    const confirmButton = new PixelButton(scene, {
      label: 'このまま開始',
      width: 150,
      height: 44,
      variant: 'primary',
      onAction: callbacks.onConfirm,
    })
    confirmButton.setPosition(120, 176)
    const cancel = new PixelButton(scene, {
      label: '戻って調整',
      width: 150,
      height: 44,
      onAction: callbacks.onCancel,
    })
    cancel.setPosition(290, 176)
    this.content.add([this.headText, note, this.planText, confirmButton, cancel])
  }

  show(remaining: number, planSummary: string): void {
    this.openFlag = true
    this.headText.setText(`${remaining}人の人員が未配置です`)
    this.planText.setText(planSummary)
    const { width, height } = this.scene.scale.gameSize
    this.begin(width, height, CONFIRM_W, CONFIRM_W, false)
    this.finish(height, CONFIRM_H - 32, 32)
    this.showCard()
  }

  hide(): void {
    this.openFlag = false
    this.hideCard()
  }

  get isOpen(): boolean {
    return this.openFlag
  }
}
