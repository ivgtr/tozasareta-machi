import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import { COLORS, FONT_DISPLAY, TEXT_SIZE } from '../tokens'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { deriveEndingPresentation, type EndingPresentationModel } from './ending-model'
import { PresentationSurface } from './presentation-surface'

export interface EndingPresentationCallbacks {
  onRestart: () => void
  onTitle: () => void
}

export class EndingPresentation extends PresentationSurface {
  private readonly callbacks: EndingPresentationCallbacks

  constructor(scene: Phaser.Scene, callbacks: EndingPresentationCallbacks) {
    super(scene)
    this.callbacks = callbacks
  }

  show(state: GameState): void {
    const model = deriveEndingPresentation(state)
    if (!model) {
      this.hide()
      return
    }
    this.begin(model.accent)
    if (this.deviceClass === 'wide') this.renderWide(model)
    else this.renderNarrow(model)
  }

  private renderWide(model: EndingPresentationModel): void {
    const p = this.panel
    const pad = 30
    const kicker = pixelText(this.scene, model.eyebrow, {
      fontSize: TEXT_SIZE.labelWide,
      color: model.accent,
      trackingEm: 0.08,
    })
    kicker.setPosition(p.x + pad, p.y + 30)
    const title = pixelText(this.scene, model.title, {
      fontSize: 30,
      color: COLORS.gold,
    })
    title.setPosition(p.x + pad, p.y + 58)
    this.content.add([kicker, title])

    const artX = p.x + pad
    const artY = p.y + 118
    const artW = Math.floor(p.width * 0.55)
    const artH = p.height - 200
    this.drawArtFrame(artX, artY, artW, artH, model.accent)
    drawArtSlot(
      this.scene,
      this.content,
      'ending',
      model.ending,
      artX + artW / 2,
      artY + artH / 2,
      {
        width: artW - 16,
        height: artH - 16,
        glyphSize: 96,
        fallbackGlyph: '了',
      },
    )

    const columnX = artX + artW + 30
    const columnW = p.x + p.width - pad - columnX
    const dayLabel = pixelText(this.scene, 'SURVIVAL RECORD', {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
      trackingEm: 0.08,
    })
    dayLabel.setPosition(columnX, artY)
    const day = pixelText(this.scene, `DAY ${model.reachedDay}`, {
      fontFamily: FONT_DISPLAY,
      fontSize: 28,
      color: model.accent,
    })
    day.setPosition(columnX, artY + 26)
    const witnessW = model.witness ? 112 : 0
    if (model.witness) {
      this.drawArtFrame(columnX, artY + 70, witnessW, 146, model.accent)
      drawArtSlot(
        this.scene,
        this.content,
        'portrait',
        model.witness.portrait,
        columnX + witnessW / 2,
        artY + 143,
        { width: witnessW - 12, height: 134, glyphSize: 44, fallbackGlyph: '人' },
      )
    }
    const flavor = pixelText(this.scene, model.flavor, {
      fontSize: TEXT_SIZE.bodyWide,
      color: COLORS.ink,
      wordWrapWidth: columnW - witnessW - (model.witness ? 16 : 0),
    })
    flavor.setPosition(columnX + witnessW + (model.witness ? 16 : 0), artY + 78)
    this.content.add([dayLabel, day, flavor])

    const resourceY = artY + 234
    model.resources.forEach((metric, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const gap = 10
      const cardW = (columnW - gap) / 2
      this.addMetricCard(
        columnX + col * (cardW + gap),
        resourceY + row * 66,
        cardW,
        56,
        metric.label,
        metric.value,
        model.accent,
      )
    })

    this.addRecordGrid(columnX, resourceY + 142, columnW, model)
    this.addActions(p.x + p.width - pad, p.y + p.height - 34, false)
  }

  private renderNarrow(model: EndingPresentationModel): void {
    const p = this.panel
    const pad = 18
    const contentW = p.width - pad * 2
    const kicker = pixelText(this.scene, model.eyebrow, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: model.accent,
    })
    kicker.setPosition(p.x + pad, p.y + 26)
    const title = pixelText(this.scene, model.title, {
      fontSize: 23,
      color: COLORS.gold,
    })
    title.setPosition(p.x + pad, p.y + 52)
    this.content.add([kicker, title])

    const artX = p.x + pad
    const artY = p.y + 94
    const artH = 214
    this.drawArtFrame(artX, artY, contentW, artH, model.accent)
    drawArtSlot(
      this.scene,
      this.content,
      'ending',
      model.ending,
      artX + contentW / 2,
      artY + artH / 2,
      {
        width: contentW - 14,
        height: artH - 14,
        glyphSize: 72,
        fallbackGlyph: '了',
      },
    )
    if (model.witness) {
      const portraitW = 98
      const portraitH = 132
      const portraitX = artX + 14
      const portraitY = artY + artH - portraitH - 14
      this.drawArtFrame(portraitX, portraitY, portraitW, portraitH, model.accent)
      drawArtSlot(
        this.scene,
        this.content,
        'portrait',
        model.witness.portrait,
        portraitX + portraitW / 2,
        portraitY + portraitH / 2,
        { width: portraitW - 10, height: portraitH - 10, glyphSize: 38, fallbackGlyph: '人' },
      )
    }

    const day = pixelText(this.scene, `DAY ${model.reachedDay}`, {
      fontFamily: FONT_DISPLAY,
      fontSize: 21,
      color: model.accent,
    })
    day.setPosition(p.x + pad, artY + artH + 18)
    const flavor = pixelText(this.scene, model.flavor, {
      fontSize: TEXT_SIZE.bodyNarrow,
      color: COLORS.ink,
      wordWrapWidth: contentW,
    })
    flavor.setPosition(p.x + pad, artY + artH + 52)
    this.content.add([day, flavor])

    const resourceY = artY + artH + 118
    model.resources.forEach((metric, index) => {
      const gap = 8
      const cardW = (contentW - gap * 3) / 4
      this.addMetricCard(
        artX + index * (cardW + gap),
        resourceY,
        cardW,
        54,
        metric.label,
        metric.value,
        model.accent,
      )
    })
    this.addRecordGrid(artX, resourceY + 70, contentW, model)
    this.addActions(p.x + p.width - pad, p.y + p.height - 32, true)
  }

  private addMetricCard(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: number,
    accent: number,
  ): void {
    const g = this.scene.add.graphics()
    g.fillStyle(COLORS.night800, 0.92)
    g.fillRect(x, y, width, height)
    g.lineStyle(1, COLORS.frameLo, 0.9)
    g.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1)
    g.fillStyle(accent, 0.9)
    g.fillRect(x, y, 3, height)
    const labelText = pixelText(this.scene, label, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
    })
    labelText.setPosition(x + 10, y + 7)
    const valueText = pixelText(this.scene, String(value), {
      fontFamily: FONT_DISPLAY,
      fontSize: 16,
      color: COLORS.ink,
    })
    valueText.setPosition(x + 10, y + 27)
    this.content.add([g, labelText, valueText])
  }

  private addRecordGrid(x: number, y: number, width: number, model: EndingPresentationModel): void {
    const title = pixelText(this.scene, '30日間の記録', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.gold,
    })
    title.setPosition(x, y)
    this.content.add(title)
    const columns = this.deviceClass === 'wide' ? 3 : 2
    const cellW = width / columns
    model.records.forEach((record, index) => {
      const col = index % columns
      const row = Math.floor(index / columns)
      const label = pixelText(this.scene, record.label, {
        fontSize: TEXT_SIZE.labelNarrow,
        color: COLORS.inkDim,
      })
      label.setPosition(x + col * cellW, y + 28 + row * 42)
      const value = pixelText(this.scene, String(record.value), {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.ink,
      })
      value.setPosition(x + col * cellW, y + 46 + row * 42)
      this.content.add([label, value])
    })
  }

  private addActions(right: number, y: number, narrow: boolean): void {
    const restart = new PixelButton(this.scene, {
      label: 'もう一度',
      width: narrow ? 156 : 150,
      height: 46,
      variant: 'primary',
      onAction: this.callbacks.onRestart,
    })
    const title = new PixelButton(this.scene, {
      label: 'タイトルへ',
      width: narrow ? 156 : 150,
      height: 46,
      variant: 'quiet',
      onAction: this.callbacks.onTitle,
    })
    restart.setPosition(right - restart.buttonWidth / 2, y)
    title.setPosition(right - restart.buttonWidth - 12 - title.buttonWidth / 2, y)
    this.content.add([restart, title])
  }
}
