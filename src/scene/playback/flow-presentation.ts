import Phaser from 'phaser'
import { NO_INSETS, logicalSafeInsetsForCanvas, type DeviceClass, type SafeInsets } from '../layout'
import { COLORS, TEXT_SIZE } from '../tokens'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import type { BeatImportance } from './beat-presentation'
import type { FlowPresentationModel, FlowTone } from './flow-model'

export interface FlowPresentationCallbacks {
  onSkip: () => void
}

export function flowAccent(tone: FlowTone): number {
  if (tone === 'positive') return COLORS.green
  if (tone === 'negative') return COLORS.red
  return COLORS.cyan
}

export class FlowPresentation extends Phaser.GameObjects.Container {
  private readonly backdrop: Phaser.GameObjects.Graphics
  private readonly frame: Phaser.GameObjects.Graphics
  private readonly dynamic: Phaser.GameObjects.Container
  private readonly skipButton: PixelButton
  private deviceClass: DeviceClass = 'wide'
  private viewportWidth = 1280
  private viewportHeight = 720
  private safeInsets: SafeInsets = NO_INSETS
  private currentKey: string | null = null

  constructor(scene: Phaser.Scene, callbacks: FlowPresentationCallbacks) {
    super(scene)
    this.backdrop = scene.add.graphics()
    this.frame = scene.add.graphics()
    this.dynamic = scene.add.container()
    this.skipButton = new PixelButton(scene, {
      label: '結果を送る ▶▶',
      width: 154,
      height: 44,
      variant: 'quiet',
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onSkip,
    })
    this.add([this.backdrop, this.frame, this.dynamic, this.skipButton])
    this.setDepth(1050)
    this.setVisible(false)
    scene.add.existing(this)
    this.backdrop.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData,
      ) => event.stopPropagation(),
    )
  }

  setViewport(width: number, height: number, deviceClass: DeviceClass): void {
    this.viewportWidth = width
    this.viewportHeight = height
    this.deviceClass = deviceClass
    this.safeInsets = logicalSafeInsetsForCanvas(this.scene.game.canvas, width, height)
    this.currentKey = null
    this.backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains,
    )
  }

  update(
    model: FlowPresentationModel | null,
    index: number,
    total: number,
    reduced: boolean,
  ): void {
    if (!model) {
      this.hide()
      return
    }
    const key = `${index}:${model.title}:${model.summary}`
    if (this.visible && this.currentKey === key) return
    this.currentKey = key
    this.safeInsets = logicalSafeInsetsForCanvas(
      this.scene.game.canvas,
      this.viewportWidth,
      this.viewportHeight,
    )
    this.render(model, index, total, reduced)
  }

  hide(): void {
    this.currentKey = null
    this.scene.tweens.killTweensOf(this.dynamic)
    this.setVisible(false)
  }

  private render(
    model: FlowPresentationModel,
    index: number,
    total: number,
    reduced: boolean,
  ): void {
    this.scene.tweens.killTweensOf(this.dynamic)
    this.dynamic.removeAll(true)
    const accent = flowAccent(model.tone)
    const panel = this.panelRect(model.importance)
    this.redrawFrame(panel, accent, model.importance)
    if (model.importance === 'minor') this.renderMinor(model, panel)
    else if (this.deviceClass === 'wide') this.renderWide(model, panel)
    else this.renderNarrow(model, panel)

    const wide = this.deviceClass === 'wide'
    this.skipButton.setLabel('結果を送る ▶▶')
    this.skipButton.setPosition(panel.x + panel.width - (wide ? 94 : 82), panel.y + 30)
    this.skipButton.setSize(wide ? 154 : 132, 44)
    this.skipButton.setVisible(model.importance !== 'minor')

    const progress = pixelText(this.scene, `RESULT ${index + 1} / ${total}`, {
      fontSize: wide ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
    })
    progress.setPosition(
      panel.x + panel.width - (wide ? (model.importance === 'minor' ? 18 : 174) : 16),
      panel.y + (model.importance === 'minor' ? 12 : 58),
    )
    progress.setOrigin(1, 0)
    this.dynamic.add(progress)

    this.setVisible(true)
    if (reduced) {
      this.dynamic.setAlpha(1)
      this.dynamic.setX(0)
      return
    }
    this.dynamic.setAlpha(0)
    this.dynamic.setX(-22)
    this.scene.tweens.add({
      targets: this.dynamic,
      x: 0,
      alpha: 1,
      duration: 220,
      ease: 'Cubic.Out',
    })
  }

  private renderWide(model: FlowPresentationModel, panel: Phaser.Geom.Rectangle): void {
    const major = model.importance === 'major'
    const portraitWidth = model.primaryActor ? (major ? 176 : 138) : 0
    const portraitX = panel.x + 18
    const portraitY = major ? panel.y + 18 : panel.y - 46
    if (model.primaryActor) {
      const portraitHeight = major ? 226 : 190
      this.drawPortraitFrame(
        portraitX,
        portraitY,
        portraitWidth,
        portraitHeight,
        flowAccent(model.tone),
      )
      drawArtSlot(
        this.scene,
        this.dynamic,
        'portrait',
        model.primaryActor.portrait,
        portraitX + portraitWidth / 2,
        portraitY + portraitHeight / 2,
        {
          width: portraitWidth - 14,
          height: portraitHeight - 14,
          glyphSize: major ? 66 : 48,
          fallbackGlyph: '人',
        },
      )
    }

    const textX = panel.x + (model.primaryActor ? (major ? 222 : 178) : 28)
    const textWidth = panel.x + panel.width - 206 - textX
    if (major) this.drawImportanceLabel(textX, panel.y + 18, '重大な変化')
    this.drawHeading(model, textX, panel.y + (major ? 46 : 22), textWidth, false)
    this.drawDeltas(
      model,
      textX,
      panel.y + (major ? 154 : 116),
      panel.x + panel.width - 24 - textX,
      6,
    )
  }

  private renderNarrow(model: FlowPresentationModel, panel: Phaser.Geom.Rectangle): void {
    const major = model.importance === 'major'
    const hasActor = model.primaryActor !== null
    if (model.primaryActor) {
      const portraitX = panel.x + 14
      const portraitY = panel.y + (major ? 38 : 14)
      const portraitW = major ? 110 : 86
      const portraitH = major ? 150 : 118
      this.drawPortraitFrame(portraitX, portraitY, portraitW, portraitH, flowAccent(model.tone))
      drawArtSlot(
        this.scene,
        this.dynamic,
        'portrait',
        model.primaryActor.portrait,
        portraitX + portraitW / 2,
        portraitY + portraitH / 2,
        {
          width: portraitW - 10,
          height: portraitH - 10,
          glyphSize: major ? 44 : 34,
          fallbackGlyph: '人',
        },
      )
    }
    const textX = panel.x + (hasActor ? (major ? 140 : 112) : 16)
    const textRight = panel.x + panel.width - 158
    const textWidth = Math.max(104, textRight - textX)
    if (major) this.drawImportanceLabel(textX, panel.y + 18, '重大な変化')
    this.drawHeading(model, textX, panel.y + (major ? 46 : 16), textWidth, true)
    this.drawDeltas(model, panel.x + 14, panel.y + (major ? 208 : 142), panel.width - 28, 3)
  }

  private renderMinor(model: FlowPresentationModel, panel: Phaser.Geom.Rectangle): void {
    const wide = this.deviceClass === 'wide'
    const title = pixelText(this.scene, model.title, {
      fontSize: wide ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
      color: COLORS.ink,
    })
    title.setPosition(panel.x + 16, panel.y + 14)
    this.dynamic.add(title)
    const summary = pixelText(this.scene, model.summary, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
      wordWrapWidth: wide ? panel.width * 0.42 : panel.width - 32,
    })
    summary.setPosition(panel.x + 16, panel.y + 42)
    this.dynamic.add(summary)
    const deltaX = wide ? panel.x + panel.width * 0.48 : panel.x + 14
    const deltaY = wide ? panel.y + 30 : panel.y + 72
    this.drawDeltas(model, deltaX, deltaY, panel.x + panel.width - 16 - deltaX, wide ? 5 : 3)
  }

  private drawImportanceLabel(x: number, y: number, label: string): void {
    const text = pixelText(this.scene, label, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.gold,
      backgroundColor: '#31260f',
    })
    text.setPadding(6, 3, 6, 3)
    text.setPosition(x, y)
    this.dynamic.add(text)
  }

  private drawHeading(
    model: FlowPresentationModel,
    x: number,
    y: number,
    width: number,
    compact: boolean,
  ): void {
    const kicker = pixelText(this.scene, model.kicker, {
      fontSize: compact ? TEXT_SIZE.labelNarrow : TEXT_SIZE.labelWide,
      color: flowAccent(model.tone),
      wordWrapWidth: width,
    })
    kicker.setPosition(x, y)
    this.dynamic.add(kicker)

    const title = pixelText(this.scene, model.title, {
      fontSize: compact ? TEXT_SIZE.heading : 28,
      color: COLORS.ink,
      wordWrapWidth: width,
    })
    title.setPosition(x, y + 24)
    this.dynamic.add(title)

    const summary = pixelText(this.scene, model.summary, {
      fontSize: compact ? TEXT_SIZE.labelNarrow : TEXT_SIZE.bodyWide,
      color: COLORS.inkDim,
      wordWrapWidth: width,
    })
    summary.setPosition(x, y + (compact ? 58 : 64))
    this.dynamic.add(summary)
  }

  private drawDeltas(
    model: FlowPresentationModel,
    x: number,
    y: number,
    width: number,
    columns: number,
  ): void {
    if (model.deltas.length === 0) return
    const gap = 6
    const count = Math.min(columns, model.deltas.length)
    const cardWidth = (width - gap * (count - 1)) / count
    const cardHeight = 42
    model.deltas.forEach((delta, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const dx = x + column * (cardWidth + gap)
      const dy = y + row * (cardHeight + gap)
      const color = flowAccent(delta.tone)
      const g = this.scene.add.graphics()
      g.fillStyle(COLORS.night800, 0.96)
      g.fillRect(dx, dy, cardWidth, cardHeight)
      g.lineStyle(2, color)
      g.strokeRect(dx + 1, dy + 1, cardWidth - 2, cardHeight - 2)
      this.dynamic.add(g)

      const label = pixelText(this.scene, delta.label, {
        fontSize: TEXT_SIZE.labelNarrow,
        color: COLORS.inkDim,
      })
      label.setPosition(dx + 8, dy + 6)
      this.dynamic.add(label)

      const value = pixelText(this.scene, `${delta.delta >= 0 ? '+' : ''}${delta.delta}`, {
        fontSize: TEXT_SIZE.bodyWide,
        color,
      })
      value.setPosition(dx + cardWidth - 8, dy + 19)
      value.setOrigin(1, 0)
      this.dynamic.add(value)
    })
  }

  private drawPortraitFrame(
    x: number,
    y: number,
    width: number,
    height: number,
    accent: number,
  ): void {
    const g = this.scene.add.graphics()
    g.fillStyle(0x000000, 0.5)
    g.fillRect(x + 6, y + 6, width, height)
    g.fillStyle(COLORS.night900)
    g.fillRect(x, y, width, height)
    g.lineStyle(3, accent)
    g.strokeRect(x + 1, y + 1, width - 2, height - 2)
    g.lineStyle(1, COLORS.frameHi)
    g.strokeRect(x + 6, y + 6, width - 12, height - 12)
    this.dynamic.add(g)
  }

  private redrawFrame(
    panel: Phaser.Geom.Rectangle,
    accent: number,
    importance: BeatImportance,
  ): void {
    this.backdrop.clear()
    this.backdrop.fillStyle(
      COLORS.night900,
      importance === 'major' ? 0.36 : importance === 'minor' ? 0 : 0.14,
    )
    this.backdrop.fillRect(0, 0, this.viewportWidth, this.viewportHeight)

    this.frame.clear()
    this.frame.fillStyle(0x000000, 0.55)
    this.frame.fillRect(panel.x + 7, panel.y + 7, panel.width, panel.height)
    this.frame.fillStyle(COLORS.night900, 0.97)
    this.frame.fillRect(panel.x, panel.y, panel.width, panel.height)
    this.frame.lineStyle(
      importance === 'major' ? 4 : 3,
      importance === 'major' ? accent : COLORS.frameHi,
    )
    this.frame.strokeRect(panel.x + 1, panel.y + 1, panel.width - 2, panel.height - 2)
    this.frame.lineStyle(2, COLORS.frameLo)
    this.frame.strokeRect(panel.x + 6, panel.y + 6, panel.width - 12, panel.height - 12)
    this.frame.fillStyle(accent)
    this.frame.fillRect(panel.x + 8, panel.y + 8, panel.width - 16, 5)
  }

  private panelRect(importance: BeatImportance): Phaser.Geom.Rectangle {
    const safe = this.safeInsets
    const innerWidth = this.viewportWidth - safe.left - safe.right
    if (this.deviceClass === 'wide') {
      const height = importance === 'minor' ? 104 : importance === 'major' ? 268 : 166
      return new Phaser.Geom.Rectangle(
        safe.left + 34,
        this.viewportHeight - safe.bottom - height - 22,
        innerWidth - 68,
        height,
      )
    }
    const height = importance === 'minor' ? 142 : importance === 'major' ? 338 : 250
    return new Phaser.Geom.Rectangle(
      safe.left + 8,
      this.viewportHeight - safe.bottom - height - 10,
      innerWidth - 16,
      height,
    )
  }
}
