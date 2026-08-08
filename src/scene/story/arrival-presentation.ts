import Phaser from 'phaser'
import type { Aptitude, GameState, Unit } from '../../game/types'
import { APTITUDE_LABEL } from '../../game/data/units'
import { TRAITS } from '../../game/traits'
import { EXPEDITION_RETURN_SOURCE } from '../../game/settlement'
import { formatDelta } from '../labels'
import type { Beat } from '../playback/beats'
import { COLORS, TEXT_SIZE } from '../tokens'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { PresentationSurface } from './presentation-surface'

const APTS: Aptitude[] = ['labor', 'tech', 'medical', 'charm']
const APT_COLOR: Record<Aptitude, number> = {
  labor: COLORS.amber,
  tech: COLORS.cyan,
  medical: COLORS.green,
  charm: COLORS.gold,
}

export interface ArrivalPresentationCallbacks {
  onConfirm: () => void
}

export class ArrivalPresentation extends PresentationSurface {
  private readonly callbacks: ArrivalPresentationCallbacks

  constructor(scene: Phaser.Scene, callbacks: ArrivalPresentationCallbacks) {
    super(scene)
    this.callbacks = callbacks
  }

  show(state: GameState, beat: Extract<Beat, { kind: 'arrival' }>): void {
    const unit = state.units.find((candidate) => candidate.id === beat.unitId)
    if (!unit) {
      this.hide()
      return
    }
    const returning = beat.effects.some((effect) => effect.source === EXPEDITION_RETURN_SOURCE)
    this.begin(returning ? COLORS.cyan : COLORS.gold)
    if (this.deviceClass === 'wide') this.renderWide(unit, returning, beat)
    else this.renderNarrow(unit, returning, beat)
  }

  private renderWide(
    unit: Unit,
    returning: boolean,
    beat: Extract<Beat, { kind: 'arrival' }>,
  ): void {
    const p = this.panel
    const pad = 30
    const portraitW = unit.unique ? 286 : 240
    const portraitH = unit.unique ? 382 : 320
    const portraitX = p.x + pad + portraitW / 2
    const portraitY = p.y + 80 + portraitH / 2
    drawArtSlot(this.scene, this.content, 'portrait', unit.portrait, portraitX, portraitY, {
      width: portraitW,
      height: portraitH,
      glyphSize: 100,
      fallbackGlyph: '人',
    })

    const infoX = p.x + pad + portraitW + 46
    const infoW = p.x + p.width - pad - infoX
    this.renderIdentity(unit, returning, infoX, p.y + 56, infoW, false)
    this.renderStats(unit, infoX, p.y + 186, infoW)
    this.renderNarrative(unit, infoX, p.y + 328, infoW)
    this.renderResults(beat, infoX, p.y + 446, infoW)
    this.addConfirm(returning ? '町へ戻る ▶' : unit.unique ? '迎え入れる ▶' : '続ける ▶')
  }

  private renderNarrow(
    unit: Unit,
    returning: boolean,
    beat: Extract<Beat, { kind: 'arrival' }>,
  ): void {
    const p = this.panel
    const portraitW = unit.unique ? 166 : 140
    const portraitH = unit.unique ? 222 : 188
    const portraitX = p.x + 20 + portraitW / 2
    const portraitY = p.y + 72 + portraitH / 2
    drawArtSlot(this.scene, this.content, 'portrait', unit.portrait, portraitX, portraitY, {
      width: portraitW,
      height: portraitH,
      glyphSize: 64,
      fallbackGlyph: '人',
    })
    const infoX = p.x + 20 + portraitW + 18
    const infoW = p.x + p.width - 18 - infoX
    this.renderIdentity(unit, returning, infoX, p.y + 60, infoW, true)
    this.renderStats(unit, p.x + 20, p.y + 310, p.width - 40)
    this.renderNarrative(unit, p.x + 20, p.y + 448, p.width - 40)
    this.renderResults(beat, p.x + 20, p.y + 570, p.width - 40)
    this.addConfirm(returning ? '町へ戻る ▶' : unit.unique ? '迎え入れる ▶' : '続ける ▶')
  }

  private renderIdentity(
    unit: Unit,
    returning: boolean,
    x: number,
    y: number,
    width: number,
    compact: boolean,
  ): void {
    const kicker = pixelText(
      this.scene,
      returning
        ? '町の入口・探索から帰還'
        : unit.unique
          ? '町の入口・特別な人物との出会い'
          : '町の入口・新たな住民との出会い',
      {
        fontSize: compact ? TEXT_SIZE.labelNarrow : TEXT_SIZE.labelWide,
        color: returning ? COLORS.cyan : COLORS.gold,
        wordWrapWidth: width,
      },
    )
    kicker.setPosition(x, y)
    this.content.add(kicker)

    const name = pixelText(this.scene, unit.name, {
      fontSize: compact ? TEXT_SIZE.heading : 30,
      color: COLORS.ink,
      wordWrapWidth: width,
    })
    name.setPosition(x, y + 32)
    this.content.add(name)

    const alias = pixelText(
      this.scene,
      unit.alias ?? (unit.unique ? '町の中核を担う人物' : '新たな住民'),
      {
        fontSize: compact ? TEXT_SIZE.labelWide : TEXT_SIZE.bodyWide,
        color: COLORS.inkDim,
        wordWrapWidth: width,
      },
    )
    alias.setPosition(x, y + 72)
    this.content.add(alias)
  }

  private renderStats(unit: Unit, x: number, y: number, width: number): void {
    const gap = 8
    const cellW = (width - gap) / 2
    APTS.forEach((aptitude, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const g = this.scene.add.graphics()
      const cx = x + col * (cellW + gap)
      const cy = y + row * 54
      g.fillStyle(COLORS.night800)
      g.fillRect(cx, cy, cellW, 46)
      g.fillStyle(APT_COLOR[aptitude])
      g.fillRect(cx, cy, 5, 46)
      this.content.add(g)
      const label = pixelText(this.scene, `${APTITUDE_LABEL[aptitude]} ${unit.apt[aptitude]}`, {
        fontSize: TEXT_SIZE.bodyWide,
        color: APT_COLOR[aptitude],
      })
      label.setPosition(cx + 14, cy + 12)
      this.content.add(label)
    })
  }

  private renderNarrative(unit: Unit, x: number, y: number, width: number): void {
    if (unit.traits.length > 0) {
      const traitText = unit.traits
        .slice(0, 2)
        .map((trait) => `${TRAITS[trait].name}: ${TRAITS[trait].desc}`)
        .join(' ／ ')
      const traits = pixelText(this.scene, traitText, {
        fontSize: TEXT_SIZE.labelWide,
        color: COLORS.ink,
        wordWrapWidth: width,
      })
      traits.setPosition(x, y)
      this.content.add(traits)
      y += traits.height + 14
    }
    if (unit.flavor) {
      const flavor = pixelText(this.scene, `「${unit.flavor}」`, {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.inkDim,
        wordWrapWidth: width,
      })
      flavor.setPosition(x, y)
      this.content.add(flavor)
    }
  }

  private renderResults(
    beat: Extract<Beat, { kind: 'arrival' }>,
    x: number,
    y: number,
    width: number,
  ): void {
    const numeric = beat.effects.filter((effect) => effect.delta !== 0)
    if (numeric.length === 0) return
    const heading = pixelText(this.scene, 'この人物がもたらした変化', {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
    })
    heading.setPosition(x, y)
    this.content.add(heading)
    let chipX = x
    for (const effect of numeric) {
      const chip = pixelText(this.scene, formatDelta(effect.target, effect.delta), {
        fontSize: TEXT_SIZE.labelWide,
        color: effect.delta > 0 ? COLORS.green : COLORS.red,
        backgroundColor: '#131740',
      })
      chip.setPadding(7, 5, 7, 5)
      if (chipX + chip.width > x + width) break
      chip.setPosition(chipX, y + 24)
      this.content.add(chip)
      chipX += chip.width + 8
    }
  }

  private addConfirm(label: string): void {
    const p = this.panel
    const btn = new PixelButton(this.scene, {
      label,
      width: this.deviceClass === 'wide' ? 190 : 160,
      height: 48,
      variant: 'primary',
      onAction: this.callbacks.onConfirm,
    })
    btn.setPosition(
      p.x + p.width - 28 - btn.buttonWidth / 2,
      p.y + p.height - 28 - btn.buttonHeight / 2,
    )
    this.content.add(btn)
  }
}
