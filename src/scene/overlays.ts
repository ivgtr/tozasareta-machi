import Phaser from 'phaser'
import type { Aptitude, Ending, GameState } from '../game/types'
import { BALANCE } from '../game/data/balance'
import { TRAITS } from '../game/traits'
import { APTITUDE_LABEL } from '../game/data/units'
import { choiceOptions, findEvent } from '../game/events'
import { EXPEDITION_RETURN_SOURCE } from '../game/settlement'
import { artSpec } from './art/manifest'
import { textureKey } from './art/assets'
import { COLORS, SPACING, TEXT_SIZE, colorNum, fitSize } from './tokens'
import { ModalCard } from './ui/modal-card'
import { PixelButton } from './ui/button'
import { TextStack } from './ui/text-stack'
import { pixelText } from './ui/pixel-text'
import type { Beat } from './playback/beats'

const APTS: Aptitude[] = ['labor', 'tech', 'medical', 'charm']
const APT_COLOR: Record<Aptitude, number> = {
  labor: COLORS.amber,
  tech: COLORS.cyan,
  medical: COLORS.green,
  charm: COLORS.gold,
}

const ENDING_FLAVOR: Record<Ending, string> = {
  full_recovery: '町は光を取り戻した。あなたの30日間は、奇跡として語り継がれるだろう。',
  managed_sacrifice: '町は存続した。だが、その代償は決して小さくなかった。',
  self_governance: '復旧は遅れた。だが町は、何にも代えがたい結びつきを手に入れた。',
  collapse: '町は静まり返った。あなたの30日間は、途中で途絶えた。',
}

export interface OverlayContext {
  state: GameState
  busy: boolean
  beat: Beat | undefined
}

export interface OverlayCallbacks {
  onConfirm: () => void
  onChoose: (optionId: string) => void
  onEndingRestart: () => void
  onEndingTitle: () => void
}

export class OverlayStack extends ModalCard {
  private readonly callbacks: OverlayCallbacks

  constructor(scene: Phaser.Scene, callbacks: OverlayCallbacks) {
    super(scene)
    this.callbacks = callbacks
  }

  update(ctx: OverlayContext): void {
    this.content.removeAll(true)
    const { width, height } = this.scene.scale.gameSize
    if (ctx.beat?.kind === 'event') {
      this.showCard()
      this.drawEvent(
        ctx.beat.id,
        ctx.beat.effects.map((e) => e.reason),
        width,
        height,
      )
      return
    }
    if (ctx.beat?.kind === 'arrival') {
      this.showCard()
      this.drawArrival(ctx, width, height)
      return
    }
    if (!ctx.busy && ctx.state.phase === 'choice' && ctx.state.pendingChoice) {
      this.showCard()
      this.drawChoice(ctx.state, width, height)
      return
    }
    if (!ctx.busy && ctx.state.phase === 'ended' && ctx.state.ending) {
      this.showCard()
      this.drawEnding(ctx.state, width, height)
      return
    }
    this.hideCard()
  }

  private addArt(
    host: Phaser.GameObjects.Container,
    kind: 'event' | 'ending',
    id: string,
    x: number,
    y: number,
  ): void {
    const key = textureKey(kind, id)
    if (this.scene.textures.exists(key)) {
      const img = this.scene.add.image(x + 128, y + 80, key)
      img.setDisplaySize(256, 160)
      host.add(img)
    } else {
      const spec = artSpec(kind, id)
      const g = this.scene.add.graphics()
      g.fillStyle(spec ? colorNum(spec.color) : COLORS.inkDim, 0.2)
      g.fillRect(x, y, 256, 160)
      g.lineStyle(2, spec ? colorNum(spec.color) : COLORS.inkDim)
      g.strokeRect(x + 1, y + 1, 254, 158)
      host.add(g)
      const glyph = pixelText(this.scene, spec?.glyph ?? '？', {
        fontSize: 48,
        color: spec ? colorNum(spec.color) : COLORS.inkDim,
      })
      glyph.setPosition(x + 128, y + 70)
      glyph.setOrigin(0.5)
      host.add(glyph)
      const stamp = pixelText(this.scene, spec?.label ?? id, {
        fontSize: TEXT_SIZE.labelWide,
        color: COLORS.inkDim,
      })
      stamp.setPosition(x + 128, y + 130)
      stamp.setOrigin(0.5)
      host.add(stamp)
    }
  }

  private drawEvent(id: string, reasons: string[], width: number, height: number): void {
    const d = this.content
    const inset = this.contentInset
    const contentW = this.begin(width, height)
    const cardW = this.cardW
    const spec = artSpec('event', id)
    this.addArt(d, 'event', id, (cardW - 256) / 2, inset)
    const stack = new TextStack(inset, inset + 176)
    stack.add(this.scene, d, spec?.label ?? id, {
      fontSize: TEXT_SIZE.heading,
      color: COLORS.gold,
      wrapWidth: contentW,
    })
    stack.advance(6)
    for (const r of reasons) {
      stack.add(this.scene, d, r, {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.ink,
        wrapWidth: contentW,
      })
    }
    this.finish(height, stack.bottom, 44 + SPACING.lg)
    const btn = new PixelButton(this.scene, {
      label: '続ける',
      width: 140,
      height: 44,
      primary: true,
      onAction: this.callbacks.onConfirm,
    })
    btn.setPosition(cardW / 2, this.cardH - 40)
    d.add(btn)
  }

  private drawArrival(ctx: OverlayContext, width: number, height: number): void {
    const d = this.content
    const beat = ctx.beat
    if (!beat || beat.kind !== 'arrival') return
    const unit = ctx.state.units.find((u) => u.id === beat.unitId)
    if (!unit) return
    const returning = beat.effects.some((e) => e.source === EXPEDITION_RETURN_SOURCE)
    const kicker = returning ? '探索から帰還した' : '新たな仲間が辿り着いた'
    const unique = unit.unique === true
    const inset = this.contentInset
    const contentW = this.begin(width, height)
    const cardW = this.cardW
    const kick = pixelText(this.scene, kicker, {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.cyan,
    })
    kick.setPosition(inset, inset)
    d.add(kick)
    const key = textureKey('portrait', unit.portrait)
    const px = inset + 48
    const boxW = unique ? 96 : 64
    const boxH = unique ? 128 : 85
    if (this.scene.textures.exists(key)) {
      const img = this.scene.add.image(px, inset + 90, key)
      const src = img.texture.getSourceImage() as { width: number; height: number }
      const fit = fitSize(src.width, src.height, boxW, boxH)
      img.setDisplaySize(fit.width, fit.height)
      img.setPosition(px, inset + 90 + (boxH - fit.height) / 2)
      d.add(img)
    } else {
      const spec = artSpec('portrait', unit.portrait)
      const glyph = pixelText(this.scene, spec?.glyph ?? '人', {
        fontSize: unique ? 48 : 32,
        color: spec ? colorNum(spec.color) : COLORS.inkDim,
      })
      glyph.setPosition(px, inset + 90)
      glyph.setOrigin(0.5)
      d.add(glyph)
    }
    const name = pixelText(this.scene, unit.name, {
      fontSize: TEXT_SIZE.heading,
      color: COLORS.gold,
      wordWrapWidth: contentW - 140,
    })
    name.setPosition(inset + 120, inset + 40)
    d.add(name)
    let y = inset + 76
    if (unique && unit.alias) {
      const alias = pixelText(this.scene, `二つ名: ${unit.alias}`, {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.inkDim,
        wordWrapWidth: contentW - 140,
      })
      alias.setPosition(inset + 120, y)
      d.add(alias)
      y += 28
    }
    if (unique) {
      for (const a of APTS) {
        const row = pixelText(this.scene, `${APTITUDE_LABEL[a]} ${unit.apt[a]}`, {
          fontSize: TEXT_SIZE.bodyWide,
          color: APT_COLOR[a],
        })
        row.setPosition(inset + 120, y)
        d.add(row)
        y += 24
      }
    } else {
      const inline = pixelText(
        this.scene,
        APTS.map((a) => `${APTITUDE_LABEL[a].slice(0, 1)}${unit.apt[a]}`).join(' '),
        { fontSize: TEXT_SIZE.bodyWide, color: COLORS.ink },
      )
      inline.setPosition(inset + 120, y)
      d.add(inline)
      y += 24
    }
    const traitsFlavor = new TextStack(inset, y)
    if (unique && unit.traits.length > 0) {
      traitsFlavor.add(
        this.scene,
        d,
        unit.traits.map((t) => `${TRAITS[t].name}: ${TRAITS[t].desc}`).join(' / '),
        { fontSize: TEXT_SIZE.labelWide, color: COLORS.inkDim, wrapWidth: contentW, gap: 12 },
      )
    }
    if (unique && unit.flavor) {
      traitsFlavor.add(this.scene, d, unit.flavor, {
        fontSize: TEXT_SIZE.labelWide,
        color: COLORS.inkDim,
        wrapWidth: contentW,
      })
    }
    const bottom = Math.max(traitsFlavor.bottom + 8, inset + 40 + boxH)
    this.finish(height, bottom, 44 + SPACING.lg)
    const btn = new PixelButton(this.scene, {
      label: returning ? '続ける' : unique ? '迎え入れる' : '続ける',
      width: 160,
      height: 44,
      primary: true,
      onAction: this.callbacks.onConfirm,
    })
    btn.setPosition(cardW / 2, this.cardH - 40)
    d.add(btn)
  }

  private drawChoice(state: GameState, width: number, height: number): void {
    const d = this.content
    const pending = state.pendingChoice
    if (!pending) return
    const event = findEvent(pending.eventId)
    if (!event) return
    const options = choiceOptions(state, event).filter((o) => pending.optionIds.includes(o.id))
    const inset = this.contentInset
    const contentW = this.begin(width, height)
    const cardW = this.cardW
    const kick = pixelText(this.scene, '判断を求められている', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.cyan,
    })
    kick.setPosition(inset, inset)
    d.add(kick)
    this.addArt(d, 'event', event.id, (cardW - 256) / 2, inset + 24)
    const stack = new TextStack(inset, inset + 196)
    stack.add(this.scene, d, event.name, {
      fontSize: TEXT_SIZE.heading,
      color: COLORS.gold,
      wrapWidth: contentW,
    })
    if (event.desc) {
      stack.add(this.scene, d, event.desc, {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.inkDim,
        wrapWidth: contentW,
      })
    }
    for (const o of options) {
      const label = o.desc ? `${o.label} — ${o.desc}` : o.label
      const btn = new PixelButton(this.scene, {
        label,
        width: contentW,
        height: 44,
        fontSize: TEXT_SIZE.labelWide,
        wordWrapWidth: contentW - 20,
        onAction: () => this.callbacks.onChoose(o.id),
      })
      stack.advance(10)
      btn.setPosition(cardW / 2, stack.bottom + btn.buttonHeight / 2)
      d.add(btn)
      stack.advance(btn.buttonHeight)
    }
    this.finish(height, stack.bottom, 16)
  }

  private drawEnding(state: GameState, width: number, height: number): void {
    const d = this.content
    const ending = state.ending
    if (!ending) return
    const spec = artSpec('ending', ending)
    const inset = this.contentInset
    const contentW = this.begin(width, height)
    const cardW = this.cardW
    this.addArt(d, 'ending', ending, (cardW - 256) / 2, inset)
    const stack = new TextStack(inset, inset + 176)
    stack.add(this.scene, d, spec?.label ?? ending, {
      fontSize: TEXT_SIZE.heading + 4,
      color: COLORS.gold,
      wrapWidth: contentW,
    })
    stack.advance(4)
    stack.add(this.scene, d, ENDING_FLAVOR[ending], {
      fontSize: TEXT_SIZE.bodyWide,
      color: COLORS.ink,
      wrapWidth: contentW,
    })
    const reached = Math.min(state.day - 1, BALANCE.days)
    stack.add(
      this.scene,
      d,
      `到達 第${reached}日 ／ 犠牲者 ${state.flags.casualties} ／ 協力 ${state.flags.cooperation}`,
      { fontSize: TEXT_SIZE.labelWide, color: COLORS.inkDim },
    )
    this.finish(height, stack.bottom, 44 + SPACING.lg)
    const restart = new PixelButton(this.scene, {
      label: 'もう一度',
      width: 150,
      height: 44,
      primary: true,
      onAction: this.callbacks.onEndingRestart,
    })
    restart.setPosition(cardW / 2 - 90, this.cardH - 60)
    const toTitle = new PixelButton(this.scene, {
      label: 'タイトルへ',
      width: 150,
      height: 44,
      onAction: this.callbacks.onEndingTitle,
    })
    toTitle.setPosition(cardW / 2 + 80, this.cardH - 60)
    d.add([restart, toTitle])
  }
}
