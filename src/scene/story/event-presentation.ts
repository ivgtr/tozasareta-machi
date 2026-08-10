import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import type { Beat } from '../playback/beats'
import { formatDelta } from '../labels'
import { COLORS, SPACING, TEXT_SIZE } from '../tokens'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { PresentationSurface } from './presentation-surface'
import { deriveStoryPresentation, type StoryPresentationModel } from './story-metadata'

export interface EventPresentationCallbacks {
  onConfirm: () => void
}

export class EventPresentation extends PresentationSurface {
  private readonly callbacks: EventPresentationCallbacks

  constructor(scene: Phaser.Scene, callbacks: EventPresentationCallbacks) {
    super(scene)
    this.callbacks = callbacks
  }

  show(state: GameState, beat: Extract<Beat, { kind: 'event' }>): void {
    const model = deriveStoryPresentation(beat.id, state)
    if (!model) {
      this.hide()
      return
    }
    const event = model.event
    const accent =
      event?.tone === 'threat' ? COLORS.red : event?.tone === 'boon' ? COLORS.green : COLORS.cyan
    this.begin(accent)
    this.renderEvent(model, beat, accent)
    this.addConfirm()
  }

  private renderEvent(
    model: StoryPresentationModel,
    beat: Extract<Beat, { kind: 'event' }>,
    accent: number,
  ): void {
    const p = this.panel
    const wide = this.deviceClass === 'wide'
    const pad = wide ? 28 : 18
    const contentX = p.x + pad
    const contentW = p.width - pad * 2
    const kicker = pixelText(this.scene, this.eventKicker(model), {
      fontSize: wide ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
      color: accent,
      wordWrapWidth: contentW,
    })
    kicker.setPosition(contentX, p.y + pad)
    this.content.add(kicker)
    const title = pixelText(this.scene, model.event.name, {
      fontSize: wide ? 28 : TEXT_SIZE.heading,
      color: COLORS.gold,
      wordWrapWidth: contentW,
    })
    title.setPosition(contentX, p.y + pad + 26)
    this.content.add(title)

    const artX = contentX
    const artY = p.y + (wide ? 100 : 88)
    const artW = wide ? 656 : contentW
    const artH = wide ? 416 : 270
    this.drawArtFrame(artX, artY, artW, artH, accent)
    drawArtSlot(this.scene, this.content, 'event', beat.id, artX + artW / 2, artY + artH / 2, {
      width: artW - 16,
      height: artH - 16,
      glyphSize: wide ? 112 : 72,
      fallbackGlyph: '！',
    })

    const textX = wide ? artX + artW + 28 : contentX
    const textW = wide ? p.x + p.width - pad - textX : contentW
    let y = wide ? artY : artY + artH + 18
    if (model.speaker) y = this.renderReporter(model.speaker, textX, y, textW, accent)
    if (model.event.desc) {
      const desc = pixelText(this.scene, model.event.desc, {
        fontSize: wide ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
        color: COLORS.inkDim,
        wordWrapWidth: textW,
        advancedWrap: true,
      })
      desc.setPosition(textX, y)
      this.content.add(desc)
      y += desc.height + 18
    }
    this.renderEffects(beat, textX, y, textW)
  }

  private eventKicker(model: StoryPresentationModel): string {
    if (model.speaker) return '現地からの報告'
    return model.event.tone === 'threat' ? '現地からの緊急報告' : '町の状況記録'
  }

  private renderReporter(
    speaker: NonNullable<StoryPresentationModel['speaker']>,
    x: number,
    y: number,
    width: number,
    accent: number,
  ): number {
    const wide = this.deviceClass === 'wide'
    const frameSize = wide ? 112 : 84
    this.drawArtFrame(x, y, frameSize, frameSize, accent)
    drawArtSlot(
      this.scene,
      this.content,
      'portrait',
      speaker.portrait,
      x + frameSize / 2,
      y + frameSize / 2,
      {
        width: frameSize - 16,
        height: frameSize - 16,
        glyphSize: wide ? 42 : 34,
        fallbackGlyph: '人',
      },
    )
    const labelX = x + frameSize + 16
    const labelW = width - frameSize - 16
    const label = pixelText(this.scene, '報告者', {
      fontSize: wide ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
      color: accent,
    })
    label.setPosition(labelX, y + (wide ? 18 : 10))
    const name = pixelText(this.scene, speaker.name, {
      fontSize: wide ? TEXT_SIZE.heading : TEXT_SIZE.bodyWide,
      color: COLORS.ink,
      wordWrapWidth: labelW,
    })
    name.setPosition(labelX, y + (wide ? 48 : 36))
    this.content.add([label, name])
    return y + frameSize + 20
  }

  private renderEffects(
    beat: Extract<Beat, { kind: 'event' }>,
    textX: number,
    startY: number,
    textW: number,
  ): void {
    let y = startY
    const numeric = beat.effects.filter((effect) => effect.delta !== 0)
    if (numeric.length > 0) {
      let chipX = textX
      let chipY = y
      for (const effect of numeric) {
        const chip = pixelText(this.scene, formatDelta(effect.target, effect.delta), {
          fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.bodyWide : TEXT_SIZE.labelWide,
          color: effect.delta >= 0 ? COLORS.green : COLORS.red,
          backgroundColor: '#131740',
        })
        chip.setPadding(7, 5, 7, 5)
        if (chipX + chip.width > textX + textW) {
          chipX = textX
          chipY += 34
        }
        chip.setPosition(chipX, chipY)
        this.content.add(chip)
        chipX += chip.width + 8
      }
      y = chipY + 44
    }

    for (const effect of beat.effects.slice(0, 4)) {
      const reason = pixelText(this.scene, `・${effect.reason}`, {
        fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
        color: COLORS.ink,
        wordWrapWidth: textW,
        advancedWrap: true,
      })
      reason.setPosition(textX, y)
      this.content.add(reason)
      y += reason.height + SPACING.sm
    }
  }

  private addConfirm(): void {
    const p = this.panel
    const pad = this.deviceClass === 'wide' ? 28 : 18
    const confirm = new PixelButton(this.scene, {
      label: '続ける ▶',
      width: this.deviceClass === 'wide' ? 176 : 150,
      height: 46,
      variant: 'primary',
      onAction: this.callbacks.onConfirm,
    })
    confirm.setPosition(
      p.x + p.width - pad - confirm.buttonWidth / 2,
      p.y + p.height - pad - confirm.buttonHeight / 2,
    )
    this.content.add(confirm)
  }
}
