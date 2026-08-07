import Phaser from 'phaser'
import type { ChoiceOption, GameState } from '../../game/types'
import { choiceOptions, findEvent } from '../../game/events'
import { COLORS, TEXT_SIZE, colorCss } from '../tokens'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { PresentationSurface } from './presentation-surface'

class ChoiceCard extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    option: ChoiceOption,
    width: number,
    height: number,
    onChoose: () => void,
  ) {
    super(scene)
    const bg = scene.add.graphics()
    const title = pixelText(scene, option.label, {
      fontSize: TEXT_SIZE.bodyWide,
      color: COLORS.gold,
      wordWrapWidth: width - 42,
    })
    const desc = pixelText(scene, option.desc ?? 'この判断を選ぶ', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.inkDim,
      wordWrapWidth: width - 42,
    })
    title.setPosition(18, 13)
    desc.setPosition(18, Math.min(height - 30, 42))
    this.add([bg, title, desc])
    this.setSize(width, height)
    this.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains,
    )

    const redraw = (hovered: boolean): void => {
      bg.clear()
      bg.fillStyle(hovered ? COLORS.night600 : COLORS.night800)
      bg.fillRect(0, 0, width, height)
      bg.lineStyle(2, hovered ? COLORS.gold : COLORS.frameLo)
      bg.strokeRect(1, 1, width - 2, height - 2)
      bg.fillStyle(hovered ? COLORS.gold : COLORS.amber)
      bg.fillRect(0, 0, 6, height)
      title.setColor(colorCss(hovered ? COLORS.ink : COLORS.gold))
    }
    redraw(false)
    this.on('pointerover', () => redraw(true))
    this.on('pointerout', () => redraw(false))
    this.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData,
      ) => event.stopPropagation(),
    )
    this.on('pointerup', onChoose)
    scene.add.existing(this)
  }
}

export interface ChoicePresentationCallbacks {
  onChoose: (optionId: string) => void
}

export class ChoicePresentation extends PresentationSurface {
  private readonly callbacks: ChoicePresentationCallbacks
  private page = 0
  private eventId: string | null = null
  private currentState: GameState | null = null

  constructor(scene: Phaser.Scene, callbacks: ChoicePresentationCallbacks) {
    super(scene)
    this.callbacks = callbacks
  }

  show(state: GameState): void {
    this.currentState = state
    const pending = state.pendingChoice
    if (!pending) {
      this.hide()
      return
    }
    const event = findEvent(pending.eventId)
    if (!event) {
      this.hide()
      return
    }
    if (this.eventId !== event.id) {
      this.eventId = event.id
      this.page = 0
    }
    const options = choiceOptions(state, event).filter((option) => pending.optionIds.includes(option.id))
    this.render(state, options)
  }

  private render(state: GameState, options: ChoiceOption[]): void {
    const pending = state.pendingChoice
    if (!pending) return
    const event = findEvent(pending.eventId)
    if (!event) return
    this.begin(COLORS.amber)
    const p = this.panel
    const pad = this.deviceClass === 'wide' ? 26 : 16
    const perPage = this.deviceClass === 'wide' ? 6 : 4
    const pageCount = Math.max(1, Math.ceil(options.length / perPage))
    this.page = Math.min(this.page, pageCount - 1)
    const visible = options.slice(this.page * perPage, (this.page + 1) * perPage)

    const kicker = pixelText(this.scene, '対策会議・判断を求められている', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.cyan,
    })
    kicker.setPosition(p.x + pad, p.y + pad)
    this.content.add(kicker)

    const title = pixelText(this.scene, event.name, {
      fontSize: this.deviceClass === 'wide' ? 28 : TEXT_SIZE.heading,
      color: COLORS.gold,
      wordWrapWidth: p.width - pad * 2,
    })
    title.setPosition(p.x + pad, p.y + pad + 28)
    this.content.add(title)

    if (this.deviceClass === 'wide') this.renderWide(event.desc, event.id, visible, pageCount)
    else this.renderNarrow(event.desc, event.id, visible, pageCount)
  }

  private renderWide(
    desc: string | undefined,
    eventId: string,
    options: ChoiceOption[],
    pageCount: number,
  ): void {
    const p = this.panel
    const pad = 26
    const leftW = Math.min(360, Math.floor(p.width * 0.32))
    const artX = p.x + pad
    const artY = p.y + 92
    const artH = 210
    this.drawArtFrame(artX, artY, leftW, artH, COLORS.amber)
    drawArtSlot(this.scene, this.content, 'event', eventId, artX + leftW / 2, artY + artH / 2, {
      width: leftW - 16,
      height: artH - 16,
      glyphSize: 68,
      fallbackGlyph: '？',
    })
    const descText = pixelText(this.scene, desc ?? '町の今後を左右する判断です。', {
      fontSize: TEXT_SIZE.bodyWide,
      color: COLORS.inkDim,
      wordWrapWidth: leftW,
    })
    descText.setPosition(artX, artY + artH + 18)
    this.content.add(descText)

    const gridX = artX + leftW + 30
    const gridW = p.x + p.width - pad - gridX
    const gap = 12
    const cardW = (gridW - gap) / 2
    const cardH = 104
    options.forEach((option, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const card = new ChoiceCard(this.scene, option, cardW, cardH, () =>
        this.callbacks.onChoose(option.id),
      )
      card.setPosition(gridX + col * (cardW + gap), artY + row * (cardH + gap))
      this.content.add(card)
    })
    this.addPager(p.x + p.width - pad, p.y + p.height - pad, pageCount)
  }

  private renderNarrow(
    desc: string | undefined,
    eventId: string,
    options: ChoiceOption[],
    pageCount: number,
  ): void {
    const p = this.panel
    const pad = 16
    const artW = 118
    const artH = 88
    const artX = p.x + pad
    const artY = p.y + 88
    this.drawArtFrame(artX, artY, artW, artH, COLORS.amber)
    drawArtSlot(this.scene, this.content, 'event', eventId, artX + artW / 2, artY + artH / 2, {
      width: artW - 12,
      height: artH - 12,
      glyphSize: 40,
      fallbackGlyph: '？',
    })
    const descText = pixelText(this.scene, desc ?? '町の今後を左右する判断です。', {
      fontSize: TEXT_SIZE.bodyNarrow,
      color: COLORS.inkDim,
      wordWrapWidth: p.width - artW - pad * 3,
    })
    descText.setPosition(artX + artW + 14, artY + 4)
    this.content.add(descText)

    const listY = artY + artH + 14
    const cardW = p.width - pad * 2
    const cardH = 92
    options.forEach((option, index) => {
      const card = new ChoiceCard(this.scene, option, cardW, cardH, () =>
        this.callbacks.onChoose(option.id),
      )
      card.setPosition(p.x + pad, listY + index * (cardH + 10))
      this.content.add(card)
    })
    this.addPager(p.x + p.width - pad, p.y + p.height - pad, pageCount)
  }

  private addPager(right: number, bottom: number, pageCount: number): void {
    if (pageCount <= 1) return
    const label = pixelText(this.scene, `${this.page + 1} / ${pageCount}`, {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.inkDim,
    })
    label.setOrigin(1, 0.5)
    label.setPosition(right - 96, bottom - 20)
    this.content.add(label)

    const prev = new PixelButton(this.scene, {
      label: '◀',
      width: 42,
      height: 36,
      variant: 'quiet',
      onAction: () => {
        if (this.page <= 0) return
        this.page--
        if (this.currentState) this.show(this.currentState)
      },
    })
    const next = new PixelButton(this.scene, {
      label: '▶',
      width: 42,
      height: 36,
      variant: 'quiet',
      onAction: () => {
        if (this.page >= pageCount - 1) return
        this.page++
        if (this.currentState) this.show(this.currentState)
      },
    })
    prev.setEnabled(this.page > 0)
    next.setEnabled(this.page < pageCount - 1)
    prev.setPosition(right - 68, bottom - 20)
    next.setPosition(right - 20, bottom - 20)
    this.content.add([prev, next])
  }

  override hide(): void {
    this.currentState = null
    super.hide()
  }
}
