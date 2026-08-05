import Phaser from 'phaser'
import { COLORS, TEXT_SIZE } from './tokens'
import { PixelButton } from './ui/button'
import { PixelPanel } from './ui/panel'
import { pixelText } from './ui/pixel-text'

export interface MenuCallbacks {
  onClose: () => void
  onBackToTitle: () => void
  onRestart: () => void
}

export class MenuOverlay extends Phaser.GameObjects.Container {
  private readonly dim: Phaser.GameObjects.Rectangle
  private readonly panel: PixelPanel
  private readonly buttons: PixelButton[]
  private openFlag = false

  constructor(scene: Phaser.Scene, callbacks: MenuCallbacks) {
    super(scene)
    this.dim = scene.add.rectangle(0, 0, 2000, 1200, COLORS.night900, 0.7)
    this.dim.setOrigin(0)
    this.dim.setInteractive()
    this.dim.on('pointerdown', () => callbacks.onClose())
    this.panel = new PixelPanel(scene, 360, 260)
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
      primary: true,
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
    this.buttons = [close, toTitle, restart]
    this.add([this.dim, this.panel, title, note, ...this.buttons])
    this.setVisible(false)
    scene.add.existing(this)
  }

  show(): void {
    this.openFlag = true
    this.setVisible(true)
    const { width, height } = this.scene.scale.gameSize
    this.setPosition((width - 360) / 2, (height - 280) / 2)
  }

  hide(): void {
    this.openFlag = false
    this.setVisible(false)
  }

  get isOpen(): boolean {
    return this.openFlag
  }
}

export interface ConfirmCallbacks {
  onConfirm: () => void
  onCancel: () => void
}

export class ConfirmOverlay extends Phaser.GameObjects.Container {
  private readonly dim: Phaser.GameObjects.Rectangle
  private readonly panel: PixelPanel
  private readonly headText: Phaser.GameObjects.Text
  private readonly planText: Phaser.GameObjects.Text
  private readonly confirmButton: PixelButton
  private openFlag = false

  constructor(scene: Phaser.Scene, callbacks: ConfirmCallbacks) {
    super(scene)
    this.dim = scene.add.rectangle(0, 0, 2000, 1200, COLORS.night900, 0.7)
    this.dim.setOrigin(0)
    this.panel = new PixelPanel(scene, 420, 220)
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
    this.confirmButton = new PixelButton(scene, {
      label: 'このまま開始',
      width: 150,
      height: 44,
      primary: true,
      onAction: callbacks.onConfirm,
    })
    this.confirmButton.setPosition(120, 176)
    const cancel = new PixelButton(scene, {
      label: '戻って調整',
      width: 150,
      height: 44,
      onAction: callbacks.onCancel,
    })
    cancel.setPosition(290, 176)
    this.add([this.dim, this.panel, this.headText, note, this.planText, this.confirmButton, cancel])
    this.setVisible(false)
    scene.add.existing(this)
  }

  show(remaining: number, planSummary: string): void {
    this.openFlag = true
    this.setVisible(true)
    this.headText.setText(`${remaining}人の人員が未配置です`)
    this.planText.setText(planSummary)
    const { width, height } = this.scene.scale.gameSize
    this.setPosition((width - 420) / 2, (height - 220) / 2)
  }

  hide(): void {
    this.openFlag = false
    this.setVisible(false)
  }

  get isOpen(): boolean {
    return this.openFlag
  }
}
