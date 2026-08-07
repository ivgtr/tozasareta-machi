import Phaser from 'phaser'
import type { Ending, GameState } from '../../game/types'
import { BALANCE } from '../../game/data/balance'
import { artSpec } from '../art/manifest'
import { COLORS, TEXT_SIZE } from '../tokens'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { PresentationSurface } from './presentation-surface'

const ENDING_FLAVOR: Record<Ending, string> = {
  full_recovery: '町は光を取り戻した。あなたの30日間は、奇跡として語り継がれるだろう。',
  managed_sacrifice: '町は存続した。だが、その代償は決して小さくなかった。',
  self_governance: '復旧は遅れた。だが町は、何にも代えがたい結びつきを手に入れた。',
  collapse: '町は静まり返った。あなたの30日間は、途中で途絶えた。',
}

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
    const ending = state.ending
    if (!ending) {
      this.hide()
      return
    }
    this.begin(ending === 'collapse' ? COLORS.red : COLORS.gold)
    const p = this.panel
    const pad = this.deviceClass === 'wide' ? 30 : 18
    const artW =
      this.deviceClass === 'wide' ? Math.min(520, Math.floor(p.width * 0.46)) : p.width - pad * 2
    const artH = this.deviceClass === 'wide' ? Math.min(330, p.height - 150) : 220
    const artX = p.x + pad
    const artY = p.y + pad + 16
    this.drawArtFrame(artX, artY, artW, artH, ending === 'collapse' ? COLORS.red : COLORS.gold)
    drawArtSlot(this.scene, this.content, 'ending', ending, artX + artW / 2, artY + artH / 2, {
      width: artW - 16,
      height: artH - 16,
      glyphSize: 84,
      fallbackGlyph: '了',
    })

    const textX = this.deviceClass === 'wide' ? artX + artW + 34 : p.x + pad
    const textY = this.deviceClass === 'wide' ? artY + 12 : artY + artH + 18
    const textW = this.deviceClass === 'wide' ? p.x + p.width - pad - textX : p.width - pad * 2
    const spec = artSpec('ending', ending)
    const title = pixelText(this.scene, spec?.label ?? ending, {
      fontSize: this.deviceClass === 'wide' ? 30 : TEXT_SIZE.heading,
      color: COLORS.gold,
      wordWrapWidth: textW,
    })
    title.setPosition(textX, textY)
    this.content.add(title)
    const flavor = pixelText(this.scene, ENDING_FLAVOR[ending], {
      fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
      color: COLORS.ink,
      wordWrapWidth: textW,
    })
    flavor.setPosition(textX, textY + 54)
    this.content.add(flavor)
    const reached = Math.min(state.day - 1, BALANCE.days)
    const stats = pixelText(
      this.scene,
      `到達 第${reached}日\n犠牲者 ${state.flags.casualties}\n協力 ${state.flags.cooperation}`,
      {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.inkDim,
        wordWrapWidth: textW,
      },
    )
    stats.setPosition(textX, textY + 132)
    this.content.add(stats)

    const restart = new PixelButton(this.scene, {
      label: 'もう一度',
      width: 150,
      height: 46,
      variant: 'primary',
      onAction: this.callbacks.onRestart,
    })
    const titleButton = new PixelButton(this.scene, {
      label: 'タイトルへ',
      width: 150,
      height: 46,
      variant: 'quiet',
      onAction: this.callbacks.onTitle,
    })
    restart.setPosition(p.x + p.width - pad - 80, p.y + p.height - 36)
    titleButton.setPosition(p.x + p.width - pad - 246, p.y + p.height - 36)
    this.content.add([restart, titleButton])
  }
}
