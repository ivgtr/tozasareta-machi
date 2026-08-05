import Phaser from 'phaser'
import type { Aptitude, Ending, GameState } from '../game/types'
import { BALANCE } from '../game/data/balance'
import { TRAITS } from '../game/traits'
import { APTITUDE_LABEL } from '../game/data/units'
import { choiceOptions, findEvent } from '../game/events'
import { EXPEDITION_RETURN_SOURCE } from '../game/settlement'
import { artSpec } from './art/manifest'
import { textureKey } from './art/assets'
import { COLORS, PANEL_CONTENT_INSET, SPACING, TEXT_SIZE, colorNum } from './tokens'
import { PixelButton } from './ui/button'
import { PixelPanel } from './ui/panel'
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

export class OverlayStack extends Phaser.GameObjects.Container {
  private readonly dim: Phaser.GameObjects.Rectangle
  private readonly panel: PixelPanel
  private readonly dynamic: Phaser.GameObjects.Container
  private readonly callbacks: OverlayCallbacks
  private cardW = 560
  private cardH = 560

  constructor(scene: Phaser.Scene, callbacks: OverlayCallbacks) {
    super(scene)
    this.callbacks = callbacks
    this.dim = scene.add.rectangle(0, 0, 2000, 1200, COLORS.night900, 0.75)
    this.dim.setOrigin(0)
    this.dim.setInteractive()
    this.panel = new PixelPanel(scene, 560, 560)
    this.dynamic = scene.add.container()
    this.add([this.dim, this.panel, this.dynamic])
    this.setVisible(false)
    scene.add.existing(this)
  }

  update(ctx: OverlayContext): void {
    const d = this.dynamic
    d.removeAll(true)
    const { width, height } = this.scene.scale.gameSize
    if (ctx.beat?.kind === 'event') {
      this.setVisible(true)
      this.layoutCard(width, height, 560)
      this.drawEvent(
        ctx.beat.id,
        ctx.beat.effects.map((e) => e.reason),
      )
      return
    }
    if (ctx.beat?.kind === 'arrival') {
      this.setVisible(true)
      this.layoutCard(width, height, 620)
      this.drawArrival(ctx)
      return
    }
    if (!ctx.busy && ctx.state.phase === 'choice' && ctx.state.pendingChoice) {
      this.setVisible(true)
      this.layoutCard(width, height, 640)
      this.drawChoice(ctx.state)
      return
    }
    if (!ctx.busy && ctx.state.phase === 'ended' && ctx.state.ending) {
      this.setVisible(true)
      this.layoutCard(width, height, 620)
      this.drawEnding(ctx.state)
      return
    }
    this.setVisible(false)
  }

  private layoutCard(width: number, height: number, cardH: number): void {
    this.cardH = cardH
    const cardW = Math.min(560, width - SPACING.lg * 2)
    this.cardW = cardW
    this.panel.setPanelSize(cardW, cardH)
    this.panel.setPosition((width - cardW) / 2, (height - cardH) / 2)
    this.dynamic.setPosition((width - cardW) / 2, (height - cardH) / 2)
    this.dim.setSize(width + 4, height + 4)
    this.dim.setPosition(-2, -2)
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

  private drawEvent(id: string, reasons: string[]): void {
    const spec = artSpec('event', id)
    const inset = PANEL_CONTENT_INSET
    this.addArt(this.dynamic, 'event', id, (this.cardW - 256) / 2, inset)
    const title = pixelText(this.scene, spec?.label ?? id, {
      fontSize: TEXT_SIZE.heading,
      color: COLORS.gold,
    })
    title.setPosition(inset, inset + 176)
    this.dynamic.add(title)
    let y = inset + 208
    for (const r of reasons) {
      const line = pixelText(this.scene, r, {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.ink,
        wordWrapWidth: 500,
      })
      line.setPosition(inset, y)
      this.dynamic.add(line)
      y += line.height + 6
    }
    const btn = new PixelButton(this.scene, {
      label: '続ける',
      width: 140,
      height: 44,
      primary: true,
      onAction: this.callbacks.onConfirm,
    })
    btn.setPosition(this.cardW / 2, this.cardH - 40)
    this.dynamic.add(btn)
  }

  private drawArrival(ctx: OverlayContext): void {
    const beat = ctx.beat
    if (!beat || beat.kind !== 'arrival') return
    const unit = ctx.state.units.find((u) => u.id === beat.unitId)
    if (!unit) return
    const returning = beat.effects.some((e) => e.source === EXPEDITION_RETURN_SOURCE)
    const kicker = returning ? '探索から帰還した' : '新たな仲間が辿り着いた'
    const unique = unit.unique === true
    const inset = PANEL_CONTENT_INSET
    const kick = pixelText(this.scene, kicker, {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.cyan,
    })
    kick.setPosition(inset, inset)
    this.dynamic.add(kick)
    const key = textureKey('portrait', unit.portrait)
    const px = inset + 48
    if (this.scene.textures.exists(key)) {
      const img = this.scene.add.image(px, inset + 90, key)
      img.setDisplaySize(unique ? 96 : 64, unique ? 128 : 85)
      this.dynamic.add(img)
    } else {
      const spec = artSpec('portrait', unit.portrait)
      const glyph = pixelText(this.scene, spec?.glyph ?? '人', {
        fontSize: unique ? 48 : 32,
        color: spec ? colorNum(spec.color) : COLORS.inkDim,
      })
      glyph.setPosition(px, inset + 90)
      glyph.setOrigin(0.5)
      this.dynamic.add(glyph)
    }
    const name = pixelText(this.scene, unit.name, {
      fontSize: TEXT_SIZE.heading,
      color: COLORS.gold,
    })
    name.setPosition(inset + 120, inset + 40)
    this.dynamic.add(name)
    let y = inset + 76
    if (unique && unit.alias) {
      const alias = pixelText(this.scene, `二つ名: ${unit.alias}`, {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.inkDim,
      })
      alias.setPosition(inset + 120, y)
      this.dynamic.add(alias)
      y += 28
    }
    if (unique) {
      for (const a of APTS) {
        const row = pixelText(this.scene, `${APTITUDE_LABEL[a]} ${unit.apt[a]}`, {
          fontSize: TEXT_SIZE.bodyWide,
          color: APT_COLOR[a],
        })
        row.setPosition(inset + 120, y)
        this.dynamic.add(row)
        y += 24
      }
    } else {
      const inline = pixelText(
        this.scene,
        APTS.map((a) => `${APTITUDE_LABEL[a].slice(0, 1)}${unit.apt[a]}`).join(' '),
        { fontSize: TEXT_SIZE.bodyWide, color: COLORS.ink },
      )
      inline.setPosition(inset + 120, y)
      this.dynamic.add(inline)
      y += 24
    }
    if (unique && unit.traits.length > 0) {
      const traits = pixelText(
        this.scene,
        unit.traits.map((t) => `${TRAITS[t].name}: ${TRAITS[t].desc}`).join(' / '),
        { fontSize: TEXT_SIZE.labelWide, color: COLORS.inkDim, wordWrapWidth: 480 },
      )
      traits.setPosition(inset, y + 12)
      this.dynamic.add(traits)
      y += traits.height + 20
    }
    if (unique && unit.flavor) {
      const flavor = pixelText(this.scene, unit.flavor, {
        fontSize: TEXT_SIZE.labelWide,
        color: COLORS.inkDim,
        wordWrapWidth: 480,
      })
      flavor.setPosition(inset, y + 8)
      this.dynamic.add(flavor)
    }
    const btn = new PixelButton(this.scene, {
      label: returning ? '続ける' : unique ? '迎え入れる' : '続ける',
      width: 160,
      height: 44,
      primary: true,
      onAction: this.callbacks.onConfirm,
    })
    btn.setPosition(this.cardW / 2, this.cardH - 40)
    this.dynamic.add(btn)
  }

  private drawChoice(state: GameState): void {
    const pending = state.pendingChoice
    if (!pending) return
    const event = findEvent(pending.eventId)
    if (!event) return
    const options = choiceOptions(state, event).filter((o) => pending.optionIds.includes(o.id))
    const inset = PANEL_CONTENT_INSET
    const kick = pixelText(this.scene, '判断を求められている', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.cyan,
    })
    kick.setPosition(inset, inset)
    this.dynamic.add(kick)
    this.addArt(this.dynamic, 'event', event.id, (this.cardW - 256) / 2, inset + 24)
    const name = pixelText(this.scene, event.name, {
      fontSize: TEXT_SIZE.heading,
      color: COLORS.gold,
    })
    name.setPosition(inset, inset + 196)
    this.dynamic.add(name)
    let y = inset + 228
    if (event.desc) {
      const desc = pixelText(this.scene, event.desc, {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.inkDim,
        wordWrapWidth: 500,
      })
      desc.setPosition(inset, y)
      this.dynamic.add(desc)
      y += desc.height + 10
    }
    for (const o of options) {
      const label = o.desc ? `${o.label} — ${o.desc}` : o.label
      const btn = new PixelButton(this.scene, {
        label,
        width: Math.min(500, this.cardW - inset * 2),
        height: 44,
        fontSize: TEXT_SIZE.labelWide,
        onAction: () => this.callbacks.onChoose(o.id),
      })
      btn.setPosition(this.cardW / 2, y + 22)
      this.dynamic.add(btn)
      y += 54
    }
  }

  private drawEnding(state: GameState): void {
    const ending = state.ending
    if (!ending) return
    const spec = artSpec('ending', ending)
    const inset = PANEL_CONTENT_INSET
    this.addArt(this.dynamic, 'ending', ending, (this.cardW - 256) / 2, inset)
    const title = pixelText(this.scene, spec?.label ?? ending, {
      fontSize: TEXT_SIZE.heading + 4,
      color: COLORS.gold,
    })
    title.setPosition(inset, inset + 176)
    this.dynamic.add(title)
    const flavor = pixelText(this.scene, ENDING_FLAVOR[ending], {
      fontSize: TEXT_SIZE.bodyWide,
      color: COLORS.ink,
      wordWrapWidth: 500,
    })
    flavor.setPosition(inset, inset + 210)
    this.dynamic.add(flavor)
    const reached = Math.min(state.day - 1, BALANCE.days)
    const stats = pixelText(
      this.scene,
      `到達 第${reached}日 ／ 犠牲者 ${state.flags.casualties} ／ 協力 ${state.flags.cooperation}`,
      { fontSize: TEXT_SIZE.labelWide, color: COLORS.inkDim },
    )
    stats.setPosition(inset, inset + 260)
    this.dynamic.add(stats)
    const restart = new PixelButton(this.scene, {
      label: 'もう一度',
      width: 150,
      height: 44,
      primary: true,
      onAction: this.callbacks.onEndingRestart,
    })
    restart.setPosition(this.cardW / 2 - 90, this.cardH - 60)
    const toTitle = new PixelButton(this.scene, {
      label: 'タイトルへ',
      width: 150,
      height: 44,
      onAction: this.callbacks.onEndingTitle,
    })
    toTitle.setPosition(this.cardW / 2 + 80, this.cardH - 60)
    this.dynamic.add([restart, toTitle])
  }
}
