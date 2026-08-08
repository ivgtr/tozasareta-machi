import Phaser from 'phaser'
import type { DeathBeat } from '../playback/beats'
import { COLORS, TEXT_SIZE } from '../tokens'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { deriveDeathPresentation } from './death-model'
import { PresentationSurface } from './presentation-surface'

export interface DeathPresentationCallbacks {
  onConfirm: () => void
}

export class DeathPresentation extends PresentationSurface {
  private readonly callbacks: DeathPresentationCallbacks

  constructor(scene: Phaser.Scene, callbacks: DeathPresentationCallbacks) {
    super(scene)
    this.callbacks = callbacks
  }

  show(beat: DeathBeat): void {
    const model = deriveDeathPresentation(beat)
    this.begin(COLORS.red)

    if (this.deviceClass === 'wide') this.renderWide(model)
    else this.renderNarrow(model)

    const p = this.panel
    const pad = this.deviceClass === 'wide' ? 28 : 18
    const confirm = new PixelButton(this.scene, {
      label: '町へ戻る ▶',
      width: this.deviceClass === 'wide' ? 184 : 160,
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

  private renderWide(model: ReturnType<typeof deriveDeathPresentation>): void {
    const p = this.panel
    const pad = 30
    const portraitW = model.unit.unique ? 286 : 250
    const portraitH = model.unit.unique ? 382 : 334
    const portraitX = p.x + pad
    const portraitY = p.y + 70

    this.drawArtFrame(portraitX, portraitY, portraitW, portraitH, COLORS.red)
    drawArtSlot(
      this.scene,
      this.content,
      'portrait',
      model.unit.portrait,
      portraitX + portraitW / 2,
      portraitY + portraitH / 2,
      {
        width: portraitW - 16,
        height: portraitH - 16,
        glyphSize: 92,
        fallbackGlyph: '人',
      },
    )

    const textX = portraitX + portraitW + 42
    const textW = p.x + p.width - pad - textX
    this.addHeader(textX, p.y + 72, textW, model)

    const loss = pixelText(this.scene, '町は一人の仲間を失った。', {
      fontSize: TEXT_SIZE.heading,
      color: COLORS.red,
      wordWrapWidth: textW,
    })
    loss.setPosition(textX, p.y + 300)
    this.content.add(loss)
  }

  private renderNarrow(model: ReturnType<typeof deriveDeathPresentation>): void {
    const p = this.panel
    const pad = 18
    const portraitW = 150
    const portraitH = 200
    const portraitX = p.x + pad
    const portraitY = p.y + 72

    this.drawArtFrame(portraitX, portraitY, portraitW, portraitH, COLORS.red)
    drawArtSlot(
      this.scene,
      this.content,
      'portrait',
      model.unit.portrait,
      portraitX + portraitW / 2,
      portraitY + portraitH / 2,
      {
        width: portraitW - 12,
        height: portraitH - 12,
        glyphSize: 58,
        fallbackGlyph: '人',
      },
    )

    const textX = portraitX + portraitW + 18
    const textW = p.x + p.width - pad - textX
    this.addHeader(textX, p.y + 72, textW, model)

    const loss = pixelText(this.scene, '町は一人の仲間を失った。', {
      fontSize: TEXT_SIZE.bodyWide,
      color: COLORS.red,
      wordWrapWidth: p.width - pad * 2,
    })
    loss.setPosition(p.x + pad, p.y + 320)
    this.content.add(loss)
  }

  private addHeader(
    x: number,
    y: number,
    width: number,
    model: ReturnType<typeof deriveDeathPresentation>,
  ): void {
    const wide = this.deviceClass === 'wide'
    const kicker = pixelText(this.scene, '死亡報告', {
      fontSize: wide ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
      color: COLORS.red,
    })
    kicker.setPosition(x, y)

    const name = pixelText(this.scene, model.unit.name, {
      fontSize: wide ? 32 : TEXT_SIZE.heading,
      color: COLORS.ink,
      wordWrapWidth: width,
    })
    name.setPosition(x, y + 30)

    const alias = pixelText(this.scene, model.unit.alias ? `「${model.unit.alias}」` : '', {
      fontSize: wide ? TEXT_SIZE.bodyWide : TEXT_SIZE.labelNarrow,
      color: COLORS.gold,
      wordWrapWidth: width,
    })
    alias.setPosition(x, y + 70)

    const cause = pixelText(this.scene, `死因  ${model.causeLabel}`, {
      fontSize: wide ? TEXT_SIZE.bodyWide : TEXT_SIZE.labelWide,
      color: COLORS.red,
      wordWrapWidth: width,
    })
    cause.setPosition(x, y + (model.unit.alias ? 112 : 88))

    const reason = pixelText(this.scene, model.reason, {
      fontSize: wide ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
      color: COLORS.inkDim,
      wordWrapWidth: width,
      advancedWrap: true,
    })
    reason.setPosition(x, cause.y + 38)
    this.content.add([kicker, name, alias, cause, reason])
  }
}
