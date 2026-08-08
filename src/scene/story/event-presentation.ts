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
    if (model.speaker) this.renderCharacter(model, beat, accent)
    else this.renderIncident(model, beat, accent)
    this.addConfirm()
  }

  private renderCharacter(
    model: StoryPresentationModel,
    beat: Extract<Beat, { kind: 'event' }>,
    accent: number,
  ): void {
    const p = this.panel
    const pad = this.deviceClass === 'wide' ? 28 : 18
    const wide = this.deviceClass === 'wide'
    const portraitW = wide ? 286 : 150
    const portraitH = wide ? Math.min(410, p.height - 116) : 200
    const portraitX = p.x + pad
    const portraitY = p.y + (wide ? 62 : 70)
    this.drawArtFrame(portraitX, portraitY, portraitW, portraitH, accent)
    drawArtSlot(
      this.scene,
      this.content,
      'portrait',
      model.speaker!.portrait,
      portraitX + portraitW / 2,
      portraitY + portraitH / 2,
      {
        width: portraitW - 16,
        height: portraitH - 16,
        glyphSize: wide ? 92 : 58,
        fallbackGlyph: '人',
      },
    )
    const textX = wide ? portraitX + portraitW + 36 : portraitX + portraitW + 18
    const textY = portraitY
    const textW = p.x + p.width - pad - textX
    const kicker = pixelText(this.scene, `${model.speaker!.name}からの報告`, {
      fontSize: wide ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
      color: accent,
      wordWrapWidth: textW,
    })
    kicker.setPosition(textX, textY)
    this.content.add(kicker)
    const title = pixelText(this.scene, model.event.name, {
      fontSize: wide ? 28 : TEXT_SIZE.heading,
      color: COLORS.gold,
      wordWrapWidth: textW,
    })
    title.setPosition(textX, textY + 28)
    this.content.add(title)
    let y = textY + 74
    if (model.event.desc) {
      const desc = pixelText(this.scene, `「${model.event.desc}」`, {
        fontSize: wide ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
        color: COLORS.ink,
        wordWrapWidth: textW,
      })
      desc.setPosition(textX, y)
      this.content.add(desc)
      y += desc.height + 18
    }
    const artW = wide ? Math.min(190, textW * 0.42) : Math.min(112, textW)
    const artH = wide ? 112 : 78
    this.drawArtFrame(textX, y, artW, artH, accent)
    drawArtSlot(this.scene, this.content, 'event', beat.id, textX + artW / 2, y + artH / 2, {
      width: artW - 12,
      height: artH - 12,
      glyphSize: wide ? 42 : 30,
      fallbackGlyph: '！',
    })
    this.renderEffects(
      beat,
      textX + (wide ? artW + 18 : 0),
      wide ? y : y + artH + 12,
      wide ? textW - artW - 18 : textW,
    )
  }

  private renderIncident(
    model: StoryPresentationModel,
    beat: Extract<Beat, { kind: 'event' }>,
    accent: number,
  ): void {
    const p = this.panel
    const pad = this.deviceClass === 'wide' ? 28 : 18
    const wide = this.deviceClass === 'wide'
    const artW = wide ? Math.min(520, Math.floor(p.width * 0.47)) : p.width - pad * 2
    const artH = wide ? Math.min(340, p.height - 150) : Math.min(240, p.height * 0.32)
    const artX = p.x + pad
    const artY = p.y + pad + 18
    this.drawArtFrame(artX, artY, artW, artH, accent)
    drawArtSlot(this.scene, this.content, 'event', beat.id, artX + artW / 2, artY + artH / 2, {
      width: artW - 16,
      height: artH - 16,
      glyphSize: wide ? 92 : 62,
      fallbackGlyph: '！',
    })
    const textX = wide ? artX + artW + 32 : p.x + pad
    const textY = wide ? artY : artY + artH + 18
    const textW = wide ? p.x + p.width - pad - textX : p.width - pad * 2
    const kicker = pixelText(
      this.scene,
      model.spec.layout === 'incident' ? '現地からの緊急報告' : '町の状況記録',
      { fontSize: TEXT_SIZE.labelWide, color: accent },
    )
    kicker.setPosition(textX, textY)
    const title = pixelText(this.scene, model.event.name, {
      fontSize: wide ? 28 : TEXT_SIZE.heading,
      color: COLORS.gold,
      wordWrapWidth: textW,
    })
    title.setPosition(textX, textY + 28)
    this.content.add([kicker, title])
    let y = textY + 74
    if (model.event.desc) {
      const desc = pixelText(this.scene, model.event.desc, {
        fontSize: wide ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
        color: COLORS.inkDim,
        wordWrapWidth: textW,
      })
      desc.setPosition(textX, y)
      this.content.add(desc)
      y += desc.height + 18
    }
    this.renderEffects(beat, textX, y, textW)
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
