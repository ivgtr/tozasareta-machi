import Phaser from 'phaser'
import { findEvent } from '../../game/events'
import type { Beat } from '../playback/beats'
import { formatDelta } from '../labels'
import { COLORS, SPACING, TEXT_SIZE } from '../tokens'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { PresentationSurface } from './presentation-surface'

export interface EventPresentationCallbacks {
  onConfirm: () => void
}

export class EventPresentation extends PresentationSurface {
  private readonly callbacks: EventPresentationCallbacks

  constructor(scene: Phaser.Scene, callbacks: EventPresentationCallbacks) {
    super(scene)
    this.callbacks = callbacks
  }

  show(beat: Extract<Beat, { kind: 'event' }>): void {
    const event = findEvent(beat.id)
    const accent =
      event?.tone === 'threat' ? COLORS.red : event?.tone === 'boon' ? COLORS.green : COLORS.cyan
    this.begin(accent)
    const p = this.panel
    const pad = this.deviceClass === 'wide' ? 28 : 18
    const artW =
      this.deviceClass === 'wide' ? Math.min(480, Math.floor(p.width * 0.44)) : p.width - pad * 2
    const artH =
      this.deviceClass === 'wide'
        ? Math.min(304, p.height - 160)
        : Math.min(212, Math.floor(p.height * 0.28))
    const artX = p.x + pad
    const artY = p.y + pad + 18
    this.drawArtFrame(artX, artY, artW, artH, accent)
    drawArtSlot(this.scene, this.content, 'event', beat.id, artX + artW / 2, artY + artH / 2, {
      width: artW - 16,
      height: artH - 16,
      glyphSize: this.deviceClass === 'wide' ? 84 : 56,
      fallbackGlyph: '！',
    })

    const textX = this.deviceClass === 'wide' ? artX + artW + 32 : p.x + pad
    const textY = this.deviceClass === 'wide' ? artY : artY + artH + 18
    const textW = this.deviceClass === 'wide' ? p.x + p.width - pad - textX : p.width - pad * 2

    const kicker = pixelText(
      this.scene,
      event?.tone === 'threat' ? '緊急報告' : event?.tone === 'boon' ? '町からの報告' : '状況報告',
      {
        fontSize: TEXT_SIZE.labelWide,
        color: accent,
      },
    )
    kicker.setPosition(textX, textY)
    this.content.add(kicker)

    const title = pixelText(this.scene, event?.name ?? beat.id, {
      fontSize: this.deviceClass === 'wide' ? 28 : TEXT_SIZE.heading,
      color: COLORS.gold,
      wordWrapWidth: textW,
    })
    title.setPosition(textX, textY + 28)
    this.content.add(title)

    let y = textY + 74
    if (event?.desc) {
      const desc = pixelText(this.scene, event.desc, {
        fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
        color: COLORS.inkDim,
        wordWrapWidth: textW,
      })
      desc.setPosition(textX, y)
      this.content.add(desc)
      y += desc.height + 18
    }

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
