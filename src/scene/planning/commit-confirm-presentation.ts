import Phaser from 'phaser'
import { COLORS, TEXT_SIZE } from '../tokens'
import { ModalCard } from '../ui/modal-card'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'

export interface CommitConfirmCallbacks {
  onConfirm: () => void
  onCancel: () => void
}

const CARD_W = 420
const CARD_H = 220

export class CommitConfirmPresentation extends ModalCard {
  private readonly headText: Phaser.GameObjects.Text
  private readonly planText: Phaser.GameObjects.Text
  private openFlag = false
  private viewportWidth = 1280
  private viewportHeight = 720

  constructor(scene: Phaser.Scene, callbacks: CommitConfirmCallbacks) {
    super(scene, callbacks.onCancel)
    this.headText = pixelText(scene, '', {
      fontSize: TEXT_SIZE.heading,
      color: COLORS.amber,
    })
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
    this.layout()
    this.showCard()
  }

  setViewport(width: number, height: number): void {
    this.viewportWidth = width
    this.viewportHeight = height
    if (this.openFlag) this.layout()
  }

  hide(): void {
    this.openFlag = false
    this.hideCard()
  }

  get isOpen(): boolean {
    return this.openFlag
  }

  private layout(): void {
    this.begin(this.viewportWidth, this.viewportHeight, CARD_W, CARD_W, false)
    this.finish(this.viewportHeight, CARD_H - 32, 32)
  }
}
