import Phaser from 'phaser'
import type { StoryMilestoneView } from './milestone-model'
import { COLORS, TEXT_SIZE } from '../tokens'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { PresentationSurface } from './presentation-surface'

export interface MilestonePresentationCallbacks {
  onConfirm: () => void
}

export class MilestonePresentation extends PresentationSurface {
  private readonly callbacks: MilestonePresentationCallbacks

  constructor(scene: Phaser.Scene, callbacks: MilestonePresentationCallbacks) {
    super(scene)
    this.callbacks = callbacks
  }

  show(view: StoryMilestoneView): void {
    this.begin(COLORS.cyan)
    if (this.deviceClass === 'wide') this.renderWide(view)
    else this.renderNarrow(view)
    this.addConfirm(view)
  }

  private renderWide(view: StoryMilestoneView): void {
    const p = this.panel
    const pad = 28
    const artW = Math.min(430, Math.floor(p.width * 0.4))
    const artH = Math.min(430, p.height - 132)
    const artX = p.x + pad
    const artY = p.y + 62
    this.drawArtFrame(artX, artY, artW, artH, COLORS.cyan)
    drawArtSlot(
      this.scene,
      this.content,
      view.page.art.kind,
      view.page.art.id,
      artX + artW / 2,
      artY + artH / 2,
      {
        width: artW - 18,
        height: artH - 18,
        glyphSize: 92,
        fallbackGlyph: view.page.art.fallbackGlyph,
      },
    )

    const textX = artX + artW + 38
    const textW = p.x + p.width - pad - textX
    this.renderText(view, textX, artY, textW, true)
  }

  private renderNarrow(view: StoryMilestoneView): void {
    const p = this.panel
    const pad = 18
    const artX = p.x + pad
    const artY = p.y + 58
    const artW = p.width - pad * 2
    const artH = Math.min(230, Math.floor(p.height * 0.3))
    this.drawArtFrame(artX, artY, artW, artH, COLORS.cyan)
    drawArtSlot(
      this.scene,
      this.content,
      view.page.art.kind,
      view.page.art.id,
      artX + artW / 2,
      artY + artH / 2,
      {
        width: artW - 16,
        height: artH - 16,
        glyphSize: 62,
        fallbackGlyph: view.page.art.fallbackGlyph,
      },
    )

    this.renderText(view, artX, artY + artH + 18, artW, false)
  }

  private renderText(
    view: StoryMilestoneView,
    x: number,
    y: number,
    width: number,
    wide: boolean,
  ): void {
    const pageCounter = pixelText(this.scene, `${view.pageNumber} / ${view.pageCount}`, {
      fontSize: wide ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
    })
    pageCounter.setOrigin(1, 0)
    pageCounter.setPosition(x + width, y)

    const kicker = pixelText(this.scene, view.page.kicker, {
      fontSize: wide ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
      color: COLORS.cyan,
      wordWrapWidth: Math.max(120, width - 70),
    })
    kicker.setPosition(x, y)

    const title = pixelText(this.scene, view.page.title, {
      fontSize: wide ? 30 : TEXT_SIZE.heading,
      color: COLORS.gold,
      wordWrapWidth: width,
      advancedWrap: true,
    })
    title.setPosition(x, y + 32)

    let bodyY = y + 86
    if (view.page.speaker) {
      const speaker = pixelText(
        this.scene,
        `${view.page.speaker.name}  /  ${view.page.speaker.role}`,
        {
          fontSize: wide ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
          color: COLORS.amber,
          wordWrapWidth: width,
        },
      )
      speaker.setPosition(x, bodyY)
      this.content.add(speaker)
      bodyY += 30
    }

    const body = pixelText(this.scene, view.page.body, {
      fontSize: wide ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
      color: COLORS.ink,
      wordWrapWidth: width,
      advancedWrap: true,
    })
    body.setPosition(x, bodyY)

    this.content.add([pageCounter, kicker, title, body])

    if (view.page.ruleNote) {
      const rule = pixelText(this.scene, view.page.ruleNote, {
        fontSize: wide ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
        color: COLORS.inkDim,
        backgroundColor: '#131740',
        wordWrapWidth: width - 20,
        advancedWrap: true,
      })
      rule.setPadding(10, 8, 10, 8)
      rule.setPosition(x, bodyY + body.height + 18)
      this.content.add(rule)
    }
  }

  private addConfirm(view: StoryMilestoneView): void {
    const p = this.panel
    const pad = this.deviceClass === 'wide' ? 28 : 18
    const confirm = new PixelButton(this.scene, {
      label: view.isLast ? 'DAY 1へ ▶' : '次へ ▶',
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
